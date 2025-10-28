import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";

type ParamsPromise = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: ParamsPromise) {
  const { id } = await ctx.params;
  const slots = await prisma.recurringSlot.findMany({ where: { calendarId: id }, orderBy: { dayOfWeek: "asc" } });
  return NextResponse.json({ slots });
}

export async function POST(req: NextRequest, ctx: ParamsPromise) {
  const role = req.cookies.get("gbti_role")?.value;
  if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
  const { id } = await ctx.params;
  const { dayOfWeek, startMinutes, endMinutes, eventTitle = "반복 이벤트" } = await req.json();
  const eventStartDate = new Date();
  const startsOn = new Date();
  const slot = await prisma.recurringSlot.create({ 
    data: { 
      calendarId: id, 
      dayOfWeek, 
      startMinutes, 
      endMinutes, 
      eventTitle,
      eventStartDate,
      startsOn
    } 
  });
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
  
  await prisma.recurringSlot.updateMany({
    where: { calendarId: id, eventTitle },
    data: { 
      eventTitle: newTitle,
      participantNames: participantNamesStr
    }
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: ParamsPromise) {
  const role = req.cookies.get("gbti_role")?.value;
  if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
  const { id } = await ctx.params;
  const { slotId } = await req.json();
  await prisma.recurringSlot.delete({ where: { id: slotId, calendarId: id } as any });
  return NextResponse.json({ ok: true });
}