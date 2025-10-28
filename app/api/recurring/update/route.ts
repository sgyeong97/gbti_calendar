import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";

export async function POST(req: NextRequest) {
	const { slotId, eventStartDate } = await req.json();

	try {
		await prisma.recurringSlot.update({
			where: { id: slotId },
			data: { eventStartDate: new Date(eventStartDate) },
		});
		return NextResponse.json({ ok: true });
	} catch (error) {
		return NextResponse.json({ error: "Failed to update recurring slot" }, { status: 500 });
	}
}
