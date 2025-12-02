import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

type ParamsPromise = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: ParamsPromise) {
  const { id } = await ctx.params;
  
  const { data: slots, error } = await supabase
    .from('RecurringSlot')
    .select('*')
    .eq('calendarId', id)
    .order('dayOfWeek', { ascending: true });
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ slots });
}

export async function POST(req: NextRequest, ctx: ParamsPromise) {
  // 일반 사용자도 반복 이벤트 생성 가능
  const { id } = await ctx.params;
  const { dayOfWeek, startMinutes, endMinutes, eventTitle = "반복 이벤트" } = await req.json();
  const eventStartDate = new Date().toISOString();
  const startsOn = new Date().toISOString();
  
  const { data: slot, error } = await supabase
    .from('RecurringSlot')
    .insert({ 
      calendarId: id, 
      dayOfWeek, 
      startMinutes, 
      endMinutes, 
      eventTitle,
      eventStartDate,
      startsOn
    })
    .select()
    .single();
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ slot }, { status: 201 });
}

export async function PUT(req: NextRequest, ctx: ParamsPromise) {
  // 일반 사용자도 반복 이벤트 수정 가능 (자신이 참여한 이벤트만)
  const { id } = await ctx.params;
  const { eventTitle, newTitle, participants, startMinutes, endMinutes, days, color } = await req.json();
  
  // participantNames 업데이트 (null 또는 JSON 문자열)
  const participantNamesStr = participants && participants.length > 0 
    ? JSON.stringify(participants) 
    : null;
  
  // 업데이트할 필드 구성
  const updateData: any = {
    eventTitle: newTitle,
    participantNames: participantNamesStr
  };
  
  // 시간이 제공된 경우 업데이트
  if (startMinutes !== undefined) {
    updateData.startMinutes = startMinutes;
  }
  if (endMinutes !== undefined) {
    updateData.endMinutes = endMinutes;
  }
  
  // 색상이 제공된 경우 업데이트
  if (color !== undefined) {
    updateData.color = color;
  }
  
  // 같은 이벤트 제목을 가진 모든 슬롯 업데이트
  const { error } = await supabase
    .from('RecurringSlot')
    .update(updateData)
    .eq('calendarId', id)
    .eq('eventTitle', eventTitle);
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  // 요일이 제공된 경우: 기존 슬롯 삭제 후 새로 생성
  if (days && Array.isArray(days) && days.length > 0) {
    // 기존 슬롯 삭제
    const { error: deleteError } = await supabase
      .from('RecurringSlot')
      .delete()
      .eq('calendarId', id)
      .eq('eventTitle', newTitle);
    
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
    
    // 새로운 요일로 슬롯 생성
    const now = new Date();
    const startsOn = new Date(now);
    startsOn.setUTCHours(0, 0, 0, 0);
    
    for (const dayOfWeek of days) {
      const { error: insertError } = await supabase
        .from('RecurringSlot')
        .insert({
          calendarId: id,
          dayOfWeek,
          startMinutes: startMinutes !== undefined ? startMinutes : 0,
          endMinutes: endMinutes !== undefined ? endMinutes : 0,
          eventTitle: newTitle,
          eventStartDate: now.toISOString(),
          startsOn: startsOn.toISOString(),
          participantNames: participantNamesStr,
          color: color || "#FDC205" // 색상이 제공된 경우 사용, 없으면 기본 색상
        });
      
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }
  }
  
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: ParamsPromise) {
  // 일반 사용자도 반복 이벤트 삭제 가능 (자신이 참여한 이벤트만)
  const { id } = await ctx.params;
  const { slotId } = await req.json();
  
  const { error } = await supabase
    .from('RecurringSlot')
    .delete()
    .eq('id', slotId)
    .eq('calendarId', id);
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ ok: true });
}