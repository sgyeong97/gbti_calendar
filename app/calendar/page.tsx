"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { format, isSameDay, addMonths } from "date-fns";
import koLocale from "@fullcalendar/core/locales/ko";
import EventDetailModal from "@/app/calendar/EventDetailModal";
import CreateEventModal from "@/app/calendar/CreateEventModal";

type FavoriteUser = {
  name: string;
};

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

export default function CalendarPage() {
	const router = useRouter();
	const [events, setEvents] = useState<Event[]>([]);
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
	const [activeEventId, setActiveEventId] = useState<string | null>(null);
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [favoriteUsers, setFavoriteUsers] = useState<FavoriteUser[]>([]);
  const [participantList, setParticipantList] = useState<string[]>([]);
  const [participantMap, setParticipantMap] = useState<
    Map<string, { title?: string | null; color?: string | null }>
  >(new Map());
	const [showSettings, setShowSettings] = useState<boolean>(false);
  const [currentUserName, setCurrentUserName] = useState<string>("");
	const [showUserInfoSettings, setShowUserInfoSettings] = useState<boolean>(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState<boolean>(false);
  const [showPartySettings, setShowPartySettings] = useState<boolean>(false);
  const [notificationLeadMins, setNotificationLeadMins] = useState<number[]>([30]);
  const [partyList, setPartyList] = useState<Event[]>([]);
  const [partyListLoading, setPartyListLoading] = useState<boolean>(false);
  const [userInfoLoading, setUserInfoLoading] = useState<boolean>(false);
	const [userInfoName, setUserInfoName] = useState<string>("");
	const [userInfoTitle, setUserInfoTitle] = useState<string>("");
	const [userInfoColor, setUserInfoColor] = useState<string>("#e5e7eb");
  const [originalTitle, setOriginalTitle] = useState<string>("");
  const [originalColor, setOriginalColor] = useState<string>("#e5e7eb");
  const { theme, setTheme } = useTheme();
  const [colorTheme, setColorTheme] = useState<string>(() => {
    if (typeof window === "undefined") return "default";
    return localStorage.getItem("gbti_color_theme") || "default";
  });

  // 배경색에 따라 가독성 좋은 텍스트 색상 계산
  function getTextColorForBg(color: string | undefined | null): string {
    const hex = color || "#e5e7eb";
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    const rgb = match
      ? {
          r: parseInt(match[1], 16),
          g: parseInt(match[2], 16),
          b: parseInt(match[3], 16),
        }
      : { r: 229, g: 231, b: 235 };
    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return brightness > 128 ? "#000000" : "#ffffff";
  }

  // FullCalendar용 이벤트 형식으로 변환
  const calendarEvents = events.map((e) => {
    const startDate = new Date(e.startAt);
    const endDate = new Date(e.endAt);
    let startStr: string;
    let endStr: string;

    if (e.isRecurring) {
      const startDateMatch = e.startAt.match(/^(\d{4}-\d{2}-\d{2})/);
      const endDateMatch = e.endAt.match(/^(\d{4}-\d{2}-\d{2})/);

      if (startDateMatch && endDateMatch) {
        startStr = startDateMatch[1];
        endStr = endDateMatch[1];
			} else {
        const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(
          2,
          "0"
        )}-${String(startDate.getDate()).padStart(2, "0")}`;
        const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(
          2,
          "0"
        )}-${String(endDate.getDate()).padStart(2, "0")}`;
        startStr = startDateStr;
        endStr = endDateStr;
				}
			} else {
      startStr = e.startAt;
      endStr = e.endAt;
    }
		
		return {
      id: e.id,
      title: e.title,
      start: startStr,
      end: endStr,
      allDay: e.allDay,
      backgroundColor: e.color || "#FDC205",
      borderColor: e.color || "#FDC205",
      extendedProps: {
        color: e.color,
        participants: e.participants || [],
        isRecurring: e.isRecurring || false,
        recurringSlotId: e.recurringSlotId,
        recurringDays: e.recurringDays,
        recurringStartMinutes: e.recurringStartMinutes,
        recurringEndMinutes: e.recurringEndMinutes,
      },
    };
  });

  // 참여자 목록 가져오기
	const fetchParticipants = async () => {
		const res = await fetch("/api/participants");
    const json = await res.json();
    const participants = json.participants ?? [];
		setParticipantList(participants.map((p: any) => p.name));
		const map = new Map<string, { title?: string | null; color?: string | null }>();
		participants.forEach((p: any) => {
			map.set(p.name, { title: p.title, color: p.color });
		});
		setParticipantMap(map);
	};

	// 즐겨찾기 목록 새로고침 함수
	const refreshFavorites = () => {
		const savedFavorites = localStorage.getItem("gbti_favorites");
		if (savedFavorites) {
			const parsed = JSON.parse(savedFavorites);
      const cleaned = parsed.filter((f: FavoriteUser) => f && f.name);
			setFavoriteUsers(cleaned);
			localStorage.setItem("gbti_favorites", JSON.stringify(cleaned));
		} else {
			setFavoriteUsers([]);
		}
	};

  // 이벤트 가져오기
  useEffect(() => {
    if (!dateRange) return;

    const fetchEvents = async () => {
      const res = await fetch(
        `/api/events?start=${dateRange.start}&end=${dateRange.end}&includeBirthdays=1`
      );
      const json = await res.json();
      let fetchedEvents = json.events ?? [];

      if (selectedParticipants.size > 0) {
        fetchedEvents = fetchedEvents.filter((event: Event) => {
          if (!event.participants || event.participants.length === 0) return false;
          return event.participants.some((p) => selectedParticipants.has(p));
        });
      }

      setEvents(fetchedEvents);
    };
    fetchEvents();
  }, [dateRange, selectedParticipants]);

  // 참여자 목록 및 즐겨찾기 로드
	useEffect(() => {
        fetchParticipants();
		refreshFavorites();

    // 저장된 사용자명 / 테마 불러오기
    const savedUserName = localStorage.getItem("gbti_current_user_name");
    if (savedUserName) {
      setCurrentUserName(savedUserName);
      setUserInfoName(savedUserName);
    }
    const savedTheme = (localStorage.getItem("gbti_theme") as "system" | "light" | "dark") || "system";
    setTheme(savedTheme);

    const savedColorTheme = localStorage.getItem("gbti_color_theme") || "default";
    setColorTheme(savedColorTheme);

    // html 클래스에 컬러 테마 반영
    const root = document.documentElement;
    root.classList.remove(
      "theme-ocean",
      "theme-forest",
      "theme-molokai",
      "theme-gruvbox",
      "theme-sonokai",
      "theme-onedark"
    );
    if (savedColorTheme === "ocean") root.classList.add("theme-ocean");
    if (savedColorTheme === "forest") root.classList.add("theme-forest");
    if (savedColorTheme === "molokai") root.classList.add("theme-molokai");
    if (savedColorTheme === "gruvbox") root.classList.add("theme-gruvbox");
    if (savedColorTheme === "sonokai") root.classList.add("theme-sonokai");
    if (savedColorTheme === "onedark") root.classList.add("theme-onedark");
    const savedLead = localStorage.getItem("gbti_notification_lead_mins");
    if (savedLead) {
      try {
        const parsed = JSON.parse(savedLead);
        if (Array.isArray(parsed) && parsed.every((v: any) => typeof v === "number")) {
          setNotificationLeadMins(parsed);
        }
      } catch {
        // 무시하고 기본값 사용
      }
    }

		const handleFavoritesUpdated = () => {
			refreshFavorites();
		};
    window.addEventListener("favoritesUpdated", handleFavoritesUpdated);
		return () => {
      window.removeEventListener("favoritesUpdated", handleFavoritesUpdated);
		};
	}, []);

  // 날짜 클릭 핸들러 (더블클릭은 dayCellDidMount에서 처리)
  const handleDateClick = (_arg: any) => {};

  // 날짜 셀에 더블클릭 이벤트 추가
  const handleDayCellDidMount = (arg: any) => {
    const cellEl = arg.el;
    cellEl.addEventListener("dblclick", () => {
      const dateStr = format(arg.date, "yyyy-MM-dd");
      const [year, month, day] = dateStr.split("-").map(Number);
      const clickedDate = new Date(year, month - 1, day);
      setSelectedDate(clickedDate);
      setShowCreateModal(true);
    });
  };

  // 이벤트 클릭 핸들러
  const handleEventClick = (arg: any) => {
    arg.jsEvent.preventDefault();
    const eventId = arg.event.id;
    setActiveEventId(eventId);
  };

  // 날짜 변경 핸들러
  const handleDatesSet = (arg: any) => {
    const start = format(arg.start, "yyyy-MM-dd");
    const end = format(arg.end, "yyyy-MM-dd");
    setDateRange({ start, end });
  };

  // 이벤트 변경 후 새로고침
  const handleEventChanged = () => {
    if (!dateRange) return;

    fetch(`/api/events?start=${dateRange.start}&end=${dateRange.end}&includeBirthdays=1`)
      .then((res) => res.json())
      .then((json) => {
        setEvents(json.events ?? []);
      });
  };

  // 오늘의 파티 목록
  // 타임존 이슈를 피하기 위해 ISO 문자열의 날짜 부분(YYYY-MM-DD)만 비교
  const todayEvents = events.filter((e) => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const match = e.startAt.match(/^(\d{4}-\d{2}-\d{2})/);
    const eventDateStr = match ? match[1] : format(new Date(e.startAt), "yyyy-MM-dd");
    return eventDateStr === todayStr;
  });

	return (
    <div className="p-4">
      {/* 상단 헤더 */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">달력</h1>
        <div className="flex gap-2">
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

      {/* 상단 참여자/즐겨찾기 선택 영역 */}
			<div className="mb-4 space-y-2">
				{selectedParticipants.size > 0 && (
					<div className="flex items-center gap-2 flex-wrap">
						<label className="text-sm text-zinc-600">선택된 참여자:</label>
						{Array.from(selectedParticipants).map((name) => {
							const participantInfo = participantMap.get(name);
							const bgColor = participantInfo?.color || "#e5e7eb";
							const hexToRgb = (hex: string) => {
								const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return result
                  ? {
									r: parseInt(result[1], 16),
									g: parseInt(result[2], 16),
                      b: parseInt(result[3], 16),
                    }
                  : { r: 229, g: 231, b: 235 };
							};
							const rgb = hexToRgb(bgColor);
							const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
							const isBright = brightness > 128;
							const textColor = isBright ? "#000" : "#fff";
							
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
                    <span className="font-bold mr-0.5 px-1.5 py-0.5 rounded" style={{ color: textColor }}>
											{participantInfo.title}
										</span>
									)}
									<span style={{ color: textColor }}>{name}</span>
								</button>
							);
						})}
					</div>
				)}

        <div className="flex items-center gap-2 flex-wrap">
					<label className="text-sm text-zinc-600 whitespace-nowrap">참여자:</label>
					<div className="flex-1 overflow-x-auto">
						<div className="flex gap-2 pb-1">
							{favoriteUsers.map((user) => {
								if (selectedParticipants.has(user.name)) return null;
								const participantInfo = participantMap.get(user.name);
								const bgColor = participantInfo?.color || "#e5e7eb";
								const hexToRgb = (hex: string) => {
									const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                  return result
                    ? {
										r: parseInt(result[1], 16),
										g: parseInt(result[2], 16),
                        b: parseInt(result[3], 16),
                      }
                    : { r: 229, g: 231, b: 235 };
								};
								const rgb = hexToRgb(bgColor);
								const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
								const isBright = brightness > 128;
								const textColor = isBright ? "#000" : "#fff";
								
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
                      <span className="font-bold mr-0.5 px-1.5 py-0.5 rounded" style={{ color: textColor }}>
												{participantInfo.title}
											</span>
										)}
										<span style={{ color: textColor }}>{user.name}</span>
									</button>
								);
							})}
							
							{participantList
                .filter((p) => !favoriteUsers.find((f) => f.name === p) && !selectedParticipants.has(p))
								.map((name) => {
									const participantInfo = participantMap.get(name);
									const bgColor = participantInfo?.color || "#e5e7eb";
									const hexToRgb = (hex: string) => {
										const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                    return result
                      ? {
											r: parseInt(result[1], 16),
											g: parseInt(result[2], 16),
                          b: parseInt(result[3], 16),
                        }
                      : { r: 229, g: 231, b: 235 };
									};
									const rgb = hexToRgb(bgColor);
									const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
									const isBright = brightness > 128;
									const textColor = isBright ? "#000" : "#fff";
									
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
                        <span className="font-bold mr-0.5 px-1.5 py-0.5 rounded" style={{ color: textColor }}>
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

      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale={koLocale}
        firstDay={0}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "",
        }}
        events={calendarEvents}
        dateClick={handleDateClick}
        eventClick={handleEventClick}
        datesSet={handleDatesSet}
        dayCellDidMount={handleDayCellDidMount}
        dayMaxEvents={true}
        height="auto"
        eventDisplay="block"
        eventContent={(arg) => {
          const bg =
            (arg.event.extendedProps as any)?.color ||
            (arg.event as any).backgroundColor ||
            "#FDC205";
          const textColor = getTextColorForBg(bg);
          return {
            html: `<div class="fc-event-title" style="color:${textColor}">${arg.event.title}</div>`,
          };
        }}
      />

      {activeEventId && (
        <EventDetailModal
          eventId={activeEventId}
          onClose={() => setActiveEventId(null)}
          onChanged={() => {
            handleEventChanged();
            fetchParticipants();
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
            handleEventChanged();
            fetchParticipants();
            setShowCreateModal(false);
            setSelectedDate(null);
          }}
        />
      )}

					{/* 오늘의 파티 목록 */}
					<div className="mt-6">
						<div className="flex items-center justify-between mb-3">
							<h2 className="text-lg font-semibold">오늘의 파티 ({format(new Date(), "MM월 dd일")})</h2>
						</div>
        {todayEvents.length === 0 ? (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">오늘 예정된 파티가 없습니다.</div>
        ) : (
          <div className="flex flex-col gap-3 pb-2 bg-white dark:bg-zinc-900 p-4 rounded-lg border">
									{todayEvents.map((e) => {
              const textColor = getTextColorForBg(e.color || "#e5e7eb");
										
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
                                const textColor = getTextColorForBg(bgColor);
																
																return (
																	<span 
																		key={p} 
																		className="px-2 py-0.5 text-xs rounded-full"
																		style={{ backgroundColor: bgColor }}
																	>
																		{participantInfo?.title && (
                                <span className="font-bold mr-0.5 px-1.5 py-0.5 rounded" style={{ color: textColor }}>
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
        )}
			</div>

			{/* 설정 모달 */}
			{showSettings && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="rounded p-4 w-full max-w-sm space-y-3"
            style={{ background: "var(--background)", color: "var(--foreground)" }}
            onClick={(e) => e.stopPropagation()}
          >
						<h2 className="text-lg font-semibold">설정</h2>
						{!currentUserName ? (
              // 사용자명이 없는 경우: 이름 선택/입력만
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
                          window.location.reload();
												}
											}}
										>
											<option value="">선택하세요</option>
											{participantList.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
											))}
										</select>
									</div>
                  <div className="mt-2 text-xs text-zinc-500">또는 직접 입력:</div>
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
                    className="px-3 py-1 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
										onClick={() => setShowSettings(false)}
									>
										닫기
									</button>
								</div>
							</div>
						) : (
              // 사용자명이 있는 경우: 기존 설정 메뉴
							<div className="space-y-3">
								<div className="text-sm text-zinc-600">
									현재 사용자: <strong>{currentUserName}</strong>
								</div>
								<div className="space-y-2">
                  {/* 1) 닉네임/칭호 설정 */}
									<button
										className="w-full px-4 py-2 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left"
										onClick={() => {
											setShowSettings(false);
											setShowUserInfoSettings(true);
                      setUserInfoLoading(true);

                      (async () => {
                        try {
                          const res = await fetch("/api/participants");
                          const data = await res.json();
                          const participants = data.participants || [];
                          const currentUser = participants.find((p: any) => p.name === currentUserName);

                          if (currentUser) {
                            setUserInfoName(currentUser.name);
                            setUserInfoTitle(currentUser.title || "");
                            setUserInfoColor(currentUser.color || "#e5e7eb");
                            setOriginalTitle(currentUser.title || "");
                            setOriginalColor(currentUser.color || "#e5e7eb");
                          } else {
                            setUserInfoName(currentUserName);
                            setUserInfoTitle("");
                            setUserInfoColor("#e5e7eb");
                            setOriginalTitle("");
                            setOriginalColor("#e5e7eb");
                          }
                        } catch {
                          setUserInfoName(currentUserName);
                          setUserInfoTitle("");
                          setUserInfoColor("#e5e7eb");
                          setOriginalTitle("");
                          setOriginalColor("#e5e7eb");
                        } finally {
                          setUserInfoLoading(false);
                        }
                      })();
										}}
									>
										닉네임/칭호 설정
									</button>
                  {/* 2) 알림 설정 */}
									<button
										className="w-full px-4 py-2 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left"
										onClick={() => {
											setShowSettings(false);
                      setShowNotificationSettings(true);
										}}
									>
                    알림 설정
									</button>
                  {/* 3) 파티 설정 */}
									<button
										className="w-full px-4 py-2 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left"
                    onClick={async () => {
											setShowSettings(false);
                      setShowPartySettings(true);

                      if (!currentUserName) return;
                      try {
                        setPartyListLoading(true);
                        const today = new Date();
                        const start = format(today, "yyyy-MM-dd");
                        const end = format(addMonths(today, 3), "yyyy-MM-dd");
                        const res = await fetch(
                          `/api/events?start=${start}&end=${end}&includeBirthdays=1`
                        );
                        const json = await res.json();
                        const allEvents: Event[] = json.events ?? [];

                        // 1차: 본인이 참여한 이벤트만
                        const mineRaw = allEvents.filter(
                          (e) =>
                            e.participants &&
                            e.participants.includes(currentUserName) &&
                            !e.id.startsWith("BIRTHDAY-")
                        );

                        // 2차: 반복 이벤트는 한 번만 표기
                        const recurringMap = new Map<string, Event>();
                        const normalEvents: Event[] = [];

                        for (const ev of mineRaw) {
                          if (ev.isRecurring && ev.recurringSlotId) {
                            const key = ev.recurringSlotId;
                            const existing = recurringMap.get(key);
                            if (!existing) {
                              recurringMap.set(key, ev);
                            } else {
                              // 더 가까운(빠른) 일정만 유지
                              if (
                                new Date(ev.startAt).getTime() <
                                new Date(existing.startAt).getTime()
                              ) {
                                recurringMap.set(key, ev);
                              }
                            }
                          } else {
                            normalEvents.push(ev);
                          }
                        }

                        const mine = [...normalEvents, ...Array.from(recurringMap.values())]
                          .filter(
                            (e) => new Date(e.startAt).getTime() >= new Date().getTime()
                          )
                          .sort(
                            (a, b) =>
                              new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
                          );
                        setPartyList(mine);
                      } catch (e) {
                        console.error("파티 리스트 불러오기 실패:", e);
                      } finally {
                        setPartyListLoading(false);
                      }
                    }}
                  >
                    파티 리스트 보기
                  </button>
                  {/* 4) 테마 설정 */}
                  <button
                    className="w-full px-4 py-2 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left flex items-center justify-between"
                    onClick={() => {
                      // 테마 순환: system -> light -> dark -> system
                      const order: ("system" | "light" | "dark")[] = ["system", "light", "dark"];
                      const idx = order.indexOf(theme as "system" | "light" | "dark");
                      const next = order[(idx + 1) % order.length];
                      setTheme(next);
                      localStorage.setItem("gbti_theme", next);
                    }}
                  >
                    <span>테마 설정</span>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      {theme === "dark" ? "🌙 다크모드" : theme === "light" ? "☀️ 라이트모드" : "🖥️ 시스템"}
                    </span>
									</button>
								</div>
                {/* 컬러 테마 선택 */}
                <div className="space-y-1 pt-2 border-t border-zinc-200 dark:border-zinc-800 mt-2">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">컬러 테마</div>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { id: "default", label: "기본" },
                      { id: "ocean", label: "오션" },
                      { id: "forest", label: "포레스트" },
                      { id: "molokai", label: "Molokai" },
                      { id: "gruvbox", label: "Gruvbox" },
                      { id: "sonokai", label: "Sonokai" },
                      { id: "onedark", label: "OneDark" },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setColorTheme(t.id);
                          localStorage.setItem("gbti_color_theme", t.id);
                          const root = document.documentElement;
                          root.classList.remove(
                            "theme-ocean",
                            "theme-forest",
                            "theme-molokai",
                            "theme-gruvbox",
                            "theme-sonokai",
                            "theme-onedark"
                          );
                          if (t.id === "ocean") root.classList.add("theme-ocean");
                          if (t.id === "forest") root.classList.add("theme-forest");
                          if (t.id === "molokai") root.classList.add("theme-molokai");
                          if (t.id === "gruvbox") root.classList.add("theme-gruvbox");
                          if (t.id === "sonokai") root.classList.add("theme-sonokai");
                          if (t.id === "onedark") root.classList.add("theme-onedark");
                        }}
                        className={`px-2 py-1 rounded border text-xs cursor-pointer ${
                          colorTheme === t.id
                            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                            : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
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
                    className="px-3 py-1 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
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
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setShowUserInfoSettings(false)}
        >
          <div
            className="rounded p-4 w-full max-w-sm space-y-3"
            style={{ background: "var(--background)", color: "var(--foreground)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">유저 정보 설정</h2>
            <div className="space-y-3">
              {userInfoLoading && (
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  사용자 정보를 불러오는 중입니다...
                </div>
              )}
              <div>
								<label className="text-sm mb-1 block">이름</label>
								<input
									type="text"
									value={userInfoName}
									readOnly
                  className="w-full border rounded px-3 py-2 bg-zinc-50 dark:bg-zinc-800"
								/>
              </div>
              {(originalTitle || originalColor !== "#e5e7eb") && (
                <div className="p-3 rounded border bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700">
                  <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-2">현재 설정</div>
                  <div className="flex items-center gap-2">
                    {originalTitle && (
                      <span
                        className="px-2 py-1 rounded text-xs font-semibold"
                        style={{ backgroundColor: originalColor, color: "#000" }}
                      >
                        {originalTitle}
                      </span>
                    )}
                    {!originalTitle && (
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">칭호 없음</span>
                    )}
                    {originalColor && (
                      <div className="flex items-center gap-1 ml-auto">
                        <div
                          className="w-4 h-4 rounded border border-zinc-300 dark:border-zinc-600"
                          style={{ backgroundColor: originalColor }}
                        />
                        <span className="text-xs text-zinc-600 dark:text-zinc-400">{originalColor}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
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
										try {
											const res = await fetch("/api/participants");
											const data = await res.json();
											const participants = data.participants || [];
											const currentUser = participants.find((p: any) => p.name === currentUserName);
											
											if (currentUser) {
												const updateRes = await fetch(`/api/participants/${currentUser.id}`, {
													method: "PUT",
													headers: { "Content-Type": "application/json" },
													body: JSON.stringify({
														name: userInfoName.trim(),
														title: userInfoTitle.trim() || null,
														color: userInfoColor || "#e5e7eb",
                            currentUserName: currentUserName,
													}),
												});
                        if (!updateRes.ok) {
													alert("저장에 실패했습니다.");
                          return;
												}
											} else {
												const createRes = await fetch("/api/participants", {
													method: "POST",
													headers: { "Content-Type": "application/json" },
													body: JSON.stringify({
														name: userInfoName.trim(),
														title: userInfoTitle.trim() || null,
                            color: userInfoColor || "#e5e7eb",
													}),
												});
                        if (!createRes.ok) {
                          alert("저장에 실패했습니다.");
                          return;
                        }
                      }
												
                      localStorage.setItem(
                        `gbti_user_info_${userInfoName.trim()}`,
                        JSON.stringify({
														name: userInfoName.trim(),
														title: userInfoTitle.trim() || null,
                          color: userInfoColor || "#e5e7eb",
                        })
                      );
													
													alert("저장되었습니다.");
													setShowUserInfoSettings(false);
													window.location.reload();
                    } catch {
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
    </div>
  );
}

