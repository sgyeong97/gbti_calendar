import { NextResponse } from "next/server";
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


