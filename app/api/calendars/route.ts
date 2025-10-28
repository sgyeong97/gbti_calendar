import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";

export async function GET() {
	const calendars = await prisma.calendar.findMany({
		include: { members: { include: { participant: true } }, recurringSlots: true },
		orderBy: { createdAt: "asc" },
	});
	return NextResponse.json({ calendars });
}

export async function POST(req: NextRequest) {
	const role = req.cookies.get("gbti_role")?.value;
	if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
	const body = await req.json();
	const cal = await prisma.calendar.create({ data: { name: body.name, color: body.color ?? "#4f46e5" } });
	return NextResponse.json({ calendar: cal }, { status: 201 });
}

export async function PUT(req: NextRequest) {
	const role = req.cookies.get("gbti_role")?.value;
	if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
	const { id, name, color } = await req.json();
	const cal = await prisma.calendar.update({ where: { id }, data: { name, color } });
	return NextResponse.json({ calendar: cal });
}
