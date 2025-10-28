"use client";

import { useEffect, useMemo, useState } from "react";
import CreateEventModal from "@/app/calendar/CreateEventModal";
import EventDetailModal from "@/app/calendar/EventDetailModal";
import { addDays, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, setHours, startOfMonth, startOfWeek, subWeeks } from "date-fns";
const BRAND_COLOR = "#FDC205"; // rgb(253,194,5)

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

type ViewMode = "month" | "week" | "favorites";

type FavoriteUser = {
	name: string;
};

export default function CalendarPage() {
	const [current, setCurrent] = useState<Date>(new Date());
	const [events, setEvents] = useState<Event[]>([]);
	const [selectedParticipant, setSelectedParticipant] = useState<string>("");
	const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
	const [viewMode, setViewMode] = useState<ViewMode>("month");
	const [favoriteUsers, setFavoriteUsers] = useState<FavoriteUser[]>([]);
	const [showFavorites, setShowFavorites] = useState(false);
	const [showAdminAuth, setShowAdminAuth] = useState(false);
	const days = useMemo(() => {
		if (viewMode === "week") {
			// 주간 뷰: 현재 주만 표시 (월요일부터 일요일)
			const start = startOfWeek(current, { weekStartsOn: 1 });
			const end = endOfWeek(current, { weekStartsOn: 1 });
			return eachDayOfInterval({ start, end });
		} else {
			// 월간 뷰: 월 전체 표시 (이전/다음 달 일부 포함)
			const start = startOfWeek(startOfMonth(current), { weekStartsOn: 1 });
			const end = endOfWeek(endOfMonth(current), { weekStartsOn: 1 });
			return eachDayOfInterval({ start, end });
		}
	}, [current, viewMode]);

	useEffect(() => {
		const fetchEvents = async () => {   
			let startStr: string, endStr: string;

			if (viewMode === "week") {
				// 주간 뷰: 현재 주 범위
				startStr = format(startOfWeek(current, { weekStartsOn: 1 }), "yyyy-MM-dd");
				endStr = format(endOfWeek(current, { weekStartsOn: 1 }), "yyyy-MM-dd");
			} else {
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

	const fetchParticipants = async () => {
		const res = await fetch("/api/participants");
		const data = await res.json();
		setParticipantList((data.participants ?? []).map((p: any) => p.name));
	};

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
		<div className="p-6 max-w-5xl mx-auto">
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-4">
					<h1 className="text-2xl font-semibold">달력</h1>
					<div className="flex gap-1">
				<button
					className={`px-3 py-1 rounded transition-colors cursor-pointer ${viewMode === "month" ? "" : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"}`}
					style={viewMode === "month" ? { backgroundColor: BRAND_COLOR, color: "#111" } : undefined}
							onClick={() => setViewMode("month")}
						>
							월간
						</button>
				<button
					className={`px-3 py-1 rounded transition-colors cursor-pointer ${viewMode === "week" ? "" : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"}`}
					style={viewMode === "week" ? { backgroundColor: BRAND_COLOR, color: "#111" } : undefined}
							onClick={() => setViewMode("week")}
						>
							주간
						</button>
				<button
					className={`px-3 py-1 rounded transition-colors cursor-pointer ${viewMode === "favorites" ? "" : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"}`}
					style={viewMode === "favorites" ? { backgroundColor: BRAND_COLOR, color: "#111" } : undefined}
							onClick={() => setViewMode("favorites")}
						>
							즐겨찾기
						</button>
					</div>
				</div>
				<div className="flex gap-2 items-center">
					<button
						className="px-3 py-1 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
						onClick={() => viewMode === "week" ? setCurrent(subWeeks(current, 1)) : setCurrent(addDays(current, -30))}
					>
						이전
					</button>
			<button
				className="min-w-20 text-center px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
				onClick={() => {
					setPickerYear(current.getFullYear());
					setPickerMonth(current.getMonth());
					setShowMonthPicker(true);
				}}
			>
						{viewMode === "week"
							? `${format(startOfWeek(current, { weekStartsOn: 1 }), "MM.dd")} - ${format(endOfWeek(current, { weekStartsOn: 1 }), "MM.dd")}`
							: format(current, "yyyy.MM")
						}
			</button>
					<button
						className="px-3 py-1 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
						onClick={() => viewMode === "week" ? setCurrent(addWeeks(current, 1)) : setCurrent(addDays(current, 30))}
					>
						다음
					</button>
					<button
						className="px-3 py-1 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer text-xl"
						onClick={() => setShowAdminAuth(true)}
						title="관리자"
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

			{viewMode === "week" ? (
				// 주간 뷰: 시간대별 타임라인
				<div className="space-y-1">
					{/* 요일 헤더 */}
					<div className="grid grid-cols-8 gap-1 text-xs">
						<div className="px-2 py-1 text-zinc-700 dark:text-zinc-300 font-medium">시간</div>
						{["월", "화", "수", "목", "금", "토", "일"].map((w, i) => {
							const day = days[i];
							return (
								<div
									key={w}
									className={`px-2 py-1 text-zinc-700 dark:text-zinc-300 font-medium text-center ${
										day && isToday(day)
											? "bg-indigo-100 dark:bg-indigo-900/40 rounded"
											: ""
									}`}
								>
									{w} {day ? format(day, "d") : ""}
								</div>
							);
						})}
					</div>

					{/* 시간대별 타임라인 */}
					{Array.from({ length: 14 }, (_, hour) => hour + 9).map((hour) => (
						<div key={hour} className="grid grid-cols-8 gap-1">
							<div className="px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400 border-b">
								{format(new Date().setHours(hour, 0, 0, 0), "HH:mm")}
							</div>
							{days.map((d, dayIndex) => {
								// 해당 시간대에 이벤트가 있는지 확인
								const slotStartMinutes = hour * 60;
								const slotEndMinutes = (hour + 1) * 60;
								const hasEventInThisSlot = events.some((e) => {
									const eventStart = new Date(e.startAt);
									const eventEnd = new Date(e.endAt);
									const eventStartMinutes = eventStart.getHours() * 60 + eventStart.getMinutes();
									const eventEndMinutes = eventEnd.getHours() * 60 + eventEnd.getMinutes();
									return isSameDay(eventStart, d) &&
										eventStartMinutes < slotEndMinutes &&
										eventEndMinutes > slotStartMinutes;
								});

								return (
									<div
										key={d.toISOString()}
										className={`border-b border-zinc-200 dark:border-zinc-700 min-h-16 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors relative ${
											isToday(d)
												? "bg-indigo-50 dark:bg-indigo-900/20"
												: "bg-white dark:bg-zinc-950"
										}`}
										onDoubleClick={() => {
											// 이벤트가 없는 시간대만 더블클릭으로 생성 가능
											if (!hasEventInThisSlot) {
												const selectedDateTime = setHours(d, hour);
												setSelectedDate(selectedDateTime);
												setShowCreateModal(true);
											}
										}}
										onClick={(e) => {
											// 이벤트가 있는 시간대는 클릭으로 상세보기
											if (hasEventInThisSlot) {
												// 해당 시간대의 첫 번째 이벤트 상세보기
												const eventInSlot = events.find((ev) => {
													const eventStart = new Date(ev.startAt);
													const eventEnd = new Date(ev.endAt);
													const eventStartMinutes = eventStart.getHours() * 60 + eventStart.getMinutes();
													const eventEndMinutes = eventEnd.getHours() * 60 + eventEnd.getMinutes();
													return isSameDay(eventStart, d) &&
														eventStartMinutes < slotEndMinutes &&
														eventEndMinutes > slotStartMinutes;
												});
												if (eventInSlot) {
													setActiveEventId(eventInSlot.id);
												}
											}
										}}
									>
									{/* 해당 시간대의 이벤트들 */}
									{(() => {
										const eventsInThisSlot = events.filter((e) => {
											const eventStart = new Date(e.startAt);
											const eventEnd = new Date(e.endAt);
											const eventStartMinutes = eventStart.getHours() * 60 + eventStart.getMinutes();
											const eventEndMinutes = eventEnd.getHours() * 60 + eventEnd.getMinutes();
											const slotStartMinutes = hour * 60;
											const slotEndMinutes = (hour + 1) * 60;
											
											return isSameDay(eventStart, d) &&
												eventStartMinutes < slotEndMinutes &&
												eventEndMinutes > slotStartMinutes;
									});
									
									return eventsInThisSlot.map((e, index) => {
											const eventStart = new Date(e.startAt);
											const eventEnd = new Date(e.endAt);
											
											const eventStartMinutes = eventStart.getHours() * 60 + eventStart.getMinutes();
											const eventEndMinutes = eventEnd.getHours() * 60 + eventEnd.getMinutes();
											const slotStartMinutes = hour * 60;
											const slotEndMinutes = (hour + 1) * 60;
											
											const isEventStart = eventStartMinutes >= slotStartMinutes && eventStartMinutes < slotEndMinutes;
											const minutesFromStart = Math.max(0, eventStartMinutes - slotStartMinutes);
											const minutesToEnd = Math.min(slotEndMinutes, eventEndMinutes) - slotStartMinutes;
											
											// 겹치는 이벤트들을 나란히 배치
											const overlappingCount = eventsInThisSlot.length;
											const gap = 1; // 각 이벤트 사이 간격 (px)
											const totalGap = gap * (overlappingCount - 1);
											const width = `calc((100% - ${totalGap}px) / ${overlappingCount})`;
											const left = index * (100 / overlappingCount);
											
									// 이벤트 색상 사용 (저장된 색상이 없으면 기본 색상)
									const eventColor = e.color || "#93c5fd";
											
											// 선택된 이벤트인지 확인
											const isActiveEvent = activeEventId === e.id;
											const isDimmed = activeEventId !== null && activeEventId !== e.id;

											return (
												<div
													key={`${e.id}-${eventStart.getTime()}`}
													className={`event-block absolute text-xs rounded px-1 py-0.5 truncate transition-all border-2 ${
														isActiveEvent ? 'border-indigo-700 dark:border-indigo-400' : 'border-transparent'
													} ${isDimmed ? 'opacity-30' : 'opacity-100'}`}
													style={{
														backgroundColor: eventColor,
														color: '#000',
														left: `${left}%`,
														width: width,
														top: `${minutesFromStart}px`,
														height: `${Math.min(60, Math.max(20, minutesToEnd))}px`,
														lineHeight: '1.1',
														zIndex: isActiveEvent ? 20 : 10 + index,
														marginRight: `${gap}px`,
														transform: isActiveEvent ? 'scale(1.02)' : 'scale(1)',
														boxShadow: isActiveEvent ? '0 2px 8px rgba(0,0,0,0.2)' : 'none'
													}}
													onClick={(ev) => {
														ev.stopPropagation();
														setActiveEventId(e.id);
													}}
													title={`${e.title} (${format(eventStart, "HH:mm")} - ${format(eventEnd, "HH:mm")})`}
												>
													{isEventStart && e.title}
												</div>
											);
										});
									})()}
									</div>
								);
							})}
						</div>
					))}
				</div>
			) : (
				// 월간 뷰: 기존 날짜 그리드
				<>
					{/* 요일 헤더 (월~일) */}
					<div className="grid grid-cols-7 gap-2 mb-1 text-xs">
						{["월", "화", "수", "목", "금", "토", "일"].map((w) => (
							<div key={w} className="px-2 py-1 text-zinc-700 dark:text-zinc-300 font-medium">{w}</div>
						))}
					</div>

					<div className="grid grid-cols-7 gap-2">
						{days.map((d) => (
						<div
								key={d.toISOString()}
							className={`border rounded p-2 min-h-24 border-zinc-200 dark:border-zinc-700 cursor-pointer transition-colors ${
								isToday(d)
									? "ring-2"
									: `${isSameMonth(d, current) ? "bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-800" : "bg-zinc-50 dark:bg-zinc-900/40 text-zinc-400 dark:text-zinc-500"}`
								}`}
							style={isToday(d) ? { backgroundColor: "#FFF6D1", boxShadow: `0 0 0 2px ${BRAND_COLOR}`, borderColor: BRAND_COLOR } : undefined}
								onDoubleClick={() => {
									setSelectedDate(d);
									setShowCreateModal(true);
								}}
							>
							<div className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
								{isToday(d) ? (
									<span className="inline-flex items-center justify-center w-6 h-6 rounded-full" style={{ backgroundColor: BRAND_COLOR, color: "#111" }}>
										{format(d, "d")}
									</span>
									) : (
									<span>{format(d, "d")}</span>
									)}
								</div>
								<div className="mt-1 space-y-1">
								{events.filter((e) => isSameDay(new Date(e.startAt), d)).map((e) => (
									<button
										key={e.id}
										onClick={() => setActiveEventId(e.id)}
									className="w-full text-left text-xs rounded px-1 py-0.5 truncate transition-colors cursor-pointer"
										style={{ 
											backgroundColor: e.color || "#93c5fd",
											color: "#000"
										}}
									>
										{e.title}
									</button>
								))}
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
					
					// 뷰 모드에 따라 올바른 날짜 범위로 이벤트 새로고침
					let startStr: string, endStr: string;

					if (viewMode === "week") {
						startStr = format(startOfWeek(current, { weekStartsOn: 1 }), "yyyy-MM-dd");
						endStr = format(endOfWeek(current, { weekStartsOn: 1 }), "yyyy-MM-dd");
					} else {
						startStr = format(startOfWeek(startOfMonth(current), { weekStartsOn: 1 }), "yyyy-MM-dd");
						endStr = format(endOfWeek(endOfMonth(current), { weekStartsOn: 1 }), "yyyy-MM-dd");
					}

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
					
					// 뷰 모드에 따라 올바른 날짜 범위로 이벤트 새로고침
					let startStr: string, endStr: string;

					if (viewMode === "week") {
						startStr = format(startOfWeek(current, { weekStartsOn: 1 }), "yyyy-MM-dd");
						endStr = format(endOfWeek(current, { weekStartsOn: 1 }), "yyyy-MM-dd");
					} else {
						startStr = format(startOfWeek(startOfMonth(current), { weekStartsOn: 1 }), "yyyy-MM-dd");
						endStr = format(endOfWeek(endOfMonth(current), { weekStartsOn: 1 }), "yyyy-MM-dd");
					}

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
				<div className="rounded p-4 w-full max-w-sm space-y-3" style={{ background: "var(--background)", color: "var(--foreground)" }}>
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
			</div>
		)}

		{/* 관리자 인증 모달 */}
		{showAdminAuth && (
			<AdminAuthModal
				onClose={() => setShowAdminAuth(false)}
				onSuccess={() => {
					setShowAdminAuth(false);
					window.location.href = "/admin";
				}}
			/>
		)}
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
