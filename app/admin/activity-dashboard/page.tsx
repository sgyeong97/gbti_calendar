"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";

type ActivityData = {
	date: string;
	totalMinutes: number;
	userCount: number;
	users: string[];
	activities: any[];
};

type UserActivityData = {
	userId: string;
	userName: string;
	totalMinutes: number;
	dayCount: number;
	days: string[];
	activities: any[];
};

type ActivityStats = {
	totalUsers: number;
	totalMinutes: number;
	averageMinutesPerUser: number;
	mostActiveUser: { userId: string; userName: string; minutes: number } | null;
		mostActiveDay: { date: string; minutes: number } | null;
};

export default function ActivityDashboardPage() {
	const router = useRouter();
	const { theme } = useTheme();
	const [colorTheme, setColorTheme] = useState<string>("default");
	const [loading, setLoading] = useState(false);
	const [groupBy, setGroupBy] = useState<"day" | "user">("day");
	const [searchTerm, setSearchTerm] = useState<string>("");
	const [pageSize, setPageSize] = useState<number>(10);
	const [currentPage, setCurrentPage] = useState<number>(1);
	const [startDate, setStartDate] = useState<string>(
		new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
	);
	const [endDate, setEndDate] = useState<string>(
		new Date().toISOString().split('T')[0]
	);
	const [activityData, setActivityData] = useState<Record<string, ActivityData | UserActivityData>>({});
	const [stats, setStats] = useState<ActivityStats | null>(null);
	const [expandedKey, setExpandedKey] = useState<string | null>(null);

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
		// 그룹 기준이나 날짜가 바뀌면 검색/페이지/확장 상태 초기화
		setSearchTerm("");
		setCurrentPage(1);
		setExpandedKey(null);
		fetchActivityData();
	}, [groupBy, startDate, endDate]);

	async function fetchActivityData() {
		setLoading(true);
		try {
			const params = new URLSearchParams({
				groupBy,
				startDate,
				endDate,
			});

			const res = await fetch(`/api/discord-activity?${params}`);
			if (!res.ok) throw new Error("Failed to fetch");
			
			const result = await res.json();
			setActivityData(result.data || {});

			// 통계 계산
			calculateStats(result.data || {});
		} catch (err) {
			console.error("활동 데이터 로딩 실패:", err);
			alert("활동 데이터를 불러오지 못했습니다.");
		} finally {
			setLoading(false);
		}
	}

	function calculateStats(data: Record<string, ActivityData | UserActivityData>) {
		if (Object.keys(data).length === 0) {
			setStats({
				totalUsers: 0,
				totalMinutes: 0,
				averageMinutesPerUser: 0,
				mostActiveUser: null,
				mostActiveDay: null,
			});
			return;
		}

		if (groupBy === "day") {
			const days = Object.values(data) as ActivityData[];
			const totalMinutes = days.reduce((sum, day) => sum + day.totalMinutes, 0);
			const allUsers = new Set<string>();
			days.forEach(day => day.users.forEach(u => allUsers.add(u)));
			
			const mostActiveDay = days.reduce((max, day) => 
				day.totalMinutes > max.totalMinutes ? day : max, days[0]
			);

			setStats({
				totalUsers: allUsers.size,
				totalMinutes,
				averageMinutesPerUser: allUsers.size > 0 ? Math.round(totalMinutes / allUsers.size) : 0,
				mostActiveUser: null,
				mostActiveDay: {
					date: mostActiveDay.date,
					minutes: mostActiveDay.totalMinutes,
				},
			});
		} else {
			const users = Object.values(data) as UserActivityData[];
			const totalMinutes = users.reduce((sum, user) => sum + user.totalMinutes, 0);
			const mostActiveUser = users.reduce((max, user) => 
				user.totalMinutes > max.totalMinutes ? user : max, users[0]
			);

			setStats({
				totalUsers: users.length,
				totalMinutes,
				averageMinutesPerUser: users.length > 0 ? Math.round(totalMinutes / users.length) : 0,
				mostActiveUser: {
					userId: mostActiveUser.userId,
					userName: mostActiveUser.userName,
					minutes: mostActiveUser.totalMinutes,
				},
				mostActiveDay: null,
			});
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

	const sortedEntries = Object.entries(activityData).sort((a, b) => {
		if (groupBy === "day") {
			return b[0].localeCompare(a[0]); // 날짜 내림차순
		} else {
			const aData = a[1] as UserActivityData;
			const bData = b[1] as UserActivityData;
			return bData.totalMinutes - aData.totalMinutes; // 활동 시간 내림차순
		}
	});

	// 검색 필터링
	const filteredEntries = sortedEntries.filter(([key, data]) => {
		if (!searchTerm.trim()) return true;
		const term = searchTerm.toLowerCase();

		if (groupBy === "day") {
			const dayData = data as ActivityData;
			const dateText = formatDate(dayData.date).toLowerCase();
			const usersText = (dayData.users || []).join(", ").toLowerCase();
			return dateText.includes(term) || usersText.includes(term);
		} else {
			const userData = data as UserActivityData;
			const name = (userData.userName || userData.userId || "").toLowerCase();
			return name.includes(term);
		}
	});

	// 페이지네이션 계산
	const totalItems = filteredEntries.length;
	const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
	const safeCurrentPage = Math.min(currentPage, totalPages);
	const startIndex = (safeCurrentPage - 1) * pageSize;
	const pageEntries = filteredEntries.slice(startIndex, startIndex + pageSize);

	return (
		<div className="p-6 max-w-7xl mx-auto" style={{ background: "var(--background)", color: "var(--foreground)" }}>
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-semibold">Discord 활동 시간 대시보드</h1>
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
					onClick={() => router.push("/admin")}
				>
					관리자 페이지로 돌아가기
				</button>
			</div>

			{/* 필터 및 설정 */}
			<div 
				className="rounded-lg p-6 mb-6"
				style={{ 
					background: "var(--background)", 
					border: "1px solid var(--accent)" 
				}}
			>
				<div className="flex gap-4 flex-wrap items-end">
					<div className="flex-1 min-w-[200px]">
						<label className="block text-sm mb-2">시작 날짜</label>
						<input
							type="date"
							value={startDate}
							onChange={(e) => setStartDate(e.target.value)}
							className="w-full border rounded px-3 py-2"
						/>
					</div>
					<div className="flex-1 min-w-[200px]">
						<label className="block text-sm mb-2">종료 날짜</label>
						<input
							type="date"
							value={endDate}
							onChange={(e) => setEndDate(e.target.value)}
							className="w-full border rounded px-3 py-2"
						/>
					</div>
					<div className="flex-1 min-w-[200px]">
						<label className="block text-sm mb-2">그룹화 기준</label>
						<select
							value={groupBy}
							onChange={(e) => setGroupBy(e.target.value as "day" | "user")}
							className="w-full border rounded px-3 py-2"
						>
							<option value="day">날짜별</option>
							<option value="user">사용자별</option>
						</select>
					</div>
					<button
						className="px-4 py-2 rounded transition-colors cursor-pointer"
						style={{ 
							backgroundColor: "var(--accent)", 
							color: "var(--foreground)" 
						}}
						onClick={fetchActivityData}
						disabled={loading}
					>
						{loading ? "로딩 중..." : "새로고침"}
					</button>
				</div>
			</div>

			{/* 통계 카드 */}
			{stats && (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
					<div 
						className="rounded-lg p-4"
						style={{ 
							background: "var(--background)", 
							border: "1px solid var(--accent)" 
						}}
					>
						<div className="text-sm opacity-70 mb-1">총 사용자 수</div>
						<div className="text-2xl font-bold">{stats.totalUsers}명</div>
					</div>
					<div 
						className="rounded-lg p-4"
						style={{ 
							background: "var(--background)", 
							border: "1px solid var(--accent)" 
						}}
					>
						<div className="text-sm opacity-70 mb-1">총 활동 시간</div>
						<div className="text-2xl font-bold">{formatMinutes(stats.totalMinutes)}</div>
					</div>
					<div 
						className="rounded-lg p-4"
						style={{ 
							background: "var(--background)", 
							border: "1px solid var(--accent)" 
						}}
					>
						<div className="text-sm opacity-70 mb-1">평균 활동 시간</div>
						<div className="text-2xl font-bold">{formatMinutes(stats.averageMinutesPerUser)}</div>
					</div>
					{stats.mostActiveUser && (
						<div 
							className="rounded-lg p-4"
							style={{ 
								background: "var(--background)", 
								border: "1px solid var(--accent)" 
							}}
						>
							<div className="text-sm opacity-70 mb-1">가장 활발한 사용자</div>
							<div className="text-lg font-bold">{stats.mostActiveUser.userName}</div>
							<div className="text-sm opacity-70">{formatMinutes(stats.mostActiveUser.minutes)}</div>
						</div>
					)}
					{stats.mostActiveDay && (
						<div 
							className="rounded-lg p-4"
							style={{ 
								background: "var(--background)", 
								border: "1px solid var(--accent)" 
							}}
						>
							<div className="text-sm opacity-70 mb-1">가장 활발한 날</div>
							<div className="text-lg font-bold">{formatDate(stats.mostActiveDay.date)}</div>
							<div className="text-sm opacity-70">{formatMinutes(stats.mostActiveDay.minutes)}</div>
						</div>
					)}
				</div>
			)}

			{/* 활동 데이터 목록 */}
			<div 
				className="rounded-lg p-6"
				style={{ 
					background: "var(--background)", 
					border: "1px solid var(--accent)" 
				}}
			>
				<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
					<h2 className="text-lg font-semibold">
						{groupBy === "day" ? "날짜별 활동" : "사용자별 활동"} ({totalItems}개)
					</h2>

					<div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-end w-full md:w-auto">
						{/* 검색 */}
						<input
							type="text"
							placeholder={groupBy === "day" ? "날짜/사용자 이름 검색..." : "사용자 이름 검색..."}
							value={searchTerm}
							onChange={(e) => {
								setSearchTerm(e.target.value);
								setCurrentPage(1);
							}}
							className="border rounded px-3 py-2 text-sm w-full md:w-56"
						/>

						{/* 페이지 크기 */}
						<div className="flex items-center gap-1 text-sm">
							<span className="opacity-70">한 번에</span>
							<select
								value={pageSize}
								onChange={(e) => {
									setPageSize(parseInt(e.target.value, 10));
									setCurrentPage(1);
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
				</div>

				{/* 페이지네이션 상단 정보 */}
				{totalItems > 0 && (
					<div className="flex items-center justify-between text-xs md:text-sm mb-3 opacity-70">
						<div>
							{startIndex + 1}–{Math.min(startIndex + pageSize, totalItems)} / {totalItems}개
						</div>
						<div className="flex items-center gap-2">
							<button
								className="px-2 py-1 border rounded disabled:opacity-40 disabled:cursor-default cursor-pointer"
								onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
								disabled={safeCurrentPage <= 1}
							>
								이전
							</button>
							<span>
								{safeCurrentPage} / {totalPages}
							</span>
							<button
								className="px-2 py-1 border rounded disabled:opacity-40 disabled:cursor-default cursor-pointer"
								onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
								disabled={safeCurrentPage >= totalPages}
							>
								다음
							</button>
						</div>
					</div>
				)}
				
				{loading ? (
					<div className="text-center py-8">로딩 중...</div>
				) : totalItems === 0 ? (
					<div className="text-center py-8" style={{ color: "var(--foreground)", opacity: 0.7 }}>
						활동 데이터가 없습니다.
					</div>
				) : (
					<div className="space-y-3 max-h-[600px] overflow-y-auto">
						{pageEntries.map(([key, data]) => {
							if (groupBy === "day") {
								const dayData = data as ActivityData;
								return (
									<div
										key={key}
										className="p-4 rounded transition-colors cursor-pointer"
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
										onClick={() => setExpandedKey(expandedKey === key ? null : key)}
									>
										<div className="flex items-center justify-between">
											<div>
												<div className="font-medium">{formatDate(dayData.date)}</div>
												<div className="text-sm opacity-70">
													{dayData.userCount}명 참여 · {formatMinutes(dayData.totalMinutes)}
												</div>
											</div>
											<div className="text-right">
												<div className="text-lg font-semibold">{formatMinutes(dayData.totalMinutes)}</div>
											</div>
										</div>

										{/* 날짜별 상세: 사용자별 총 이용 시간 */}
										{expandedKey === key && (
											<div className="mt-3 pt-3 border-t border-dashed border-zinc-700/50 text-sm">
												<div className="mb-2 font-medium">사용자별 활동 시간</div>
												{(() => {
													const perUser = new Map<string, { minutes: number; count: number }>();
													for (const act of dayData.activities || []) {
														const name = act.userName || act.userId || "알 수 없음";
														const prev = perUser.get(name) || { minutes: 0, count: 0 };
														const m = typeof act.durationMinutes === "number" ? act.durationMinutes : 0;
														perUser.set(name, { minutes: prev.minutes + m, count: prev.count + 1 });
													}
													const entries = Array.from(perUser.entries()).sort(
														(a, b) => b[1].minutes - a[1].minutes
													);

													if (entries.length === 0) {
														return (
															<div className="text-xs opacity-70">
																해당 날짜의 상세 활동 로그가 없습니다.
															</div>
														);
													}

													return (
														<ul className="space-y-1">
															{entries.map(([name, info]) => (
																<li key={name} className="flex items-center justify-between text-xs md:text-sm">
																	<div>
																		<span className="font-medium">{name}</span>
																		<span className="opacity-70 ml-2">
																			({info.count}회 활동)
																		</span>
																	</div>
																	<div className="font-semibold">
																		{formatMinutes(info.minutes)}
																	</div>
																</li>
															))}
														</ul>
													);
												})()}
											</div>
										)}
									</div>
								);
							} else {
								const userData = data as UserActivityData;
								return (
									<div
										key={key}
										className="p-4 rounded transition-colors cursor-pointer"
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
										onClick={() => setExpandedKey(expandedKey === key ? null : key)}
									>
										<div className="flex items-center justify-between">
											<div>
												<div className="font-medium">{userData.userName || userData.userId}</div>
												<div className="text-sm opacity-70">
													{userData.dayCount}일 활동 ·{" "}
													{(() => {
														const dayCountSafe = userData.dayCount && userData.dayCount > 0
															? userData.dayCount
															: (userData.days && userData.days.length > 0 ? userData.days.length : 0);
														if (!dayCountSafe) {
															return <>평균 0분/일</>;
														}
														const avg = Math.round((userData.totalMinutes || 0) / dayCountSafe);
														return <>평균 {formatMinutes(avg)}/일</>;
													})()}
												</div>
											</div>
											<div className="text-right">
												<div className="text-lg font-semibold">{formatMinutes(userData.totalMinutes)}</div>
											</div>
										</div>

										{/* 사용자별 상세: 개별 활동 로그 */}
										{expandedKey === key && (
											<div className="mt-3 pt-3 border-t border-dashed border-zinc-700/50 text-sm">
												<div className="mb-2 font-medium">
													{userData.userName || userData.userId}님의 활동 로그
												</div>
												{(() => {
													const acts = (userData.activities || []).slice().sort((a: any, b: any) => {
														const aTime = new Date(a.startTime || a.startAt || a.date).getTime();
														const bTime = new Date(b.startTime || b.startAt || b.date).getTime();
														return bTime - aTime;
													});

													if (acts.length === 0) {
														return (
															<div className="text-xs opacity-70">
																해당 사용자의 상세 활동 로그가 없습니다.
															</div>
														);
													}

													return (
														<ul className="space-y-1 max-h-64 overflow-y-auto pr-1">
															{acts.map((act: any) => {
																const start = act.startTime || act.startAt;
																const end = act.endTime || act.endAt;
																const startDate = start ? new Date(start) : null;
																const endDate = end ? new Date(end) : null;
																const dur = typeof act.durationMinutes === "number"
																	? act.durationMinutes
																	: 0;
																return (
																	<li
																		key={act.id}
																		className="flex flex-col md:flex-row md:items-center md:justify-between text-xs md:text-sm py-1 border-b border-zinc-800/40 last:border-b-0"
																	>
																		<div>
																			<div className="font-medium">
																				{startDate
																					? startDate.toLocaleString("ko-KR", {
																							month: "long",
																							day: "numeric",
																							weekday: "short",
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
																			<div>{formatMinutes(dur)}</div>
																			{startDate && endDate && (
																				<div className="opacity-60">
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
													);
												})()}
											</div>
										)}
									</div>
								);
							}
						})}
					</div>
				)}
			</div>
		</div>
	);
}

