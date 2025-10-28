import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { startOfWeek } from "date-fns";

function requireAdmin(req: NextRequest) {
  const role = req.cookies.get("gbti_role")?.value;
  if (role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const searchParams = new URL(req.url).searchParams;
  const calendarId = searchParams.get("calendarId");
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const participantName = searchParams.get("participantName");

  const where: any = {};
  if (calendarId) where.calendarId = calendarId;
  if (start || end) {
    where.startAt = { gte: start ? new Date(start) : undefined };
    where.endAt = { lte: end ? new Date(end) : undefined };
  }

  // 실제 저장된 이벤트
  const eventsRaw = await prisma.event.findMany({
    where,
    orderBy: { startAt: "asc" },
    include: { attendees: { include: { participant: true } } },
  });
  const events = eventsRaw.map((e: any) => ({
    ...e,
    participants: (e.attendees ?? []).map((a: any) => a.participant.name),
  }));

  // 반복 슬롯 기반 생성
  let recurring: any[] = [];
  if (!calendarId) {
    // 특정 캘린더 없으면 모두 대상
    const calendars = await prisma.calendar.findMany({ include: { recurringSlots: true, members: { include: { participant: true } } } });
    recurring = expandRecurring(calendars, start ?? undefined, end ?? undefined);
  } else {
    const cal = await prisma.calendar.findUnique({ where: { id: calendarId }, include: { recurringSlots: true, members: { include: { participant: true } } } });
    if (cal) recurring = expandRecurring([cal], start ?? undefined, end ?? undefined);
  }

  let all = [...events, ...recurring];
  if (participantName) {
    all = all.filter((e) => e.participants?.some((p: string) => p === participantName));
  }
  all.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  return NextResponse.json({ events: all });
}

function expandRecurring(calendars: any[], start?: string, end?: string) {
  const startDate = start ? new Date(start) : new Date();
  const endDate = end ? new Date(end) : new Date(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate());
  const days: Date[] = [];
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  const results: any[] = [];
  for (const cal of calendars) {
    for (const day of days) {
      const slots = cal.recurringSlots.filter((s: any) => {
        // 해당 요일이면 반복 표시 (매주 반복)
        const startsOnDate = new Date(s.startsOn);
        startsOnDate.setHours(0, 0, 0, 0);
        const compareDay = new Date(day);
        compareDay.setHours(0, 0, 0, 0);
        
        // endsOn 날짜만 비교 (시간 무시)
        let isWithinEndDate = true;
        if (s.endsOn) {
          const endDate = new Date(s.endsOn);
          const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
          const dayDateOnly = new Date(compareDay.getFullYear(), compareDay.getMonth(), compareDay.getDate());
          isWithinEndDate = dayDateOnly <= endDateOnly;
        }
        
        // dayOfWeek가 요일과 일치하고, startsOn 이후, endsOn 이전이어야 함
        return s.dayOfWeek === day.getDay() &&
          compareDay >= startsOnDate &&
          isWithinEndDate;
      });
      for (const s of slots) {
        const startAt = new Date(day);
        startAt.setHours(0, s.startMinutes, 0, 0);
        const endAt = new Date(day);
        endAt.setHours(0, s.endMinutes, 0, 0);
        
        // 저장된 참여자 정보가 있으면 사용, 없으면 현재 캘린더 멤버 사용
        let participants: string[];
        if (s.participantNames) {
          participants = JSON.parse(s.participantNames);
          console.log(`Slot ${s.id} (${s.eventTitle}): Using stored participantNames:`, s.participantNames, "->", participants);
        } else {
          participants = cal.members.map((m: any) => m.participant.name);
          console.log(`Slot ${s.id} (${s.eventTitle}): participantNames is null, using cal.members:`, participants);
        }
        
        results.push({
          id: `R-${cal.id}-${day.toISOString()}-${s.id}`,
          calendarId: cal.id,
          title: s.eventTitle,
          description: null,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          allDay: false,
          participants,
          color: s.color,
        });
      }
    }
  }
  return results;
}

export async function POST(req: NextRequest) {
  // 관리자만 이벤트 생성 가능
  const block = requireAdmin(req);
  if (block) return block;
  const body = await req.json();
  // body: { title, startAt, endAt, allDay, calendarId, participants?: string[], repeat?: { daysOfWeek:number[], startMinutes:number, endMinutes:number } }
  const participantNames: string[] = body.participants ?? [];
  const event = await prisma.$transaction(async (tx) => {
    // 캘린더 보장: 전달된 calendarId가 없거나 존재하지 않으면 기본 캘린더를 생성/유지
    const calendarId: string = body.calendarId ?? "default";
    await tx.calendar.upsert({
      where: { id: calendarId },
      update: {},
      create: { id: calendarId, name: body.calendarName ?? "기본 캘린더", color: body.calendarColor ?? "#4f46e5" },
    });

    // 반복 이벤트인 경우 일반 이벤트는 생성하지 않음 (반복 슬롯만 생성)
    if (body.repeat && Array.isArray(body.repeat.daysOfWeek)) {
      // 반복 옵션: RecurringSlot에 기록 (캘린더 기반 반복으로 관리)
      const eventStartDate = new Date(body.startAt);
      const startDayOfWeek = eventStartDate.getDay();
      // 참여자 정보를 JSON 배열로 저장
      const participantNamesStr = participantNames.length > 0 ? JSON.stringify(participantNames) : null;
      const eventColor = body.color || body.repeat?.color || "#60a5fa";
      
      console.log("Creating recurring event:", { title: body.title, participantNames, participantNamesStr, daysOfWeek: body.repeat.daysOfWeek });
      
      // 각 요일의 첫 발생 날짜 계산 (시작일과 같은 주 포함)
      for (const dow of body.repeat.daysOfWeek) {
        const startsOn = new Date(body.startAt);
        let daysUntilTarget = dow - startDayOfWeek;
        // 같은 주의 과거 요일이면 다음 주로, 아니면 같은 주로
        if (daysUntilTarget < 0) {
          daysUntilTarget += 7; // 다음 주
        }
        startsOn.setDate(startsOn.getDate() + daysUntilTarget);
        
        console.log(`Creating slot for day ${dow}: startsOn=${startsOn}, participantNames=${participantNamesStr}`);
        
        await tx.recurringSlot.create({ data: { calendarId, dayOfWeek: dow, startMinutes: body.repeat.startMinutes, endMinutes: body.repeat.endMinutes, startsOn, eventTitle: body.title, eventStartDate, participantNames: participantNamesStr, color: eventColor } });
      }
      
      // 반복 이벤트이므로 더미 이벤트 반환 (실제로는 반복 슬롯이 표시됨)
      return { id: 'recurring', title: body.title, startAt: body.startAt, endAt: body.endAt, allDay: !!body.allDay, calendarId };
    }
    
    // 일반 이벤트 생성
    const created = await tx.event.create({ data: { title: body.title, startAt: body.startAt, endAt: body.endAt, allDay: !!body.allDay, calendarId, color: body.color || "#60a5fa" } });
    if (participantNames.length > 0) {
      for (const name of participantNames) {
        const p = await tx.participant.upsert({ where: { name }, update: {}, create: { name } });
        await tx.eventParticipant.upsert({ where: { eventId_participantId: { eventId: created.id, participantId: p.id } }, update: {}, create: { eventId: created.id, participantId: p.id } });
        await tx.calendarParticipant.upsert({ where: { calendarId_participantId: { calendarId, participantId: p.id } }, update: {}, create: { calendarId, participantId: p.id } });
      }
    }
    return created;
  });
  return NextResponse.json({ event }, { status: 201 });
}
