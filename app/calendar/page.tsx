"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CreateEventModal from "@/app/calendar/CreateEventModal";
import EventDetailModal from "@/app/calendar/EventDetailModal";
// 공지사항 관련 import 제거
import { addDays, eachDayOfInterval, endOfDay, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import html2canvas from "html2canvas";
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
	isRecurring?: boolean;
	recurringSlotId?: string;
	recurringDays?: number[];
	recurringStartMinutes?: number;
	recurringEndMinutes?: number;
};

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
	const [favoriteUsers, setFavoriteUsers] = useState<FavoriteUser[]>([]);
	// 관리자 버튼은 라우팅으로 대체
    // 공지사항 상태 제거
		const days = useMemo(() => {
		{
			// 월간 뷰: 월 전체 표시 (이전/다음 달 일부 포함)
			const start = startOfWeek(startOfMonth(current), { weekStartsOn: 1 });
			const end = endOfWeek(endOfMonth(current), { weekStartsOn: 1 });
			return eachDayOfInterval({ start, end });
		}
	}, [current]);

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
			if (selectedParticipants.size > 0) {
				// 선택된 참가자 중 하나라도 참여하는 이벤트만 표시
				fetchedEvents = fetchedEvents.filter((event: Event) => {
					if (!event.participants || event.participants.length === 0) return false;
					return event.participants.some(p => selectedParticipants.has(p));
				});
			} else if (selectedParticipant && selectedParticipant !== "") {
				// 참가자 필터링: 선택된 참가자가 participants 배열에 포함된 이벤트만
				fetchedEvents = fetchedEvents.filter((event: Event) => {
					if (!event.participants || event.participants.length === 0) return false;
					return event.participants.includes(selectedParticipant);
				});
			}

			setEvents(fetchedEvents);
		};
		fetchEvents();
	}, [current, selectedParticipant, selectedParticipants]);

	const [participantList, setParticipantList] = useState<string[]>([]);
	const [participantMap, setParticipantMap] = useState<Map<string, { title?: string | null; color?: string | null }>>(new Map());
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
	
	// 설정 관련 상태
	const [currentUserName, setCurrentUserName] = useState<string>("");
	const [showSettings, setShowSettings] = useState<boolean>(false);
	const [showUserInfoSettings, setShowUserInfoSettings] = useState<boolean>(false);
	const [showUserNotificationSettings, setShowUserNotificationSettings] = useState<boolean>(false);
	const [showUserEventsView, setShowUserEventsView] = useState<boolean>(false);
	const [userInfoName, setUserInfoName] = useState<string>("");
	const [userInfoTitle, setUserInfoTitle] = useState<string>("");
	const [userInfoColor, setUserInfoColor] = useState<string>("#e5e7eb");
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

	// 반복 이벤트를 그룹화하는 함수
	function groupRecurringEvents(events: Event[]): Event[] {
		const recurringGroups = new Map<string, { count: number; rep: Event }>();
		const regularEvents: Event[] = [];

		events.forEach(event => {
			if (event.isRecurring && event.recurringSlotId !== undefined) {
				const startKey = event.recurringStartMinutes ?? new Date(event.startAt).getHours() * 60 + new Date(event.startAt).getMinutes();
				const endKey = event.recurringEndMinutes ?? new Date(event.endAt).getHours() * 60 + new Date(event.endAt).getMinutes();
				const groupKey = `${event.title}-${startKey}-${endKey}-${event.calendarId ?? ''}`;
				if (!recurringGroups.has(groupKey)) {
					recurringGroups.set(groupKey, { count: 1, rep: event });
				} else {
					const cur = recurringGroups.get(groupKey)!;
					cur.count += 1;
				}
			} else {
				regularEvents.push(event);
			}
		});

		const groupedRecurringEvents: Event[] = [];
		recurringGroups.forEach(({ count, rep }) => {
			const groupedEvent: Event = {
				...rep,
				id: `recurring-${rep.recurringSlotId}`,
				title: `${rep.title}`,
				isRecurring: true,
				recurringSlotId: rep.recurringSlotId,
				recurringDays: rep.recurringDays,
				recurringStartMinutes: rep.recurringStartMinutes,
				recurringEndMinutes: rep.recurringEndMinutes,
			};
			groupedRecurringEvents.push(groupedEvent);
		});

		return [...regularEvents, ...groupedRecurringEvents];
	}

	useEffect(() => {
		// 저장된 사용자명 불러오기
		const savedUserName = localStorage.getItem("gbti_current_user_name");
		if (savedUserName) {
			setCurrentUserName(savedUserName);
			// 저장된 사용자 정보 불러오기
			const savedUserInfo = localStorage.getItem(`gbti_user_info_${savedUserName}`);
			if (savedUserInfo) {
				try {
					const info = JSON.parse(savedUserInfo);
					setUserInfoName(info.name || savedUserName);
					setUserInfoTitle(info.title || "");
					setUserInfoColor(info.color || "#e5e7eb");
				} catch { }
			} else {
				setUserInfoName(savedUserName);
			}
		}
		
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

	// KST(Asia/Seoul) 시간을 정확하게 계산
	// e.startAt은 UTC ISO 문자열이므로, 이를 KST 기준으로 해석하여 정확한 알림 시간 계산
	function getKstTimeFromUtcIso(utcIsoString: string): { kstMs: number; kstHours: number; kstMinutes: number } {
		// UTC 시간을 파싱
		const utcDate = new Date(utcIsoString);
		
		// UTC 시간의 연/월/일/시/분 추출
		const utcYear = utcDate.getUTCFullYear();
		const utcMonth = utcDate.getUTCMonth();
		const utcDateNum = utcDate.getUTCDate();
		const utcHours = utcDate.getUTCHours();
		const utcMinutes = utcDate.getUTCMinutes();
		
		// KST 시간 계산 (UTC + 9시간)
		let kstHours = utcHours + 9;
		let kstDateNum = utcDateNum;
		let kstMonth = utcMonth;
		let kstYear = utcYear;
		
		// 시간 오버플로우 처리
		if (kstHours >= 24) {
			kstHours -= 24;
			kstDateNum += 1;
		}
		
		// KST 시간을 표시용으로 사용 (알림 메시지에 표시)
		// 실제 알림 시간 계산을 위해 UTC Date 객체를 그대로 사용
		// e.startAt은 이미 올바른 UTC 시간이므로, 이를 그대로 사용하면 됨
		// 하지만 사용자가 설정한 시간이 KST 기준이므로, KST 시간을 표시
		
		// UTC 시간을 그대로 사용 (이미 올바른 절대 시간)
		const kstMs = utcDate.getTime();
		
		return {
			kstMs,
			kstHours,
			kstMinutes: utcMinutes
		};
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
			const { kstMs, kstHours, kstMinutes } = getKstTimeFromUtcIso(e.startAt);
			const startTimeText = `${String(kstHours).padStart(2, '0')}:${String(kstMinutes).padStart(2, '0')}`;

			const leads = (notificationLeadMinutesList.length > 0 ? notificationLeadMinutesList : [notificationLeadMinutes])
				.filter((m, idx, arr) => arr.indexOf(m) === idx)
				.sort((a, b) => a - b);

			leads.forEach((m) => {
				const triggerAt = kstMs - m * 60 * 1000;
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
		const participants = data.participants ?? [];
		setParticipantList(participants.map((p: any) => p.name));
		// 참여자 정보 맵 생성 (이름 -> {title, color})
		const map = new Map<string, { title?: string | null; color?: string | null }>();
		participants.forEach((p: any) => {
			map.set(p.name, { title: p.title, color: p.color });
		});
		
		// localStorage에 저장된 사용자 정보도 병합
		const savedUserName = localStorage.getItem("gbti_current_user_name");
		if (savedUserName) {
			const savedUserInfo = localStorage.getItem(`gbti_user_info_${savedUserName}`);
			if (savedUserInfo) {
				try {
					const info = JSON.parse(savedUserInfo);
					map.set(savedUserName, { title: info.title, color: info.color });
				} catch { }
			}
		}
		
		setParticipantMap(map);
	};

    // 공지사항 fetch 제거

	// 즐겨찾기 목록 새로고침 함수
	const refreshFavorites = () => {
		const savedFavorites = localStorage.getItem("gbti_favorites");
		if (savedFavorites) {
			const parsed = JSON.parse(savedFavorites);
			// viewMode 제거 (구버전 호환)
			const cleaned = parsed.map((f: any) => ({ name: f.name }));
			setFavoriteUsers(cleaned);
			localStorage.setItem("gbti_favorites", JSON.stringify(cleaned));
		} else {
			setFavoriteUsers([]);
		}
	};

	useEffect(() => {
        fetchParticipants();
		refreshFavorites();

		// 즐겨찾기 변경 이벤트 리스너
		const handleFavoritesUpdated = () => {
			refreshFavorites();
		};
		window.addEventListener('favoritesUpdated', handleFavoritesUpdated);
		return () => {
			window.removeEventListener('favoritesUpdated', handleFavoritesUpdated);
		};
	}, []);


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
						className="h-9 w-9 rounded-md border hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer text-lg sm:text-xl text-zinc-600"
						onClick={() => setShowSettings(true)}
						title="설정"
					>
						⚙️
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

			{/* 참여자 선택 UI */}
			<div className="mb-4 space-y-2">
				{/* 선택된 유저들 (위쪽) */}
				{selectedParticipants.size > 0 && (
					<div className="flex items-center gap-2 flex-wrap">
						<label className="text-sm text-zinc-600">선택된 참여자:</label>
						{Array.from(selectedParticipants).map((name) => {
							const participantInfo = participantMap.get(name);
							const bgColor = participantInfo?.color || "#e5e7eb";
							// 배경색 밝기에 따라 글자색 결정
							const hexToRgb = (hex: string) => {
								const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
								return result ? {
									r: parseInt(result[1], 16),
									g: parseInt(result[2], 16),
									b: parseInt(result[3], 16)
								} : { r: 229, g: 231, b: 235 }; // 기본값
							};
							const rgb = hexToRgb(bgColor);
							// 상대적 밝기 계산 (0-255)
							const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
							const isBright = brightness > 128;
							const textColor = isBright ? "#000" : "#fff";
							
							// 칭호 네온 효과 (배경이 너무 밝을 때만 어두운 색, 그 외에는 흰색 네온)
							const titleGlowColor = participantInfo?.color || "#ff00ff";
							const titleRgb = hexToRgb(titleGlowColor);
							const isVeryBright = brightness > 200; // 너무 밝은 배경(흰색 계열)일 때만 어두운 색 사용
							// 기본적으로는 흰색 계열로 네온 효과, 너무 밝은 배경일 때만 어두운 색
							const titleTextColor = isVeryBright 
								? `rgb(${Math.max(0, titleRgb.r - 100)}, ${Math.max(0, titleRgb.g - 100)}, ${Math.max(0, titleRgb.b - 100)})`
								: `rgb(${Math.min(255, titleRgb.r + 200)}, ${Math.min(255, titleRgb.g + 200)}, ${Math.min(255, titleRgb.b + 200)})`;
							const titleTextShadow = isVeryBright
								? `0 0 2px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.8),
								   0 0 4px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.6),
								   0 0 6px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.4)`
								: `0 0 2px rgb(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}),
								   0 0 4px rgb(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}),
								   0 0 6px rgb(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}),
								   0 0 10px rgb(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}),
								   0 0 20px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.8),
								   0 0 30px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.6)`;
							const titleBgColor = isVeryBright
								? `rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.3)`
								: `rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.15)`;
							
							return (
								<button
									key={name}
									onClick={() => {
										const newSelected = new Set(selectedParticipants);
										newSelected.delete(name);
										setSelectedParticipants(newSelected);
									}}
									className="px-2 py-1 text-xs rounded-full flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer"
									style={{ backgroundColor: bgColor }}
								>
									{participantInfo?.title && (
										<span
											className="font-bold mr-0.5 px-1.5 py-0.5 rounded"
											style={{
												color: titleTextColor,
												textShadow: titleTextShadow.trim(),
												backgroundColor: titleBgColor,
												letterSpacing: "0.5px",
												fontWeight: "700",
												animation: "glow-pulse 2s ease-in-out infinite",
												boxShadow: isBright 
													? `0 0 5px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.3)`
													: `0 0 10px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.3), inset 0 0 10px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.1)`
											}}
										>
											{participantInfo.title}
										</span>
									)}
									<span style={{ color: textColor }}>{name}</span>
									<span style={{ color: textColor, opacity: 0.7 }}>×</span>
								</button>
							);
						})}
					</div>
				)}

				{/* 선택 가능한 유저들 (아래쪽, 가로 스크롤) */}
				<div className="flex items-center gap-2">
					<label className="text-sm text-zinc-600 whitespace-nowrap">참여자:</label>
					<div className="flex-1 overflow-x-auto">
						<div className="flex gap-2 pb-1">
							{/* 즐겨찾기 유저들 먼저 */}
							{favoriteUsers.map((user) => {
								if (selectedParticipants.has(user.name)) return null;
								const participantInfo = participantMap.get(user.name);
								const bgColor = participantInfo?.color || "#e5e7eb";
								// 배경색 밝기에 따라 글자색 결정
								const hexToRgb = (hex: string) => {
									const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
									return result ? {
										r: parseInt(result[1], 16),
										g: parseInt(result[2], 16),
										b: parseInt(result[3], 16)
									} : { r: 229, g: 231, b: 235 }; // 기본값
								};
								const rgb = hexToRgb(bgColor);
								const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
								const isBright = brightness > 128;
								const textColor = isBright ? "#000" : "#fff";
								
								// 칭호 네온 효과 (배경이 너무 밝을 때만 어두운 색, 그 외에는 흰색 네온)
								const titleGlowColor = participantInfo?.color || "#ff00ff";
								const titleRgb = hexToRgb(titleGlowColor);
								const isVeryBright = brightness > 200; // 너무 밝은 배경(흰색 계열)일 때만 어두운 색 사용
								// 기본적으로는 흰색 계열로 네온 효과, 너무 밝은 배경일 때만 어두운 색
								const titleTextColor = isVeryBright 
									? `rgb(${Math.max(0, titleRgb.r - 100)}, ${Math.max(0, titleRgb.g - 100)}, ${Math.max(0, titleRgb.b - 100)})`
									: `rgb(${Math.min(255, titleRgb.r + 200)}, ${Math.min(255, titleRgb.g + 200)}, ${Math.min(255, titleRgb.b + 200)})`;
								const titleTextShadow = isVeryBright
									? `0 0 2px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.8),
									   0 0 4px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.6),
									   0 0 6px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.4)`
									: `0 0 2px rgb(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}),
									   0 0 4px rgb(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}),
									   0 0 6px rgb(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}),
									   0 0 10px rgb(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}),
									   0 0 20px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.8),
									   0 0 30px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.6)`;
								const titleBgColor = isVeryBright
									? `rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.3)`
									: `rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.15)`;
								
								return (
									<button
										key={user.name}
										onClick={() => {
											const newSelected = new Set(selectedParticipants);
											newSelected.add(user.name);
											setSelectedParticipants(newSelected);
										}}
										className="px-2 py-1 text-xs rounded-full flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer whitespace-nowrap"
										style={{ backgroundColor: bgColor }}
									>
										<span className="text-yellow-500 text-[10px]">⭐</span>
										{participantInfo?.title && (
											<span
												className="font-bold mr-0.5 px-1.5 py-0.5 rounded"
												style={{
													color: titleTextColor,
													textShadow: titleTextShadow.trim(),
													backgroundColor: titleBgColor,
													letterSpacing: "0.5px",
													fontWeight: "700",
													animation: "glow-pulse 2s ease-in-out infinite",
													boxShadow: isBright 
														? `0 0 5px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.3)`
														: `0 0 10px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.3), inset 0 0 10px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.1)`
												}}
											>
												{participantInfo.title}
											</span>
										)}
										<span style={{ color: textColor }}>{user.name}</span>
									</button>
								);
							})}
							
							{/* 일반 유저들 */}
							{participantList
								.filter(p => !favoriteUsers.find(f => f.name === p) && !selectedParticipants.has(p))
								.map((name) => {
									const participantInfo = participantMap.get(name);
									const bgColor = participantInfo?.color || "#e5e7eb";
									// 배경색 밝기에 따라 글자색 결정
									const hexToRgb = (hex: string) => {
										const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
										return result ? {
											r: parseInt(result[1], 16),
											g: parseInt(result[2], 16),
											b: parseInt(result[3], 16)
										} : { r: 229, g: 231, b: 235 }; // 기본값
									};
									const rgb = hexToRgb(bgColor);
									const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
									const isBright = brightness > 128;
									const textColor = isBright ? "#000" : "#fff";
									
									// 칭호 네온 효과 (배경이 너무 밝을 때만 어두운 색, 그 외에는 흰색 네온)
									const titleGlowColor = participantInfo?.color || "#ff00ff";
									const titleRgb = hexToRgb(titleGlowColor);
									const isVeryBright = brightness > 200; // 너무 밝은 배경(흰색 계열)일 때만 어두운 색 사용
									// 기본적으로는 흰색 계열로 네온 효과, 너무 밝은 배경일 때만 어두운 색
									const titleTextColor = isVeryBright 
										? `rgb(${Math.max(0, titleRgb.r - 100)}, ${Math.max(0, titleRgb.g - 100)}, ${Math.max(0, titleRgb.b - 100)})`
										: `rgb(${Math.min(255, titleRgb.r + 200)}, ${Math.min(255, titleRgb.g + 200)}, ${Math.min(255, titleRgb.b + 200)})`;
									const titleTextShadow = isVeryBright
										? `0 0 2px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.8),
										   0 0 4px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.6),
										   0 0 6px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.4)`
										: `0 0 2px rgb(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}),
										   0 0 4px rgb(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}),
										   0 0 6px rgb(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}),
										   0 0 10px rgb(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}),
										   0 0 20px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.8),
										   0 0 30px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.6)`;
									const titleBgColor = isVeryBright
										? `rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.3)`
										: `rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.15)`;
									
									return (
										<button
											key={name}
											onClick={() => {
												const newSelected = new Set(selectedParticipants);
												newSelected.add(name);
												setSelectedParticipants(newSelected);
											}}
											className="px-2 py-1 text-xs rounded-full flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer whitespace-nowrap"
											style={{ backgroundColor: bgColor }}
										>
											{participantInfo?.title && (
												<span
													className="font-bold mr-0.5 px-1.5 py-0.5 rounded"
													style={{
														color: titleTextColor,
														textShadow: titleTextShadow.trim(),
														backgroundColor: titleBgColor,
														letterSpacing: "0.5px",
														fontWeight: "700",
														animation: "glow-pulse 2s ease-in-out infinite",
														boxShadow: isBright 
															? `0 0 5px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.3)`
															: `0 0 10px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.3), inset 0 0 10px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.1)`
													}}
												>
													{participantInfo.title}
												</span>
											)}
											<span style={{ color: textColor }}>{name}</span>
										</button>
									);
								})}
						</div>
					</div>
				</div>
			</div>

			{/* 설정 모달 */}
			{showSettings && (
				<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowSettings(false)}>
					<div className="rounded p-4 w-full max-w-sm space-y-3" style={{ background: "var(--background)", color: "var(--foreground)" }} onClick={(e) => e.stopPropagation()}>
						<h2 className="text-lg font-semibold">설정</h2>
						
						{!currentUserName ? (
							// 사용자명이 없는 경우: 입력/선택만 가능
							<div className="space-y-3">
								<div>
									<label className="text-sm mb-1 block">사용자명</label>
									<div className="flex gap-2">
										<select
											className="flex-1 border rounded px-3 py-2"
											value={currentUserName}
											onChange={(e) => {
												if (e.target.value) {
													setCurrentUserName(e.target.value);
													localStorage.setItem("gbti_current_user_name", e.target.value);
													setShowSettings(false);
													window.location.reload(); // 참여자 정보 새로고침
												}
											}}
										>
											<option value="">선택하세요</option>
											{participantList.map((name) => (
												<option key={name} value={name}>{name}</option>
											))}
										</select>
									</div>
									<div className="mt-2 text-xs text-zinc-500">
										또는 직접 입력:
									</div>
									<input
										type="text"
										placeholder="사용자명 입력"
										className="w-full border rounded px-3 py-2 mt-1"
										onKeyDown={(e) => {
											if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
												const name = (e.target as HTMLInputElement).value.trim();
												setCurrentUserName(name);
												localStorage.setItem("gbti_current_user_name", name);
												setShowSettings(false);
												window.location.reload();
											}
										}}
									/>
								</div>
								<div className="flex justify-end">
									<button
										className="px-3 py-1 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800"
										onClick={() => setShowSettings(false)}
									>
										닫기
									</button>
								</div>
							</div>
						) : (
							// 사용자명이 있는 경우: 설정 버튼 표시
							<div className="space-y-3">
								<div className="text-sm text-zinc-600">
									현재 사용자: <strong>{currentUserName}</strong>
								</div>
								<div className="space-y-2">
									<button
										className="w-full px-4 py-2 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left"
										onClick={() => {
											setShowSettings(false);
											setShowUserInfoSettings(true);
										}}
									>
										닉네임/칭호 설정
									</button>
									<button
										className="w-full px-4 py-2 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left"
										onClick={() => {
											setShowSettings(false);
											setShowUserNotificationSettings(true);
										}}
									>
										알람 설정
									</button>
									<button
										className="w-full px-4 py-2 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left"
										onClick={() => {
											setShowSettings(false);
											setShowUserEventsView(true);
										}}
									>
										파티 한눈에 보기
									</button>
								</div>
								<div className="flex justify-end gap-2">
									<button
										className="px-3 py-1 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm"
										onClick={() => {
											if (confirm("사용자명을 변경하시겠습니까?")) {
												localStorage.removeItem("gbti_current_user_name");
												setCurrentUserName("");
												setShowSettings(false);
											}
										}}
									>
										사용자명 변경
									</button>
									<button
										className="px-3 py-1 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800"
										onClick={() => setShowSettings(false)}
									>
										닫기
									</button>
								</div>
							</div>
						)}
					</div>
				</div>
			)}

			{/* 유저 정보 설정 모달 */}
			{showUserInfoSettings && (
				<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowUserInfoSettings(false)}>
					<div className="rounded p-4 w-full max-w-sm space-y-3" style={{ background: "var(--background)", color: "var(--foreground)" }} onClick={(e) => e.stopPropagation()}>
						<h2 className="text-lg font-semibold">유저 정보 설정</h2>
						<div className="space-y-3">
							<div>
								<label className="text-sm mb-1 block">이름</label>
								<input
									type="text"
									value={userInfoName}
									onChange={(e) => setUserInfoName(e.target.value)}
									className="w-full border rounded px-3 py-2 bg-zinc-50 dark:bg-zinc-800"
									readOnly
									title="이름은 관리자만 변경할 수 있습니다"
								/>
							</div>
							<div>
								<label className="text-sm mb-1 block">칭호</label>
								<input
									type="text"
									value={userInfoTitle}
									onChange={(e) => setUserInfoTitle(e.target.value)}
									placeholder="예: 공주"
									className="w-full border rounded px-3 py-2"
								/>
							</div>
							<div>
								<label className="text-sm mb-1 block">칭호 색상</label>
								<div className="flex gap-2">
									<input
										type="color"
										value={userInfoColor}
										onChange={(e) => setUserInfoColor(e.target.value)}
										className="w-16 h-10 border rounded cursor-pointer"
									/>
									<input
										type="text"
										value={userInfoColor}
										onChange={(e) => setUserInfoColor(e.target.value)}
										className="flex-1 border rounded px-3 py-2"
										placeholder="#e5e7eb"
									/>
								</div>
							</div>
							<div className="flex justify-end gap-2">
								<button
									className="px-3 py-1 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800"
									onClick={async () => {
										// API를 통해 참여자 정보 업데이트
										try {
											// 먼저 참여자 목록에서 현재 사용자의 ID 찾기
											const res = await fetch("/api/participants");
											const data = await res.json();
											const participants = data.participants || [];
											const currentUser = participants.find((p: any) => p.name === currentUserName);
											
											if (currentUser) {
												// 기존 참여자 업데이트
												const updateRes = await fetch(`/api/participants/${currentUser.id}`, {
													method: "PUT",
													headers: { "Content-Type": "application/json" },
													body: JSON.stringify({
														name: userInfoName.trim(),
														title: userInfoTitle.trim() || null,
														color: userInfoColor || "#e5e7eb",
														currentUserName: currentUserName
													}),
												});
												
												if (updateRes.ok) {
													// localStorage에도 저장
													localStorage.setItem(`gbti_user_info_${userInfoName.trim()}`, JSON.stringify({
														name: userInfoName.trim(),
														title: userInfoTitle.trim() || null,
														color: userInfoColor || "#e5e7eb"
													}));
													
													// 사용자명이 변경된 경우
													if (userInfoName.trim() !== currentUserName) {
														localStorage.setItem("gbti_current_user_name", userInfoName.trim());
														localStorage.removeItem(`gbti_user_info_${currentUserName}`);
													}
													
													alert("저장되었습니다.");
													setShowUserInfoSettings(false);
													window.location.reload();
												} else {
													alert("저장에 실패했습니다.");
												}
											} else {
												// 새 참여자 추가
												const createRes = await fetch("/api/participants", {
													method: "POST",
													headers: { "Content-Type": "application/json" },
													body: JSON.stringify({
														name: userInfoName.trim(),
														title: userInfoTitle.trim() || null,
														color: userInfoColor || "#e5e7eb"
													}),
												});
												
												if (createRes.ok) {
													localStorage.setItem(`gbti_user_info_${userInfoName.trim()}`, JSON.stringify({
														name: userInfoName.trim(),
														title: userInfoTitle.trim() || null,
														color: userInfoColor || "#e5e7eb"
													}));
													
													if (userInfoName.trim() !== currentUserName) {
														localStorage.setItem("gbti_current_user_name", userInfoName.trim());
													}
													
													alert("저장되었습니다.");
													setShowUserInfoSettings(false);
													window.location.reload();
												} else {
													alert("저장에 실패했습니다.");
												}
											}
										} catch (err) {
											console.error("저장 실패:", err);
											alert("네트워크 오류가 발생했습니다.");
										}
									}}
								>
									저장
								</button>
								<button
									className="px-3 py-1 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800"
									onClick={() => setShowUserInfoSettings(false)}
								>
									취소
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* 유저 알람 설정 모달 */}
			{showUserNotificationSettings && (
				<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowUserNotificationSettings(false)}>
					<div className="rounded p-4 w-full max-w-sm space-y-3" style={{ background: "var(--background)", color: "var(--foreground)" }} onClick={(e) => e.stopPropagation()}>
						<h2 className="text-lg font-semibold">유저 알람 설정</h2>
						<div className="text-sm text-zinc-600 mb-3">
							알림 대상: <strong>{currentUserName}</strong>
						</div>
						<div>
							<div className="text-sm mb-1">알림 시점 선택</div>
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
												localStorage.setItem("gbti_notifications_minutes", String(next[0] || 30));
											}}
										>
											{m === 60 ? "1시간 전" : m === 120 ? "2시간 전" : `${m}분 전`}
										</button>
									);
								})}
							</div>
						</div>
						<div className="flex justify-end gap-2">
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
								알람 테스트
							</button>
							<button
								className="px-3 py-1 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800"
								onClick={async () => {
									// 알림 대상은 현재 사용자로 고정
									const targets = [currentUserName];
									setNotificationTargets(targets);
									localStorage.setItem("gbti_notifications_targets", JSON.stringify(targets));
									
									// 알림 활성화
									setNotificationsEnabled(true);
									localStorage.setItem("gbti_notifications_enabled", "1");
									
									// 권한 요청
									if (Notification.permission !== "granted") {
										const ok = await requestNotificationPermission();
										if (!ok) {
											alert("알림 권한이 필요합니다.");
											return;
										}
									}
									
									await ensurePushSubscription();
									alert("저장되었습니다.");
									setShowUserNotificationSettings(false);
								}}
							>
								저장
							</button>
							<button
								className="px-3 py-1 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800"
								onClick={() => setShowUserNotificationSettings(false)}
							>
								취소
							</button>
						</div>
					</div>
				</div>
			)}

			{/* 파티 한눈에 보기 모달 */}
			{showUserEventsView && (
				<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowUserEventsView(false)}>
					<div className="rounded p-4 w-full max-w-2xl max-h-[80vh] overflow-y-auto" style={{ background: "var(--background)", color: "var(--foreground)" }} onClick={(e) => e.stopPropagation()}>
						<h2 className="text-lg font-semibold mb-3">파티 한눈에 보기 - {currentUserName}</h2>
						<div className="space-y-2">
							{(() => {
								// 현재 사용자가 참여하는 이벤트 필터링
								const now = new Date();
								const todayStart = startOfDay(now);
								
								const userEvents = events.filter((e) => {
									if (!e.participants || !e.participants.includes(currentUserName)) return false;
									
									// 반복 이벤트는 항상 표시
									if (e.isRecurring) return true;
									
									// 단일 이벤트는 오늘 이후 종료되는 이벤트만 표시 (진행 중이거나 예정인 이벤트)
									const endDate = new Date(e.endAt);
									return endDate >= todayStart;
								});
								
								// 반복 이벤트 그룹화
								const groupedEvents = groupRecurringEvents(userEvents);
								// 정렬 (반복 이벤트는 제목으로, 일반 이벤트는 날짜로)
								const sortedEvents = groupedEvents.sort((a, b) => {
									if (a.isRecurring && !b.isRecurring) return -1;
									if (!a.isRecurring && b.isRecurring) return 1;
									if (a.isRecurring && b.isRecurring) {
										return a.title.localeCompare(b.title);
									}
									return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
								});
								
								return sortedEvents.length === 0 ? (
									<div className="text-center text-zinc-500 dark:text-zinc-400 py-8">
										참여 예정인 파티가 없습니다.
									</div>
								) : (
									sortedEvents.map((e) => {
										const startDate = new Date(e.startAt);
										const endDate = new Date(e.endAt);
										const isSameDay = format(startDate, "yyyy-MM-dd") === format(endDate, "yyyy-MM-dd");
										
										return (
											<div
												key={e.id}
												className="border rounded-lg p-3 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
												onClick={() => {
													// 반복 이벤트의 경우 첫 번째 인스턴스 ID 찾기
													if (e.isRecurring && e.recurringSlotId) {
														const firstInstance = userEvents.find(ev => 
															ev.isRecurring && 
															ev.recurringSlotId === e.recurringSlotId
														);
														if (firstInstance) {
															setActiveEventId(firstInstance.id);
														}
													} else {
														setActiveEventId(e.id);
													}
													setShowUserEventsView(false);
												}}
											>
												<div className="flex items-start justify-between">
													<div className="flex-1">
														<div className="font-medium text-base mb-1">{e.title}</div>
														{e.isRecurring ? (
															<div className="text-sm text-zinc-600 dark:text-zinc-400">
																반복 이벤트 - 요일: {e.recurringDays?.map(d => ['일', '월', '화', '수', '목', '금', '토'][d]).join(', ')}
																<br />
																시간: {Math.floor((e.recurringStartMinutes || 0) / 60)}:{(e.recurringStartMinutes || 0) % 60 < 10 ? '0' : ''}{(e.recurringStartMinutes || 0) % 60} - {Math.floor((e.recurringEndMinutes || 0) / 60)}:{(e.recurringEndMinutes || 0) % 60 < 10 ? '0' : ''}{(e.recurringEndMinutes || 0) % 60}
															</div>
														) : (
															<div className="text-sm text-zinc-600 dark:text-zinc-400">
																{isSameDay ? (
																	<>
																		{format(startDate, "yyyy년 MM월 dd일")} {format(startDate, "HH:mm")} - {format(endDate, "HH:mm")}
																	</>
																) : (
																	<>
																		{format(startDate, "yyyy년 MM월 dd일 HH:mm")} ~ {format(endDate, "yyyy년 MM월 dd일 HH:mm")}
																	</>
																)}
															</div>
														)}
														{e.participants && e.participants.length > 0 && (
															<div className="flex gap-1.5 flex-wrap mt-2">
																{e.participants.map((p) => {
																	const participantInfo = participantMap.get(p);
																	const bgColor = participantInfo?.color || "#e5e7eb";
																	
																	const hexToRgb = (hex: string) => {
																		const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
																		return result ? {
																			r: parseInt(result[1], 16),
																			g: parseInt(result[2], 16),
																			b: parseInt(result[3], 16)
																		} : { r: 229, g: 231, b: 235 };
																	};
																	
																	const rgb = hexToRgb(bgColor);
																	const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
																	const isBright = brightness > 128;
																	const textColor = isBright ? "#000" : "#fff";
																	
																	return (
																		<span
																			key={p}
																			className="px-2 py-0.5 text-xs rounded-full"
																			style={{ backgroundColor: bgColor, color: textColor }}
																		>
																			{participantInfo?.title && (
																				<span className="font-bold mr-0.5">{participantInfo.title}</span>
																			)}
																			{p}
																		</span>
																	);
																})}
															</div>
														)}
													</div>
													<div
														className="w-4 h-4 rounded ml-2 flex-shrink-0"
														style={{ backgroundColor: e.color || "#93c5fd" }}
													/>
												</div>
											</div>
										);
									})
								);
							})()}
						</div>
						<div className="flex justify-end mt-4">
							<button
								className="px-3 py-1 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800"
								onClick={() => setShowUserEventsView(false)}
							>
								닫기
							</button>
						</div>
					</div>
				</div>
			)}

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
                                        
                                        // 종일 이벤트의 경우: 시작일과 종료일 사이에 해당 날짜가 포함되면 표시
                                        if (e.allDay) {
                                            const startDate = startOfDay(s);
                                            const endDate = endOfDay(en);
                                            const dayStart = startOfDay(d);
                                            const dayEnd = endOfDay(d);
                                            return startDate <= dayEnd && endDate >= dayStart;
                                        }
                                        
                                        // 일반 이벤트의 경우: 여러 방법으로 확인하여 더 확실하게 표시
                                        const dayStart = startOfDay(d);
                                        const dayEnd = endOfDay(d);
                                        
                                        // 방법 1: 시작일 또는 종료일이 해당 날짜와 정확히 같은지 확인
                                        const isStartOnDay = isSameDay(s, d);
                                        const isEndOnDay = isSameDay(en, d);
                                        
                                        // 방법 2: 이벤트 기간이 해당 날짜와 겹치는지 확인 (시간 포함)
                                        const overlapsByTime = s <= dayEnd && en >= dayStart;
                                        
                                        // 방법 3: 날짜만 비교 (시간 무시)
                                        const eventStartDay = startOfDay(s);
                                        const eventEndDay = endOfDay(en);
                                        const overlapsByDate = eventStartDay <= dayEnd && eventEndDay >= dayStart;
                                        
                                        // 세 가지 조건 중 하나라도 만족하면 표시
                                        return isStartOnDay || isEndOnDay || overlapsByTime || overlapsByDate;
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
                                        // 연결감을 위해 중간/끝/시작에 컬러 보더 추가
                                        const leftBorder = (isStartDay || isMiddle) ? `3px solid ${borderColor}` : undefined;
                                        const rightBorder = (isEndDay || isMiddle) ? `3px solid ${borderColor}` : undefined;

                                        return (
                                            <button
                                                key={e.id}
                                                onClick={() => setActiveEventId(e.id)}
                                                className={`w-full text-left text-[10px] sm:text-xs px-1 py-0.5 truncate transition-colors cursor-pointer`}
                                                style={{
                                                    backgroundColor: e.color || "#93c5fd",
                                                    color: "#000",
                                                    borderLeft: leftBorder,
                                                    borderRight: rightBorder,
                                                    ...shapeStyle
                                                }}
                                                title={e.title}
                                            >
                                                {isMiddle ? "↔" : label}
                                            </button>
                                        );
                                    })}
                                </div>
							</div>
						))}
					</div>

					{/* 오늘의 파티 목록 */}
					<div className="mt-6">
						<div className="flex items-center justify-between mb-3">
							<h2 className="text-lg font-semibold">오늘의 파티 ({format(new Date(), "MM월 dd일")})</h2>
							{(() => {
								const todayEvents = events.filter((e) => isSameDay(new Date(e.startAt), new Date()));
								if (todayEvents.length === 0) return null;
								return (
									<button
										onClick={async () => {
											const todayEvents = events.filter((e) => isSameDay(new Date(e.startAt), new Date()));
											if (todayEvents.length === 0) return;
											
											const container = document.getElementById("today-events-container");
											if (!container) {
												alert("저장할 내용을 찾을 수 없습니다.");
												return;
											}
											
											// 변수들을 try 블록 밖에서 선언하여 catch 블록에서도 접근 가능하도록 함
											const originalClasses = container.className;
											const allOriginalElements = container.querySelectorAll("*");
											const originalStyles = new Map<HTMLElement, string>();
											const originalStyleValues = new Map<CSSStyleRule, Map<string, string>>();
											const styleProps = [
												"color", "backgroundColor", "borderColor", 
												"borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor",
												"outlineColor", "textDecorationColor", "columnRuleColor", "fill", "stroke"
											];
											
											try {
												// 저장 전에 컨테이너 스타일을 조정하여 더 예쁘게 보이도록 함
												container.className = "flex flex-col gap-4 pb-4 bg-white p-6 rounded-lg border-2 border-zinc-200 shadow-lg";
												
												// lab() 색상을 RGB로 변환하는 함수
												const convertLabToRgb = (value: string, prop: string): string | null => {
													if (!value || !value.includes("lab(")) return null;
													
													try {
														// 임시 요소를 사용하여 computed style로 RGB 변환
														const tempEl = document.createElement("div");
														tempEl.style.setProperty(prop, value, "important");
														tempEl.style.position = "absolute";
														tempEl.style.visibility = "hidden";
														tempEl.style.pointerEvents = "none";
														document.body.appendChild(tempEl);
														
														const tempComputed = window.getComputedStyle(tempEl);
														const rgb = tempComputed.getPropertyValue(prop);
														
														document.body.removeChild(tempEl);
														
														if (rgb && !rgb.includes("lab(") && rgb !== "rgba(0, 0, 0, 0)" && rgb !== "transparent" && rgb.trim() !== "") {
															return rgb;
														}
													} catch (e) {
														// 변환 실패
													}
													return null;
												};
												
												// 원본 문서에서 모든 요소의 computed style을 읽어서 lab() 색상을 RGB로 변환하여 인라인 스타일로 설정
												
												allOriginalElements.forEach((el) => {
													const htmlEl = el as HTMLElement;
													const computed = window.getComputedStyle(htmlEl);
													const originalStyle = htmlEl.style.cssText;
													originalStyles.set(htmlEl, originalStyle);
													
													// 모든 스타일 속성 확인
													styleProps.forEach((prop) => {
														const value = computed.getPropertyValue(prop);
														if (value && value.includes("lab(")) {
															// lab() 색상을 RGB로 변환
															const rgb = convertLabToRgb(value, prop);
															if (rgb) {
																htmlEl.style.setProperty(prop, rgb, "important");
															} else {
																// 변환 실패 시 기본값 또는 제거
																if (prop === "color") {
																	htmlEl.style.setProperty(prop, "#000000", "important");
																} else if (prop === "backgroundColor") {
																	// 배경색은 투명하게 하거나 기본값 설정
																	const bgValue = computed.getPropertyValue("backgroundColor");
																	if (bgValue && bgValue !== "rgba(0, 0, 0, 0)" && bgValue !== "transparent") {
																		htmlEl.style.setProperty(prop, "#ffffff", "important");
																	}
																} else {
																	// 기타 색상 속성은 제거
																	htmlEl.style.removeProperty(prop);
																}
															}
														}
													});
													
													// CSS 변수도 확인
													const cssVars = Array.from(computed).filter(prop => prop.startsWith("--"));
													cssVars.forEach((varName) => {
														const varValue = computed.getPropertyValue(varName);
														if (varValue && varValue.includes("lab(")) {
															const rgb = convertLabToRgb(varValue, "color");
															if (rgb) {
																htmlEl.style.setProperty(varName, rgb, "important");
															}
														}
													});
												});
												
												// 모든 스타일시트에서 lab() 색상 제거 (원본 저장 및 복원)
												const styleSheets = Array.from(document.styleSheets);
												
												styleSheets.forEach((sheet) => {
													try {
														const rules = Array.from(sheet.cssRules || []);
														rules.forEach((rule) => {
															if (rule instanceof CSSStyleRule) {
																const style = rule.style;
																const originalValues = new Map<string, string>();
																styleProps.forEach((prop) => {
																	const value = style.getPropertyValue(prop);
																	if (value && value.includes("lab(")) {
																		// 원본 값 저장
																		originalValues.set(prop, value);
																		// lab() 색상을 RGB로 변환 시도
																		const rgb = convertLabToRgb(value, prop);
																		if (rgb) {
																			style.setProperty(prop, rgb, "important");
																		} else {
																			// 변환 실패 시 제거
																			style.removeProperty(prop);
																		}
																	}
																});
																if (originalValues.size > 0) {
																	originalStyleValues.set(rule, originalValues);
																}
															} else if (rule instanceof CSSMediaRule) {
																// 미디어 쿼리 내부 규칙도 처리
																const mediaRules = Array.from(rule.cssRules);
																mediaRules.forEach((mediaRule) => {
																	if (mediaRule instanceof CSSStyleRule) {
																		const style = mediaRule.style;
																		const originalValues = new Map<string, string>();
																		styleProps.forEach((prop) => {
																			const value = style.getPropertyValue(prop);
																			if (value && value.includes("lab(")) {
																				// 원본 값 저장
																				originalValues.set(prop, value);
																				const rgb = convertLabToRgb(value, prop);
																				if (rgb) {
																					style.setProperty(prop, rgb, "important");
																				} else {
																					style.removeProperty(prop);
																				}
																			}
																		});
																		if (originalValues.size > 0) {
																			originalStyleValues.set(mediaRule, originalValues);
																		}
																	}
																});
															}
														});
													} catch (e) {
														// Cross-origin 스타일시트는 접근 불가
													}
												});
												
												// 스타일 적용을 위한 짧은 대기 시간
												await new Promise(resolve => setTimeout(resolve, 200));
												
												const canvas = await html2canvas(container, {
													backgroundColor: "#ffffff",
													scale: 2,
													useCORS: true,
													logging: false,
													width: container.scrollWidth,
													height: container.scrollHeight,
													ignoreElements: (element) => {
														// lab() 색상이 있는 요소는 무시하지 않지만, 스타일은 이미 변환됨
														return false;
													},
													onclone: (clonedDoc, clonedWindow) => {
														// 클론된 문서에서 다크모드 클래스 제거 및 밝은 배경으로 변경
														const clonedContainer = clonedDoc.getElementById("today-events-container");
														if (clonedContainer) {
															clonedContainer.className = "flex flex-col gap-4 pb-4 bg-white p-6 rounded-lg border-2 border-zinc-200 shadow-lg";
															// 모든 자식 요소의 다크모드 클래스 제거
															const allElements = clonedContainer.querySelectorAll("*");
															allElements.forEach((el) => {
																const htmlEl = el as HTMLElement;
																// 다크모드 관련 클래스 제거
																htmlEl.classList.remove("dark:bg-zinc-900", "dark:text-zinc-400", "dark:border-zinc-700", "dark:hover:bg-zinc-800", "dark:bg-indigo-900/30", "dark:text-indigo-200", "dark:fill-green-400", "dark:fill-red-400");
																// 텍스트 색상이 어두운 경우 밝게 조정
																if (htmlEl.classList.contains("text-zinc-600") || htmlEl.classList.contains("text-zinc-500")) {
																	htmlEl.style.color = "#52525b";
																}
																if (htmlEl.classList.contains("text-zinc-400")) {
																	htmlEl.style.color = "#a1a1aa";
																}
															});
														}
														
														// 클론된 문서에서도 lab() 색상 제거
														const allClonedElements = clonedDoc.querySelectorAll("*");
														const styleProps = [
															"color", "backgroundColor", "borderColor", 
															"borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor",
															"outlineColor", "textDecorationColor", "columnRuleColor"
														];
														
														allClonedElements.forEach((el) => {
															const htmlEl = el as HTMLElement;
															
															// 인라인 스타일에서 lab() 제거
															if (htmlEl.style && htmlEl.style.cssText) {
																const inlineStyle = htmlEl.style.cssText;
																if (inlineStyle.includes("lab(")) {
																	// lab() 색상이 포함된 속성 제거
																	const styleRules = inlineStyle.split(";");
																	const cleanedRules = styleRules
																		.filter((rule) => !rule.trim().includes("lab("))
																		.join(";");
																	htmlEl.style.cssText = cleanedRules;
																}
															}
															
															// 각 속성에서 lab() 제거
															styleProps.forEach((prop) => {
																const value = htmlEl.style.getPropertyValue(prop);
																if (value && value.includes("lab(")) {
																	htmlEl.style.removeProperty(prop);
																}
															});
															
															// computed style에서도 확인 (가능한 경우)
															try {
																if (clonedWindow && "getComputedStyle" in clonedWindow) {
																	const getComputedStyleFn = (clonedWindow as any).getComputedStyle;
																	if (typeof getComputedStyleFn === "function") {
																		const computed = getComputedStyleFn(htmlEl);
																		if (computed) {
																			styleProps.forEach((prop) => {
																				const value = computed.getPropertyValue(prop);
																				if (value && value.includes("lab(")) {
																					// lab() 색상이 있으면 제거하거나 기본값 설정
																					if (prop === "color") {
																						htmlEl.style.setProperty(prop, "#000000", "important");
																					} else if (prop === "backgroundColor") {
																						htmlEl.style.setProperty(prop, "#ffffff", "important");
																					} else {
																						htmlEl.style.removeProperty(prop);
																					}
																				}
																			});
																		}
																	}
																}
															} catch (e) {
																// computed style 접근 실패 시 무시
															}
														});
														
														// 스타일시트의 lab() 색상도 처리
														try {
															const styleSheets = Array.from(clonedDoc.styleSheets || []);
															styleSheets.forEach((sheet) => {
																try {
																	const rules = Array.from(sheet.cssRules || []);
																	rules.forEach((rule) => {
																		if (rule instanceof CSSStyleRule) {
																			const style = rule.style;
																			styleProps.forEach((prop) => {
																				const value = style.getPropertyValue(prop);
																				if (value && value.includes("lab(")) {
																					style.removeProperty(prop);
																				}
																			});
																		}
																	});
																} catch (e) {
																	// Cross-origin 스타일시트는 접근 불가
																}
															});
														} catch (e) {
															// 스타일시트 접근 실패 시 무시
														}
													},
												});
												
												// 원본 스타일시트 복원
												originalStyleValues.forEach((originalValues: Map<string, string>, rule: CSSStyleRule) => {
													if (rule instanceof CSSStyleRule) {
														const style = rule.style;
														originalValues.forEach((originalValue: string, prop: string) => {
															style.setProperty(prop, originalValue);
														});
													}
												});
												
												// 원본 스타일 복원
												allOriginalElements.forEach((el) => {
													const htmlEl = el as HTMLElement;
													const originalStyle = originalStyles.get(htmlEl);
													if (originalStyle !== undefined) {
														htmlEl.style.cssText = originalStyle;
													}
												});
												
												// 원래 클래스 복원
												container.className = originalClasses;
												
												const link = document.createElement("a");
												link.download = `오늘의_파티_${format(new Date(), "MM월dd일")}.png`;
												link.href = canvas.toDataURL("image/png");
												link.click();
											} catch (error) {
												// 에러 발생 시에도 원본 스타일시트 복원
												originalStyleValues.forEach((originalValues: Map<string, string>, rule: CSSStyleRule) => {
													if (rule instanceof CSSStyleRule) {
														const style = rule.style;
														originalValues.forEach((originalValue: string, prop: string) => {
															style.setProperty(prop, originalValue);
														});
													}
												});
												
												// 에러 발생 시에도 원본 스타일 복원
												allOriginalElements.forEach((el) => {
													const htmlEl = el as HTMLElement;
													const originalStyle = originalStyles.get(htmlEl);
													if (originalStyle !== undefined) {
														htmlEl.style.cssText = originalStyle;
													}
												});
												container.className = originalClasses;
												
												console.error("이미지 저장 실패:", error);
												alert("이미지 저장에 실패했습니다: " + (error instanceof Error ? error.message : String(error)));
											}
										}}
										className="px-3 py-1.5 rounded text-sm border hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer flex items-center gap-1.5"
									>
										<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
											<path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
										</svg>
										저장
									</button>
								);
							})()}
						</div>
						{(() => {
							const todayEvents = events.filter((e) => isSameDay(new Date(e.startAt), new Date()));
							if (todayEvents.length === 0) {
								return <div className="text-sm text-zinc-500 dark:text-zinc-400">오늘 예정된 파티가 없습니다.</div>;
							}
							return (
								<div id="today-events-container" className="flex flex-col gap-3 pb-2 bg-white dark:bg-zinc-900 p-4 rounded-lg border">
									<div className="text-xl font-bold mb-2 text-center pb-3 border-b">
										오늘의 파티 ({format(new Date(), "MM월 dd일")})
									</div>
									{todayEvents.map((e) => {
										// 배경색 밝기에 따라 글자색 결정을 위한 함수
										const hexToRgb = (hex: string) => {
											const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
											return result ? {
												r: parseInt(result[1], 16),
												g: parseInt(result[2], 16),
												b: parseInt(result[3], 16)
											} : { r: 229, g: 231, b: 235 }; // 기본값
										};
										
										return (
											<div
												key={e.id}
												className="border rounded-lg p-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors w-full shadow-sm"
												onClick={() => setActiveEventId(e.id)}
											>
												<div className="flex flex-col gap-2">
													<div className="flex items-start justify-between">
														<div className="font-medium text-base">{e.title}</div>
														{e.allDay && (
															<span className="px-2 py-0.5 text-xs rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200 flex-shrink-0">
																종일
															</span>
														)}
													</div>
													<div className="text-sm text-zinc-600 dark:text-zinc-400">
														{format(new Date(e.startAt), "HH:mm")} - {format(new Date(e.endAt), "HH:mm")}
													</div>
													{e.participants && e.participants.length > 0 && (
														<div className="flex gap-1.5 flex-wrap mt-1">
															{e.participants.map((p) => {
																const participantInfo = participantMap.get(p);
																const bgColor = participantInfo?.color || "#e5e7eb";
																
																const rgb = hexToRgb(bgColor);
																const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
																const isBright = brightness > 128;
																const textColor = isBright ? "#000" : "#fff";
																
																// 칭호 네온 효과 (배경이 너무 밝을 때만 어두운 색, 그 외에는 흰색 네온)
																const titleGlowColor = participantInfo?.color || "#ff00ff";
																const titleRgb = hexToRgb(titleGlowColor);
																const isVeryBright = brightness > 200; // 너무 밝은 배경(흰색 계열)일 때만 어두운 색 사용
																// 기본적으로는 흰색 계열로 네온 효과, 너무 밝은 배경일 때만 어두운 색
																const titleTextColor = isVeryBright 
																	? `rgb(${Math.max(0, titleRgb.r - 100)}, ${Math.max(0, titleRgb.g - 100)}, ${Math.max(0, titleRgb.b - 100)})`
																	: `rgb(${Math.min(255, titleRgb.r + 200)}, ${Math.min(255, titleRgb.g + 200)}, ${Math.min(255, titleRgb.b + 200)})`;
																const titleTextShadow = isVeryBright
																	? `0 0 2px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.8),
																	   0 0 4px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.6),
																	   0 0 6px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.4)`
																	: `0 0 2px rgb(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}),
																	   0 0 4px rgb(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}),
																	   0 0 6px rgb(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}),
																	   0 0 10px rgb(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}),
																	   0 0 20px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.8),
																	   0 0 30px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.6)`;
																const titleBgColor = isVeryBright
																	? `rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.3)`
																	: `rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.15)`;
																
																return (
																	<span 
																		key={p} 
																		className="px-2 py-0.5 text-xs rounded-full"
																		style={{ backgroundColor: bgColor }}
																	>
																		{participantInfo?.title && (
																			<span
																				className="font-bold mr-0.5 px-1.5 py-0.5 rounded"
																				style={{
																					color: titleTextColor,
																					textShadow: titleTextShadow.trim(),
																					backgroundColor: titleBgColor,
																					letterSpacing: "0.5px",
																					fontWeight: "700",
																					animation: "glow-pulse 2s ease-in-out infinite",
																					boxShadow: isBright 
																						? `0 0 5px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.3)`
																						: `0 0 10px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.3), inset 0 0 10px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.1)`
																				}}
																			>
																				{participantInfo.title}
																			</span>
																		)}
																		<span style={{ color: textColor }}>{p}</span>
																	</span>
																);
															})}
														</div>
													)}
												</div>
											</div>
										);
									})}
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
