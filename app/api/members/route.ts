import { NextResponse, NextRequest } from "next/server";
import { supabase } from "@/app/lib/supabase";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

type Member = {
    id: string;
    name: string;
    platforms: { discord: boolean; notice: boolean; chat: boolean };
    status: "active" | "inactive";
    lastSeen: string;
    discordLink?: string;
    birthYear?: number;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
	const { data, error } = await supabase
		.from('member')
		.select('*')
		.order('name', { ascending: true });
	if (error) return NextResponse.json({ error: error.message }, { status: 500 });

	const members: Member[] = (data || []).map((r: any) => ({
		id: r.id,
		name: r.name,
		platforms: { discord: !!r.discord, notice: !!r.notice, chat: !!r.chat },
		status: r.status === 'inactive' ? 'inactive' : 'active',
		lastSeen: r.lastseen ?? new Date().toISOString().split('T')[0],
		discordLink: r.discordlink ?? undefined,
		birthYear: typeof r.birthyear === 'number' ? r.birthyear : undefined,
	}));
	return NextResponse.json(members);
}

export async function POST(req: NextRequest) {
	function requireAdmin(req: NextRequest) {
		const role = req.cookies.get("gbti_role")?.value;
		if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
		return null;
	}

	const block = requireAdmin(req);
	if (block) return block;

	try {
		const body = await req.json();
		const name: string | undefined = body?.name?.toString();
		if (!name || !name.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

		const insert = {
			name: name.trim(),
			discord: !!body?.platforms?.discord,
			notice: !!body?.platforms?.notice,
			chat: !!body?.platforms?.chat,
			status: body?.status === 'inactive' ? 'inactive' : 'active',
			lastseen: new Date().toISOString().slice(0,10),
			discordlink: body?.discordLink || null,
			birthyear: typeof body?.birthYear === 'number' ? body.birthYear : null,
		};

		const { data, error } = await supabaseAdmin
			.from('member')
			.insert(insert)
			.select()
			.single();
		if (error) return NextResponse.json({ error: error.message }, { status: 500 });

		const created: Member = {
			id: data.id,
			name: data.name,
			platforms: { discord: !!data.discord, notice: !!data.notice, chat: !!data.chat },
			status: data.status === 'inactive' ? 'inactive' : 'active',
			lastSeen: data.lastseen ?? new Date().toISOString().slice(0,10),
			discordLink: data.discordlink ?? undefined,
			birthYear: typeof data.birthyear === 'number' ? data.birthyear : undefined,
		};
		return NextResponse.json(created, { status: 201 });
	} catch (err: any) {
		return NextResponse.json({ error: "invalid request", message: err?.message || String(err) }, { status: 400 });
	}
}
