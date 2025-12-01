"use client";

import { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import koLocale from "@fullcalendar/core/locales/ko";

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
	const [events, setEvents] = useState<Event[]>([]);
	const [currentDate, setCurrentDate] = useState<Date>(new Date());

	// FullCalendar용 이벤트 형식으로 변환
	const calendarEvents = events.map((e) => ({
		id: e.id,
		title: e.title,
		start: e.startAt,
		end: e.endAt,
		allDay: e.allDay,
		backgroundColor: e.color || "#FDC205",
		borderColor: e.color || "#FDC205",
		extendedProps: {
			participants: e.participants || [],
			isRecurring: e.isRecurring || false,
		},
	}));

	// 이벤트 가져오기
	useEffect(() => {
		const fetchEvents = async () => {
			// FullCalendar의 datesSet 이벤트를 사용하는 것이 더 정확하지만, 일단 기본 구현
			const start = format(startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 }), "yyyy-MM-dd");
			const end = format(endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 }), "yyyy-MM-dd");
			
			const res = await fetch(`/api/events?start=${start}&end=${end}&includeBirthdays=1`);
			const json = await res.json();
			setEvents(json.events ?? []);
		};
		fetchEvents();
	}, [currentDate]);

	// 날짜 클릭 핸들러
	const handleDateClick = (arg: any) => {
		console.log("날짜 클릭:", arg.dateStr);
		// TODO: 이벤트 생성 모달 열기
	};

	// 이벤트 클릭 핸들러
	const handleEventClick = (arg: any) => {
		console.log("이벤트 클릭:", arg.event.id);
		// TODO: 이벤트 상세 모달 열기
	};

	// 날짜 변경 핸들러 (월 이동 시)
	const handleDatesSet = (arg: any) => {
		setCurrentDate(arg.start);
	};

	return (
		<div className="p-4">
			<h1 className="text-2xl font-bold mb-4">달력</h1>
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
				height="auto"
			/>
		</div>
	);
}
