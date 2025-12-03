"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "next-themes";

type ActivityData = {
	date: string;
	totalMinutes: number;
	userCount: number;
	users: string[];
	activities: any[];
};

type UserSummary = {
	userId: string;
	userName: string;
	activityCount: number;
	totalMinutes: number;
	activities: any[];
};

export default function DayDetailPage() {
	const router = useRouter();
	const params = useParams();
	const { theme } = useTheme();
	const [colorTheme, setColorTheme] = useState<string>("default");
	const [loading, setLoading] = useState(false);
	const date = params.date as string;
	const [activityData, setActivityData] = useState<ActivityData | null>(null);
	const [userSummaries, setUserSummaries] = useState<UserSummary[]>([]);
	const [searchTerm, setSearchTerm] = useState<string>("");
	const [sortBy, setSortBy] = useState<"name" | "time" | "count">("time");
	const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

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
		if (date) {
			fetchDayData();
		}
	}, [date]);

	// 로컬 시간대 기준으로 날짜 추출 (UTC 변환으로 인한 날짜 밀림 방지)
	function getLocalDateString(dateStr: string): string {
		const date = new Date(dateStr);
		if (isNaN(date.getTime())) return "";
		// 로컬 시간대 기준으로 YYYY-MM-DD 형식 추출
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	// 날짜 보정: startTime 또는 createdAt의 날짜를 사용하여 재그룹화
	function normalizeDates(data: Record<string, ActivityData>): Record<string, ActivityData> {
		const normalized: Record<string, ActivityData> = {};
		const activitiesByDate = new Map<string, any[]>();

		// 모든 활동을 날짜별로 재그룹화
		for (const value of Object.values(data || {})) {
			const dayData = value as ActivityData;
			for (const act of dayData.activities || []) {
				// startTime 우선, 없으면 createdAt 사용, 마지막으로 date 필드 사용
				const timeStr = act.startTime || act.startAt || act.createdAt || act.created_at || act.date;
				if (!timeStr) continue;

				// 로컬 시간대 기준으로 날짜 추출
				const actualDate = getLocalDateString(timeStr);
				if (!actualDate) continue;

				const activities = activitiesByDate.get(actualDate) || [];
				activities.push({
					...act,
					date: actualDate, // date 필드도 보정
				});
				activitiesByDate.set(actualDate, activities);
			}
		}

		// 각 날짜별로 ActivityData 생성
		for (const [dateKey, activities] of activitiesByDate.entries()) {
			const totalMinutes = activities.reduce((sum, a) => sum + (a.durationMinutes || 0), 0);
			const users = new Set<string>();
			activities.forEach((a: any) => {
				if (a.userName) users.add(a.userName);
			});

			normalized[dateKey] = {
				date: dateKey,
				totalMinutes,
				userCount: users.size,
				users: Array.from(users),
				activities,
			};
		}

		return normalized;
	}

	async function fetchDayData() {
		setLoading(true);
		try {
			// 날짜 범위를 넓게 설정 (봇 API의 date 필드가 부정확할 수 있으므로)
			// 해당 날짜 전후 1일씩 포함하여 요청
			const targetDate = new Date(date);
			const prevDate = new Date(targetDate);
			prevDate.setDate(prevDate.getDate() - 1);
			const nextDate = new Date(targetDate);
			nextDate.setDate(nextDate.getDate() + 1);
			
			const startDate = prevDate.toISOString().split('T')[0];
			const endDate = nextDate.toISOString().split('T')[0];
			
			const params = new URLSearchParams({
				groupBy: "day",
				startDate,
				endDate,
			});

			const res = await fetch(`/api/discord-activity?${params}`);
			if (!res.ok) throw new Error("Failed to fetch");
			
			const result = await res.json();
			const rawData = result.data || {};
			
			// 날짜 보정 적용 (대시보드 메인 페이지와 동일한 로직)
			const normalizedData = normalizeDates(rawData);
			
			// 해당 날짜의 데이터 찾기
			const dayData = normalizedData[date] as ActivityData;
			if (dayData) {
				setActivityData(dayData);
				
				// 사용자별로 집계
				const userMap = new Map<string, UserSummary>();
				for (const act of dayData.activities || []) {
					const userId = act.userId || act.user_id || "";
					const userName = act.userName || act.user_name || userId;
					if (!userId) continue;

					const existing = userMap.get(userId);
					const minutes = typeof act.durationMinutes === "number" ? act.durationMinutes : 0;
					if (existing) {
						existing.activityCount += 1;
						existing.totalMinutes += minutes;
						existing.activities.push(act);
					} else {
						userMap.set(userId, {
							userId,
							userName,
							activityCount: 1,
							totalMinutes: minutes,
							activities: [act],
						});
					}
				}

				const summaries = Array.from(userMap.values());
				setUserSummaries(summaries);
			} else {
				setActivityData(null);
				setUserSummaries([]);
			}
		} catch (err) {
			console.error("활동 데이터 로딩 실패:", err);
			alert("활동 데이터를 불러오지 못했습니다.");
		} finally {
			setLoading(false);
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
	const filteredAndSorted = userSummaries
		.filter((user) => {
			if (!searchTerm.trim()) return true;
			const term = searchTerm.toLowerCase();
			return (user.userName || user.userId).toLowerCase().includes(term);
		})
		.sort((a, b) => {
			if (sortBy === "name") {
				return (a.userName || a.userId).localeCompare(b.userName || b.userId);
			} else if (sortBy === "count") {
				return b.activityCount - a.activityCount;
			} else {
				return b.totalMinutes - a.totalMinutes;
			}
		});

	// 채널별 활동 시간 계산
	function getChannelSummary(activities: any[]) {
		const channelMap = new Map<string, { name: string; minutes: number; count: number }>();
		for (const act of activities) {
			const channelId = act.channelId || act.channel_id || "";
			const channelName = act.channelName || act.channel_name || channelId || "알 수 없음";
			const minutes = typeof act.durationMinutes === "number" ? act.durationMinutes : 0;
			
			const existing = channelMap.get(channelId);
			if (existing) {
				existing.minutes += minutes;
				existing.count += 1;
			} else {
				channelMap.set(channelId, { name: channelName, minutes, count: 1 });
			}
		}
		return Array.from(channelMap.values()).sort((a, b) => b.minutes - a.minutes);
	}

	return (
		<div className="p-6 max-w-7xl mx-auto" style={{ background: "var(--background)", color: "var(--foreground)" }}>
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-semibold">날짜별 활동 상세</h1>
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
			) : !activityData ? (
				<div className="text-center py-8" style={{ color: "var(--foreground)", opacity: 0.7 }}>
					해당 날짜의 활동 데이터가 없습니다.
				</div>
			) : (
				<>
					{/* 날짜 헤더 */}
					<div 
						className="rounded-lg p-6 mb-6"
						style={{ 
							background: "var(--background)", 
							border: "1px solid var(--accent)" 
						}}
					>
						<div className="text-2xl font-bold mb-2">{formatDate(activityData.date)}</div>
						<div className="text-lg opacity-70">
							총 {formatMinutes(activityData.totalMinutes)} · {activityData.userCount}명 참여
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
									placeholder="사용자 이름 검색..."
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
									className="w-full border rounded px-3 py-2"
								/>
							</div>
							<div className="flex-1 min-w-[200px]">
								<label className="block text-sm mb-2">정렬 기준</label>
								<select
									value={sortBy}
									onChange={(e) => setSortBy(e.target.value as "name" | "time" | "count")}
									className="w-full border rounded px-3 py-2"
								>
									<option value="time">활동 시간순</option>
									<option value="count">활동 횟수순</option>
									<option value="name">이름순</option>
								</select>
							</div>
						</div>
					</div>

					{/* 사용자 리스트 */}
					<div 
						className="rounded-lg p-6"
						style={{ 
							background: "var(--background)", 
							border: "1px solid var(--accent)" 
						}}
					>
						<h2 className="text-lg font-semibold mb-4">사용자별 활동 ({filteredAndSorted.length}명)</h2>
						
						{filteredAndSorted.length === 0 ? (
							<div className="text-center py-8" style={{ color: "var(--foreground)", opacity: 0.7 }}>
								검색 결과가 없습니다.
							</div>
						) : (
							<div className="space-y-3">
								{filteredAndSorted.map((user) => {
									const isExpanded = expandedUserId === user.userId;
									const channelSummary = getChannelSummary(user.activities);
									
									return (
										<div
											key={user.userId}
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
												onClick={() => setExpandedUserId(isExpanded ? null : user.userId)}
											>
												<div>
													<div className="font-medium text-lg">▶ {user.userName}</div>
													<div className="text-sm opacity-70">
														{user.activityCount}회 활동
													</div>
												</div>
												<div className="text-right">
													<div className="text-xl font-semibold">{formatMinutes(user.totalMinutes)}</div>
												</div>
											</div>

											{/* 상세 정보 */}
											{isExpanded && (
												<div className="mt-4 pt-4 border-t border-dashed border-zinc-700/50">
													{/* 채널별 활동 시간 */}
													<div className="mb-4">
														<div className="font-medium mb-2">채널별 활동 시간</div>
														<ul className="space-y-1">
															{channelSummary.map((ch, idx) => (
																<li key={idx} className="flex items-center justify-between text-sm">
																	<div>
																		<span className="font-medium">{ch.name}</span>
																		<span className="opacity-70 ml-2">({ch.count}회)</span>
																	</div>
																	<div className="font-semibold">{formatMinutes(ch.minutes)}</div>
																</li>
															))}
														</ul>
													</div>

													{/* 활동 로그 */}
													<div>
														<div className="font-medium mb-2">활동 로그</div>
														<ul className="space-y-2 max-h-96 overflow-y-auto">
															{user.activities
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
												</div>
											)}
										</div>
									);
								})}
							</div>
						)}
					</div>
				</>
			)}
		</div>
	);
}

