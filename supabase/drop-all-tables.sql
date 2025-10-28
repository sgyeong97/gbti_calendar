-- 기존 테이블 삭제 (순서 중요 - 외래키 때문에 역순으로 삭제)
DROP TABLE IF EXISTS "RecurringSlot" CASCADE;
DROP TABLE IF EXISTS "EventParticipant" CASCADE;
DROP TABLE IF EXISTS "Event" CASCADE;
DROP TABLE IF EXISTS "CalendarParticipant" CASCADE;
DROP TABLE IF EXISTS "Participant" CASCADE;
DROP TABLE IF EXISTS "Calendar" CASCADE;

