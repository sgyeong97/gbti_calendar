import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

export async function POST(req: NextRequest) {
	const role = req.cookies.get("gbti_role")?.value;
	if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

	// Upsert 대체: 존재 여부 확인 후 없으면 생성
	const { data: existing } = await supabase
		.from('Calendar')
		.select('id')
		.eq('id', 'default')
		.single();

	if (!existing) {
		const { error } = await supabase
			.from('Calendar')
			.insert({ id: 'default', name: '기본 캘린더', color: '#4f46e5' });
		if (error) return NextResponse.json({ error: error.message }, { status: 500 });
	}

	return NextResponse.json({ calendar: { id: 'default' } });
}
