"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "next-themes";
import { applyColorTheme } from "@/app/lib/color-themes";
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

type OverlapDetail = {
	start: string;
	end: string;
	minutes: number;
};

type ChannelOverlap = {
	channelId: string;
	channelName: string;
	totalMinutes: number;
	overlaps: OverlapDetail[];
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
	const [allUsers, setAllUsers] = useState<Array<{ userId: string; userName: string }>>([]);
	const [searchTerm, setSearchTerm] = useState<string>("");
	const [sortBy, setSortBy] = useState<"date" | "time" | "count">("date");
	const [expandedDate, setExpandedDate] = useState<string | null>(null);
	const [dayPageSize, setDayPageSize] = useState<number>(10);
	const [dayCurrentPage, setDayCurrentPage] = useState<number>(1);
	const [expandedMeetingUserId, setExpandedMeetingUserId] = useState<string | null>(null);
	
	// 만남 횟수 관련 상태
	const [meetingViewMode, setMeetingViewMode] = useState<"list" | "chart">("list");
	const [meetingChartType, setMeetingChartType] = useState<"bar" | "line" | "pie">("bar");
	const [meetingSearchTerm, setMeetingSearchTerm] = useState<string>("");
	const [meetingSortBy, setMeetingSortBy] = useState<"count" | "time">("count");
	const [meetingPageSize, setMeetingPageSize] = useState<number>(10);
	const [meetingCurrentPage, setMeetingCurrentPage] = useState<number>(1);
	const [deleting, setDeleting] = useState(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [meetingCountMode, setMeetingCountMode] = useState<"total" | "weekly">("total");
	const [weeklyMeetings, setWeeklyMeetings] = useState<any[]>([]);
	const [loadingWeekly, setLoadingWeekly] = useState(false);
	const [selectedMonth, setSelectedMonth] = useState<string>("");
	const [deletingWeekKey, setDeletingWeekKey] = useState<string | null>(null);
	const [showWeekDeleteConfirm, setShowWeekDeleteConfirm] = useState<string | null>(null);
	const [expandedWeekKey, setExpandedWeekKey] = useState<string | null>(null);
	const [overlapByUser, setOverlapByUser] = useState<Record<string, ChannelOverlap[]>>({});
	const [overlapLoading, setOverlapLoading] = useState<Record<string, boolean>>({});
	const [overlapError, setOverlapError] = useState<Record<string, string>>({});


	function getTotalOverlapMinutes(userId: string): number | null {
		const overlaps = overlapByUser[userId];
		if (!overlaps) return null;
		return overlaps.reduce((sum, ch) => sum + (ch?.totalMinutes || 0), 0);
	}
	const [isDayActivityExpanded, setIsDayActivityExpanded] = useState<boolean>(true);
	const [isMeetingCountExpanded, setIsMeetingCountExpanded] = useState<boolean>(true);

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
		if (userId) {
			fetchUserData();
			fetchAllUsers();
		}
	}, [userId]);

	// 모든 사용자 목록 가져오기
	async function fetchAllUsers() {
		try {
			// 최근 1년 데이터에서 사용자 목록 가져오기
			const today = new Date();
			const yearAgo = new Date(today);
			yearAgo.setFullYear(yearAgo.getFullYear() - 1);
			
			const params = new URLSearchParams({
				groupBy: "user",
				startDate: yearAgo.toISOString().split('T')[0],
				endDate: today.toISOString().split('T')[0],
			});

			const res = await fetch(`/api/discord-activity?${params}`);
			if (!res.ok) return;
			
			const result = await res.json();
			const rawData = result.data || {};
			
			// 사용자 목록 추출
			const usersList: Array<{ userId: string; userName: string }> = [];
			for (const [key, value] of Object.entries(rawData)) {
				const userData = value as UserActivityData;
				if (userData.userId && userData.userName) {
					usersList.push({
						userId: userData.userId,
						userName: userData.userName,
					});
				}
			}
			
			// userName으로 정렬
			usersList.sort((a, b) => (a.userName || a.userId).localeCompare(b.userName || b.userId));
			setAllUsers(usersList);
		} catch (err) {
			console.error("사용자 목록 로딩 실패:", err);
		}
	}

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

	// 유저 기록 삭제
	async function handleDeleteUser() {
		if (!userId) return;

		setDeleting(true);
		try {
			const res = await fetch(`/api/discord-activity/delete-user?userId=${encodeURIComponent(userId)}`, {
				method: "DELETE",
			});

			if (!res.ok) {
				const error = await res.json();
				throw new Error(error.error || "삭제 실패");
			}

			const result = await res.json();
			alert(`해당 유저의 모든 기록이 삭제되었습니다.\n삭제된 활동 기록: ${result.deleted?.activityCount || 0}개\n삭제된 만남 횟수: ${result.deleted?.meetingCount || 0}개`);
			
			// 대시보드로 돌아가기
			router.push("/admin/activity-dashboard");
		} catch (err: any) {
			console.error("삭제 실패:", err);
			alert(`삭제 중 오류가 발생했습니다: ${err.message || String(err)}`);
		} finally {
			setDeleting(false);
			setShowDeleteConfirm(false);
		}
	}

	// 주별 만남 횟수 조회
	async function fetchWeeklyMeetingCounts(userId: string, month?: string) {
		setLoadingWeekly(true);
		try {
			const params = new URLSearchParams({ userId });
			if (month) params.set("month", month);

			const res = await fetch(`/api/discord-activity/meeting-counts/weekly?${params}`);
			if (!res.ok) {
				console.error("주별 만남 횟수 조회 실패:", res.status);
				setWeeklyMeetings([]);
				return;
			}

			const result = await res.json();
			const weeklyData = result.data || [];
			setWeeklyMeetings(weeklyData);
		} catch (err) {
			console.error("주별 만남 횟수 조회 실패:", err);
			setWeeklyMeetings([]);
		} finally {
			setLoadingWeekly(false);
		}
	}

	// 주별 기록 삭제
	async function handleDeleteWeek(weekKey: string) {
		setDeletingWeekKey(weekKey);
		try {
			const res = await fetch(`/api/discord-activity/delete-week?weekKey=${encodeURIComponent(weekKey)}&deleteActivities=true&deleteMeetingCounts=true`, {
				method: "DELETE",
			});

			if (!res.ok) {
				const error = await res.json();
				throw new Error(error.error || "삭제 실패");
			}

			const result = await res.json();
			alert(`해당 주의 기록이 삭제되었습니다.\n삭제된 활동 기록: ${result.deleted?.activityCount || 0}개\n삭제된 주별 만남 횟수: ${result.deleted?.meetingCountWeekly || 0}개`);
			
			// 주별 데이터 다시 로드
			if (meetingCountMode === "weekly") {
				fetchWeeklyMeetingCounts(userId, selectedMonth || undefined);
			}
		} catch (err: any) {
			console.error("삭제 실패:", err);
			alert(`삭제 중 오류가 발생했습니다: ${err.message || String(err)}`);
		} finally {
			setDeletingWeekKey(null);
			setShowWeekDeleteConfirm(null);
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

	// 만남 횟수 모드 변경 시 데이터 로드
	useEffect(() => {
		if (meetingCountMode === "weekly" && userId) {
			fetchWeeklyMeetingCounts(userId, selectedMonth || undefined);
		}
	}, [meetingCountMode, userId, selectedMonth]);

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

	// 두 유저가 같은 채널에 머문 시간(분) 계산
	function computeChannelOverlaps(
		userActs: any[],
		otherActs: any[],
	): ChannelOverlap[] {
		const resultMap = new Map<string, ChannelOverlap>();

		const safeActs = (userActs || []).filter(Boolean).map((a) => ({
			...a,
			start: new Date(a.startTime || a.startAt || a.date).getTime(),
			end: a.endTime || a.endAt
				? new Date(a.endTime || a.endAt).getTime()
				: new Date(a.startTime || a.startAt || a.date).getTime() +
				  ((typeof a.durationMinutes === "number" ? a.durationMinutes : 0) * 60000),
		}));

		const otherSafe = (otherActs || []).filter(Boolean).map((a) => ({
			...a,
			start: new Date(a.startTime || a.startAt || a.date).getTime(),
			end: a.endTime || a.endAt
				? new Date(a.endTime || a.endAt).getTime()
				: new Date(a.startTime || a.startAt || a.date).getTime() +
				  ((typeof a.durationMinutes === "number" ? a.durationMinutes : 0) * 60000),
		}));

		for (const a of safeActs) {
			if (!a.channelId) continue;
			for (const b of otherSafe) {
				if (a.channelId !== b.channelId) continue;
				const overlapStart = Math.max(a.start, b.start);
				const overlapEnd = Math.min(a.end, b.end);
				const diffMs = overlapEnd - overlapStart;
				if (diffMs <= 0) continue;
				const minutes = Math.round(diffMs / 60000);
				const key = a.channelId;
				const entry = resultMap.get(key) || {
					channelId: a.channelId,
					channelName: a.channelName || b.channelName || a.channelId,
					totalMinutes: 0,
					overlaps: [] as OverlapDetail[],
				};
				entry.totalMinutes += minutes;
				entry.overlaps.push({
					start: new Date(overlapStart).toISOString(),
					end: new Date(overlapEnd).toISOString(),
					minutes,
				});
				resultMap.set(key, entry);
			}
		}

		return Array.from(resultMap.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);
	}

	// 특정 상대 유저와의 채널별 겹친 시간 조회
	async function loadChannelOverlaps(otherUserId: string) {
		if (overlapByUser[otherUserId]) return;
		if (!userData?.activities) return;

		setOverlapLoading((prev) => ({ ...prev, [otherUserId]: true }));
		setOverlapError((prev) => ({ ...prev, [otherUserId]: "" }));

		try {
			const res = await fetch(`/api/discord-activity?groupBy=user&userId=${encodeURIComponent(otherUserId)}`);
			if (!res.ok) {
				throw new Error(`상대 유저 활동 조회 실패: ${res.status}`);
			}
			const result = await res.json();
			const otherData = result.data?.[otherUserId];
			const otherActivities = otherData?.activities || [];

			const overlaps = computeChannelOverlaps(userData.activities, otherActivities);
			setOverlapByUser((prev) => ({ ...prev, [otherUserId]: overlaps }));
		} catch (err: any) {
			console.error("채널 겹친 시간 계산 실패:", err);
			setOverlapError((prev) => ({ ...prev, [otherUserId]: err?.message || "조회 실패" }));
		} finally {
			setOverlapLoading((prev) => ({ ...prev, [otherUserId]: false }));
		}
	}
	
	// 만남 리스트용: 총 겹친 시간 정렬 지원
	function getOverlapSortValue(userId: string): number {
		const total = getTotalOverlapMinutes(userId);
		return total ?? 0;
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
				minutes: Math.round(data.minutes),
				count: data.count,
			}))
			.sort((a, b) => a.hour - b.hour);
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

	// 날짜별 활동 페이징 계산
	const dayTotalPages = Math.ceil(filteredAndSortedDays.length / dayPageSize);
	const paginatedDays = filteredAndSortedDays.slice(
		(dayCurrentPage - 1) * dayPageSize,
		dayCurrentPage * dayPageSize
	);

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
						<div className="flex items-center justify-between mb-4">
							<div>
								<div className="text-2xl font-bold mb-2">{userData.userName || userData.userId}</div>
								<div className="text-lg opacity-70">
									총 {formatMinutes(userData.totalMinutes)} · {userData.dayCount}일 활동
								</div>
							</div>
							<div className="flex gap-3 items-end">
								{/* 사용자 선택 드롭다운 */}
								{allUsers.length > 0 && (
									<div className="min-w-[250px]">
										<label className="block text-sm mb-2">사용자 선택</label>
										<select
											value={userId}
											onChange={(e) => {
												router.push(`/admin/activity-dashboard/user/${e.target.value}`);
											}}
											className="w-full border rounded px-3 py-2"
											style={{
												background: "var(--background)",
												color: "var(--foreground)",
												borderColor: "var(--accent)",
											}}
										>
											{allUsers.map((user) => (
												<option key={user.userId} value={user.userId}>
													{user.userName || user.userId}
												</option>
											))}
										</select>
									</div>
								)}
								{/* 삭제 버튼 */}
								<button
									className="px-4 py-2 rounded transition-colors cursor-pointer text-sm"
									style={{
										backgroundColor: "#ef4444",
										color: "white",
									}}
									onMouseEnter={(e) => {
										e.currentTarget.style.background = "#dc2626";
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.background = "#ef4444";
									}}
									onClick={() => setShowDeleteConfirm(true)}
									disabled={deleting}
								>
									{deleting ? "삭제 중..." : "삭제"}
								</button>
							</div>
						</div>
					</div>

					{/* 주 활동 시간대 차트 */}
					{userData.activities && userData.activities.length > 0 && (() => {
						const hourlyData = getHourlyActivity(userData.activities);
						const maxCount = Math.max(...hourlyData.map(h => h.count), 1);
						const topHours = hourlyData
							.filter(h => h.count > 0)
							.sort((a, b) => b.count - a.count)
							.slice(0, 5);
						
						return (
							<div 
								className="rounded-lg p-6 mb-6"
								style={{ 
									background: "var(--background)", 
									border: "1px solid var(--accent)" 
								}}
							>
								<h2 className="text-lg font-semibold mb-4">주 활동 시간대</h2>
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
												label={{ value: '활동 횟수', angle: -90, position: 'insideLeft', style: { fill: 'var(--foreground)' } }}
											/>
											<Tooltip 
												contentStyle={{ 
													backgroundColor: "var(--background)",
													border: "1px solid var(--accent)",
													color: "var(--foreground)",
												}}
												formatter={(value: any, payload: any) => {
													const count = value || 0;
													return [`${count}회 활동`, "활동 횟수"];
												}}
											/>
											<Bar dataKey="count" fill="var(--accent)" />
										</BarChart>
									</ResponsiveContainer>
								</div>
								
								{/* 시간대별 요약 정보 */}
								{topHours.length > 0 && (
									<div className="mt-4">
										<div className="text-sm font-semibold mb-2">가장 활동이 많은 시간대 (상위 5개)</div>
										<div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
											{topHours.map((h) => {
												return (
													<div 
														key={h.hour}
														className="rounded p-2"
														style={{ 
															background: "color-mix(in srgb, var(--accent) 20%, transparent)",
															border: "1px solid var(--accent)"
														}}
													>
														<div className="font-semibold">{h.label}</div>
														<div className="opacity-70">{h.count}회 활동</div>
													</div>
												);
											})}
										</div>
									</div>
								)}
							</div>
						);
					})()}

					{/* 삭제 확인 팝업 */}
					{showDeleteConfirm && (
						<div
							className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
							onClick={() => setShowDeleteConfirm(false)}
						>
							<div
								className="rounded-lg p-6 max-w-md w-full mx-4"
								style={{
									background: "var(--background)",
									border: "1px solid var(--accent)",
								}}
								onClick={(e) => e.stopPropagation()}
							>
								<h3 className="text-xl font-bold mb-4">삭제 확인</h3>
								<p className="mb-6" style={{ color: "var(--foreground)", opacity: 0.9 }}>
									정말로 <strong>{userData.userName || userData.userId}</strong>의 모든 활동 기록을 삭제하시겠습니까?
									<br />
									<br />
									삭제되는 항목:
									<br />
									• 모든 활동 기록
									<br />
									• 모든 만남 횟수 (전체 누적 + 주별)
									<br />
									• 유저 정보
									<br />
									<br />
									이 작업은 되돌릴 수 없습니다.
								</p>
								<div className="flex gap-3 justify-end">
									<button
										className="px-4 py-2 rounded transition-colors cursor-pointer"
										style={{
											background: "var(--accent)",
											color: "var(--foreground)",
										}}
										onClick={() => setShowDeleteConfirm(false)}
									>
										취소
									</button>
									<button
										className="px-4 py-2 rounded transition-colors cursor-pointer text-white"
										style={{
											backgroundColor: "#ef4444",
										}}
										onMouseEnter={(e) => {
											e.currentTarget.style.background = "#dc2626";
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.background = "#ef4444";
										}}
										onClick={handleDeleteUser}
										disabled={deleting}
									>
										{deleting ? "삭제 중..." : "삭제"}
									</button>
								</div>
							</div>
						</div>
					)}

					{/* 날짜별 리스트 */}
					<div 
						className="rounded-lg p-6 mb-6"
						style={{ 
							background: "var(--background)", 
							border: "1px solid var(--accent)" 
						}}
					>
						<div className="flex items-center justify-between mb-4">
							<h2 className="text-lg font-semibold">날짜별 활동 ({filteredAndSortedDays.length}일)</h2>
							<button
								className="px-3 py-1 rounded text-sm transition-colors"
								style={{
									backgroundColor: "var(--accent)",
									color: "var(--foreground)",
									border: "1px solid var(--accent)",
								}}
								onClick={() => setIsDayActivityExpanded(!isDayActivityExpanded)}
							>
								{isDayActivityExpanded ? "▼" : "▶"}
							</button>
						</div>

						{isDayActivityExpanded && (
							<>
								{/* 검색 및 정렬 */}
								<div className="flex flex-col md:flex-row gap-4 items-end mb-4">
									<div className="flex-1 min-w-[200px]">
										<label className="block text-sm mb-2">검색</label>
										<input
											type="text"
											placeholder="날짜 검색..."
											value={searchTerm}
											onChange={(e) => setSearchTerm(e.target.value)}
											className="w-full border rounded px-3 py-2"
											style={{
												background: "var(--background)",
												color: "var(--foreground)",
												borderColor: "var(--accent)",
											}}
										/>
									</div>
									<div className="flex-1 min-w-[200px]">
										<label className="block text-sm mb-2">정렬 기준</label>
										<select
											value={sortBy}
											onChange={(e) => setSortBy(e.target.value as "date" | "time" | "count")}
											className="w-full border rounded px-3 py-2"
											style={{
												background: "var(--background)",
												color: "var(--foreground)",
												borderColor: "var(--accent)",
											}}
										>
											<option value="date">날짜순 (최신)</option>
											<option value="time">활동 시간순</option>
											<option value="count">활동 횟수순</option>
										</select>
									</div>
								</div>
						
						{filteredAndSortedDays.length === 0 ? (
							<div className="text-center py-8" style={{ color: "var(--foreground)", opacity: 0.7 }}>
								검색 결과가 없습니다.
							</div>
						) : (
							<>
								<div className="space-y-3 mb-4">
									{paginatedDays.map((day) => {
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
								
								{/* 페이징 */}
								{dayTotalPages > 1 && (
									<div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-700/50">
										<button
											className="px-3 py-2 rounded transition-colors cursor-pointer text-sm"
											style={{
												background: dayCurrentPage > 1 ? "var(--accent)" : "transparent",
												color: "var(--foreground)",
												border: "1px solid var(--accent)",
												opacity: dayCurrentPage > 1 ? 1 : 0.5,
											}}
											onClick={() => setDayCurrentPage(prev => Math.max(1, prev - 1))}
											disabled={dayCurrentPage === 1}
										>
											이전
										</button>
										<span className="text-sm opacity-70">
											{dayCurrentPage} / {dayTotalPages}
										</span>
										<button
											className="px-3 py-2 rounded transition-colors cursor-pointer text-sm"
											style={{
												background: dayCurrentPage < dayTotalPages ? "var(--accent)" : "transparent",
												color: "var(--foreground)",
												border: "1px solid var(--accent)",
												opacity: dayCurrentPage < dayTotalPages ? 1 : 0.5,
											}}
											onClick={() => setDayCurrentPage(prev => Math.min(dayTotalPages, prev + 1))}
											disabled={dayCurrentPage === dayTotalPages}
										>
											다음
										</button>
									</div>
								)}
							</>
						)}
							</>
						)}
					</div>

					{/* 만남 횟수 리스트 */}
					<div 
						className="rounded-lg p-6"
						style={{ 
							background: "var(--background)", 
							border: "1px solid var(--accent)" 
						}}
					>
						<div className="flex items-center justify-between mb-4">
							<h2 className="text-lg font-semibold">
								유저별 만남 횟수 ({meetingCountMode === "total" ? meetings.length : weeklyMeetings.length}명)
							</h2>
							<button
								className="px-3 py-1 rounded text-sm transition-colors"
								style={{
									backgroundColor: "var(--accent)",
									color: "var(--foreground)",
									border: "1px solid var(--accent)",
								}}
								onClick={() => setIsMeetingCountExpanded(!isMeetingCountExpanded)}
							>
								{isMeetingCountExpanded ? "▼" : "▶"}
							</button>
						</div>

						{isMeetingCountExpanded && (
							<>
								<div className="flex gap-2 items-center mb-4">
									{/* 누적 카운트 / 위클리 토글 */}
									<button
										className={`px-3 py-2 rounded text-sm transition-colors ${
											meetingCountMode === "total"
												? "font-semibold"
												: "opacity-70"
										}`}
										style={{
											backgroundColor: meetingCountMode === "total" ? "var(--accent)" : "transparent",
											color: "var(--foreground)",
											border: "1px solid var(--accent)",
										}}
										onClick={() => setMeetingCountMode("total")}
									>
										누적 카운트
									</button>
									<button
										className={`px-3 py-2 rounded text-sm transition-colors ${
											meetingCountMode === "weekly"
												? "font-semibold"
												: "opacity-70"
										}`}
										style={{
											backgroundColor: meetingCountMode === "weekly" ? "var(--accent)" : "transparent",
											color: "var(--foreground)",
											border: "1px solid var(--accent)",
										}}
										onClick={() => setMeetingCountMode("weekly")}
									>
										위클리 만남 횟수
									</button>
									
									{/* 리스트/차트 토글 */}
									{(meetingCountMode === "total" ? meetings.length > 0 : weeklyMeetings.length > 0) && (
										<div className="flex gap-2 ml-2">
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
									)}
								</div>

								{/* 위클리 모드일 때 월 선택 */}
						{meetingCountMode === "weekly" && (
							<div className="mb-4">
								<label className="block text-sm mb-2">월 선택 (선택사항)</label>
								<div className="flex gap-2 items-center">
									<input
										type="month"
										value={selectedMonth}
										onChange={(e) => {
											setSelectedMonth(e.target.value);
										}}
										className="border rounded px-3 py-2 text-sm"
										style={{
											background: "var(--background)",
											color: "var(--foreground)",
											borderColor: "var(--accent)",
										}}
									/>
									<button
										className="px-3 py-2 rounded text-sm transition-colors cursor-pointer"
										style={{
											background: "var(--accent)",
											color: "var(--foreground)",
										}}
										onClick={() => {
											setSelectedMonth("");
											fetchWeeklyMeetingCounts(userId);
										}}
									>
										전체 기간
									</button>
								</div>
							</div>
						)}

						{meetingCountMode === "total" ? (
							meetings.length === 0 ? (
								<div className="text-center py-8" style={{ color: "var(--foreground)", opacity: 0.7 }}>
									조회되는 만남횟수가 없습니다.
								</div>
							) : meetingViewMode === "list" ? (
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
												style={{
													background: "var(--background)",
													color: "var(--foreground)",
													borderColor: "var(--accent)",
												}}
											/>
										</div>
										<div className="flex-1 min-w-[200px]">
											<label className="block text-sm mb-2">정렬 기준</label>
											<div className="flex gap-2">
												<button
													className={`px-3 py-2 rounded text-sm transition-colors flex-1 ${
														meetingSortBy === "count"
															? "font-semibold"
															: "opacity-70"
													}`}
													style={{
														backgroundColor: meetingSortBy === "count" ? "var(--accent)" : "transparent",
														color: "var(--foreground)",
														border: "1px solid var(--accent)",
													}}
													onClick={() => {
														setMeetingSortBy("count");
														setMeetingCurrentPage(1);
													}}
												>
													만남 횟수
												</button>
												<button
													className={`px-3 py-2 rounded text-sm transition-colors flex-1 ${
														meetingSortBy === "time"
															? "font-semibold"
															: "opacity-70"
													}`}
													style={{
														backgroundColor: meetingSortBy === "time" ? "var(--accent)" : "transparent",
														color: "var(--foreground)",
														border: "1px solid var(--accent)",
													}}
													onClick={() => {
														setMeetingSortBy("time");
														setMeetingCurrentPage(1);
													}}
												>
													시간순
												</button>
											</div>
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

									{/* 필터링 및 정렬된 만남 리스트 */}
									{(() => {
										const filtered = meetings.filter((m) => {
											if (!meetingSearchTerm.trim()) return true;
											const term = meetingSearchTerm.toLowerCase();
											return (m.userName || m.userId).toLowerCase().includes(term);
										});

										const sorted = filtered.sort((a, b) => {
											if (meetingSortBy === "time") {
												return getOverlapSortValue(b.userId) - getOverlapSortValue(a.userId);
											}
											return b.count - a.count;
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
															// 사전 로드: 겹친 시간 없으면 비동기 로드
															if (!overlapByUser[meeting.userId] && !overlapLoading[meeting.userId]) {
																loadChannelOverlaps(meeting.userId);
															}
															const overlapTotal = getTotalOverlapMinutes(meeting.userId);
															
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
												onClick={async () => {
													const next = isExpanded ? null : meeting.userId;
													setExpandedMeetingUserId(next);
													if (next) {
														await loadChannelOverlaps(next);
													}
												}}
																	>
																		<div className="font-medium text-lg">▶ {meeting.userName}</div>
											<div className="text-xl font-semibold">
												{(() => {
																				return `${meeting.count}번${
																					overlapTotal !== null && overlapTotal > 0
																						? ` (${formatMinutes(overlapTotal)})`
																						: overlapLoading[meeting.userId]
																							? " (계산중...)"
																							: ""
																				}`;
												})()}
											</div>
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
														<div className="pt-3 border-t border-dashed border-zinc-700/50">
															<div className="font-semibold mb-2">같이 있었던 채널</div>
															{overlapLoading[meeting.userId] ? (
																<div className="text-xs opacity-70">불러오는 중...</div>
															) : overlapError[meeting.userId] ? (
																<div className="text-xs text-red-500">
																	오류: {overlapError[meeting.userId]}
																</div>
															) : !overlapByUser[meeting.userId] ||
																overlapByUser[meeting.userId].length === 0 ? (
																<div className="text-xs opacity-70">
																	같이 있었던 채널 기록이 없습니다.
																</div>
															) : (
																<div className="space-y-2 text-xs md:text-sm">
																	{overlapByUser[meeting.userId].map((ch) => {
																		const firstOverlap = ch.overlaps[0];
																		const dateText = firstOverlap
																			? new Date(firstOverlap.start).toLocaleDateString("ko-KR", {
																					year: "numeric",
																					month: "long",
																					day: "numeric",
																			  })
																			: "";
																		return (
																			<div
																				key={ch.channelId}
																				className="p-2 rounded border"
																				style={{
																					borderColor: "var(--accent)",
																					background: "color-mix(in srgb, var(--background) 98%, var(--accent) 2%)",
																				}}
																			>
																				<div className="flex items-center justify-between">
																					<div className="font-medium">
																						{ch.channelName || ch.channelId}
																						{dateText ? ` (${dateText})` : ""}
																					</div>
																					<div className="opacity-70">{formatMinutes(ch.totalMinutes)}</div>
																				</div>
																			</div>
																		);
																	})}
																</div>
															)}
														</div>
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

										const filtered = meetings.filter((m) => {
											if (!meetingSearchTerm.trim()) return true;
											const term = meetingSearchTerm.toLowerCase();
											return (m.userName || m.userId).toLowerCase().includes(term);
										});

										const sorted = filtered.sort((a, b) => {
											if (meetingSortBy === "time") {
												return getOverlapSortValue(b.userId) - getOverlapSortValue(a.userId);
											}
											return b.count - a.count;
										});

										const chartData = sorted
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
							)
						) : (
							// 위클리 만남 횟수 모드
							loadingWeekly ? (
								<div className="text-center py-8" style={{ color: "var(--foreground)", opacity: 0.7 }}>
									로딩 중...
								</div>
							) : weeklyMeetings.length === 0 ? (
								<div className="text-center py-8" style={{ color: "var(--foreground)", opacity: 0.7 }}>
									조회되는 주별 만남 횟수가 없습니다.
								</div>
							) : (
								(() => {
									// 주별로 그룹화
									const weekGroups = new Map<string, {
										weekKey: string;
										weekStart: string;
										month: string;
										users: Array<{
											otherUserId: string;
											otherUserName: string;
											count: number;
											lastMetAt?: string;
											updatedAt?: string;
										}>;
										totalCount: number;
									}>();

									weeklyMeetings.forEach((item: any) => {
										const weekKey = item.weekKey;
										if (!weekGroups.has(weekKey)) {
											weekGroups.set(weekKey, {
												weekKey: weekKey,
												weekStart: item.weekStart || "",
												month: item.month || "",
												users: [],
												totalCount: 0,
											});
										}
										const group = weekGroups.get(weekKey)!;
										group.users.push({
											otherUserId: item.otherUserId,
											otherUserName: item.otherUserName || item.otherUserId,
											count: item.count || 0,
											lastMetAt: item.lastMetAt,
											updatedAt: item.updatedAt,
										});
										group.totalCount += item.count || 0;
									});

									// 주별로 정렬 (최신순)
									const sortedWeeks = Array.from(weekGroups.values()).sort((a, b) => {
										return b.weekKey.localeCompare(a.weekKey);
									});

									// 주 표시 형식 변환 (예: "2025-12-1" -> "12월 1주차")
									const formatWeekLabel = (weekKey: string, weekStart: string) => {
										const parts = weekKey.split('-');
										if (parts.length >= 3) {
											const year = parts[0];
											const month = parseInt(parts[1], 10);
											const weekNum = parseInt(parts[2], 10);
											return `${month}월 ${weekNum}주차`;
										}
										return weekStart || weekKey;
									};

									return (
										<div className="space-y-3">
											{sortedWeeks.map((weekGroup) => {
												const isExpanded = expandedWeekKey === weekGroup.weekKey;
												const weekLabel = formatWeekLabel(weekGroup.weekKey, weekGroup.weekStart);
												
												return (
													<div
														key={weekGroup.weekKey}
														className="rounded transition-colors"
														style={{ 
															border: "1px solid var(--accent)",
															background: "var(--background)"
														}}
													>
														{/* 주 헤더 */}
														<div
															className="p-4 cursor-pointer"
															onClick={() => setExpandedWeekKey(isExpanded ? null : weekGroup.weekKey)}
															onMouseEnter={(e) => {
																e.currentTarget.style.background = "color-mix(in srgb, var(--background) 95%, var(--accent) 5%)";
															}}
															onMouseLeave={(e) => {
																e.currentTarget.style.background = "var(--background)";
															}}
														>
															<div className="flex items-center justify-between">
																<div className="flex items-center gap-2">
																	<span className="text-lg">{isExpanded ? "▼" : "▶"}</span>
																	<div>
																		<div className="font-medium text-lg">{weekLabel}</div>
																		<div className="text-sm opacity-70 mt-1">
																			{weekGroup.weekStart} ({weekGroup.users.length}명)
																		</div>
																	</div>
																</div>
																<div className="flex items-center gap-3">
																	<div className="text-xl font-semibold">{weekGroup.totalCount}번</div>
																	<button
																		className="px-3 py-1 rounded text-sm transition-colors cursor-pointer"
																		style={{
																			backgroundColor: "#ef4444",
																			color: "white",
																		}}
																		onMouseEnter={(e) => {
																			e.currentTarget.style.background = "#dc2626";
																			e.stopPropagation();
																		}}
																		onMouseLeave={(e) => {
																			e.currentTarget.style.background = "#ef4444";
																			e.stopPropagation();
																		}}
																		onClick={(e) => {
																			e.stopPropagation();
																			setShowWeekDeleteConfirm(weekGroup.weekKey);
																		}}
																		disabled={deletingWeekKey === weekGroup.weekKey}
																	>
																		{deletingWeekKey === weekGroup.weekKey ? "삭제 중..." : "삭제"}
																	</button>
																</div>
															</div>
														</div>

														{/* 유저 리스트 (펼쳐질 때) */}
														{isExpanded && (
															<div className="pt-2 pb-4 px-4 border-t border-dashed border-zinc-700/50">
																<div className="space-y-2 mt-2">
																	{weekGroup.users
																		.sort((a, b) => b.count - a.count)
																		.map((user) => (
																			<div
																				key={user.otherUserId}
																				className="p-3 rounded transition-colors"
																				style={{
																					border: "1px solid var(--accent)",
																					background: "color-mix(in srgb, var(--background) 98%, var(--accent) 2%)",
																				}}
																				onMouseEnter={(e) => {
																					e.currentTarget.style.background = "color-mix(in srgb, var(--background) 95%, var(--accent) 5%)";
																				}}
																				onMouseLeave={(e) => {
																					e.currentTarget.style.background = "color-mix(in srgb, var(--background) 98%, var(--accent) 2%)";
																				}}
																			>
																				<div className="flex items-center justify-between">
																					<div className="flex-1">
																						<div className="font-medium">▶ {user.otherUserName}</div>
																						{user.lastMetAt && (
																							<div className="text-xs opacity-70 mt-1">
																								마지막 만남: {new Date(user.lastMetAt).toLocaleDateString('ko-KR', {
																									year: 'numeric',
																									month: 'long',
																									day: 'numeric',
																								})}
																							</div>
																						)}
																					</div>
																					<div className="text-lg font-semibold">{user.count}번</div>
																				</div>
																			</div>
																		))}
																</div>
															</div>
														)}
													</div>
												);
											})}
										</div>
									);
								})()
							)
						)}
							</>
						)}
					</div>

					{/* 끼리끼리 별도 페이지 이동 */}
					{meetingCountMode === "total" && meetings.length > 0 && (
						<div 
							className="rounded-lg p-6 mt-6"
							style={{ 
								background: "var(--background)", 
								border: "1px solid var(--accent)" 
							}}
						>
							<div className="flex items-center justify-between mb-3">
								<h2 className="text-lg font-semibold">끼리끼리 분석</h2>
								<button
									className="px-3 py-2 rounded text-sm transition-colors cursor-pointer"
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
									onClick={() => router.push(`/admin/activity-dashboard/user/${userId}/close-group`)}
								>
									페이지 이동
								</button>
							</div>
							<div className="text-sm opacity-70">
								페이지에서 끼리끼리(3명 이상) 분석을 시작합니다. 기준: 만남 횟수 평균+5회, 같이 있는 시간 평균+5시간.
							</div>
						</div>
					)}

					{/* 주별 삭제 확인 팝업 */}
					{showWeekDeleteConfirm && (
						<div
							className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
							onClick={() => setShowWeekDeleteConfirm(null)}
						>
							<div
								className="rounded-lg p-6 max-w-md w-full mx-4"
								style={{
									background: "var(--background)",
									border: "1px solid var(--accent)",
								}}
								onClick={(e) => e.stopPropagation()}
							>
								<h3 className="text-xl font-bold mb-4">삭제 확인</h3>
								<p className="mb-6" style={{ color: "var(--foreground)", opacity: 0.9 }}>
									정말로 <strong>{showWeekDeleteConfirm}</strong> 주의 만남 횟수와 활동 기록을 삭제하시겠습니까?
									<br />
									<br />
									삭제되는 항목:
									<br />
									• 해당 주의 활동 기록
									<br />
									• 해당 주의 주별 만남 횟수
									<br />
									<br />
									전체 누적 만남 횟수는 유지됩니다.
									<br />
									이 작업은 되돌릴 수 없습니다.
								</p>
								<div className="flex gap-3 justify-end">
									<button
										className="px-4 py-2 rounded transition-colors cursor-pointer"
										style={{
											background: "var(--accent)",
											color: "var(--foreground)",
										}}
										onClick={() => setShowWeekDeleteConfirm(null)}
									>
										취소
									</button>
									<button
										className="px-4 py-2 rounded transition-colors cursor-pointer text-white"
										style={{
											backgroundColor: "#ef4444",
										}}
										onMouseEnter={(e) => {
											e.currentTarget.style.background = "#dc2626";
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.background = "#ef4444";
										}}
										onClick={() => handleDeleteWeek(showWeekDeleteConfirm)}
										disabled={deletingWeekKey === showWeekDeleteConfirm}
									>
										{deletingWeekKey === showWeekDeleteConfirm ? "삭제 중..." : "삭제"}
									</button>
								</div>
							</div>
						</div>
					)}
				</>
			)}
		</div>
	);
}

