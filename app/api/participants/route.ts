import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

export async function GET() {
	const { data: participants, error } = await supabase
		.from('Participant')
		.select('*')
		.order('name', { ascending: true });

	if (error) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}

	return NextResponse.json({ participants });
}

export async function POST(req: NextRequest) {
	const role = req.cookies.get("gbti_role")?.value;
	if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

	const { name, title, color } = await req.json();
	
	if (!name || !name.trim()) {
		return NextResponse.json({ error: "Name is required" }, { status: 400 });
	}

	const { data: participant, error } = await supabase
		.from('Participant')
		.insert({ 
			name: name.trim(),
			title: title?.trim() || null,
			color: color || "#e5e7eb"
		})
		.select()
		.single();

	if (error) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}

	return NextResponse.json({ participant }, { status: 201 });
}


