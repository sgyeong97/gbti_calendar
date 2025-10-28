import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

export async function POST(req: NextRequest) {
	const { slotId, eventStartDate } = await req.json();

	try {
		const { error } = await supabase
			.from('RecurringSlot')
			.update({ eventStartDate: new Date(eventStartDate).toISOString() })
			.eq('id', slotId);

		if (error) throw error;
		return NextResponse.json({ ok: true });
	} catch (error: any) {
		return NextResponse.json({ error: error.message || "Failed to update recurring slot" }, { status: 500 });
	}
}
