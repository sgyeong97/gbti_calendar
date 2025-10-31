"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CreateEventModal from "@/app/calendar/CreateEventModal";
import EventDetailModal from "@/app/calendar/EventDetailModal";
// 공지사항 관련 import 제거
import { addDays, eachDayOfInterval, endOfDay, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfDay, startOfMonth, startOfWeek } from "date-fns";
const BRAND_COLOR = "#FDC205"; // rgb(253,194,5)
const NOTIF_ICON = "/gbti_small.jpg"; // public 경로의 아이콘
const NOTIF_BADGE = "/gbti_small.jpg";  // 작은 배지 아이콘(없으면 아이콘과 동일하게 사용)

type Event = {
	id: string;
	title: string;
	description?: string | null;
	startAt: string;
	endAt: string;
	allDay: boolean;
	calendarId: string;
	participants?: string[];
	color?: string;
};

type ViewMode = "month" | "favorites";

type FavoriteUser = {
	name: string;
};

// 공지사항 타입 제거

export default function CalendarPage() {
	const router = useRouter();
	const [current, setCurrent] = useState<Date>(new Date());
	const [events, setEvents] = useState<Event[]>([]);
	const [selectedParticipant, setSelectedParticipant] = useState<string>("");
	const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
	const [viewMode, setViewMode] = useState<ViewMode>("month");
	const [favoriteUsers, setFavoriteUsers] = useState<FavoriteUser[]>([]);
	const [showFavorites, setShowFavorites] = useState(false);
	// 관리자 버튼은 라우팅으로 대체
    // 공지사항 상태 제거
	const days = useMemo(() => {
		{
			// 월간 뷰: 월 전체 표시 (이전/다음 달 일부 포함)
			const start = startOfWeek(startOfMonth(current), { weekStartsOn: 1 });
			const end = endOfWeek(endOfMonth(current), { weekStartsOn: 1 });
			return eachDayOfInterval({ start, end });
		}
	}, [current, viewMode]);

	useEffect(() => {
		const fetchEvents = async () => {
			let startStr: string, endStr: string;

			{
				// 월간 뷰: 월 전체 범위
				startStr = format(startOfWeek(startOfMonth(current), { weekStartsOn: 1 }), "yyyy-MM-dd");
				endStr = format(endOfWeek(endOfMonth(current), { weekStartsOn: 1 }), "yyyy-MM-dd");
			}

			const qp = new URLSearchParams({ start: startStr, end: endStr });
			const res = await fetch(`/api/events?${qp.toString()}`);
			const json = await res.json();
			let fetchedEvents = json.events ?? [];

			// 필터링: 참가자 선택 시 해당 참가자가 포함된 이벤트만 표시
			if (selectedParticipant && selectedParticipant !== "") {
				// 참가자 필터링: 선택된 참가자가 participants 배열에 포함된 이벤트만
				fetchedEvents = fetchedEvents.filter((event: Event) => {
					if (!event.participants || event.participants.length === 0) return false;
					return event.participants.includes(selectedParticipant);
				});
			} else if (viewMode === "favorites" && selectedParticipants.size > 0) {
				// 즐겨찾기 모드에서 여러 참가자 필터링
				fetchedEvents = fetchedEvents.filter((event: Event) => {
					if (!event.participants || event.participants.length === 0) return false;
					// 선택된 참가자 중 하나라도 참여하는 이벤트만 표시
					return event.participants.some(p => selectedParticipants.has(p));
				});
			}

			setEvents(fetchedEvents);
		};
		fetchEvents();
	}, [current, selectedParticipant, selectedParticipants, viewMode]);

	const [participantList, setParticipantList] = useState<string[]>([]);
	const [activeEventId, setActiveEventId] = useState<string | null>(null);
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [selectedDate, setSelectedDate] = useState<Date | null>(null);
	const [showMonthPicker, setShowMonthPicker] = useState(false);
	const [pickerYear, setPickerYear] = useState<number>(new Date().getFullYear());
	const [pickerMonth, setPickerMonth] = useState<number>(new Date().getMonth());

	// 알림 기능 상태 및 참조들
	const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(false);
	const [notificationLeadMinutes, setNotificationLeadMinutes] = useState<number>(30);
	const [notificationLeadMinutesList, setNotificationLeadMinutesList] = useState<number[]>([30]);
	const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);
	const notifTimersRef = useRef<Map<string, number>>(new Map());
	const notifMenuOpenRef = useRef<boolean>(false);
	const [notifMenuOpen, setNotifMenuOpen] = useState<boolean>(false);
	const [notifMenuPos, setNotifMenuPos] = useState<{ x: number; y: number } | null>(null);
	const bellLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const bellLongPressedRef = useRef<boolean>(false);
	const bellBtnRef = useRef<HTMLButtonElement | null>(null);
	const [notificationTargets, setNotificationTargets] = useState<string[]>([]);
	const [showNotificationSettings, setShowNotificationSettings] = useState<boolean>(false);
	const [showSaveToast, setShowSaveToast] = useState<boolean>(false);
	// 도우미: 같은 색 이벤트가 겹칠 때 구분을 위한 진한 테두리 색 생성
	function darkenColor(hex?: string, amount = 20) {
		if (!hex) return "#000000";
		const h = hex.replace('#', '');
		const num = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
		let r = (num >> 16) & 0xff;
		let g = (num >> 8) & 0xff;
		let b = num & 0xff;
		r = Math.max(0, r - amount);
		g = Math.max(0, g - amount);
		b = Math.max(0, b - amount);
		return `rgb(${r}, ${g}, ${b})`;
	}

	useEffect(() => {
		// 저장된 설정 불러오기
		const saved = localStorage.getItem("gbti_notifications_enabled");
		setNotificationsEnabled(saved === "1");
		const savedLead = parseInt(localStorage.getItem("gbti_notifications_minutes") || "30", 10);
		if (!isNaN(savedLead)) setNotificationLeadMinutes(savedLead);
		try {
			const listRaw = localStorage.getItem("gbti_notifications_minutes_list");
			if (listRaw) {
				const list = JSON.parse(listRaw);
				if (Array.isArray(list) && list.length > 0) {
					setNotificationLeadMinutesList(list);
					setNotificationLeadMinutes(list[0]);
				}
			} else if (!isNaN(savedLead)) {
				setNotificationLeadMinutesList([savedLead]);
			}
		} catch { }
		try {
			const savedTargets = JSON.parse(localStorage.getItem("gbti_notifications_targets") || "[]");
			if (Array.isArray(savedTargets)) setNotificationTargets(savedTargets.slice(0, 3));
		} catch { }
		// 서비스 워커 등록
		if (typeof window !== "undefined" && "serviceWorker" in navigator) {
			navigator.serviceWorker.register("/sw.js").then((reg) => {
				swRegistrationRef.current = reg;
			}).catch(() => { });
		}
	}, []);

	// Web Push 구독/업데이트 (서버 푸시용)
	async function ensurePushSubscription() {
		if (!swRegistrationRef.current) return;
		try {
			const keyRes = await fetch("/api/notifications/vapid-key");
			const { publicKey } = await keyRes.json();
			if (!publicKey) return;
			const existing = await swRegistrationRef.current.pushManager.getSubscription();
			const sub = existing || await swRegistrationRef.current.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(publicKey),
			});
			await fetch("/api/notifications/subscribe", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					subscription: sub.toJSON(),
					targets: notificationTargets,
					leads: notificationLeadMinutesList.length ? notificationLeadMinutesList : [notificationLeadMinutes],
				}),
			});
		} catch { }
	}

	function urlBase64ToUint8Array(base64String: string) {
		const padding = '='.repeat((4 - base64String.length % 4) % 4);
		const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
		const rawData = atob(base64);
		const outputArray = new Uint8Array(rawData.length);
		for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
		return outputArray;
	}

	function clearAllNotificationTimers() {
		notifTimersRef.current.forEach((id) => clearTimeout(id));
		notifTimersRef.current.clear();
	}

	async function requestNotificationPermission() {
		try {
			const result = await Notification.requestPermission();
			if (result === "granted") {
				setNotificationsEnabled(true);
				localStorage.setItem("gbti_notifications_enabled", "1");
				return true;
			}
		} catch { }
		setNotificationsEnabled(false);
		localStorage.setItem("gbti_notifications_enabled", "0");
		return false;
	}

	function showLocalNotification(title: string, options?: NotificationOptions) {
		const reg = swRegistrationRef.current;
		try {
			if (reg && reg.showNotification) {
				reg.showNotification(title, options);
				return;
			}
		} catch { }
		try {
			if (typeof Notification !== "undefined") {
				// eslint-disable-next-line no-new
				new Notification(title, options);
			}
		} catch { }
	}

	// KST(Asia/Seoul) 고정 변환: 어떤 사용자의 로컬 타임존에서도 한국 시간 기준으로 계산되도록 함
	function toKstDate(d: Date) {
		// KST 벽시각을 문자열로 만든 뒤 Date로 재생성
		// 주의: 생성된 Date는 로컬 타임존으로 파싱되지만, 우리는 getTime()만 사용해 상대 시간 계산에 활용
		const kstString = d.toLocaleString("en-US", { timeZone: "Asia/Seoul" });
		return new Date(kstString);
	}

	// 선택 대상 일정의 알림 스케줄링 (탭이 열려 있는 동안 동작)
	useEffect(() => {
		if (!notificationsEnabled) {
			clearAllNotificationTimers();
			return;
		}
		if (typeof Notification === "undefined") return;
		if (Notification.permission !== "granted") return;

		clearAllNotificationTimers();

		const targetNames = new Set(notificationTargets);
		const now = Date.now();
		const maxDelayMs = 24 * 60 * 60 * 1000; // 최대 24시간까지만 예약

			events.forEach((e) => {
			if (!e.participants || e.participants.length === 0) return;
			if (targetNames.size === 0) return; // 대상이 없으면 예약 안 함
			const hasTarget = e.participants.some((p) => targetNames.has(p));
			if (!hasTarget) return;

				// 한국시간 기준으로 고정된 시작 시각 계산
				const startUtc = new Date(e.startAt);
				const startKst = toKstDate(startUtc);
				const startMs = startKst.getTime();
				const startTimeText = `${String(startKst.getHours()).padStart(2, '0')}:${String(startKst.getMinutes()).padStart(2, '0')}`;

			const leads = (notificationLeadMinutesList.length > 0 ? notificationLeadMinutesList : [notificationLeadMinutes])
				.filter((m, idx, arr) => arr.indexOf(m) === idx)
				.sort((a, b) => a - b);

			leads.forEach((m) => {
				const triggerAt = startMs - m * 60 * 1000;
				const delay = triggerAt - now;
				if (delay <= 0 || delay > maxDelayMs) return;
				const key = `${e.id}:${m}`;
				const timeoutId = window.setTimeout(() => {
					showLocalNotification(`${e.title} (${startTimeText})`, {
						body: `${m}분 후 시작합니다`,
						badge: NOTIF_BADGE,
						icon: NOTIF_ICON,
					});
					notifTimersRef.current.delete(key);
				}, delay);
				notifTimersRef.current.set(key, timeoutId);
			});
		});

		return () => {
			clearAllNotificationTimers();
		};
	}, [notificationsEnabled, events, notificationTargets, notificationLeadMinutes, notificationLeadMinutesList]);

	// 모바일 제스처: 더블탭 / 롱프레스 감지
	const lastTapRef = useRef<number>(0);
	const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const longPressTriggeredRef = useRef<boolean>(false);
	const touchStartXYRef = useRef<{ x: number; y: number } | null>(null);

	function getDayTouchHandlers(day: Date) {
		return {
			onDoubleClick: () => {
				setSelectedDate(day);
				setShowCreateModal(true);
			},
			onTouchStart: (e: React.TouchEvent) => {
				longPressTriggeredRef.current = false;
				const t = e.touches[0];
				touchStartXYRef.current = { x: t.clientX, y: t.clientY };
				if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
				longPressTimerRef.current = setTimeout(() => {
					longPressTriggeredRef.current = true;
					setSelectedDate(day);
					setShowCreateModal(true);
				}, 450);
			},
			onTouchMove: (e: React.TouchEvent) => {
				const start = touchStartXYRef.current;
				if (!start) return;
				const t = e.touches[0];
				if (Math.abs(t.clientX - start.x) > 10 || Math.abs(t.clientY - start.y) > 10) {
					if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
					longPressTimerRef.current = null;
				}
			},
			onTouchEnd: () => {
				if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
				longPressTimerRef.current = null;
				if (longPressTriggeredRef.current) return; // 롱프레스가 이미 실행됨
				const now = Date.now();
				if (now - lastTapRef.current < 300) {
					setSelectedDate(day);
					setShowCreateModal(true);
					lastTapRef.current = 0;
				} else {
					lastTapRef.current = now;
				}
			},
			onTouchCancel: () => {
				if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
				longPressTimerRef.current = null;
			},
		};
	}

	const fetchParticipants = async () => {
		const res = await fetch("/api/participants");
		const data = await res.json();
		setParticipantList((data.participants ?? []).map((p: any) => p.name));
	};

    // 공지사항 fetch 제거

	useEffect(() => {
        fetchParticipants();

		// localStorage에서 즐겨찾기 로드
		const savedFavorites = localStorage.getItem("gbti_favorites");
		if (savedFavorites) {
			const parsed = JSON.parse(savedFavorites);
			// viewMode 제거 (구버전 호환)
			const cleaned = parsed.map((f: any) => ({ name: f.name }));
			setFavoriteUsers(cleaned);
			localStorage.setItem("gbti_favorites", JSON.stringify(cleaned));
		}
	}, []);

	// 즐겨찾기 모드로 전환 시 모든 즐겨찾기 항목 자동 선택
	useEffect(() => {
		if (viewMode === "favorites" && favoriteUsers.length > 0 && selectedParticipants.size === 0) {
			setSelectedParticipants(new Set(favoriteUsers.map(f => f.name)));
		}
	}, [viewMode, favoriteUsers]);

	// 즐겨찾기 관리 함수들
	const addFavorite = (name: string) => {
		if (favoriteUsers.length >= 3) {
			alert("즐겨찾기는 최대 3명까지 추가할 수 있습니다.");
			return;
		}
		if (favoriteUsers.find(f => f.name === name)) {
			alert("이미 즐겨찾기에 추가된 사용자입니다.");
			return;
		}
		const newFavorites: FavoriteUser[] = [...favoriteUsers, { name }];
		setFavoriteUsers(newFavorites);
		localStorage.setItem("gbti_favorites", JSON.stringify(newFavorites));
	};

	const removeFavorite = (name: string) => {
		const newFavorites = favoriteUsers.filter(f => f.name !== name);
		setFavoriteUsers(newFavorites);
		localStorage.setItem("gbti_favorites", JSON.stringify(newFavorites));
		// 선택된 참가자에서도 제거
		const newSelected = new Set(selectedParticipants);
		newSelected.delete(name);
		setSelectedParticipants(newSelected);
	};

	// 하단 입력 폼 제거로 인한 잔여 함수 삭제

	return (
		<div className="px-3 py-4 sm:p-6 max-w-5xl mx-auto">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4">
				<div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
					<h1 className="text-base sm:text-2xl font-semibold">달력</h1>
                    <div className="w-full sm:w-auto grid grid-cols-2 gap-1">
                        <button
                            className={`h-9 px-4 min-w-16 text-xs sm:text-sm border rounded-md transition-colors cursor-pointer ${viewMode === "month" ? "" : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"}`}
							style={viewMode === "month" ? { backgroundColor: BRAND_COLOR, color: "#111", borderColor: BRAND_COLOR } : undefined}
							onClick={() => setViewMode("month")}
						>
							월간
						</button>
                        
                        <button
                            className={`h-9 px-4 min-w-16 text-xs sm:text-sm border rounded-md transition-colors cursor-pointer ${viewMode === "favorites" ? "" : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"}`}
							style={viewMode === "favorites" ? { backgroundColor: BRAND_COLOR, color: "#111", borderColor: BRAND_COLOR } : undefined}
							onClick={() => setViewMode("favorites")}
						>
							즐겨찾기
						</button>
					</div>
				</div>
				<div className="flex gap-1.5 sm:gap-2 items-center">
					<button
						className="h-9 px-3 text-xs sm:text-sm rounded-md border hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
						onClick={() => setCurrent(addDays(current, -30))}
					>
						이전
					</button>
					<button
						className="h-9 min-w-20 text-center px-2 text-sm rounded-md border hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
						onClick={() => {
							setPickerYear(current.getFullYear());
							setPickerMonth(current.getMonth());
							setShowMonthPicker(true);
						}}
					>
						{format(current, "yyyy.MM")}
					</button>
					<button
						className="h-9 px-3 text-xs sm:text-sm rounded-md border hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
						onClick={() => setCurrent(addDays(current, 30))}
					>
						다음
					</button>
					<button
						ref={bellBtnRef}
						className={`h-9 w-9 rounded-md border hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer text-lg sm:text-xl ${notificationsEnabled ? "text-yellow-600" : "text-zinc-600"}`}
						onClick={async () => {
							if (bellLongPressedRef.current) { bellLongPressedRef.current = false; return; }
							if (Notification.permission !== "granted") {
								const ok = await requestNotificationPermission();
								if (!ok) return;
							}
							setShowNotificationSettings(true);
						}}
						onContextMenu={(e) => {
							// 우클릭으로 리드타임 메뉴
							e.preventDefault();
							setNotifMenuOpen(true);
							notifMenuOpenRef.current = true;
							setNotifMenuPos({ x: e.clientX, y: e.clientY });
						}}
						onTouchStart={(e) => {
							bellLongPressedRef.current = false;
							if (bellLongPressTimerRef.current) clearTimeout(bellLongPressTimerRef.current);
							bellLongPressTimerRef.current = setTimeout(() => {
								bellLongPressedRef.current = true;
								// 아이콘 기준 위치에 메뉴 표시
								const rect = bellBtnRef.current?.getBoundingClientRect();
								setNotifMenuPos(rect ? { x: rect.left, y: rect.bottom + 6 } : { x: 12, y: 12 });
								setNotifMenuOpen(true);
								notifMenuOpenRef.current = true;
							}, 500);
						}}
						onTouchEnd={() => { if (bellLongPressTimerRef.current) clearTimeout(bellLongPressTimerRef.current); }}
						onTouchCancel={() => { if (bellLongPressTimerRef.current) clearTimeout(bellLongPressTimerRef.current); }}
						title="즐겨찾기 알림"
					>
						{notificationsEnabled ? "🔔" : "🔕"}
					</button>
					<button
						className="h-9 w-9 rounded-md border hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer text-lg sm:text-xl"
						onClick={() => router.push("/admin")}
						title="관리자 페이지"
					>
						🔒
					</button>
				</div>
			</div>

			<div className="mb-4 flex items-center gap-2">
				{viewMode === "favorites" ? (
					// 즐겨찾기 모드: 즐겨찾기 유저 목록
					<div className="flex items-center gap-2">
						<label className="text-sm text-zinc-600">즐겨찾기:</label>
						{favoriteUsers.length === 0 ? (
							<span className="text-sm text-zinc-500">즐겨찾기가 없습니다</span>
						) : (
							<div className="flex gap-2 flex-wrap">
								{favoriteUsers.map((user) => {
									const isSelected = selectedParticipants.has(user.name);
									return (
										<div key={user.name} className="flex items-center gap-1 px-2 py-1 border rounded bg-white dark:bg-zinc-800">
											<button
												className={`px-2 py-1 text-xs rounded transition-colors cursor-pointer ${isSelected ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"}`}
												onClick={() => {
													const newSelected = new Set(selectedParticipants);
													if (isSelected) {
														newSelected.delete(user.name);
													} else {
														newSelected.add(user.name);
													}
													setSelectedParticipants(newSelected);
												}}
											>
												{user.name}
											</button>
											<button
												className="px-1 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors cursor-pointer"
												onClick={() => removeFavorite(user.name)}
												title="삭제"
											>
												×
											</button>
										</div>
									);
								})}
							</div>
						)}
						<select
							className="border rounded px-2 py-1 text-sm"
							onChange={(e) => {
								if (e.target.value) {
									addFavorite(e.target.value);
									e.target.selectedIndex = 0;
								}
							}}
						>
							<option value="">참여자 추가</option>
							{participantList
								.filter(p => !favoriteUsers.find(f => f.name === p))
								.map((p) => (
									<option key={p} value={p}>{p}</option>
								))
							}
						</select>
					</div>
				) : (
					// 일반 모드: 참가자 선택 드롭다운
					<>
						<label className="text-sm text-zinc-600">참여자:</label>
						<select className="border rounded px-2 py-1" value={selectedParticipant} onChange={(e) => setSelectedParticipant(e.target.value)}>
							<option value="">전체</option>
							{participantList.map((p) => (
								<option key={p} value={p}>{p}</option>
							))}
						</select>
					</>
				)}
			</div>

			{/* 알림 설정 모달 */}
			{showNotificationSettings && (
				<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
					<div className="rounded p-4 w-full max-w-sm space-y-3" style={{ background: "var(--background)", color: "var(--foreground)" }}>
						<h2 className="text-lg font-semibold">알림 설정</h2>
						<div className="flex items-center justify-between">
							<div className="text-sm">알림</div>
							<button
								className={`px-3 py-1 rounded border ${notificationsEnabled ? "bg-yellow-200 text-black" : "bg-zinc-100 dark:bg-zinc-800"}`}
								onClick={() => {
									const next = !notificationsEnabled;
									setNotificationsEnabled(next);
									localStorage.setItem("gbti_notifications_enabled", next ? "1" : "0");
									if (!next) clearAllNotificationTimers();
									else {
										// 권한이 이미 있는 경우 즉시 서버 구독 업데이트
										if (Notification.permission === "granted") ensurePushSubscription();
									}
								}}
							>
								{notificationsEnabled ? "ON" : "OFF"}
							</button>
						</div>

						<div>
							<div className="text-sm mb-1">알림 대상(최대 3명)</div>
							<div className="flex gap-2 flex-wrap">
								{participantList.map((name) => {
									const selected = notificationTargets.includes(name);
									return (
										<button
											key={name}
											className={`px-2 py-1 text-xs rounded border ${selected ? "bg-indigo-600 text-white" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
											onClick={() => {
												let next = [...notificationTargets];
												if (selected) next = next.filter((n) => n !== name);
												else {
													if (next.length >= 3) return;
													next.push(name);
												}
												setNotificationTargets(next);
												localStorage.setItem("gbti_notifications_targets", JSON.stringify(next));
											}}
										>
											{name}
										</button>
									);
								})}
							</div>
						</div>

						<div>
							<div className="text-sm mb-1">알림 시점(복수 선택 가능)</div>
							<div className="flex gap-2 flex-wrap">
								{[5, 10, 15, 30, 60, 120].map((m) => {
									const selected = notificationLeadMinutesList.includes(m);
									return (
										<button
											key={m}
											className={`px-2 py-1 text-xs rounded border ${selected ? "bg-yellow-200 text-black" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
											onClick={() => {
												let next = notificationLeadMinutesList.slice();
												if (selected) next = next.filter((x) => x !== m);
												else next.push(m);
												setNotificationLeadMinutesList(next);
												if (next.length > 0) setNotificationLeadMinutes(next[0]);
												localStorage.setItem("gbti_notifications_minutes_list", JSON.stringify(next));
												// 구버전 키도 함께 업데이트(선택 첫값)
												localStorage.setItem("gbti_notifications_minutes", String(next[0] || 30));
											}}
										>
											{m}분 전
										</button>
									);
								})}
							</div>
						</div>

						<div className="flex justify-end gap-2">
							<button
								className="px-3 py-1 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800"
								onClick={async () => {
									await ensurePushSubscription();
									setShowNotificationSettings(false);
									setShowSaveToast(true);
									setTimeout(() => setShowSaveToast(false), 2000);
								}}
							>
								저장
							</button>
							<button
								className="px-3 py-1 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800"
								onClick={() => {
									const run = () => showLocalNotification("테스트 알림", {
										body: "알림이 정상 동작합니다.",
										badge: NOTIF_BADGE,
										icon: NOTIF_ICON,
									});
									if (Notification.permission !== "granted") {
										requestNotificationPermission().then((ok) => { if (ok) run(); });
									} else {
										run();
									}
								}}
							>
								테스트 알림
							</button>
							<button
								className="px-3 py-1 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800"
								onClick={() => {
									setShowNotificationSettings(false);
									ensurePushSubscription();
								}}
							>닫기</button>
						</div>
					</div>
				</div>
			)}

			{/* 저장 토스트 */}
			{showSaveToast && (
				<div className="fixed top-4 right-4 z-[60] px-3 py-2 rounded border text-sm"
					style={{ background: "var(--background)", color: "var(--foreground)" }}>
					설정이 저장되었습니다
				</div>
			)}
            {(
				// 월간 뷰: 기존 날짜 그리드
				<>
					{/* 요일 헤더 (월~일) */}
					<div className="grid grid-cols-7 gap-2 mb-1 text-xs">
						{["월", "화", "수", "목", "금", "토", "일"].map((w) => (
							<div key={w} className="px-2 py-1 text-zinc-700 dark:text-zinc-300 font-medium">{w}</div>
						))}
					</div>

					<div className="grid grid-cols-7 gap-1 sm:gap-2">
						{days.map((d) => (
							<div
								key={d.toISOString()}
								className={`border rounded p-1 sm:p-2 min-h-20 sm:min-h-24 border-zinc-200 dark:border-zinc-700 cursor-pointer transition-colors ${isToday(d)
									? "ring-2"
									: `${isSameMonth(d, current) ? "bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-800" : "bg-zinc-50 dark:bg-zinc-900/40 text-zinc-400 dark:text-zinc-500"}`
									}`}
								style={isToday(d) ? { backgroundColor: "#FFF6D1", boxShadow: `0 0 0 2px ${BRAND_COLOR}`, borderColor: BRAND_COLOR } : undefined}
								{...getDayTouchHandlers(d)}
							>
								<div className="text-xs sm:text-sm font-medium text-zinc-800 dark:text-zinc-100">
									{isToday(d) ? (
										<span className="inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full" style={{ backgroundColor: BRAND_COLOR, color: "#111" }}>
											{format(d, "d")}
										</span>
									) : (
										<span>{format(d, "d")}</span>
            )}
								</div>
                                <div className="mt-1 space-y-1">
                                    {events.filter((e) => {
                                        const s = new Date(e.startAt);
                                        const en = new Date(e.endAt);
                                        const dayStart = startOfDay(d);
                                        const dayEnd = endOfDay(d);
                                        return s <= dayEnd && en >= dayStart;
                                    }).map((e) => {
                                        const s = new Date(e.startAt);
                                        const en = new Date(e.endAt);
                                        const isStartDay = isSameDay(s, d);
                                        const isEndDay = isSameDay(en, d);
                                        const radius = 6;
                                        const shapeStyle = {
                                            borderTopLeftRadius: isStartDay ? radius : 0,
                                            borderBottomLeftRadius: isStartDay ? radius : 0,
                                            borderTopRightRadius: isEndDay ? radius : 0,
                                            borderBottomRightRadius: isEndDay ? radius : 0,
                                        } as React.CSSProperties;

                                        // 라벨: 시작/중간/종료 구분
                                        let label = e.title;
                                        if (!isStartDay && !isEndDay) label = "계속";
                                        if (isEndDay && !isStartDay) label = `종료 ${format(en, "HH:mm")}`;
                                        if (isStartDay && !isEndDay) label = `${format(s, "HH:mm")} ${e.title}`;

                                        const borderColor = darkenColor(e.color || "#93c5fd", 40);
                                        const isMiddle = !isStartDay && !isEndDay;
                                        const heightClass = isMiddle ? "h-1.5" : "";

                                        return (
                                            <button
                                                key={e.id}
                                                onClick={() => setActiveEventId(e.id)}
                                                className={`w-full text-left text-[10px] sm:text-xs px-1 py-0.5 truncate transition-colors cursor-pointer ${heightClass}`}
                                                style={{
                                                    backgroundColor: e.color || "#93c5fd",
                                                    color: "#000",
                                                    borderLeft: `3px solid ${borderColor}`,
                                                    ...shapeStyle
                                                }}
                                                title={e.title}
                                            >
                                                {isMiddle ? "" : label}
                                            </button>
                                        );
                                    })}
                                </div>
							</div>
						))}
					</div>

					{/* 오늘의 파티 목록 */}
					<div className="mt-6">
						<h2 className="text-lg font-semibold mb-3">오늘의 파티 ({format(new Date(), "MM월 dd일")})</h2>
						{(() => {
							const todayEvents = events.filter((e) => isSameDay(new Date(e.startAt), new Date()));
							if (todayEvents.length === 0) {
								return <div className="text-sm text-zinc-500 dark:text-zinc-400">오늘 예정된 파티가 없습니다.</div>;
							}
							return (
								<div className="space-y-2">
									{todayEvents.map((e) => (
										<div
											key={e.id}
											className="border rounded p-3 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
											onClick={() => setActiveEventId(e.id)}
										>
											<div className="flex items-start justify-between">
												<div className="flex-1">
													<div className="font-medium text-sm">{e.title}</div>
													<div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
														{format(new Date(e.startAt), "HH:mm")} - {format(new Date(e.endAt), "HH:mm")}
													</div>
													{e.participants && e.participants.length > 0 && (
														<div className="flex gap-1 flex-wrap mt-1">
															{e.participants.map((p) => (
																<span key={p} className="px-2 py-0.5 text-xs rounded-full bg-zinc-200 dark:bg-zinc-700">
																	{p}
																</span>
															))}
														</div>
													)}
												</div>
												{e.allDay && (
													<span className="px-2 py-0.5 text-xs rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200">
														종일
													</span>
												)}
											</div>
										</div>
									))}
								</div>
							);
						})()}
					</div>
				</>
			)}

			{/* 하단 인라인 추가 폼 제거 (관리자 팝업으로 대체) */}
			{activeEventId && (
				<EventDetailModal
					eventId={activeEventId}
					onClose={() => setActiveEventId(null)}
					onChanged={() => {
						// 참여자 목록 새로고침 (참여자가 추가/삭제되었을 수 있음)
						fetchParticipants();

						// 월간 범위로 이벤트 새로고침
						let startStr: string, endStr: string;
						startStr = format(startOfWeek(startOfMonth(current), { weekStartsOn: 1 }), "yyyy-MM-dd");
						endStr = format(endOfWeek(endOfMonth(current), { weekStartsOn: 1 }), "yyyy-MM-dd");

						const qp = new URLSearchParams({ start: startStr, end: endStr });
						if (selectedParticipant) qp.set("participantName", selectedParticipant);
						fetch(`/api/events?${qp.toString()}`).then((r) => r.json()).then((json) => setEvents(json.events ?? []));
					}}
				/>
			)}
			{showCreateModal && selectedDate && (
				<CreateEventModal
					selectedDate={selectedDate}
					onClose={() => {
						setShowCreateModal(false);
						setSelectedDate(null);
					}}
					onCreated={() => {
						// 참여자 목록 새로고침 (새 참여자가 추가되었을 수 있음)
						fetchParticipants();

						// 월간 범위로 이벤트 새로고침
						let startStr: string, endStr: string;
						startStr = format(startOfWeek(startOfMonth(current), { weekStartsOn: 1 }), "yyyy-MM-dd");
						endStr = format(endOfWeek(endOfMonth(current), { weekStartsOn: 1 }), "yyyy-MM-dd");

						const qp = new URLSearchParams({ start: startStr, end: endStr });
						if (selectedParticipant) qp.set("participantName", selectedParticipant);
						fetch(`/api/events?${qp.toString()}`).then((r) => r.json()).then((json) => setEvents(json.events ?? []));

						setShowCreateModal(false);
						setSelectedDate(null);
					}}
				/>
			)}

			{/* 연/월 선택 모달 */}
			{showMonthPicker && (
				<div className="fixed inset-0 bg-black/40 flex items-center justify-center">
					<div className="rounded p-4 w-full max-w-sm mx-4 sm:mx-0 space-y-3 max-h-[85vh] overflow-y-auto" style={{ background: "var(--background)", color: "var(--foreground)" }}>
						<h2 className="text-lg font-semibold">연/월 선택</h2>
						<div className="flex gap-2">
							<select
								className="flex-1 border rounded px-2 py-1"
								value={pickerYear}
								onChange={(e) => setPickerYear(parseInt(e.target.value))}
							>
								{Array.from({ length: 31 }).map((_, i) => {
									const y = new Date().getFullYear() - 15 + i; // 현재 기준 -15년 ~ +15년
									return <option key={y} value={y}>{y}년</option>;
								})}
							</select>
							<select
								className="flex-1 border rounded px-2 py-1"
								value={pickerMonth}
								onChange={(e) => setPickerMonth(parseInt(e.target.value))}
							>
								{Array.from({ length: 12 }).map((_, m) => (
									<option key={m} value={m}>{m + 1}월</option>
								))}
							</select>
						</div>
						<div className="flex justify-end gap-2">
							<button
								className="px-3 py-1 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
								onClick={() => setShowMonthPicker(false)}
							>
								취소
							</button>
							<button
								className="px-3 py-1 rounded text-black transition-colors cursor-pointer"
								style={{ backgroundColor: BRAND_COLOR }}
								onClick={() => {
									const newDate = new Date(pickerYear, pickerMonth, 1);
									setCurrent(newDate);
									setShowMonthPicker(false);
								}}
							>
								완료
							</button>
						</div>
					</div>

					{/* 알림 리드타임 설정 메뉴 */}
					{notifMenuOpen && (
						<div className="fixed inset-0 z-50" onClick={() => { setNotifMenuOpen(false); notifMenuOpenRef.current = false; }}>
							<div
								className="absolute rounded border bg-white dark:bg-zinc-900 text-sm shadow-md"
								style={{ left: (notifMenuPos?.x ?? 12), top: (notifMenuPos?.y ?? 12) }}
								onClick={(e) => e.stopPropagation()}
							>
								<div className="px-3 py-2 border-b dark:border-zinc-700">알림 시간 선택</div>
								{[5, 10, 15, 30, 60].map((m) => (
									<button
										key={m}
										className={`block w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 ${notificationLeadMinutes === m ? "font-semibold" : ""}`}
										onClick={() => {
											setNotificationLeadMinutes(m);
											localStorage.setItem("gbti_notifications_minutes", String(m));
											setNotifMenuOpen(false);
											notifMenuOpenRef.current = false;
										}}
									>
										{m}분 전
									</button>
								))}
								<div className="px-3 py-2 border-t dark:border-zinc-700 text-xs text-zinc-500">우클릭/롱프레스로 열기</div>
							</div>
						</div>
					)}
				</div>
			)}

            {/* 공지사항 관련 모달 제거 */}
		</div>
	);
}

function AdminAuthModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			const res = await fetch("/api/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ password, role: "admin" }),
			});

			if (res.ok) {
				onSuccess();
			} else {
				setError("비밀번호가 일치하지 않습니다.");
			}
		} catch (err) {
			setError("로그인에 실패했습니다.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
			<div className="rounded p-6 w-full max-w-sm bg-white dark:bg-zinc-900">
				<h2 className="text-lg font-semibold mb-4">관리자 인증</h2>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label className="block text-sm mb-2">관리자 비밀번호</label>
						<input
							type="password"
							className="w-full border rounded px-3 py-2"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							autoFocus
						/>
						{error && <div className="text-sm text-red-600 mt-1">{error}</div>}
					</div>
					<div className="flex gap-2 justify-end">
						<button
							type="button"
							className="px-4 py-2 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
							onClick={onClose}
							disabled={loading}
						>
							취소
						</button>
						<button
							type="submit"
							className="px-4 py-2 rounded text-black transition-colors cursor-pointer"
							style={{ backgroundColor: BRAND_COLOR }}
							disabled={loading}
						>
							{loading ? "확인 중..." : "확인"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
