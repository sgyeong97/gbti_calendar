"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "next-themes";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

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
	lastMetAt?: string;
	updatedAt?: string;
	meetings?: Array<{
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
	
	// 만남 횟수 관련 상태
	const [meetingViewMode, setMeetingViewMode] = useState<"list" | "chart">("list");
	const [meetingChartType, setMeetingChartType] = useState<"bar" | "line" | "pie">("bar");
	const [meetingSearchTerm, setMeetingSearchTerm] = useState<string>("");
	const [meetingSortBy, setMeetingSortBy] = useState<"name" | "count">("count");
	const [meetingPageSize, setMeetingPageSize] = useState<number>(10);
	const [meetingCurrentPage, setMeetingCurrentPage] = useState<number>(1);

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

				// 만남 횟수: 봇 API에서 가져오기
				await fetchMeetingCounts(userId);
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

	async function fetchMeetingCounts(userId: string) {
		try {
			const res = await fetch(`/api/discord-activity/meeting-counts?userId=${userId}`);
			if (!res.ok) {
				console.error("만남 횟수 조회 실패:", res.status);
				setMeetings([]);
				return;
			}

			const result = await res.json();
			const meetingData = result.data || [];

			// API 응답에서 otherUserName을 직접 사용
			const meetings: MeetingEntry[] = meetingData.map((item: any) => ({
				userId: item.otherUserId,
				userName: item.otherUserName || item.otherUserId, // API에서 제공하는 otherUserName 사용
				count: item.count,
				lastMetAt: item.lastMetAt,
				updatedAt: item.updatedAt,
			}));

			// 만남 횟수순으로 정렬
			meetings.sort((a, b) => b.count - a.count);
			setMeetings(meetings);
		} catch (err) {
			console.error("만남 횟수 조회 실패:", err);
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
							<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
								<h2 className="text-lg font-semibold">유저별 만남 횟수 ({meetings.length}명)</h2>
								
								{/* 리스트/차트 토글 */}
								<div className="flex gap-2">
									<button
										className={`px-4 py-2 rounded text-sm transition-colors ${
											meetingViewMode === "list"
												? "font-semibold"
												: "opacity-70"
										}`}
										style={{
											backgroundColor: meetingViewMode === "list" ? "var(--accent)" : "transparent",
											color: "var(--foreground)",
											border: "1px solid var(--accent)",
										}}
										onClick={() => setMeetingViewMode("list")}
									>
										리스트
									</button>
									<button
										className={`px-4 py-2 rounded text-sm transition-colors ${
											meetingViewMode === "chart"
												? "font-semibold"
												: "opacity-70"
										}`}
										style={{
											backgroundColor: meetingViewMode === "chart" ? "var(--accent)" : "transparent",
											color: "var(--foreground)",
											border: "1px solid var(--accent)",
										}}
										onClick={() => setMeetingViewMode("chart")}
									>
										차트
									</button>
								</div>
							</div>

							{meetingViewMode === "list" ? (
								<>
									{/* 검색 및 정렬 */}
									<div className="flex flex-col md:flex-row gap-4 items-end mb-4">
										<div className="flex-1 min-w-[200px]">
											<label className="block text-sm mb-2">검색</label>
											<input
												type="text"
												placeholder="사용자 이름 검색..."
												value={meetingSearchTerm}
												onChange={(e) => {
													setMeetingSearchTerm(e.target.value);
													setMeetingCurrentPage(1);
												}}
												className="w-full border rounded px-3 py-2"
											/>
										</div>
										<div className="flex-1 min-w-[200px]">
											<label className="block text-sm mb-2">정렬 기준</label>
											<select
												value={meetingSortBy}
												onChange={(e) => {
													setMeetingSortBy(e.target.value as "name" | "count");
													setMeetingCurrentPage(1);
												}}
												className="w-full border rounded px-3 py-2"
											>
												<option value="count">만남 횟수순 (높은순)</option>
												<option value="name">이름순</option>
											</select>
										</div>
										<div className="flex items-center gap-1 text-sm">
											<span className="opacity-70">한 번에</span>
											<select
												value={meetingPageSize}
												onChange={(e) => {
													setMeetingPageSize(parseInt(e.target.value, 10));
													setMeetingCurrentPage(1);
												}}
												className="border rounded px-2 py-1 text-sm"
											>
												<option value={5}>5개</option>
												<option value={10}>10개</option>
												<option value={20}>20개</option>
												<option value={50}>50개</option>
											</select>
										</div>
									</div>

									{/* 필터링 및 정렬된 만남 리스트 */}
									{(() => {
										const filtered = meetings.filter((m) => {
											if (!meetingSearchTerm.trim()) return true;
											const term = meetingSearchTerm.toLowerCase();
											return (m.userName || m.userId).toLowerCase().includes(term);
										});

										const sorted = filtered.sort((a, b) => {
											if (meetingSortBy === "name") {
												return (a.userName || a.userId).localeCompare(b.userName || b.userId);
											} else {
												return b.count - a.count;
											}
										});

										const totalPages = Math.max(1, Math.ceil(sorted.length / meetingPageSize));
										const safeCurrentPage = Math.min(meetingCurrentPage, totalPages);
										const startIndex = (safeCurrentPage - 1) * meetingPageSize;
										const pageMeetings = sorted.slice(startIndex, startIndex + meetingPageSize);

										return (
											<>
												{/* 페이지네이션 상단 */}
												{sorted.length > 0 && (
													<div className="flex items-center justify-between text-xs md:text-sm mb-3 opacity-70">
														<div>
															{startIndex + 1}–{Math.min(startIndex + meetingPageSize, sorted.length)} / {sorted.length}개
														</div>
														<div className="flex items-center gap-2">
															<button
																className="px-2 py-1 border rounded disabled:opacity-40 disabled:cursor-default cursor-pointer"
																onClick={() => setMeetingCurrentPage((p) => Math.max(1, p - 1))}
																disabled={safeCurrentPage <= 1}
															>
																이전
															</button>
															<span>
																{safeCurrentPage} / {totalPages}
															</span>
															<button
																className="px-2 py-1 border rounded disabled:opacity-40 disabled:cursor-default cursor-pointer"
																onClick={() => setMeetingCurrentPage((p) => Math.min(totalPages, p + 1))}
																disabled={safeCurrentPage >= totalPages}
															>
																다음
															</button>
														</div>
													</div>
												)}

												{pageMeetings.length === 0 ? (
													<div className="text-center py-8" style={{ color: "var(--foreground)", opacity: 0.7 }}>
														검색 결과가 없습니다.
													</div>
												) : (
													<div className="space-y-3">
														{pageMeetings.map((meeting) => {
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

																	{/* 만남 정보 */}
																	{isExpanded && (
																		<div className="mt-4 pt-4 border-t border-dashed border-zinc-700/50">
																			<div className="text-sm space-y-2">
																				{meeting.lastMetAt && (
																					<div className="opacity-70">
																						마지막 만남: {new Date(meeting.lastMetAt).toLocaleString("ko-KR", {
																							year: "numeric",
																							month: "long",
																							day: "numeric",
																							hour: "2-digit",
																							minute: "2-digit",
																						})}
																					</div>
																				)}
																				{meeting.updatedAt && (
																					<div className="opacity-70 text-xs">
																						업데이트: {new Date(meeting.updatedAt).toLocaleString("ko-KR", {
																							year: "numeric",
																							month: "long",
																							day: "numeric",
																							hour: "2-digit",
																							minute: "2-digit",
																						})}
																					</div>
																				)}
																			</div>
																		</div>
																	)}
																</div>
															);
														})}
													</div>
												)}
											</>
										);
									})()}
								</>
							) : (
								<>
									{/* 차트 타입 선택 */}
									<div className="flex gap-2 mb-4">
										<button
											className={`px-4 py-2 rounded text-sm transition-colors ${
												meetingChartType === "bar" ? "font-semibold" : "opacity-70"
											}`}
											style={{
												backgroundColor: meetingChartType === "bar" ? "var(--accent)" : "transparent",
												color: "var(--foreground)",
												border: "1px solid var(--accent)",
											}}
											onClick={() => setMeetingChartType("bar")}
										>
											막대 그래프
										</button>
										<button
											className={`px-4 py-2 rounded text-sm transition-colors ${
												meetingChartType === "line" ? "font-semibold" : "opacity-70"
											}`}
											style={{
												backgroundColor: meetingChartType === "line" ? "var(--accent)" : "transparent",
												color: "var(--foreground)",
												border: "1px solid var(--accent)",
											}}
											onClick={() => setMeetingChartType("line")}
										>
											라인 그래프
										</button>
										<button
											className={`px-4 py-2 rounded text-sm transition-colors ${
												meetingChartType === "pie" ? "font-semibold" : "opacity-70"
											}`}
											style={{
												backgroundColor: meetingChartType === "pie" ? "var(--accent)" : "transparent",
												color: "var(--foreground)",
												border: "1px solid var(--accent)",
											}}
											onClick={() => setMeetingChartType("pie")}
										>
											원형 그래프
										</button>
									</div>

									{/* 차트 데이터 준비 */}
									{(() => {
										// 이름에서 [] 안의 칭호/레벨 제거하는 함수
										const cleanUserName = (userName: string): string => {
											// [로 시작하는 부분을 모두 제거
											return userName.replace(/\[.*?\]\s*/g, '').trim() || userName;
										};

										const chartData = meetings
											.filter((m) => {
												if (!meetingSearchTerm.trim()) return true;
												const term = meetingSearchTerm.toLowerCase();
												return (m.userName || m.userId).toLowerCase().includes(term);
											})
											.sort((a, b) => b.count - a.count)
											.slice(0, 20) // 차트는 상위 20개만 표시
											.map((m, index) => {
												const cleanName = cleanUserName(m.userName || m.userId);
												return {
													name: cleanName.length > 10 
														? cleanName.substring(0, 10) + "..."
														: cleanName,
													value: m.count,
													fullName: m.userName || m.userId,
													index: index, // 색상 인덱스용
												};
											});

										const COLORS = [
											"#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", 
											"#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8",
											"#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B88B",
										];

										return (
											<div style={{ width: "100%", height: "500px" }}>
											{meetingChartType === "bar" && (
												<ResponsiveContainer>
													<BarChart data={chartData}>
														<CartesianGrid strokeDasharray="3 3" />
														<XAxis 
															dataKey="name" 
															angle={-45}
															textAnchor="end"
															height={100}
															style={{ fill: "var(--foreground)" }}
														/>
														<YAxis style={{ fill: "var(--foreground)" }} />
														<Tooltip 
															contentStyle={{ 
																backgroundColor: "var(--background)",
																border: "1px solid var(--accent)",
																color: "var(--foreground)",
															}}
															formatter={(value: any, payload: any) => {
																return [`${value}번`, payload[0]?.payload?.fullName || ""];
															}}
														/>
														<Legend />
														<Bar dataKey="value" name="만남 횟수">
															{chartData.map((entry, index) => (
																<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
															))}
														</Bar>
													</BarChart>
												</ResponsiveContainer>
											)}

												{meetingChartType === "line" && (
													<ResponsiveContainer>
														<LineChart data={chartData}>
															<CartesianGrid strokeDasharray="3 3" />
															<XAxis 
																dataKey="name" 
																angle={-45}
																textAnchor="end"
																height={100}
																style={{ fill: "var(--foreground)" }}
															/>
															<YAxis style={{ fill: "var(--foreground)" }} />
															<Tooltip 
																contentStyle={{ 
																	backgroundColor: "var(--background)",
																	border: "1px solid var(--accent)",
																	color: "var(--foreground)",
																}}
																formatter={(value: any, payload: any) => {
																	return [`${value}번`, payload[0]?.payload?.fullName || ""];
																}}
															/>
															<Legend />
															<Line 
																type="monotone" 
																dataKey="value" 
																stroke="var(--accent)" 
																strokeWidth={2}
																name="만남 횟수"
															/>
														</LineChart>
													</ResponsiveContainer>
												)}

												{meetingChartType === "pie" && (
													<ResponsiveContainer>
														<PieChart>
															<Pie
																data={chartData}
																cx="50%"
																cy="50%"
																labelLine={false}
																label={({ name, percent }: { name: string; percent: number }) => {
																	// name은 이미 cleanName이므로 그대로 사용
																	return `${name}: ${(percent * 100).toFixed(0)}%`;
																}}
																outerRadius={150}
																fill="#8884d8"
																dataKey="value"
															>
																{chartData.map((entry, index) => (
																	<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
																))}
															</Pie>
															<Tooltip 
																contentStyle={{ 
																	backgroundColor: "var(--background)",
																	border: "1px solid var(--accent)",
																	color: "var(--foreground)",
																}}
																formatter={(value: any, payload: any) => {
																	return [`${value}번`, payload?.fullName || ""];
																}}
															/>
															<Legend />
														</PieChart>
													</ResponsiveContainer>
												)}
											</div>
										);
									})()}
								</>
							)}
						</div>
					)}
				</>
			)}
		</div>
	);
}

