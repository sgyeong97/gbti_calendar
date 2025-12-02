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
	const [startDate, setStartDate] = useState<string>(
		new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
	);
	const [endDate, setEndDate] = useState<string>(
		new Date().toISOString().split('T')[0]
	);
	const [activityData, setActivityData] = useState<Record<string, ActivityData | UserActivityData>>({});
	const [stats, setStats] = useState<ActivityStats | null>(null);

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
				<h2 className="text-lg font-semibold mb-4">
					{groupBy === "day" ? "날짜별 활동" : "사용자별 활동"} ({sortedEntries.length}개)
				</h2>
				
				{loading ? (
					<div className="text-center py-8">로딩 중...</div>
				) : sortedEntries.length === 0 ? (
					<div className="text-center py-8" style={{ color: "var(--foreground)", opacity: 0.7 }}>
						활동 데이터가 없습니다.
					</div>
				) : (
					<div className="space-y-3 max-h-[600px] overflow-y-auto">
						{sortedEntries.map(([key, data]) => {
							if (groupBy === "day") {
								const dayData = data as ActivityData;
								return (
									<div
										key={key}
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
									</div>
								);
							} else {
								const userData = data as UserActivityData;
								return (
									<div
										key={key}
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
										<div className="flex items-center justify-between">
											<div>
												<div className="font-medium">{userData.userName || userData.userId}</div>
												<div className="text-sm opacity-70">
													{userData.dayCount}일 활동 · 평균 {formatMinutes(Math.round(userData.totalMinutes / userData.dayCount))}/일
												</div>
											</div>
											<div className="text-right">
												<div className="text-lg font-semibold">{formatMinutes(userData.totalMinutes)}</div>
											</div>
										</div>
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

