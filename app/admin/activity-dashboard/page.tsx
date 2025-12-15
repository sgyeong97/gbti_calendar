"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { applyColorTheme } from "@/app/lib/color-themes";

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
	isActive?: boolean; // 서버에 있는 사용자인지 여부
	inServer?: boolean; // 서버에 있는 사용자인지 여부 (isActive와 동일한 의미)
};

type ActivityStats = {
	totalUsers: number;
	totalMinutes: number;
	averageMinutesPerUser: number;
	mostActiveUser: { userId: string; userName: string; minutes: number } | null;
	mostActiveDay: { date: string; minutes: number } | null;
};

type CloseGroupUser = {
	userId: string;
	userName: string;
	closeGroupCount: number; // 끼리끼리 인원 수
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
	const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc"); // 날짜별: desc(최신순), 사용자별: desc(활동량 많은순)
	const [dateRangeType, setDateRangeType] = useState<"week" | "month" | "custom">("month");
	// 한국 시간대(KST) 기준 날짜 유틸
	function toKoreaDate(date: Date): Date {
		const utcTime = date.getTime() + date.getTimezoneOffset() * 60000;
		return new Date(utcTime + 9 * 60 * 60000);
	}
	function formatDateYMD(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}
	const [startDate, setStartDate] = useState<string>(() => {
		const todayKorea = toKoreaDate(new Date());
		const monthAgo = new Date(todayKorea);
		monthAgo.setDate(monthAgo.getDate() - 30);
		return formatDateYMD(monthAgo);
	});
	const [endDate, setEndDate] = useState<string>(() => {
		const todayKorea = toKoreaDate(new Date());
		return formatDateYMD(todayKorea);
	});

	// 한국 시간 기준으로 오늘 날짜 가져오기
	function getKoreaToday(): string {
		return formatDateYMD(toKoreaDate(new Date()));
	}

	// 날짜 범위 타입 변경 시 날짜 자동 설정
	useEffect(() => {
		if (dateRangeType === "week") {
			// 한국 시간 기준으로 날짜 계산
			const today = toKoreaDate(new Date());
			today.setHours(0, 0, 0, 0);
			const weekAgo = new Date(today);
			weekAgo.setDate(weekAgo.getDate() - 7);
			setStartDate(formatDateYMD(weekAgo));
			setEndDate(formatDateYMD(today));
		} else if (dateRangeType === "month") {
			// 한국 시간 기준으로 날짜 계산
			const today = toKoreaDate(new Date());
			today.setHours(0, 0, 0, 0);
			const monthAgo = new Date(today);
			monthAgo.setDate(monthAgo.getDate() - 30);
			setStartDate(formatDateYMD(monthAgo));
			setEndDate(formatDateYMD(today));
		}
		// custom인 경우는 사용자가 직접 입력하므로 변경하지 않음
	}, [dateRangeType]);
	const [activityData, setActivityData] = useState<Record<string, ActivityData | UserActivityData>>({});
	const [stats, setStats] = useState<ActivityStats | null>(null);
	const [expandedKey, setExpandedKey] = useState<string | null>(null);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [closeGroupUsers, setCloseGroupUsers] = useState<CloseGroupUser[]>([]);
	const [showCloseGroupModal, setShowCloseGroupModal] = useState(false);
	const [syncingUsers, setSyncingUsers] = useState(false);
	const [includeInactive, setIncludeInactive] = useState<boolean>(true); // 기본값: true (서버에 나간 사용자 포함)
	const DEFAULT_GUILD_ID = "1373916592294985828";

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
		// 그룹 기준이나 날짜가 바뀌면 검색/페이지/확장 상태 초기화
		setSearchTerm("");
		setCurrentPage(1);
		setExpandedKey(null);
		fetchActivityData();
	}, [groupBy, startDate, endDate, dateRangeType, includeInactive]);

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
	// 한국 시간대 기준으로 날짜 추출 (UTC 변환으로 인한 날짜 밀림 방지)
	function getKoreaDateString(dateStr: string): string {
		const date = new Date(dateStr);
		if (isNaN(date.getTime())) return "";
		// 입력된 시간을 KST로 변환한 뒤 날짜만 추출
		const koreaDate = toKoreaDate(date);
		return formatDateYMD(koreaDate);
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
					const actualDate = getKoreaDateString(timeStr);
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
						const actualDate = getKoreaDateString(timeStr);
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
				startDate,
				endDate,
				includeInactive: includeInactive ? "true" : "false",
			});

			// 최적화된 API 사용
			const apiEndpoint = groupBy === "day" 
				? `/api/discord-activity/grouped-by-date`
				: `/api/discord-activity/grouped-by-user`;

			const res = await fetch(`${apiEndpoint}?${params}`);
			if (!res.ok) throw new Error("Failed to fetch");
			
			const result = await res.json();
			const rawData = result.data || [];

			console.log(`[대시보드] 최적화된 API 응답: ${rawData.length}개 항목`);

			// 최적화된 API 응답을 기존 형식으로 변환
			let convertedData: Record<string, ActivityData | UserActivityData> = {};

			if (groupBy === "day") {
				// 날짜별 그룹화 데이터 변환
				for (const dayItem of rawData) {
					// totalMinutes를 숫자로 변환 (문자열일 수 있음)
					const totalMinutes = typeof dayItem.totalMinutes === 'string' 
						? parseInt(dayItem.totalMinutes, 10) 
						: (dayItem.totalMinutes || 0);
					
					// users 배열을 activities로 변환 (기존 형식 호환)
					const activities: any[] = [];
					for (const user of dayItem.users || []) {
						// 사용자별 활동을 시뮬레이션 (실제 활동 데이터는 없지만 통계는 유지)
						const userMinutes = typeof user.totalMinutes === 'string'
							? parseInt(user.totalMinutes, 10)
							: (user.totalMinutes || 0);
						
						activities.push({
							userId: user.userId,
							userName: user.userName,
							durationMinutes: userMinutes,
							date: dayItem.date,
							isActive: user.isActive !== undefined ? user.isActive : (user.inServer !== undefined ? user.inServer : true), // 활성 상태 정보 보존
							inServer: user.inServer !== undefined ? user.inServer : (user.isActive !== undefined ? user.isActive : true),
						});
					}

					convertedData[dayItem.date] = {
						date: dayItem.date,
						totalMinutes: totalMinutes,
						userCount: dayItem.userCount || 0,
						users: dayItem.users?.map((u: any) => u.userId) || [],
						activities,
					};
				}
			} else {
				// 사용자별 그룹화 데이터 변환
				for (const userItem of rawData) {
					// totalMinutes를 숫자로 변환 (문자열일 수 있음)
					const totalMinutes = typeof userItem.totalMinutes === 'string'
						? parseInt(userItem.totalMinutes, 10)
						: (userItem.totalMinutes || 0);
					
					// dates 배열을 activities로 변환 (기존 형식 호환)
					const activities: any[] = [];
					for (const dateItem of userItem.dates || []) {
						for (const activity of dateItem.activities || []) {
							activities.push({
								...activity,
								date: dateItem.date,
								userId: userItem.userId,
								userName: userItem.userName,
							});
						}
					}

					convertedData[userItem.userId] = {
						userId: userItem.userId,
						userName: userItem.userName,
						totalMinutes: totalMinutes,
						dayCount: userItem.activeDays || 0,
						days: userItem.dates?.map((d: any) => d.date) || [],
						activities,
						isActive: userItem.isActive !== undefined ? userItem.isActive : (userItem.inServer !== undefined ? userItem.inServer : true), // 활성 상태 정보 보존
						inServer: userItem.inServer !== undefined ? userItem.inServer : (userItem.isActive !== undefined ? userItem.isActive : true),
					};
				}
			}

			setActivityData(convertedData);

			// 통계 계산
			calculateStats(convertedData);
			// 끼리끼리 인원 계산
			await calculateCloseGroupUsers();
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
			// totalMinutes를 숫자로 안전하게 변환
			const totalMinutes = days.reduce((sum, day) => {
				const minutes = typeof day.totalMinutes === 'string' 
					? parseInt(day.totalMinutes, 10) 
					: (day.totalMinutes || 0);
				return sum + (isNaN(minutes) ? 0 : minutes);
			}, 0);
			
			const allUsers = new Set<string>();
			days.forEach(day => day.users.forEach(u => allUsers.add(u)));
			
			const mostActiveDay = days.reduce((max, day) => {
				const maxMinutes = typeof max.totalMinutes === 'string'
					? parseInt(max.totalMinutes, 10)
					: (max.totalMinutes || 0);
				const dayMinutes = typeof day.totalMinutes === 'string'
					? parseInt(day.totalMinutes, 10)
					: (day.totalMinutes || 0);
				return (isNaN(dayMinutes) ? 0 : dayMinutes) > (isNaN(maxMinutes) ? 0 : maxMinutes) ? day : max;
			}, days[0]);

			const mostActiveMinutes = typeof mostActiveDay.totalMinutes === 'string'
				? parseInt(mostActiveDay.totalMinutes, 10)
				: (mostActiveDay.totalMinutes || 0);

			setStats({
				totalUsers: allUsers.size,
				totalMinutes: isNaN(totalMinutes) ? 0 : totalMinutes,
				averageMinutesPerUser: allUsers.size > 0 ? Math.round(totalMinutes / allUsers.size) : 0,
				mostActiveUser: null,
				mostActiveDay: {
					date: mostActiveDay.date,
					minutes: isNaN(mostActiveMinutes) ? 0 : mostActiveMinutes,
				},
			});
		} else {
			const users = Object.values(data) as UserActivityData[];
			// totalMinutes를 숫자로 안전하게 변환
			const totalMinutes = users.reduce((sum, user) => {
				const minutes = typeof user.totalMinutes === 'string'
					? parseInt(user.totalMinutes, 10)
					: (user.totalMinutes || 0);
				return sum + (isNaN(minutes) ? 0 : minutes);
			}, 0);
			
			const mostActiveUser = users.reduce((max, user) => {
				const maxMinutes = typeof max.totalMinutes === 'string'
					? parseInt(max.totalMinutes, 10)
					: (max.totalMinutes || 0);
				const userMinutes = typeof user.totalMinutes === 'string'
					? parseInt(user.totalMinutes, 10)
					: (user.totalMinutes || 0);
				return (isNaN(userMinutes) ? 0 : userMinutes) > (isNaN(maxMinutes) ? 0 : maxMinutes) ? user : max;
			}, users[0]);

			const mostActiveMinutes = typeof mostActiveUser.totalMinutes === 'string'
				? parseInt(mostActiveUser.totalMinutes, 10)
				: (mostActiveUser.totalMinutes || 0);

			setStats({
				totalUsers: users.length,
				totalMinutes: isNaN(totalMinutes) ? 0 : totalMinutes,
				averageMinutesPerUser: users.length > 0 ? Math.round(totalMinutes / users.length) : 0,
				mostActiveUser: {
					userId: mostActiveUser.userId,
					userName: mostActiveUser.userName,
					minutes: isNaN(mostActiveMinutes) ? 0 : mostActiveMinutes,
				},
				mostActiveDay: null,
			});
		}
	}

	// 사용자 이름 동기화
	async function syncUserNames() {
		setSyncingUsers(true);
		try {
			const params = new URLSearchParams({
				guildId: DEFAULT_GUILD_ID,
			});

			const res = await fetch(`/api/discord-activity/sync-user-names?${params.toString()}`, {
				method: 'POST',
			});
			
			if (!res.ok) {
				const error = await res.json();
				throw new Error(error.error || "사용자 이름 동기화 실패");
			}
			
			const result = await res.json();
			
			// 성공 메시지 표시
			const summary = result.summary || {};
			const message = `사용자 이름 동기화 완료!\n\n` +
				`- DB 사용자: ${summary.totalDbUsers || 0}명\n` +
				`- Discord 서버 사용자: ${summary.totalServerUsers || 0}명\n` +
				`- 업데이트: ${summary.updatedCount || 0}명\n` +
				`- 변경 없음: ${summary.skippedCount || 0}명\n` +
				`- 서버에 없음: ${summary.notFoundCount || 0}명`;
			
			alert(message);
			
			// 데이터 새로고침
			await fetchActivityData();
		} catch (err: any) {
			console.error("사용자 이름 동기화 실패:", err);
			alert(`사용자 이름 동기화 중 오류가 발생했습니다: ${err.message || String(err)}`);
		} finally {
			setSyncingUsers(false);
		}
	}

	// 끼리끼리 인원 5명 이상인 유저 계산 (최적화된 API 사용)
	async function calculateCloseGroupUsers() {
		try {
			// 최적화된 API 사용 (백엔드에서 직접 집계)
			const params = new URLSearchParams({
				minGroupSize: "5",
				countOffset: "10",
				includeInactive: includeInactive ? "true" : "false",
			});
			const res = await fetch(`/api/discord-activity/close-group-users?${params}`);
			
			// 백엔드에 아직 구현되지 않았다면 빈 배열 반환 (404 등)
			if (!res.ok) {
				console.log("[대시보드] 끼리끼리 인원 계산 API가 아직 구현되지 않았습니다. 기능을 비활성화합니다.");
				setCloseGroupUsers([]);
				return;
			}
			
			const result = await res.json();
			const data = result.data || [];
			
			// 응답 데이터를 기존 형식으로 변환
			const closeGroupUsersList: CloseGroupUser[] = data.map((item: any) => ({
				userId: item.userId,
				userName: item.userName || item.userId,
				closeGroupCount: item.closeGroupCount,
			}));
			
			setCloseGroupUsers(closeGroupUsersList);
		} catch (err) {
			console.error("끼리끼리 인원 계산 실패:", err);
			setCloseGroupUsers([]);
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
			// 날짜 정렬
			if (sortOrder === "asc") {
				return a[0].localeCompare(b[0]); // 날짜 오름차순
			} else {
				return b[0].localeCompare(a[0]); // 날짜 내림차순
			}
		} else {
			const aData = a[1] as UserActivityData;
			const bData = b[1] as UserActivityData;
			// 활동량 정렬
			if (sortOrder === "asc") {
				return aData.totalMinutes - bData.totalMinutes; // 활동량 오름차순
			} else {
				return bData.totalMinutes - aData.totalMinutes; // 활동량 내림차순
			}
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
						<div className="flex items-center justify-between mb-1">
							<div className="text-sm opacity-70">총 사용자 수</div>
							<button
								onClick={syncUserNames}
								disabled={syncingUsers}
								className="text-lg cursor-pointer transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
								style={{ color: "var(--accent)" }}
								title="사용자 이름 동기화"
							>
								{syncingUsers ? "⏳" : "🔄"}
							</button>
						</div>
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
					{/* 분석 페이지 이동 버튼들 */}
					<div
						className="rounded-lg p-4"
						style={{
							background: "var(--background)",
							border: "1px solid var(--accent)",
						}}
					>
						<div className="text-sm opacity-70 mb-3">분석 페이지</div>
						<div className="flex gap-2">
							<button
								className="flex-1 px-4 py-3 rounded text-sm font-semibold transition-colors cursor-pointer"
								style={{
									background: "var(--accent)",
									color: "var(--foreground)",
									border: "1px solid var(--accent)",
								}}
								onMouseEnter={(e) => {
									e.currentTarget.style.background = "color-mix(in srgb, var(--accent) 80%, var(--foreground) 20%)";
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.background = "var(--accent)";
								}}
								onClick={() => router.push("/admin/activity-dashboard/close-group")}
							>
								끼리끼리
							</button>
							<button
								className="flex-1 px-4 py-3 rounded text-sm font-semibold transition-colors cursor-pointer"
								style={{
									background: "var(--accent)",
									color: "var(--foreground)",
									border: "1px solid var(--accent)",
								}}
								onMouseEnter={(e) => {
									e.currentTarget.style.background = "color-mix(in srgb, var(--accent) 80%, var(--foreground) 20%)";
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.background = "var(--accent)";
								}}
								onClick={() => router.push("/admin/activity-dashboard/channel-analysis")}
							>
								채널별
							</button>
						</div>
					</div>
				</div>
			)}

			{/* 필터 및 설정 */}
			<div 
				className="rounded-lg p-6 mb-6"
				style={{ 
					background: "var(--background)", 
					border: "1px solid var(--accent)" 
				}}
			>
				<div className="flex gap-4 flex-wrap items-end">
					{/* 그룹화 기준 */}
					<div className="flex-1 min-w-[200px]">
						<label className="block text-sm mb-2">그룹화 기준</label>
						<div className="flex gap-2">
							<button
								className={`flex-1 px-4 py-2 rounded transition-colors text-sm ${
									groupBy === "day" ? "font-semibold" : "opacity-70"
								}`}
								style={{
									backgroundColor: groupBy === "day" ? "var(--accent)" : "transparent",
									color: "var(--foreground)",
									border: "1px solid var(--accent)",
								}}
								onClick={() => {
									if (groupBy !== "day") {
										setGroupBy("day");
									}
								}}
							>
								날짜별
							</button>
							<button
								className={`flex-1 px-4 py-2 rounded transition-colors text-sm ${
									groupBy === "user" ? "font-semibold" : "opacity-70"
								}`}
								style={{
									backgroundColor: groupBy === "user" ? "var(--accent)" : "transparent",
									color: "var(--foreground)",
									border: "1px solid var(--accent)",
								}}
								onClick={() => {
									if (groupBy !== "user") {
										setGroupBy("user");
									}
								}}
							>
								사용자별
							</button>
						</div>
					</div>

					{/* 날짜 범위 선택 및 입력 */}
					<div className="flex-1 min-w-[200px]">
						<label className="block text-sm mb-2">기간 선택</label>
						<div className="flex flex-col gap-2">
							<div className="flex gap-2 items-center">
								<button
									className={`px-3 py-2 rounded transition-colors text-sm ${
										dateRangeType === "week" ? "font-semibold" : "opacity-70"
									}`}
									style={{
										backgroundColor: dateRangeType === "week" ? "var(--accent)" : "transparent",
										color: "var(--foreground)",
										border: "1px solid var(--accent)",
									}}
									onClick={() => setDateRangeType("week")}
								>
									일주일
								</button>
								<button
									className={`px-3 py-2 rounded transition-colors text-sm ${
										dateRangeType === "month" ? "font-semibold" : "opacity-70"
									}`}
									style={{
										backgroundColor: dateRangeType === "month" ? "var(--accent)" : "transparent",
										color: "var(--foreground)",
										border: "1px solid var(--accent)",
									}}
									onClick={() => setDateRangeType("month")}
								>
									한달
								</button>
								<button
									className={`px-3 py-2 rounded transition-colors text-sm ${
										dateRangeType === "custom" ? "font-semibold" : "opacity-70"
									}`}
									style={{
										backgroundColor: dateRangeType === "custom" ? "var(--accent)" : "transparent",
										color: "var(--foreground)",
										border: "1px solid var(--accent)",
									}}
									onClick={() => setDateRangeType("custom")}
								>
									커스텀
								</button>
							</div>
							{dateRangeType === "custom" && (
								<div className="flex gap-2 items-center">
									<input
										type="date"
										value={startDate}
										onChange={(e) => setStartDate(e.target.value)}
										className="border rounded px-3 py-2 text-sm flex-1"
									/>
									<span className="opacity-70">~</span>
									<input
										type="date"
										value={endDate}
										onChange={(e) => setEndDate(e.target.value)}
										className="border rounded px-3 py-2 text-sm flex-1"
									/>
								</div>
							)}
						</div>
					</div>

					{/* 서버에 나간 사용자 포함 옵션 */}
					<div className="flex items-center gap-2">
						<label className="flex items-center gap-2 cursor-pointer">
							<input
								type="checkbox"
								checked={includeInactive}
								onChange={(e) => {
									setIncludeInactive(e.target.checked);
								}}
								className="w-4 h-4 cursor-pointer"
								style={{
									accentColor: "var(--accent)"
								}}
							/>
							<span className="text-sm">서버에 나간 사용자 포함</span>
						</label>
					</div>
				</div>
			</div>

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
							placeholder={groupBy === "day" ? "날짜 검색" : "사용자 이름 검색..."}
							value={searchTerm}
							onChange={(e) => {
								setSearchTerm(e.target.value);
								setCurrentPage(1);
							}}
							className="border rounded px-3 py-2 text-sm w-full md:w-56"
						/>

						{/* 정렬 */}
						<button
							className="px-3 py-2 text-sm rounded transition-colors"
							style={{
								backgroundColor: "transparent",
								color: "var(--foreground)",
								border: "1px solid var(--accent)",
							}}
							onClick={() => {
								setSortOrder(sortOrder === "asc" ? "desc" : "asc");
								setCurrentPage(1);
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.background = "color-mix(in srgb, var(--accent) 20%, transparent)";
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.background = "transparent";
							}}
						>
							{groupBy === "day" 
								? (sortOrder === "asc" ? "날짜 오름차순" : "날짜 내림차순")
								: (sortOrder === "asc" ? "활동량 오름차순" : "활동량 내림차순")
							}
						</button>

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
								style={{
									background: "var(--background)",
									color: "var(--foreground)",
									borderColor: "var(--accent)",
								}}
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
											<div className="flex-1 cursor-pointer" onClick={() => setExpandedKey(expandedKey === key ? null : key)}>
												<div className="font-medium">{formatDate(dayData.date)}</div>
												<div className="text-sm opacity-70">
													{dayData.userCount}명 참여 · {formatMinutes(dayData.totalMinutes)}
												</div>
											</div>
											<div className="flex items-center gap-3">
												<div className="text-right">
													<div className="text-lg font-semibold">{formatMinutes(dayData.totalMinutes)}</div>
												</div>
												<button
													className="px-3 py-1 text-sm rounded transition-colors"
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
													onClick={(e) => {
														e.stopPropagation();
														router.push(`/admin/activity-dashboard/day/${dayData.date}`);
													}}
												>
													자세히보기
												</button>
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
															{entries.map(([name, info]) => {
																// 해당 사용자의 활성 상태 확인
																const userActivity = dayData.activities.find((act: any) => 
																	(act.userName || act.userId) === name
																);
																const isActive = userActivity?.isActive !== false && userActivity?.inServer !== false;
																const showInactive = includeInactive && !isActive;
																
																return (
																	<li key={name} className="flex items-center justify-between text-xs md:text-sm">
																		<div>
																			<span className="font-medium">
																				{name}
																				{showInactive && (
																					<span className="ml-1 text-red-500" title="서버에 나간 사용자">(X)</span>
																				)}
																			</span>
																			<span className="opacity-70 ml-2">
																				({info.count}회 활동)
																			</span>
																		</div>
																		<div className="font-semibold">
																			{formatMinutes(info.minutes)}
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
											<div className="flex-1 cursor-pointer" onClick={() => setExpandedKey(expandedKey === key ? null : key)}>
												<div className="font-medium">
													{userData.userName || userData.userId}
													{includeInactive && (userData.isActive === false || userData.inServer === false) && (
														<span className="ml-1 text-red-500" title="서버에 나간 사용자">(X)</span>
													)}
												</div>
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
											<div className="flex items-center gap-3">
												<div className="text-right">
													<div className="text-lg font-semibold">{formatMinutes(userData.totalMinutes)}</div>
												</div>
												<button
													className="px-3 py-1 text-sm rounded transition-colors"
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
													onClick={(e) => {
														e.stopPropagation();
														router.push(`/admin/activity-dashboard/user/${userData.userId}`);
													}}
												>
													자세히보기
												</button>
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

			{/* 끼리끼리 인원 모달 */}
			{showCloseGroupModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center">
					{/* 배경 */}
					<div
						className="absolute inset-0 bg-black/60"
						onClick={() => setShowCloseGroupModal(false)}
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
								<h2 className="text-lg font-semibold">끼리끼리 인원 5명 이상</h2>
								<p className="text-xs md:text-sm opacity-70 mt-1">
									평균 만남 횟수보다 10회 이상 많은 사람이 5명 이상인 유저 목록입니다.
								</p>
							</div>
							<button
								className="px-3 py-1 border rounded text-sm cursor-pointer"
								onClick={() => setShowCloseGroupModal(false)}
							>
								닫기
							</button>
						</div>

						{closeGroupUsers.length === 0 ? (
							<div
								className="text-center py-6 text-sm"
								style={{ color: "var(--foreground)", opacity: 0.7 }}
							>
								끼리끼리 인원이 5명 이상인 유저가 없습니다.
							</div>
						) : (
							<div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
								{closeGroupUsers.map((user) => (
									<div
										key={user.userId}
										className="p-3 rounded border transition-colors cursor-pointer"
										style={{
											borderColor: "var(--accent)",
											background: "var(--background)",
										}}
										onMouseEnter={(e) => {
											e.currentTarget.style.background =
												"color-mix(in srgb, var(--background) 95%, var(--accent) 5%)";
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.background = "var(--background)";
										}}
										onClick={() => {
											router.push(`/admin/activity-dashboard/user/${user.userId}`);
										}}
									>
										<div className="flex items-center justify-between">
											<div>
												<div className="font-medium">
													{user.userName || user.userId}
												</div>
												<div className="text-xs opacity-70">
													끼리끼리 인원: {user.closeGroupCount}명
												</div>
											</div>
											<div className="text-xs opacity-70">
												상세보기 →
											</div>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

