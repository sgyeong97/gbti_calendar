import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

type ParamsPromise = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: ParamsPromise) {
	const role = req.cookies.get("gbti_role")?.value;
	if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
	const { id } = await ctx.params;
	const { participantName } = await req.json();
	
	// Check if participant exists, otherwise create
	const { data: existingParticipant } = await supabase
		.from('Participant')
		.select('id')
		.eq('name', participantName)
		.single();
	
	let participantId: string;
	
	if (existingParticipant) {
		participantId = existingParticipant.id;
	} else {
		const { data: newParticipant, error: participantError } = await supabase
			.from('Participant')
			.insert({ name: participantName })
			.select('id')
			.single();
		
		if (participantError) {
			return NextResponse.json({ error: participantError.message }, { status: 500 });
		}
		participantId = newParticipant.id;
	}
	
	// Check if relationship exists, otherwise create
	const { error: linkError } = await supabase
		.from('CalendarParticipant')
		.upsert({ calendarId: id, participantId }, { onConflict: 'calendarId,participantId' });
	
	if (linkError) {
		return NextResponse.json({ error: linkError.message }, { status: 500 });
	}
	
	return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: ParamsPromise) {
	const role = req.cookies.get("gbti_role")?.value;
	if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
	const { id } = await ctx.params;
	const { participantId } = await req.json();
	
	const { error } = await supabase
		.from('CalendarParticipant')
		.delete()
		.eq('calendarId', id)
		.eq('participantId', participantId);
	
	if (error) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
	
	return NextResponse.json({ ok: true });
}
