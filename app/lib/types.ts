export interface Calendar {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface Participant {
  id: string;
  name: string;
  createdAt: string;
}

export interface Event {
  id: string;
  calendarId: string;
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringSlot {
  id: string;
  calendarId: string;
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
  startsOn: string;
  endsOn?: string;
  eventTitle: string;
  eventStartDate: string;
  participantNames?: string;
  color: string;
}

export interface CalendarParticipant {
  id: string;
  calendarId: string;
  participantId: string;
}

export interface EventParticipant {
  id: string;
  eventId: string;
  participantId: string;
}

