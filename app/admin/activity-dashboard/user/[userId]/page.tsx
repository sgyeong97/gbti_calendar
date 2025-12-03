"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "next-themes";

type UserActivityData = {
	userId: string;
	userName: string;
	totalMinutes: number;
	dayCount: number;
	days: string[];
	activities: any[];
};

type DaySummary = {
	date: string;
	activityCount: number;
	totalMinutes: number;
	activities: any[];
};

type MeetingEntry = {
	userId: string;
	userName: string;
	count: number;
	meetings: Array<{
		date: string;
		channelId: string;
		channelName: string;
		activities: any[];
	}>;
};

export default function UserDetailPage() {
	const router = useRouter();
	const params = useParams();
	const { theme } = useTheme();
	const [colorTheme, setColorTheme] = useState<string>("default");
	const [loading, setLoading] = useState(false);
	const userId = params.userId as string;
	const [userData, setUserData] = useState<UserActivityData | null>(null);
	const [daySummaries, setDaySummaries] = useState<DaySummary[]>([]);
	const [meetings, setMeetings] = useState<MeetingEntry[]>([]);
	const [searchTerm, setSearchTerm] = useState<string>("");
	const [sortBy, setSortBy] = useState<"date" | "time" | "count">("date");
	const [expandedDate, setExpandedDate] = useState<string | null>(null);
	const [expandedMeetingUserId, setExpandedMeetingUserId] = useState<string | null>(null);

	useEffect(() => {
		const savedColorTheme = localStorage.getItem("gbti_color_theme") || "default";
		setColorTheme(savedColorTheme);

		const handleStorageChange = () => {
			const newColorTheme = localStorage.getItem("gbti_color_theme") || "default";
			setColorTheme(newColorTheme);
		};

		window.addEventListener("storage", handleStorageChange);
		
		const observer = new MutationObserver(() => {
			const newColorTheme = localStorage.getItem("gbti_color_theme") || "default";
			setColorTheme(newColorTheme);
		});

		const html = document.documentElement;
		observer.observe(html, { attributes: true, attributeFilter: ["class"] });

		return () => {
			window.removeEventListener("storage", handleStorageChange);
			observer.disconnect();
		};
	}, [theme]);

	useEffect(() => {
		if (userId) {
			fetchUserData();
		}
	}, [userId]);

	async function fetchUserData() {
		setLoading(true);
		try {
			// 사용자별 데이터 가져오기
			const params = new URLSearchParams({
				groupBy: "user",
				userId: userId,
			});

			const res = await fetch(`/api/discord-activity?${params}`);
			if (!res.ok) throw new Error("Failed to fetch");
			
			const result = await res.json();
			const rawData = result.data || {};
			
			// 해당 사용자 데이터 찾기
			const userData = rawData[userId] as UserActivityData;
			if (userData) {
				setUserData(userData);
				
				// 날짜별로 집계
				const dayMap = new Map<string, DaySummary>();
				for (const act of userData.activities || []) {
					const actDate = act.date || (act.startTime ? new Date(act.startTime).toISOString().split('T')[0] : "");
					if (!actDate) continue;

					const existing = dayMap.get(actDate);
					const minutes = typeof act.durationMinutes === "number" ? act.durationMinutes : 0;
					if (existing) {
						existing.activityCount += 1;
						existing.totalMinutes += minutes;
						existing.activities.push(act);
					} else {
						dayMap.set(actDate, {
							date: actDate,
							activityCount: 1,
							totalMinutes: minutes,
							activities: [act],
						});
					}
				}

				const summaries = Array.from(dayMap.values());
				setDaySummaries(summaries);

				// 만남 횟수 계산: 같은 채널에 동시에 있던 사람들
				await calculateMeetings(userData.activities || []);
			} else {
				setUserData(null);
				setDaySummaries([]);
				setMeetings([]);
			}
		} catch (err) {
			console.error("활동 데이터 로딩 실패:", err);
			alert("활동 데이터를 불러오지 못했습니다.");
		} finally {
			setLoading(false);
		}
	}

	async function calculateMeetings(activities: any[]) {
		// 모든 활동 데이터를 가져와서 같은 채널/시간대의 다른 사용자 찾기
		try {
			// 사용자의 활동 날짜 범위 계산
			const dates = new Set<string>();
			const channelIds = new Set<string>();
			for (const act of activities) {
				const actDate = act.date || (act.startTime ? new Date(act.startTime).toISOString().split('T')[0] : "");
				const actChannelId = act.channelId || act.channel_id || "";
				if (actDate) dates.add(actDate);
				if (actChannelId) channelIds.add(actChannelId);
			}

			if (dates.size === 0) {
				setMeetings([]);
				return;
			}

			const dateArray = Array.from(dates).sort();
			const startDate = dateArray[0];
			const endDate = dateArray[dateArray.length - 1];

			// 해당 기간의 모든 활동 데이터 가져오기
			const params = new URLSearchParams({
				groupBy: "day",
				startDate,
				endDate,
			});

			const res = await fetch(`/api/discord-activity?${params}`);
			if (!res.ok) {
				setMeetings([]);
				return;
			}

			const result = await res.json();
			const allActivities: any[] = [];
			for (const value of Object.values(result.data || {})) {
				if ((value as any).activities && Array.isArray((value as any).activities)) {
					allActivities.push(...(value as any).activities);
				}
			}

			// 같은 채널, 겹치는 시간대의 다른 사용자 찾기
			const meetingMap = new Map<string, MeetingEntry>();

			for (const userAct of activities) {
				const userActStart = userAct.startTime || userAct.startAt;
				const userActEnd = userAct.endTime || userAct.endAt;
				const userActChannelId = userAct.channelId || userAct.channel_id || "";
				const userActDate = userAct.date || (userActStart ? new Date(userActStart).toISOString().split('T')[0] : "");
				
				if (!userActStart || !userActEnd || !userActChannelId || !userActDate) continue;

				const userActStartTime = new Date(userActStart).getTime();
				const userActEndTime = new Date(userActEnd).getTime();

				// 같은 채널의 다른 사용자 활동 찾기
				for (const otherAct of allActivities) {
					const otherUserId = otherAct.userId || otherAct.user_id || "";
					const otherUserName = otherAct.userName || otherAct.user_name || otherUserId;
					const otherActStart = otherAct.startTime || otherAct.startAt;
					const otherActEnd = otherAct.endTime || otherAct.endAt;
					const otherActChannelId = otherAct.channelId || otherAct.channel_id || "";
					const otherActDate = otherAct.date || (otherActStart ? new Date(otherActStart).toISOString().split('T')[0] : "");

					// 같은 사용자는 제외
					if (otherUserId === userId || !otherUserId) continue;
					// 같은 채널이 아니면 제외
					if (otherActChannelId !== userActChannelId) continue;
					// 같은 날짜가 아니면 제외
					if (otherActDate !== userActDate) continue;
					// 시간이 겹치지 않으면 제외
					if (!otherActStart || !otherActEnd) continue;

					const otherActStartTime = new Date(otherActStart).getTime();
					const otherActEndTime = new Date(otherActEnd).getTime();

					// 시간 겹침 확인
					if (userActStartTime <= otherActEndTime && userActEndTime >= otherActStartTime) {
						const existing = meetingMap.get(otherUserId);
						if (existing) {
							existing.count += 1;
							// 같은 날짜/채널의 기록이 있는지 확인
							const existingMeeting = existing.meetings.find(
								m => m.date === userActDate && m.channelId === userActChannelId
							);
							if (existingMeeting) {
								existingMeeting.activities.push(otherAct);
							} else {
								existing.meetings.push({
									date: userActDate,
									channelId: userActChannelId,
									channelName: otherAct.channelName || otherAct.channel_name || userActChannelId,
									activities: [otherAct],
								});
							}
						} else {
							meetingMap.set(otherUserId, {
								userId: otherUserId,
								userName: otherUserName,
								count: 1,
								meetings: [{
									date: userActDate,
									channelId: userActChannelId,
									channelName: otherAct.channelName || otherAct.channel_name || userActChannelId,
									activities: [otherAct],
								}],
							});
						}
					}
				}
			}

			const meetingList = Array.from(meetingMap.values()).sort((a, b) => b.count - a.count);
			setMeetings(meetingList);
		} catch (err) {
			console.error("만남 횟수 계산 실패:", err);
			setMeetings([]);
		}
	}

	function formatMinutes(minutes: number): string {
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		if (hours > 0) {
			return `${hours}시간 ${mins}분`;
		}
		return `${mins}분`;
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('ko-KR', { 
			year: 'numeric', 
			month: 'long', 
			day: 'numeric',
			weekday: 'short'
		});
	}

	// 필터링 및 정렬
	const filteredAndSortedDays = daySummaries
		.filter((day) => {
			if (!searchTerm.trim()) return true;
			const term = searchTerm.toLowerCase();
			return formatDate(day.date).toLowerCase().includes(term) || day.date.includes(term);
		})
		.sort((a, b) => {
			if (sortBy === "date") {
				return b.date.localeCompare(a.date); // 최신순
			} else if (sortBy === "count") {
				return b.activityCount - a.activityCount;
			} else {
				return b.totalMinutes - a.totalMinutes;
			}
		});

	return (
		<div className="p-6 max-w-7xl mx-auto" style={{ background: "var(--background)", color: "var(--foreground)" }}>
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-semibold">사용자별 활동 상세</h1>
				<button
					className="px-4 py-2 rounded transition-colors cursor-pointer"
					style={{ 
						backgroundColor: "var(--accent)", 
						color: "var(--foreground)" 
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.background = "color-mix(in srgb, var(--accent) 80%, var(--foreground) 20%)";
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.background = "var(--accent)";
					}}
					onClick={() => router.push("/admin/activity-dashboard")}
				>
					대시보드로 돌아가기
				</button>
			</div>

			{loading ? (
				<div className="text-center py-8">로딩 중...</div>
			) : !userData ? (
				<div className="text-center py-8" style={{ color: "var(--foreground)", opacity: 0.7 }}>
					해당 사용자의 활동 데이터가 없습니다.
				</div>
			) : (
				<>
					{/* 사용자 헤더 */}
					<div 
						className="rounded-lg p-6 mb-6"
						style={{ 
							background: "var(--background)", 
							border: "1px solid var(--accent)" 
						}}
					>
						<div className="text-2xl font-bold mb-2">{userData.userName || userData.userId}</div>
						<div className="text-lg opacity-70">
							총 {formatMinutes(userData.totalMinutes)} · {userData.dayCount}일 활동
						</div>
					</div>

					{/* 검색 및 정렬 */}
					<div 
						className="rounded-lg p-4 mb-6"
						style={{ 
							background: "var(--background)", 
							border: "1px solid var(--accent)" 
						}}
					>
						<div className="flex flex-col md:flex-row gap-4 items-end">
							<div className="flex-1 min-w-[200px]">
								<label className="block text-sm mb-2">검색</label>
								<input
									type="text"
									placeholder="날짜 검색..."
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
									className="w-full border rounded px-3 py-2"
								/>
							</div>
							<div className="flex-1 min-w-[200px]">
								<label className="block text-sm mb-2">정렬 기준</label>
								<select
									value={sortBy}
									onChange={(e) => setSortBy(e.target.value as "date" | "time" | "count")}
									className="w-full border rounded px-3 py-2"
								>
									<option value="date">날짜순 (최신)</option>
									<option value="time">활동 시간순</option>
									<option value="count">활동 횟수순</option>
								</select>
							</div>
						</div>
					</div>

					{/* 날짜별 리스트 */}
					<div 
						className="rounded-lg p-6 mb-6"
						style={{ 
							background: "var(--background)", 
							border: "1px solid var(--accent)" 
						}}
					>
						<h2 className="text-lg font-semibold mb-4">날짜별 활동 ({filteredAndSortedDays.length}일)</h2>
						
						{filteredAndSortedDays.length === 0 ? (
							<div className="text-center py-8" style={{ color: "var(--foreground)", opacity: 0.7 }}>
								검색 결과가 없습니다.
							</div>
						) : (
							<div className="space-y-3">
								{filteredAndSortedDays.map((day) => {
									const isExpanded = expandedDate === day.date;
									
									return (
										<div
											key={day.date}
											className="p-4 rounded transition-colors"
											style={{ 
												border: "1px solid var(--accent)",
												background: "var(--background)"
											}}
											onMouseEnter={(e) => {
												e.currentTarget.style.background = "color-mix(in srgb, var(--background) 95%, var(--accent) 5%)";
											}}
											onMouseLeave={(e) => {
												e.currentTarget.style.background = "var(--background)";
											}}
										>
											<div 
												className="flex items-center justify-between cursor-pointer"
												onClick={() => setExpandedDate(isExpanded ? null : day.date)}
											>
												<div>
													<div className="font-medium text-lg">{formatDate(day.date)}</div>
													<div className="text-sm opacity-70">
														{day.activityCount}회 활동
													</div>
												</div>
												<div className="text-right">
													<div className="text-xl font-semibold">{formatMinutes(day.totalMinutes)}</div>
												</div>
											</div>

											{/* 상세 정보 */}
											{isExpanded && (
												<div className="mt-4 pt-4 border-t border-dashed border-zinc-700/50">
													<div className="font-medium mb-2">활동 로그</div>
													<ul className="space-y-2 max-h-96 overflow-y-auto">
														{day.activities
															.slice()
															.sort((a: any, b: any) => {
																const aTime = new Date(a.startTime || a.startAt || a.date).getTime();
																const bTime = new Date(b.startTime || b.startAt || b.date).getTime();
																return bTime - aTime;
															})
															.map((act: any) => {
																const start = act.startTime || act.startAt;
																const end = act.endTime || act.endAt;
																const startDate = start ? new Date(start) : null;
																const endDate = end ? new Date(end) : null;
																const dur = typeof act.durationMinutes === "number" ? act.durationMinutes : 0;
																
																return (
																	<li
																		key={act.id}
																		className="flex flex-col md:flex-row md:items-center md:justify-between text-xs md:text-sm py-2 border-b border-zinc-800/40 last:border-b-0"
																	>
																		<div>
																			<div className="font-medium">
																				{startDate
																					? startDate.toLocaleString("ko-KR", {
																							month: "long",
																							day: "numeric",
																							hour: "2-digit",
																							minute: "2-digit",
																					  })
																					: act.date}
																			</div>
																			<div className="opacity-70">
																				채널: {act.channelName || act.channelId || "알 수 없음"}
																			</div>
																		</div>
																		<div className="mt-1 md:mt-0 text-right md:text-right">
																			<div className="font-semibold">{formatMinutes(dur)}</div>
																			{startDate && endDate && (
																				<div className="opacity-60 text-xs">
																					{startDate.toLocaleTimeString("ko-KR", {
																						hour: "2-digit",
																						minute: "2-digit",
																					})}
																					{" ~ "}
																					{endDate.toLocaleTimeString("ko-KR", {
																						hour: "2-digit",
																						minute: "2-digit",
																					})}
																				</div>
																			)}
																		</div>
																	</li>
																);
															})}
													</ul>
												</div>
											)}
										</div>
									);
								})}
							</div>
						)}
					</div>

					{/* 만남 횟수 리스트 */}
					{meetings.length > 0 && (
						<div 
							className="rounded-lg p-6"
							style={{ 
								background: "var(--background)", 
								border: "1px solid var(--accent)" 
							}}
						>
							<h2 className="text-lg font-semibold mb-4">유저별 만남 횟수</h2>
							<div className="space-y-3">
								{meetings.map((meeting) => {
									const isExpanded = expandedMeetingUserId === meeting.userId;
									
									return (
										<div
											key={meeting.userId}
											className="p-4 rounded transition-colors"
											style={{ 
												border: "1px solid var(--accent)",
												background: "var(--background)"
											}}
											onMouseEnter={(e) => {
												e.currentTarget.style.background = "color-mix(in srgb, var(--background) 95%, var(--accent) 5%)";
											}}
											onMouseLeave={(e) => {
												e.currentTarget.style.background = "var(--background)";
											}}
										>
											<div 
												className="flex items-center justify-between cursor-pointer"
												onClick={() => setExpandedMeetingUserId(isExpanded ? null : meeting.userId)}
											>
												<div className="font-medium text-lg">▶ {meeting.userName}</div>
												<div className="text-xl font-semibold">{meeting.count}번</div>
											</div>

											{/* 같은 채널 기록 */}
											{isExpanded && (
												<div className="mt-4 pt-4 border-t border-dashed border-zinc-700/50">
													<div className="font-medium mb-2">같은 채널에 있었던 기록</div>
													<div className="space-y-3">
														{meeting.meetings.map((m, idx) => (
															<div key={idx} className="p-3 rounded" style={{ background: "var(--background)", border: "1px solid var(--accent)" }}>
																<div className="font-medium mb-2">
																	{formatDate(m.date)} · {m.channelName}
																</div>
																<ul className="space-y-1 text-sm">
																	{m.activities.map((act: any, actIdx: number) => {
																		const start = act.startTime || act.startAt;
																		const end = act.endTime || act.endAt;
																		const startDate = start ? new Date(start) : null;
																		const endDate = end ? new Date(end) : null;
																		const dur = typeof act.durationMinutes === "number" ? act.durationMinutes : 0;
																		
																		return (
																			<li key={actIdx} className="flex items-center justify-between text-xs">
																				<div>
																					{startDate && endDate && (
																						<span>
																							{startDate.toLocaleTimeString("ko-KR", {
																								hour: "2-digit",
																								minute: "2-digit",
																							})}
																							{" ~ "}
																							{endDate.toLocaleTimeString("ko-KR", {
																								hour: "2-digit",
																								minute: "2-digit",
																							})}
																						</span>
																					)}
																				</div>
																				<div className="font-semibold">{formatMinutes(dur)}</div>
																			</li>
																		);
																	})}
																</ul>
															</div>
														))}
													</div>
												</div>
											)}
										</div>
									);
								})}
							</div>
						</div>
					)}
				</>
			)}
		</div>
	);
}

