import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";

export async function POST(req: NextRequest) {
	const role = req.cookies.get("gbti_role")?.value;
	if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
	const cal = await prisma.calendar.upsert({
		where: { id: "default" },
		update: {},
		create: { id: "default", name: "기본 캘린더", color: "#4f46e5" },
	});
	return NextResponse.json({ calendar: cal });
}
