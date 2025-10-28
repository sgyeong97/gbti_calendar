import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";
import type { Calendar } from "@/app/lib/types";

export async function GET() {
	// Fetch calendars with related data
	const { data: calendars, error } = await supabase
		.from('Calendar')
		.select('*, members:CalendarParticipant(participant:Participant(*)), recurringSlots:RecurringSlot(*)')
		.order('createdAt', { ascending: true });

	if (error) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}

	return NextResponse.json({ calendars });
}

export async function POST(req: NextRequest) {
	const role = req.cookies.get("gbti_role")?.value;
	if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
	const body = await req.json();
	const { data: cal, error } = await supabase
		.from('Calendar')
		.insert({ name: body.name, color: body.color ?? "#4f46e5" })
		.select()
		.single();
	
	if (error) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
	
	return NextResponse.json({ calendar: cal }, { status: 201 });
}

export async function PUT(req: NextRequest) {
	const role = req.cookies.get("gbti_role")?.value;
	if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
	const { id, name, color } = await req.json();
	const { data: cal, error } = await supabase
		.from('Calendar')
		.update({ name, color, updatedAt: new Date().toISOString() })
		.eq('id', id)
		.select()
		.single();
	
	if (error) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
	
	return NextResponse.json({ calendar: cal });
}
