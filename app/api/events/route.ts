import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { expandRecurringSlots, prepareRecurringSlots } from "@/app/lib/recurring-events";

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

  console.log(`\n========== [API: 이벤트 조회 시작] ==========`);
  console.log(`쿼리 파라미터: calendarId=${calendarId || '없음'}, start=${start || '없음'}, end=${end || '없음'}, participantName=${participantName || '없음'}`);

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
    console.log(`[API] 반복 이벤트 슬롯 조회 시작`);
    let recurring: any[] = [];
    if (!calendarId) {
      // Fetch all calendars with their slots
      const { data: calendars, error: calError } = await supabase
        .from('Calendar')
        .select('*, recurringSlots:RecurringSlot(*)');
      
      if (calError) throw calError;
      
      const allSlots = (calendars || []).flatMap((cal: any) => cal.recurringSlots || []);
      console.log(`[API] 전체 캘린더에서 슬롯 조회: ${allSlots.length}개 슬롯 발견`);
      if (allSlots.length > 0) {
        allSlots.slice(0, 5).forEach((slot: any, idx: number) => {
          console.log(`  슬롯[${idx}]: id=${slot.id}, dayOfWeek=${slot.dayOfWeek}, title="${slot.eventTitle}"`);
        });
      }
      recurring = expandRecurringSlots(allSlots, start ?? undefined, end ?? undefined);
    } else {
      const { data: cal, error: calError } = await supabase
        .from('Calendar')
        .select('*, recurringSlots:RecurringSlot(*)')
        .eq('id', calendarId)
        .single();
      
      if (calError) throw calError;
      
      if (cal) {
        const slots = cal.recurringSlots || [];
        console.log(`[API] 특정 캘린더(${calendarId})에서 슬롯 조회: ${slots.length}개 슬롯 발견`);
        if (slots.length > 0) {
          slots.slice(0, 5).forEach((slot: any, idx: number) => {
            console.log(`  슬롯[${idx}]: id=${slot.id}, dayOfWeek=${slot.dayOfWeek}, title="${slot.eventTitle}"`);
          });
        }
        recurring = expandRecurringSlots(slots, start ?? undefined, end ?? undefined);
      }
    }

    console.log(`[API] 확장된 반복 이벤트: ${recurring.length}개`);
    console.log(`[API] 일반 이벤트: ${events.length}개`);
    
    let all = [...events, ...recurring];
    if (participantName) {
      const beforeFilter = all.length;
      all = all.filter((e) => e.participants?.some((p: string) => p === participantName));
      console.log(`[API] 참가자 필터링: ${beforeFilter}개 → ${all.length}개`);
    }
    all.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    
    console.log(`[API: 이벤트 조회 완료] 총 ${all.length}개 이벤트 반환\n`);
    
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
      console.log(`\n========== [API: 반복 이벤트 생성 시작] ==========`);
      console.log(`요청 데이터:`);
      console.log(`  title: "${body.title}"`);
      console.log(`  startAt: ${body.startAt}`);
      console.log(`  endAt: ${body.endAt}`);
      console.log(`  repeat.daysOfWeek: [${body.repeat.daysOfWeek.join(', ')}]`);
      console.log(`  repeat.startMinutes: ${body.repeat.startMinutes}`);
      console.log(`  repeat.endMinutes: ${body.repeat.endMinutes}`);
      
      // 반복 이벤트는 startAt, endAt과 무관하게 선택한 요일(dayOfWeek)에만 반복됨
      // startAt은 시간만 결정하고, 실제 반복은 dayOfWeek로 결정
      const eventColor = body.color || body.repeat?.color || "#FDC205";
      const startAtDate = new Date(body.startAt);
      
      console.log(`파싱된 startAtDate: ${startAtDate.toISOString()}, getDay()=${startAtDate.getDay()}`);
      
      // 공통 모듈을 사용하여 반복 이벤트 슬롯 데이터 준비
      const slotsData = prepareRecurringSlots({
        calendarId,
        title: body.title,
        daysOfWeek: body.repeat.daysOfWeek,
        startMinutes: body.repeat.startMinutes,
        endMinutes: body.repeat.endMinutes,
        color: eventColor,
        participantNames: participantNames,
        eventStartDate: startAtDate,
      });
      
      console.log(`[API] 준비된 슬롯 데이터: ${slotsData.length}개`);
      slotsData.forEach((slot, idx) => {
        console.log(`  슬롯[${idx}]: dayOfWeek=${slot.dayOfWeek}, title="${slot.eventTitle}", startMinutes=${slot.startMinutes}, endMinutes=${slot.endMinutes}`);
      });
      
      // 각 슬롯을 데이터베이스에 저장
      for (const slotData of slotsData) {
        const { data, error } = await supabaseAdmin
          .from('RecurringSlot')
          .insert(slotData)
          .select();
        
        if (error) {
          console.error(`[API] 슬롯 저장 실패:`, error);
          throw error;
        }
        
        console.log(`[API] 슬롯 저장 성공: id=${data?.[0]?.id}, dayOfWeek=${slotData.dayOfWeek}`);
      }
      
      console.log(`[API: 반복 이벤트 생성 완료]\n`);
      
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
