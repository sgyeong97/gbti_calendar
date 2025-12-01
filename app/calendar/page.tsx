"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { format, isSameDay } from "date-fns";
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
          return { html: `<div class="fc-event-title">${arg.event.title}</div>` };
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

              const rgb = hexToRgb(e.color || "#e5e7eb");
              const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
              const isBright = brightness > 128;
              const textColor = isBright ? "#000" : "#fff";

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

      {/* 설정 모달 (간단 버전) */}
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
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              설정 기능은 추후 이 화면에서 확장될 예정입니다.
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
        </div>
      )}
    </div>
  );
}


