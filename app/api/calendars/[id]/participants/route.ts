import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";

type ParamsPromise = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: ParamsPromise) {
	const role = req.cookies.get("gbti_role")?.value;
	if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
	const { id } = await ctx.params;
	const { participantName } = await req.json();
	const participant = await prisma.participant.upsert({
		where: { name: participantName },
		update: {},
		create: { name: participantName },
	});
	await prisma.calendarParticipant.upsert({
		where: { calendarId_participantId: { calendarId: id, participantId: participant.id } },
		update: {},
		create: { calendarId: id, participantId: participant.id },
	});
	return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: ParamsPromise) {
	const role = req.cookies.get("gbti_role")?.value;
	if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
	const { id } = await ctx.params;
	const { participantId } = await req.json();
	await prisma.calendarParticipant.delete({ where: { calendarId_participantId: { calendarId: id, participantId } } });
	return NextResponse.json({ ok: true });
}
