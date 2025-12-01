import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
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
    return NextResponse.json({ events: all }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // 일반 사용자도 이벤트 생성 가능
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
      await supabaseAdmin
        .from('Calendar')
        .insert({ id: calendarId, name: body.calendarName ?? "기본 캘린더", color: body.calendarColor ?? "#FDC205" });
    }

    // 반복 이벤트인 경우 일반 이벤트는 생성하지 않음 (반복 슬롯만 생성)
    if (body.repeat && Array.isArray(body.repeat.daysOfWeek)) {
      // 반복 이벤트는 startAt, endAt과 무관하게 선택한 요일(dayOfWeek)에만 반복됨
      // startAt은 시간만 결정하고, 실제 반복은 dayOfWeek로 결정
      const participantNamesStr = participantNames.length > 0 ? JSON.stringify(participantNames) : null;
      const eventColor = body.color || body.repeat?.color || "#FDC205";
      
      // body.startAt에서 날짜 추출 (타임존 문제 방지)
      const startAtDate = new Date(body.startAt);
      // 로컬 날짜로 정규화
      const startAtLocal = new Date(startAtDate.getFullYear(), startAtDate.getMonth(), startAtDate.getDate());
      
      // 단순화: startsOn을 과거 날짜로 설정하여 항상 표시되도록 함
      // 실제 반복은 dayOfWeek만으로 결정됨
      const startsOnISO = "1970-01-01T00:00:00.000Z"; // 과거 날짜로 설정하여 항상 startsOn 체크 통과
      
      for (const dow of body.repeat.daysOfWeek) {
        // dayOfWeek는 JavaScript getDay() 값 (0=일요일, 1=월요일, ..., 6=토요일)
        // CreateEventModal에서 이미 올바른 값으로 전달됨
        
        console.log(`[RecurringSlot 생성] dayOfWeek: ${dow} (${['일','월','화','수','목','금','토'][dow]}), startsOn: ${startsOnISO}`);
        
        const { error } = await supabaseAdmin
          .from('RecurringSlot')
          .insert({
            calendarId,
            dayOfWeek: dow, // 핵심: 선택한 요일 그대로 저장
            startMinutes: body.repeat.startMinutes,
            endMinutes: body.repeat.endMinutes,
            startsOn: startsOnISO, // 과거 날짜로 설정하여 항상 표시
            eventTitle: body.title,
            eventStartDate: startAtLocal.toISOString(),
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
      .insert({ title: body.title, startAt: body.startAt, endAt: body.endAt, allDay: !!body.allDay, calendarId, color: body.color || "#FDC205" })
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
