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
  const role = req.cookies.get("gbti_role")?.value;
  if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
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
  const role = req.cookies.get("gbti_role")?.value;
  if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
  const { id } = await ctx.params;
  const { eventTitle, newTitle, participants } = await req.json();
  
  // participantNames 업데이트 (null 또는 JSON 문자열)
  const participantNamesStr = participants && participants.length > 0 
    ? JSON.stringify(participants) 
    : null;
  
  const { error } = await supabase
    .from('RecurringSlot')
    .update({ 
      eventTitle: newTitle,
      participantNames: participantNamesStr
    })
    .eq('calendarId', id)
    .eq('eventTitle', eventTitle);
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: ParamsPromise) {
  const role = req.cookies.get("gbti_role")?.value;
  if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
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