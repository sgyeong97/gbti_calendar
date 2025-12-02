-- Calendar table
CREATE TABLE "Calendar" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#4f46e5',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Participant table
CREATE TABLE "Participant" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CalendarParticipant junction table
CREATE TABLE "CalendarParticipant" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "calendarId" TEXT NOT NULL REFERENCES "Calendar"(id) ON DELETE CASCADE,
  "participantId" TEXT NOT NULL REFERENCES "Participant"(id) ON DELETE CASCADE,
  UNIQUE("calendarId", "participantId")
);

CREATE INDEX "CalendarParticipant_participantId_idx" ON "CalendarParticipant"("participantId");

-- Event table
CREATE TABLE "Event" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "calendarId" TEXT NOT NULL REFERENCES "Calendar"(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  "startAt" TIMESTAMPTZ NOT NULL,
  "endAt" TIMESTAMPTZ NOT NULL,
  "allDay" BOOLEAN NOT NULL DEFAULT false,
  color TEXT NOT NULL DEFAULT '#60a5fa',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "Event_calendarId_startAt_endAt_idx" ON "Event"("calendarId", "startAt", "endAt");

-- EventParticipant junction table
CREATE TABLE "EventParticipant" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "eventId" TEXT NOT NULL REFERENCES "Event"(id) ON DELETE CASCADE,
  "participantId" TEXT NOT NULL REFERENCES "Participant"(id) ON DELETE CASCADE,
  UNIQUE("eventId", "participantId")
);

CREATE INDEX "EventParticipant_participantId_idx" ON "EventParticipant"("participantId");

-- RecurringSlot table
CREATE TABLE "RecurringSlot" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "calendarId" TEXT NOT NULL REFERENCES "Calendar"(id) ON DELETE CASCADE,
  "dayOfWeek" INTEGER NOT NULL,
  "startMinutes" INTEGER NOT NULL,
  "endMinutes" INTEGER NOT NULL,
  "startsOn" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "endsOn" TIMESTAMPTZ,
  "eventTitle" TEXT NOT NULL,
  "eventStartDate" TIMESTAMPTZ NOT NULL,
  "participantNames" TEXT,
  color TEXT NOT NULL DEFAULT '#60a5fa'
);

CREATE INDEX "RecurringSlot_calendarId_dayOfWeek_startsOn_idx" ON "RecurringSlot"("calendarId", "dayOfWeek", "startsOn");

-- Calendar table
CREATE TABLE "Calendar" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#4f46e5',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Participant table
CREATE TABLE "Participant" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CalendarParticipant junction table
CREATE TABLE "CalendarParticipant" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "calendarId" TEXT NOT NULL REFERENCES "Calendar"(id) ON DELETE CASCADE,
  "participantId" TEXT NOT NULL REFERENCES "Participant"(id) ON DELETE CASCADE,
  UNIQUE("calendarId", "participantId")
);

CREATE INDEX "CalendarParticipant_participantId_idx" ON "CalendarParticipant"("participantId");

-- Event table
CREATE TABLE "Event" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "calendarId" TEXT NOT NULL REFERENCES "Calendar"(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  "startAt" TIMESTAMPTZ NOT NULL,
  "endAt" TIMESTAMPTZ NOT NULL,
  "allDay" BOOLEAN NOT NULL DEFAULT false,
  color TEXT NOT NULL DEFAULT '#60a5fa',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "Event_calendarId_startAt_endAt_idx" ON "Event"("calendarId", "startAt", "endAt");

-- EventParticipant junction table
CREATE TABLE "EventParticipant" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "eventId" TEXT NOT NULL REFERENCES "Event"(id) ON DELETE CASCADE,
  "participantId" TEXT NOT NULL REFERENCES "Participant"(id) ON DELETE CASCADE,
  UNIQUE("eventId", "participantId")
);

CREATE INDEX "EventParticipant_participantId_idx" ON "EventParticipant"("participantId");

-- RecurringSlot table
CREATE TABLE "RecurringSlot" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "calendarId" TEXT NOT NULL REFERENCES "Calendar"(id) ON DELETE CASCADE,
  "dayOfWeek" INTEGER NOT NULL,
  "startMinutes" INTEGER NOT NULL,
  "endMinutes" INTEGER NOT NULL,
  "startsOn" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "endsOn" TIMESTAMPTZ,
  "eventTitle" TEXT NOT NULL,
  "eventStartDate" TIMESTAMPTZ NOT NULL,
  "participantNames" TEXT,
  color TEXT NOT NULL DEFAULT '#60a5fa'
);

CREATE INDEX "RecurringSlot_calendarId_dayOfWeek_startsOn_idx" ON "RecurringSlot"("calendarId", "dayOfWeek", "startsOn");