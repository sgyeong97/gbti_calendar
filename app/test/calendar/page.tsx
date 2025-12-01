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

export default function TestCalendarPage() {
	const router = useRouter();
	const [events, setEvents] = useState<Event[]>([]);
	const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
	const [activeEventId, setActiveEventId] = useState<string | null>(null);
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [selectedDate, setSelectedDate] = useState<Date | null>(null);
	const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
	const [favoriteUsers, setFavoriteUsers] = useState<FavoriteUser[]>([]);
	const [participantList, setParticipantList] = useState<string[]>([]);
	const [participantMap, setParticipantMap] = useState<Map<string, { title?: string | null; color?: string | null }>>(new Map());
	const [showSettings, setShowSettings] = useState<boolean>(false);

	// FullCalendar용 이벤트 형식으로 변환
	const calendarEvents = events.map((e) => {
		// 타임존 문제 방지: ISO 문자열을 로컬 날짜로 파싱
		const startDate = new Date(e.startAt);
		const endDate = new Date(e.endAt);
		
		// FullCalendar는 ISO 문자열을 파싱할 때 타임존 변환을 하므로,
		// 반복 이벤트의 경우 날짜만 추출하여 YYYY-MM-DD 형식으로 전달
		// 이렇게 하면 타임존 변환 없이 정확한 날짜가 표시됨
		let startStr: string;
		let endStr: string;
		
		if (e.isRecurring) {
			// 반복 이벤트: ISO 문자열에서 날짜 부분만 추출 (YYYY-MM-DD)
			// ISO 문자열 형식: "2025-12-01T21:00:00.000Z"
			// 날짜 부분만 추출: "2025-12-01"
			const startDateMatch = e.startAt.match(/^(\d{4}-\d{2}-\d{2})/);
			const endDateMatch = e.endAt.match(/^(\d{4}-\d{2}-\d{2})/);
			
			if (startDateMatch && endDateMatch) {
				startStr = startDateMatch[1];
				endStr = endDateMatch[1];
			} else {
				// 매칭 실패 시 기존 방식 사용
				const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
				const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
				startStr = startDateStr;
				endStr = endDateStr;
			}
			
			// 디버깅 로그
			const startDayOfWeek = startDate.getDay();
			const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
			console.log(`[클라이언트] 반복 이벤트 변환: id=${e.id}, title="${e.title}", startAt=${e.startAt}, 파싱된 날짜=${startStr} (${dayNames[startDayOfWeek]}), getDay()=${startDayOfWeek}, FullCalendar 전달: ${startStr}`);
		} else {
			// 일반 이벤트: ISO 문자열 그대로 사용
			startStr = e.startAt;
			endStr = e.endAt;
		}
		
		return {
			id: e.id, // 반복 이벤트도 R-로 시작하는 ID 그대로 사용
			title: e.title, // 제목만 표시 (시간은 표시하지 않음)
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
		// 참여자 정보 맵 생성
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
			console.log("이벤트 가져오기:", dateRange.start, "~", dateRange.end);
			const res = await fetch(`/api/events?start=${dateRange.start}&end=${dateRange.end}&includeBirthdays=1`);
			const json = await res.json();
			let fetchedEvents = json.events ?? [];
			
			// 필터링: 참가자 선택 시 해당 참가자가 포함된 이벤트만 표시
			if (selectedParticipants.size > 0) {
				fetchedEvents = fetchedEvents.filter((event: Event) => {
					if (!event.participants || event.participants.length === 0) return false;
					return event.participants.some(p => selectedParticipants.has(p));
				});
			}
			
			console.log("가져온 이벤트:", fetchedEvents.length, "개");
			console.log("반복 이벤트:", fetchedEvents.filter((e: Event) => e.isRecurring)?.length, "개");
			setEvents(fetchedEvents);
		};
		fetchEvents();
	}, [dateRange, selectedParticipants]);

	// 참여자 목록 및 즐겨찾기 로드
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

	// 날짜 클릭 핸들러 (더블클릭은 dayCellDidMount에서 처리)
	const handleDateClick = (arg: any) => {
		// 단일 클릭은 무시
	};
	
	// 날짜 셀에 더블클릭 이벤트 추가
	const handleDayCellDidMount = (arg: any) => {
		// 빈 날짜 셀에 더블클릭 이벤트 추가
		const cellEl = arg.el;
		cellEl.addEventListener('dblclick', () => {
			// dateStr을 사용하여 타임존 문제 방지 (형식: "YYYY-MM-DD")
			const dateStr = format(arg.date, "yyyy-MM-dd");
			// 로컬 날짜로 파싱 (타임존 무시)
			const [year, month, day] = dateStr.split('-').map(Number);
			const clickedDate = new Date(year, month - 1, day);
			console.log("더블클릭 날짜:", clickedDate, "dateStr:", dateStr);
			setSelectedDate(clickedDate);
			setShowCreateModal(true);
		});
	};

	// 이벤트 클릭 핸들러
	const handleEventClick = (arg: any) => {
		arg.jsEvent.preventDefault();
		const eventId = arg.event.id;
		console.log("이벤트 클릭:", eventId, arg.event.extendedProps);
		setActiveEventId(eventId);
	};

	// 날짜 변경 핸들러 (월 이동 시) - FullCalendar가 표시하는 실제 날짜 범위 사용
	const handleDatesSet = (arg: any) => {
		// FullCalendar가 실제로 표시하는 날짜 범위 사용
		const start = format(arg.start, "yyyy-MM-dd");
		const end = format(arg.end, "yyyy-MM-dd");
		setDateRange({ start, end });
	};

	// 이벤트 변경 후 새로고침
	const handleEventChanged = () => {
		if (!dateRange) return;
		
		fetch(`/api/events?start=${dateRange.start}&end=${dateRange.end}`)
			.then(res => res.json())
			.then(json => {
				console.log("새로고침 후 이벤트:", json.events?.length, "개");
				setEvents(json.events ?? []);
			});
	};

	// 오늘의 파티 목록
	const todayEvents = events.filter((e) => isSameDay(new Date(e.startAt), new Date()));

	return (
		<div className="p-4">
			<div className="mb-4 p-3 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-400 dark:border-yellow-700 rounded">
				<p className="text-sm text-yellow-800 dark:text-yellow-200">
					⚠️ <strong>테스트 페이지</strong> - FullCalendar 라이브러리를 사용한 새 버전입니다. 
					기존 <a href="/calendar" className="underline">/calendar</a> 페이지는 그대로 유지됩니다.
				</p>
			</div>
			
			{/* 상단 헤더 */}
			<div className="mb-4 flex items-center justify-between">
				<h1 className="text-2xl font-bold">달력 (테스트 버전)</h1>
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
				{/* 선택된 유저들 */}
				{selectedParticipants.size > 0 && (
					<div className="flex items-center gap-2 flex-wrap">
						<label className="text-sm text-zinc-600">선택된 참여자:</label>
						{Array.from(selectedParticipants).map((name) => {
							const participantInfo = participantMap.get(name);
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
				
				{/* 즐겨찾기 및 일반 유저 리스트 */}
				<div className="flex items-center gap-2 flex-wrap">
					<label className="text-sm text-zinc-600 whitespace-nowrap">참여자:</label>
					<div className="flex-1 overflow-x-auto">
						<div className="flex gap-2 pb-1">
							{/* 즐겨찾기 유저들 먼저 */}
							{favoriteUsers.map((user) => {
								if (selectedParticipants.has(user.name)) return null;
								const participantInfo = participantMap.get(user.name);
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
							
							{/* 일반 유저들 */}
							{participantList
								.filter(p => !favoriteUsers.find(f => f.name === p) && !selectedParticipants.has(p))
								.map((name) => {
									const participantInfo = participantMap.get(name);
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
				firstDay={0} // 일요일 시작
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
					// 제목만 표시 (시간 제거)
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
								return result ? {
									r: parseInt(result[1], 16),
									g: parseInt(result[2], 16),
									b: parseInt(result[3], 16)
								} : { r: 229, g: 231, b: 235 };
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
				<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowSettings(false)}>
					<div className="rounded p-4 w-full max-w-sm space-y-3" style={{ background: "var(--background)", color: "var(--foreground)" }} onClick={(e) => e.stopPropagation()}>
						<h2 className="text-lg font-semibold">설정</h2>
						<div className="text-sm text-zinc-600 dark:text-zinc-400">
							설정 기능은 기존 캘린더 페이지에서 사용할 수 있습니다.
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

