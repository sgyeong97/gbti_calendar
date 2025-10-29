import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

type ParamsPromise = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: ParamsPromise) {
	const role = req.cookies.get("gbti_role")?.value;
	if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
	
	const { id } = await ctx.params;
	const { name } = await req.json();
	
	if (!name || !name.trim()) {
		return NextResponse.json({ error: "Name is required" }, { status: 400 });
	}
	
	const { error } = await supabase
		.from('Participant')
		.update({ name: name.trim() })
		.eq('id', id);
	
	if (error) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
	
	return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: ParamsPromise) {
	const role = _req.cookies.get("gbti_role")?.value;
	if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
	
	const { id } = await ctx.params;
	
	const { error } = await supabase
		.from('Participant')
		.delete()
		.eq('id', id);
	
	if (error) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
	
	return NextResponse.json({ ok: true });
}

