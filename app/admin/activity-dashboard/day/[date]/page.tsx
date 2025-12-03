"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "next-themes";
import { applyColorTheme } from "@/app/lib/color-themes";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

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
	
	// 리스트/차트 토글 및 페이징
	const [viewMode, setViewMode] = useState<"list" | "chart">("list");
	const [chartType, setChartType] = useState<"bar" | "line" | "pie">("bar");
	const [pageSize, setPageSize] = useState<number>(10);
	const [currentPage, setCurrentPage] = useState<number>(1);

	useEffect(() => {
		const savedColorTheme = localStorage.getItem("gbti_color_theme") || "default";
		setColorTheme(savedColorTheme);
		
		// 테마 적용
		applyColorTheme();

		// 테마 변경 감지 (다른 탭에서 변경된 경우)
		const handleStorageChange = () => {
			const newColorTheme = localStorage.getItem("gbti_color_theme") || "default";
			if (newColorTheme !== colorTheme) {
				setColorTheme(newColorTheme);
			}
		};

		window.addEventListener("storage", handleStorageChange);

		return () => {
			window.removeEventListener("storage", handleStorageChange);
		};
	}, [theme]);

	// colorTheme 변경 시 테마 적용
	useEffect(() => {
		applyColorTheme();
	}, [colorTheme]);

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

	// 페이징 계산
	const totalPages = Math.ceil(filteredAndSorted.length / pageSize);
	const paginatedUsers = filteredAndSorted.slice(
		(currentPage - 1) * pageSize,
		currentPage * pageSize
	);

	// 페이지 변경 시 스크롤 상단으로
	useEffect(() => {
		window.scrollTo({ top: 0, behavior: "smooth" });
	}, [currentPage, viewMode]);

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

	// 시간대별 활동 집계 (0시~23시)
	function getHourlyActivity(activities: any[]) {
		const hourlyMap = new Map<number, { minutes: number; count: number }>();
		
		// 0시~23시 초기화
		for (let i = 0; i < 24; i++) {
			hourlyMap.set(i, { minutes: 0, count: 0 });
		}

		for (const act of activities) {
			const startTime = act.startTime || act.startAt;
			const endTime = act.endTime || act.endAt;
			const minutes = typeof act.durationMinutes === "number" ? act.durationMinutes : 0;
			
			if (!startTime) continue;

			const start = new Date(startTime);
			const end = endTime ? new Date(endTime) : new Date(start.getTime() + minutes * 60000);
			
			// 활동이 시작된 시간대와 종료된 시간대 사이의 모든 시간대에 분배
			const startHour = start.getHours();
			const endHour = end.getHours();
			
			// 같은 시간대에 시작하고 끝나면 해당 시간대에만 추가
			if (startHour === endHour) {
				const existing = hourlyMap.get(startHour);
				if (existing) {
					existing.minutes += minutes;
					existing.count += 1;
				}
			} else {
				// 여러 시간대에 걸쳐 있으면 각 시간대에 비례 분배
				const totalMs = end.getTime() - start.getTime();
				if (totalMs > 0) {
					// 시작 시간대
					const startHourEnd = new Date(start);
					startHourEnd.setHours(startHour + 1, 0, 0, 0);
					const startHourMs = Math.min(startHourEnd.getTime() - start.getTime(), totalMs);
					const startHourMinutes = Math.round((startHourMs / totalMs) * minutes);
					
					const startExisting = hourlyMap.get(startHour);
					if (startExisting) {
						startExisting.minutes += startHourMinutes;
						startExisting.count += 1;
					}

					// 중간 시간대들
					for (let h = startHour + 1; h < endHour; h++) {
						const hourMinutes = Math.round((60 * 60000 / totalMs) * minutes);
						const hourExisting = hourlyMap.get(h);
						if (hourExisting) {
							hourExisting.minutes += hourMinutes;
							hourExisting.count += 1;
						}
					}

					// 종료 시간대
					const endHourStart = new Date(end);
					endHourStart.setHours(endHour, 0, 0, 0);
					const endHourMs = end.getTime() - endHourStart.getTime();
					const endHourMinutes = Math.round((endHourMs / totalMs) * minutes);
					
					const endExisting = hourlyMap.get(endHour);
					if (endExisting) {
						endExisting.minutes += endHourMinutes;
						endExisting.count += 1;
					}
				} else {
					// 시간이 0이면 시작 시간대에만 추가
					const existing = hourlyMap.get(startHour);
					if (existing) {
						existing.minutes += minutes;
						existing.count += 1;
					}
				}
			}
		}

		// 배열로 변환하고 시간대 순서대로 정렬
		return Array.from(hourlyMap.entries())
			.map(([hour, data]) => ({
				hour,
				label: `${hour}시`,
				minutes: data.minutes,
				count: data.count,
			}))
			.sort((a, b) => a.hour - b.hour);
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

					{/* 시간대별 활동 차트 */}
					{activityData.activities && activityData.activities.length > 0 && (() => {
						const hourlyData = getHourlyActivity(activityData.activities);
						const maxMinutes = Math.max(...hourlyData.map(h => h.minutes), 1);
						
						return (
							<div 
								className="rounded-lg p-6 mb-6"
								style={{ 
									background: "var(--background)", 
									border: "1px solid var(--accent)" 
								}}
							>
								<h2 className="text-lg font-semibold mb-4">활동이 많은 시간대</h2>
								<div style={{ width: "100%", height: "300px" }}>
									<ResponsiveContainer>
										<BarChart data={hourlyData}>
											<CartesianGrid strokeDasharray="3 3" />
											<XAxis 
												dataKey="label" 
												style={{ fill: "var(--foreground)" }}
												angle={-45}
												textAnchor="end"
												height={80}
											/>
											<YAxis 
												style={{ fill: "var(--foreground)" }}
												label={{ value: '활동 시간 (분)', angle: -90, position: 'insideLeft', style: { fill: 'var(--foreground)' } }}
											/>
											<Tooltip 
												contentStyle={{ 
													backgroundColor: "var(--background)",
													border: "1px solid var(--accent)",
													color: "var(--foreground)",
												}}
												formatter={(value: any, payload: any) => {
													const hours = Math.floor(value / 60);
													const mins = value % 60;
													const timeStr = hours > 0 ? `${hours}시간 ${mins}분` : `${mins}분`;
													const count = payload?.[0]?.payload?.count || 0;
													return [`${timeStr} (${count}회 활동)`, "활동 시간"];
												}}
											/>
											<Bar dataKey="minutes" fill="var(--accent)" />
										</BarChart>
									</ResponsiveContainer>
								</div>
								
								{/* 시간대별 요약 정보 */}
								<div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
									{hourlyData
										.filter(h => h.minutes > 0)
										.sort((a, b) => b.minutes - a.minutes)
										.slice(0, 4)
										.map((h, idx) => (
											<div 
												key={h.hour}
												className="p-2 rounded"
												style={{ 
													background: "color-mix(in srgb, var(--accent) 20%, transparent)",
													border: "1px solid var(--accent)"
												}}
											>
												<div className="font-semibold">{h.label}</div>
												<div className="opacity-70">
													{formatMinutes(h.minutes)} · {h.count}회
												</div>
											</div>
										))}
								</div>
							</div>
						);
					})()}

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
						<div className="flex items-center justify-between mb-4">
							<h2 className="text-lg font-semibold">사용자별 활동 ({filteredAndSorted.length}명)</h2>
							
							{/* 리스트/차트 토글 */}
							<div className="flex gap-2">
								<button
									className={`px-4 py-2 rounded text-sm transition-colors ${
										viewMode === "list" ? "font-semibold" : "opacity-70"
									}`}
									style={{
										backgroundColor: viewMode === "list" ? "var(--accent)" : "transparent",
										color: "var(--foreground)",
										border: "1px solid var(--accent)",
									}}
									onClick={() => setViewMode("list")}
								>
									리스트
								</button>
								<button
									className={`px-4 py-2 rounded text-sm transition-colors ${
										viewMode === "chart" ? "font-semibold" : "opacity-70"
									}`}
									style={{
										backgroundColor: viewMode === "chart" ? "var(--accent)" : "transparent",
										color: "var(--foreground)",
										border: "1px solid var(--accent)",
									}}
									onClick={() => setViewMode("chart")}
								>
									차트
								</button>
							</div>
						</div>

						{filteredAndSorted.length === 0 ? (
							<div className="text-center py-8" style={{ color: "var(--foreground)", opacity: 0.7 }}>
								검색 결과가 없습니다.
							</div>
						) : viewMode === "list" ? (
							<>
								{/* 페이지 크기 선택 및 페이징 컨트롤 */}
								<div className="flex items-center justify-between mb-4">
									<div className="flex items-center gap-2">
										<label className="text-sm">페이지당 표시:</label>
										<select
											value={pageSize}
											onChange={(e) => {
												setPageSize(Number(e.target.value));
												setCurrentPage(1);
											}}
											className="border rounded px-2 py-1 text-sm"
										>
											<option value={10}>10</option>
											<option value={20}>20</option>
											<option value={50}>50</option>
											<option value={100}>100</option>
										</select>
									</div>
									<div className="text-sm opacity-70">
										{filteredAndSorted.length}명 중 {(currentPage - 1) * pageSize + 1}-
										{Math.min(currentPage * pageSize, filteredAndSorted.length)}명 표시
									</div>
								</div>

								<div className="space-y-3">
									{paginatedUsers.map((user) => {
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

								{/* 페이징 네비게이션 */}
								{totalPages > 1 && (
									<div className="flex items-center justify-center gap-2 mt-6">
										<button
											className="px-3 py-1 rounded text-sm transition-colors"
											style={{
												backgroundColor: currentPage === 1 ? "transparent" : "var(--accent)",
												color: "var(--foreground)",
												border: "1px solid var(--accent)",
												opacity: currentPage === 1 ? 0.5 : 1,
												cursor: currentPage === 1 ? "not-allowed" : "pointer",
											}}
											onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
											disabled={currentPage === 1}
										>
											이전
										</button>
										<div className="text-sm">
											{currentPage} / {totalPages}
										</div>
										<button
											className="px-3 py-1 rounded text-sm transition-colors"
											style={{
												backgroundColor: currentPage === totalPages ? "transparent" : "var(--accent)",
												color: "var(--foreground)",
												border: "1px solid var(--accent)",
												opacity: currentPage === totalPages ? 0.5 : 1,
												cursor: currentPage === totalPages ? "not-allowed" : "pointer",
											}}
											onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
											disabled={currentPage === totalPages}
										>
											다음
										</button>
									</div>
								)}
							</>
						) : (
							<>
								{/* 차트 타입 선택 */}
								<div className="flex gap-2 mb-4">
									<button
										className={`px-4 py-2 rounded text-sm transition-colors ${
											chartType === "bar" ? "font-semibold" : "opacity-70"
										}`}
										style={{
											backgroundColor: chartType === "bar" ? "var(--accent)" : "transparent",
											color: "var(--foreground)",
											border: "1px solid var(--accent)",
										}}
										onClick={() => setChartType("bar")}
									>
										막대 그래프
									</button>
									<button
										className={`px-4 py-2 rounded text-sm transition-colors ${
											chartType === "line" ? "font-semibold" : "opacity-70"
										}`}
										style={{
											backgroundColor: chartType === "line" ? "var(--accent)" : "transparent",
											color: "var(--foreground)",
											border: "1px solid var(--accent)",
										}}
										onClick={() => setChartType("line")}
									>
										라인 그래프
									</button>
									<button
										className={`px-4 py-2 rounded text-sm transition-colors ${
											chartType === "pie" ? "font-semibold" : "opacity-70"
										}`}
										style={{
											backgroundColor: chartType === "pie" ? "var(--accent)" : "transparent",
											color: "var(--foreground)",
											border: "1px solid var(--accent)",
										}}
										onClick={() => setChartType("pie")}
									>
										원형 그래프
									</button>
								</div>

								{/* 차트 데이터 준비 */}
								{(() => {
									const chartData = filteredAndSorted
										.slice(0, 20) // 차트는 상위 20개만 표시
										.map((user) => ({
											name: (user.userName || user.userId).length > 10 
												? (user.userName || user.userId).substring(0, 10) + "..."
												: (user.userName || user.userId),
											value: sortBy === "time" ? user.totalMinutes : user.activityCount,
											fullName: user.userName || user.userId,
											minutes: user.totalMinutes,
											count: user.activityCount,
										}));

									const COLORS = [
										"#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", 
										"#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8",
										"#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B88B",
									];

									return (
										<div style={{ width: "100%", height: "500px" }}>
											{chartType === "bar" && (
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
																if (sortBy === "time") {
																	const hours = Math.floor(value / 60);
																	const mins = value % 60;
																	return [`${hours}시간 ${mins}분`, payload[0]?.payload?.fullName || ""];
																} else {
																	return [`${value}회`, payload[0]?.payload?.fullName || ""];
																}
															}}
														/>
														<Bar dataKey="value" fill="var(--accent)" />
													</BarChart>
												</ResponsiveContainer>
											)}
											{chartType === "line" && (
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
																if (sortBy === "time") {
																	const hours = Math.floor(value / 60);
																	const mins = value % 60;
																	return [`${hours}시간 ${mins}분`, payload[0]?.payload?.fullName || ""];
																} else {
																	return [`${value}회`, payload[0]?.payload?.fullName || ""];
																}
															}}
														/>
														<Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} />
													</LineChart>
												</ResponsiveContainer>
											)}
											{chartType === "pie" && (
												<ResponsiveContainer>
													<PieChart>
														<Pie
															data={chartData}
															cx="50%"
															cy="50%"
															labelLine={false}
															label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
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
																if (sortBy === "time") {
																	const hours = Math.floor(value / 60);
																	const mins = value % 60;
																	return [`${hours}시간 ${mins}분`, payload?.fullName || ""];
																} else {
																	return [`${value}회`, payload?.fullName || ""];
																}
															}}
														/>
													</PieChart>
												</ResponsiveContainer>
											)}
										</div>
									);
								})()}
							</>
						)}
					</div>
				</>
			)}
		</div>
	);
}

