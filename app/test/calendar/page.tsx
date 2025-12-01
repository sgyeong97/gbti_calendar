"use client";

import { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { format } from "date-fns";
import koLocale from "@fullcalendar/core/locales/ko";
import EventDetailModal from "@/app/calendar/EventDetailModal";
import CreateEventModal from "@/app/calendar/CreateEventModal";

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
	const [events, setEvents] = useState<Event[]>([]);
	const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
	const [activeEventId, setActiveEventId] = useState<string | null>(null);
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [selectedDate, setSelectedDate] = useState<Date | null>(null);

	// FullCalendar용 이벤트 형식으로 변환
	const calendarEvents = events.map((e) => {
		return {
			id: e.id, // 반복 이벤트도 R-로 시작하는 ID 그대로 사용
			title: e.title, // 제목만 표시 (시간은 표시하지 않음)
			start: e.startAt,
			end: e.endAt,
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

	// 이벤트 가져오기
	useEffect(() => {
		if (!dateRange) return;
		
		const fetchEvents = async () => {
			console.log("이벤트 가져오기:", dateRange.start, "~", dateRange.end);
			const res = await fetch(`/api/events?start=${dateRange.start}&end=${dateRange.end}`);
			const json = await res.json();
			console.log("가져온 이벤트:", json.events?.length, "개");
			console.log("반복 이벤트:", json.events?.filter((e: Event) => e.isRecurring)?.length, "개");
			setEvents(json.events ?? []);
		};
		fetchEvents();
	}, [dateRange]);

	// 날짜 클릭 핸들러 (더블클릭은 dayCellDidMount에서 처리)
	const handleDateClick = (arg: any) => {
		// 단일 클릭은 무시
	};
	
	// 날짜 셀에 더블클릭 이벤트 추가
	const handleDayCellDidMount = (arg: any) => {
		// 빈 날짜 셀에 더블클릭 이벤트 추가
		const cellEl = arg.el;
		cellEl.addEventListener('dblclick', () => {
			const clickedDate = new Date(arg.date);
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

	return (
		<div className="p-4">
			<div className="mb-4 p-3 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-400 dark:border-yellow-700 rounded">
				<p className="text-sm text-yellow-800 dark:text-yellow-200">
					⚠️ <strong>테스트 페이지</strong> - FullCalendar 라이브러리를 사용한 새 버전입니다. 
					기존 <a href="/calendar" className="underline">/calendar</a> 페이지는 그대로 유지됩니다.
				</p>
			</div>
			<h1 className="text-2xl font-bold mb-4">달력 (테스트 버전)</h1>
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
					onChanged={handleEventChanged}
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
						setShowCreateModal(false);
						setSelectedDate(null);
					}}
				/>
			)}
		</div>
	);
}

