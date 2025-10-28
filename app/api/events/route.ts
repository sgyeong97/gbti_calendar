import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";
import { expandRecurringSlots } from "@/app/lib/supabase-helpers";

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

  try {
    // Fetch actual events with attendees
    let query = supabase
      .from('Event')
      .select('*, attendees:EventParticipant(participant:Participant(*))');
    
    if (calendarId) {
      query = query.eq('calendarId', calendarId);
    }
    if (start) {
      query = query.gte('startAt', start);
    }
    if (end) {
      query = query.lte('endAt', end);
    }
    
    const { data: eventsRaw, error: eventsError } = await query.order('startAt', { ascending: true });
    
    if (eventsError) throw eventsError;
    
    const events = (eventsRaw || []).map((e: any) => ({
      ...e,
      participants: (e.attendees ?? []).map((a: any) => a.participant.name),
    }));

    // Fetch recurring slots
    let recurring: any[] = [];
    if (!calendarId) {
      // Fetch all calendars with their slots
      const { data: calendars, error: calError } = await supabase
        .from('Calendar')
        .select('*, recurringSlots:RecurringSlot(*)');
      
      if (calError) throw calError;
      
      const allSlots = (calendars || []).flatMap((cal: any) => cal.recurringSlots || []);
      recurring = expandRecurringSlots(allSlots, start ?? undefined, end ?? undefined);
    } else {
      const { data: cal, error: calError } = await supabase
        .from('Calendar')
        .select('*, recurringSlots:RecurringSlot(*)')
        .eq('id', calendarId)
        .single();
      
      if (calError) throw calError;
      
      if (cal) {
        recurring = expandRecurringSlots(cal.recurringSlots || [], start ?? undefined, end ?? undefined);
      }
    }

    let all = [...events, ...recurring];
    if (participantName) {
      all = all.filter((e) => e.participants?.some((p: string) => p === participantName));
    }
    all.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    return NextResponse.json({ events: all });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // 관리자만 이벤트 생성 가능
  const block = requireAdmin(req);
  if (block) return block;
  const body = await req.json();
  const participantNames: string[] = body.participants ?? [];
  
  try {
    // 캘린더 보장: 전달된 calendarId가 없거나 존재하지 않으면 기본 캘린더를 생성/유지
    const calendarId: string = body.calendarId ?? "default";
    
    // Check if calendar exists, otherwise create
    const { data: existingCal } = await supabase
      .from('Calendar')
      .select('id')
      .eq('id', calendarId)
      .single();
    
    if (!existingCal) {
      await supabase
        .from('Calendar')
        .insert({ id: calendarId, name: body.calendarName ?? "기본 캘린더", color: body.calendarColor ?? "#4f46e5" });
    }

    // 반복 이벤트인 경우 일반 이벤트는 생성하지 않음 (반복 슬롯만 생성)
    if (body.repeat && Array.isArray(body.repeat.daysOfWeek)) {
      const eventStartDate = new Date(body.startAt);
      const startDayOfWeek = eventStartDate.getDay();
      const participantNamesStr = participantNames.length > 0 ? JSON.stringify(participantNames) : null;
      const eventColor = body.color || body.repeat?.color || "#60a5fa";
      
      // 각 요일의 첫 발생 날짜 계산
      for (const dow of body.repeat.daysOfWeek) {
        const startsOn = new Date(body.startAt);
        let daysUntilTarget = dow - startDayOfWeek;
        if (daysUntilTarget < 0) {
          daysUntilTarget += 7;
        }
        startsOn.setDate(startsOn.getDate() + daysUntilTarget);
        
        const { error } = await supabase
          .from('RecurringSlot')
          .insert({
            calendarId,
            dayOfWeek: dow,
            startMinutes: body.repeat.startMinutes,
            endMinutes: body.repeat.endMinutes,
            startsOn: startsOn.toISOString(),
            eventTitle: body.title,
            eventStartDate: eventStartDate.toISOString(),
            participantNames: participantNamesStr,
            color: eventColor
          });
        
        if (error) throw error;
      }
      
      return NextResponse.json({ event: { id: 'recurring', title: body.title, startAt: body.startAt, endAt: body.endAt, allDay: !!body.allDay, calendarId } }, { status: 201 });
    }
    
    // 일반 이벤트 생성
    const { data: created, error: eventError } = await supabase
      .from('Event')
      .insert({ title: body.title, startAt: body.startAt, endAt: body.endAt, allDay: !!body.allDay, calendarId, color: body.color || "#60a5fa" })
      .select()
      .single();
    
    if (eventError) throw eventError;
    
    // Add participants
    if (participantNames.length > 0) {
      for (const name of participantNames) {
        const participantId = await getOrCreateParticipant(name);
        
        // Link to event
        await supabase
          .from('EventParticipant')
          .upsert({ eventId: created.id, participantId }, { onConflict: 'eventId,participantId' });
        
        // Link to calendar
        await supabase
          .from('CalendarParticipant')
          .upsert({ calendarId, participantId }, { onConflict: 'calendarId,participantId' });
      }
    }
    
    return NextResponse.json({ event: created }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function getOrCreateParticipant(name: string): Promise<string> {
  const { data: existing } = await supabase
    .from('Participant')
    .select('id')
    .eq('name', name)
    .single();
  
  if (existing) return existing.id;
  
  const { data: created, error } = await supabase
    .from('Participant')
    .insert({ name })
    .select('id')
    .single();
  
  if (error) throw error;
  return created.id;
}
