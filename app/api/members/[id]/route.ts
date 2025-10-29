import { NextResponse, NextRequest } from "next/server";
import { supabase } from "@/app/lib/supabase";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

type RouteContext = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, ctx: RouteContext) {
    const { id } = await ctx.params;
	if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    function requireAdmin(req: NextRequest) {
        const role = req.cookies.get("gbti_role")?.value;
        if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
        return null;
    }

    const block = requireAdmin(req);
    if (block) return block;

    try {
        const patch = await req.json();
        const updates: any = { updatedat: new Date().toISOString() };
        if (patch?.name !== undefined) updates.name = String(patch.name);
        if (patch?.platforms) {
            if (typeof patch.platforms.discord === 'boolean') updates.discord = patch.platforms.discord;
            if (typeof patch.platforms.notice === 'boolean') updates.notice = patch.platforms.notice;
            if (typeof patch.platforms.chat === 'boolean') updates.chat = patch.platforms.chat;
        }
        if (patch?.status === 'active' || patch?.status === 'inactive') updates.status = patch.status;
        if (patch?.discordLink !== undefined) updates.discordlink = patch.discordLink || null;
        if (patch?.birthYear !== undefined) updates.birthyear = typeof patch.birthYear === 'number' ? patch.birthYear : null;

        const { data, error } = await supabaseAdmin
            .from('member')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        const updated = {
            id: data.id,
            name: data.name,
            platforms: { discord: !!data.discord, notice: !!data.notice, chat: !!data.chat },
            status: data.status === 'inactive' ? 'inactive' : 'active',
            lastSeen: data.lastseen ?? new Date().toISOString().slice(0,10),
            discordLink: data.discordlink ?? undefined,
            birthYear: typeof data.birthyear === 'number' ? data.birthyear : undefined,
        };
        return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: "invalid request", message: err?.message || String(err) }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
    const { id } = await ctx.params;
	if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    function requireAdmin() {
        // DELETE는 서버에서만 호출되며 admin만 허용
        return null;
    }
    const block = requireAdmin();
    if (block) return block as any;

    const { error } = await supabaseAdmin
        .from('member')
        .delete()
        .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}
