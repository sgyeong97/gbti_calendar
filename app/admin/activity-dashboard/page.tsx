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

type SuspiciousEntry = {
	userId: string;
	userName: string;
	count: number;
	activities: any[];
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
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [suspicious, setSuspicious] = useState<SuspiciousEntry[]>([]);
	const [expandedSuspiciousUser, setExpandedSuspiciousUser] = useState<string | null>(null);
	const [showSuspiciousModal, setShowSuspiciousModal] = useState(false);

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

	async function handleDeleteActivity(activityId: string) {
		if (!activityId) return;
		if (!window.confirm("이 활동 로그를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
			return;
		}

		setDeletingId(activityId);
		try {
			const res = await fetch("/api/discord-activity/delete", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id: activityId }),
			});

			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				console.error("활동 로그 삭제 실패:", err);
				alert("활동 로그 삭제에 실패했습니다.");
				return;
			}

			// 최신 데이터를 다시 불러와서 상태 동기화
			await fetchActivityData();
		} catch (err) {
			console.error("활동 로그 삭제 중 오류:", err);
			alert("활동 로그 삭제 중 오류가 발생했습니다.");
		} finally {
			setDeletingId(null);
		}
	}

	// userId 기준으로 userName 정규화: 가장 최근 createdAt의 userName 사용
	function normalizeUserNames(data: Record<string, ActivityData | UserActivityData>): Record<string, ActivityData | UserActivityData> {
		// 1) 모든 활동 수집
		const allActivities: any[] = [];
		for (const value of Object.values(data || {})) {
			if ((value as any).activities && Array.isArray((value as any).activities)) {
				allActivities.push(...(value as any).activities);
			}
		}

		if (allActivities.length === 0) return data;

		// 2) userId별로 가장 최근 createdAt의 userName 찾기
		const userIdToLatestName = new Map<string, { userName: string; createdAt: string }>();
		for (const act of allActivities) {
			const userId = act.userId || act.user_id || "";
			if (!userId) continue;

			const createdAt = act.createdAt || act.created_at || act.startTime || act.startAt || "";
			if (!createdAt) continue;

			const existing = userIdToLatestName.get(userId);
			if (!existing || createdAt > existing.createdAt) {
				const userName = act.userName || act.user_name || userId;
				userIdToLatestName.set(userId, { userName, createdAt });
			}
		}

		// 3) 모든 활동의 userName을 정규화된 userName으로 교체
		const normalizedData: Record<string, ActivityData | UserActivityData> = {};
		for (const [key, value] of Object.entries(data)) {
			if (groupBy === "day") {
				const dayData = value as ActivityData;
				const normalizedActivities = (dayData.activities || []).map((act: any) => {
					const userId = act.userId || act.user_id || "";
					const latest = userIdToLatestName.get(userId);
					if (latest) {
						return { ...act, userName: latest.userName };
					}
					return act;
				});
				// users 배열도 userId 기준으로 정규화
				const normalizedUsers = new Set<string>();
				normalizedActivities.forEach((act: any) => {
					const userId = act.userId || act.user_id || "";
					const latest = userIdToLatestName.get(userId);
					if (latest) {
						normalizedUsers.add(latest.userName);
					}
				});
				normalizedData[key] = {
					...dayData,
					activities: normalizedActivities,
					users: Array.from(normalizedUsers),
					userCount: normalizedUsers.size,
				};
			} else {
				const userData = value as UserActivityData;
				const normalizedActivities = (userData.activities || []).map((act: any) => {
					const userId = act.userId || act.user_id || "";
					const latest = userIdToLatestName.get(userId);
					if (latest) {
						return { ...act, userName: latest.userName };
					}
					return act;
				});
				const userId = userData.userId || "";
				const latest = userIdToLatestName.get(userId);
				normalizedData[key] = {
					...userData,
					activities: normalizedActivities,
					userName: latest ? latest.userName : (userData.userName || userData.userId),
				};
			}
		}

		// 4) 사용자별 그룹화인 경우, userId 기준으로 재그룹화
		if (groupBy === "user") {
			const userIdGroups = new Map<string, UserActivityData>();
			for (const value of Object.values(normalizedData)) {
				const userData = value as UserActivityData;
				const userId = userData.userId || "";
				if (!userId) continue;

				const existing = userIdGroups.get(userId);
				if (existing) {
					// 기존 데이터와 병합
					existing.totalMinutes += userData.totalMinutes;
					existing.activities.push(...(userData.activities || []));
					// days 중복 제거
					const allDays = new Set([...(existing.days || []), ...(userData.days || [])]);
					existing.days = Array.from(allDays);
					existing.dayCount = existing.days.length;
				} else {
					userIdGroups.set(userId, { ...userData });
				}
			}

			// userId를 키로 하는 새 객체 생성
			const regrouped: Record<string, UserActivityData> = {};
			for (const [userId, userData] of userIdGroups.entries()) {
				// activities를 시간순 정렬
				userData.activities.sort((a: any, b: any) => {
					const aTime = new Date(a.startTime || a.startAt || a.date).getTime();
					const bTime = new Date(b.startTime || b.startAt || b.date).getTime();
					return bTime - aTime; // 최신순
				});
				// userId를 키로 사용 (표시는 userName 사용)
				regrouped[userId] = userData;
			}
			return regrouped;
		}

		return normalizedData;
	}

	// date 필드 보정: startTime 또는 createdAt의 날짜를 사용
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

	function normalizeDates(data: Record<string, ActivityData | UserActivityData>): Record<string, ActivityData | UserActivityData> {
		const normalized: Record<string, ActivityData | UserActivityData> = {};

		for (const [key, value] of Object.entries(data)) {
			if (groupBy === "day") {
				const dayData = value as ActivityData;
				// 날짜별 그룹화인 경우, 각 활동의 실제 날짜를 계산해서 재그룹화
				const activitiesByDate = new Map<string, any[]>();

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
			} else {
				// 사용자별 그룹화인 경우, 각 활동의 date 필드만 보정
				const userData = value as UserActivityData;
				const normalizedActivities = (userData.activities || []).map((act: any) => {
					const timeStr = act.startTime || act.startAt || act.createdAt || act.created_at || act.date;
					if (timeStr) {
						const actualDate = getLocalDateString(timeStr);
						if (actualDate) {
							return { ...act, date: actualDate };
						}
					}
					return act;
				});

				// days 배열도 실제 날짜로 재계산
				const actualDays = new Set<string>();
				normalizedActivities.forEach((act: any) => {
					if (act.date) actualDays.add(act.date);
				});

				normalized[key] = {
					...userData,
					activities: normalizedActivities,
					days: Array.from(actualDays),
					dayCount: actualDays.size,
				};
			}
		}

		return normalized;
	}

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
			const rawData = result.data || {};

			// 디버깅: 받아온 데이터 확인
			console.log("[대시보드] 받아온 원본 데이터:", rawData);
			if (groupBy === "day") {
				for (const [dateKey, dayData] of Object.entries(rawData)) {
					const activities = (dayData as ActivityData).activities || [];
					console.log(`[대시보드] 날짜 ${dateKey}: ${activities.length}개 활동`);
					activities.forEach((act: any, idx: number) => {
						if (idx < 3) { // 처음 3개만 로그
							console.log(`  - 활동 ${idx + 1}: date=${act.date}, startTime=${act.startTime}, createdAt=${act.createdAt}`);
						}
					});
				}
			}

			// date 필드 보정 (startTime 또는 createdAt의 날짜 사용)
			const dateNormalized = normalizeDates(rawData);
			console.log("[대시보드] 날짜 보정 후 데이터:", dateNormalized);
			// userName 정규화 (userId 기준으로 가장 최근 userName 사용)
			const normalizedData = normalizeUserNames(dateNormalized);
			setActivityData(normalizedData);

			// 통계 계산
			calculateStats(normalizedData);
			// 수상한 활동 계산
			calculateSuspicious(normalizedData);
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

	// 수상한 활동 탐지:
	// - 기준 1) 1분 안에 2채널 이상의 채널 입장
	// - 기준 2) 총 입장시간이 0분인 세션이 3개 이상 연속으로 있음
	// 위 두 조건을 모두 만족하는 구간에 포함된 세션들을 "수상한 활동"으로 간주
	function calculateSuspicious(data: Record<string, ActivityData | UserActivityData>) {
		const suspiciousByUser = new Map<string, SuspiciousEntry>();

		// 1) 데이터 구조: userId -> 활동 배열 (시간순)
		const byUser = new Map<string, any[]>();

		for (const value of Object.values(data || {})) {
			if ((value as any).activities && Array.isArray((value as any).activities)) {
				for (const act of (value as any).activities as any[]) {
					const userId: string = act.userId || act.user_id || "";
					if (!userId) continue;
					const arr = byUser.get(userId) || [];
					arr.push(act);
					byUser.set(userId, arr);
				}
			}
		}

		if (byUser.size === 0) {
			setSuspicious([]);
			return;
		}

		// 2) 각 사용자별로 시간순 정렬 후 패턴 탐지
		for (const [userId, actsRaw] of byUser.entries()) {
			const acts = actsRaw
				.filter((a: any) => a)
				.slice()
				.sort((a: any, b: any) => {
					const aTime = new Date(a.startTime || a.startAt || a.date).getTime();
					const bTime = new Date(b.startTime || b.startAt || b.date).getTime();
					return aTime - bTime;
				});

			if (acts.length < 3) continue;

			const suspiciousSet = new Set<string>(); // 활동 ID 집합

			for (let i = 0; i <= acts.length - 3; i++) {
				const triple = acts.slice(i, i + 3);

				// 기준 2: 연속 3개가 모두 0분 세션
				if (!triple.every((a: any) => (a.durationMinutes ?? 0) === 0)) continue;

				// 시작~끝이 1분(60초) 이내인지
				const firstTime = new Date(
					triple[0].startTime || triple[0].startAt || triple[0].date,
				).getTime();
				const lastTime = new Date(
					triple[2].startTime || triple[2].startAt || triple[2].date,
				).getTime();
				if (Number.isNaN(firstTime) || Number.isNaN(lastTime)) continue;
				const diffMs = lastTime - firstTime;
				if (diffMs > 60 * 1000) continue; // 1분 초과

				// 기준 1: 이 구간 안에서 2개 이상의 채널
				const channelSet = new Set(
					triple.map(
						(a: any) => a.channelId || a.channelName || (a.channel_id ?? "unknown"),
					),
				);
				if (channelSet.size < 2) continue;

				// 조건을 만족하는 triple에 포함된 세션들 모두 수상한 세션으로 표시
				for (const a of triple) {
					if (a.id) suspiciousSet.add(a.id);
				}
			}

			if (suspiciousSet.size === 0) continue;

			const suspiciousActivities = acts.filter((a: any) =>
				a.id ? suspiciousSet.has(a.id) : false,
			);
			if (suspiciousActivities.length === 0) continue;

			const sample = suspiciousActivities[0];
			const userName: string = sample.userName || sample.user_name || userId || "알 수 없음";

			suspiciousByUser.set(userId, {
				userId,
				userName,
				count: suspiciousActivities.length,
				activities: suspiciousActivities,
			});
		}

		const list = Array.from(suspiciousByUser.values()).sort((a, b) => b.count - a.count);
		setSuspicious(list);
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
			// userId 기준으로 정렬 (같은 userId는 하나로 합쳐져 있음)
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
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
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
					{/* 수상한 활동 카드 */}
					<div
						className="rounded-lg p-4 cursor-pointer transition-colors"
						style={{
							background: "var(--background)",
							border: "1px solid var(--accent)",
							opacity: suspicious.length === 0 ? 0.7 : 1,
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.background =
								"color-mix(in srgb, var(--background) 95%, var(--accent) 5%)";
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.background = "var(--background)";
						}}
						onClick={() => {
							if (suspicious.length > 0) {
								setShowSuspiciousModal(true);
							}
						}}
					>
						<div className="text-sm opacity-70 mb-1">수상한 활동</div>
						<div className="text-2xl font-bold">
							{(() => {
								const total = suspicious.reduce(
									(sum, entry) => sum + entry.activities.length,
									0,
								);
								return total > 0 ? `${total}건` : "없음";
							})()}
						</div>
						<div className="text-xs opacity-70 mt-1">
							클릭해서 상세 로그 보기
						</div>
					</div>
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
																const isDeleting = deletingId === act.id;
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
																		<div className="mt-1 md:mt-0 flex flex-col md:items-end gap-1 text-right">
																			<div className="flex items-center justify-end gap-2">
																				<div>{formatMinutes(dur)}</div>
																				<button
																					className="px-2 py-1 border rounded text-[11px] md:text-xs hover:bg-red-600/10 hover:border-red-500 transition-colors disabled:opacity-50 disabled:cursor-default"
																					onClick={(e) => {
																						e.stopPropagation();
																						void handleDeleteActivity(act.id);
																					}}
																					disabled={isDeleting}
																				>
																					{isDeleting ? "삭제 중..." : "삭제"}
																				</button>
																			</div>
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

			{/* 수상한 활동 모달 */}
			{showSuspiciousModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center">
					{/* 배경 */}
					<div
						className="absolute inset-0 bg-black/60"
						onClick={() => setShowSuspiciousModal(false)}
					/>
					{/* 내용 */}
					<div
						className="relative max-w-3xl w-[90%] max-h-[80vh] rounded-lg shadow-lg p-4 md:p-6"
						style={{
							background: "var(--background)",
							color: "var(--foreground)",
							border: "1px solid var(--accent)",
						}}
					>
						<div className="flex items-center justify-between mb-3">
							<div>
								<h2 className="text-lg font-semibold">수상한 활동 상세</h2>
								<p className="text-xs md:text-sm opacity-70 mt-1">
									1분 안에 2채널 이상의 채널을 이동하면서 0분 세션이 3개 이상 연속으로
									발생한 경우를 수상한 활동으로 표시합니다.
								</p>
							</div>
							<button
								className="px-3 py-1 border rounded text-sm cursor-pointer"
								onClick={() => setShowSuspiciousModal(false)}
							>
								닫기
							</button>
						</div>

						{suspicious.length === 0 ? (
							<div
								className="text-center py-6 text-sm"
								style={{ color: "var(--foreground)", opacity: 0.7 }}
							>
								현재 기간에는 수상한 활동이 감지되지 않았습니다.
							</div>
						) : (
							<div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
								{suspicious.map((entry) => {
									const isExpanded = expandedSuspiciousUser === entry.userId;
									return (
										<div
											key={entry.userId}
											className="p-3 rounded border cursor-pointer transition-colors"
											style={{
												borderColor: "var(--accent)",
												background: "var(--background)",
											}}
											onClick={() =>
												setExpandedSuspiciousUser(
													isExpanded ? null : entry.userId,
												)
											}
										>
											<div className="flex items-center justify-between">
												<div>
													<div className="font-medium">
														{entry.userName || entry.userId}
													</div>
													<div className="text-xs opacity-70">
														수상한 로그 {entry.count}개
													</div>
												</div>
												<div className="text-xs opacity-70">
													{isExpanded ? "접기 ▲" : "펼치기 ▼"}
												</div>
											</div>

											{isExpanded && (
												<div className="mt-3 pt-2 border-t border-dashed border-zinc-700/50 text-xs md:text-sm">
													<ul className="space-y-1 max-h-64 overflow-y-auto pr-1">
														{entry.activities
															.slice()
															.sort((a: any, b: any) => {
																const aTime = new Date(
																	a.startTime ||
																		a.startAt ||
																		a.date,
																).getTime();
																const bTime = new Date(
																	b.startTime ||
																		b.startAt ||
																		b.date,
																).getTime();
																return bTime - aTime;
															})
															.map((act: any) => {
																const start =
																	act.startTime ||
																	act.startAt;
																const end =
																	act.endTime || act.endAt;
																const startDate = start
																	? new Date(start)
																	: null;
																const endDate = end
																	? new Date(end)
																	: null;
																const dur =
																	typeof act.durationMinutes ===
																	"number"
																		? act.durationMinutes
																		: 0;
																return (
																	<li
																		key={act.id}
																		className="flex flex-col md:flex-row md:items-center md:justify-between py-1 border-b border-zinc-800/40 last:border-b-0"
																	>
																		<div>
																			<div className="font-medium">
																				{startDate
																					? startDate.toLocaleString(
																							"ko-KR",
																							{
																								month: "long",
																								day: "numeric",
																								weekday:
																									"short",
																								hour: "2-digit",
																								minute:
																									"2-digit",
																							},
																					  )
																					: act.date}
																			</div>
																			<div className="opacity-70">
																				채널:{" "}
																				{act.channelName ||
																					act.channelId ||
																					"알 수 없음"}
																			</div>
																		</div>
																		<div className="mt-1 md:mt-0 text-right">
																			<div>
																				{formatMinutes(
																					dur,
																				)}
																			</div>
																			{startDate &&
																				endDate && (
																					<div className="opacity-60">
																						{startDate.toLocaleTimeString(
																							"ko-KR",
																							{
																								hour: "2-digit",
																								minute:
																									"2-digit",
																							},
																						)}
																						{" ~ "}
																						{endDate.toLocaleTimeString(
																							"ko-KR",
																							{
																								hour: "2-digit",
																								minute:
																									"2-digit",
																							},
																						)}
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
				</div>
			)}
		</div>
	);
}

