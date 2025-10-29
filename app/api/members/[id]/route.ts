import { NextResponse } from "next/server";
import { readMembers, writeMembers, Member } from "@/app/lib/members-store";

type RouteContext = { params: { id: string } };

export async function PUT(req: Request, ctx: RouteContext) {
	const id = ctx.params.id;
	if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
	try {
		const patch = await req.json();
		const members = await readMembers();
		const idx = members.findIndex(m => m.id === id);
		if (idx === -1) return NextResponse.json({ error: "not found" }, { status: 404 });

		const current = members[idx];
		const updated: Member = {
			...current,
			name: patch?.name !== undefined ? String(patch.name) : current.name,
			platforms: patch?.platforms ? {
				discord: typeof patch.platforms.discord === "boolean" ? patch.platforms.discord : current.platforms.discord,
				notice: typeof patch.platforms.notice === "boolean" ? patch.platforms.notice : current.platforms.notice,
				chat: typeof patch.platforms.chat === "boolean" ? patch.platforms.chat : current.platforms.chat,
			} : current.platforms,
			status: patch?.status === "inactive" ? "inactive" : (patch?.status === "active" ? "active" : current.status),
			lastSeen: current.lastSeen,
			discordLink: patch?.discordLink === null || patch?.discordLink === "" ? undefined : (patch?.discordLink ?? current.discordLink),
			birthYear: typeof patch?.birthYear === "number" ? patch.birthYear : (patch?.birthYear === null ? undefined : current.birthYear),
		};

		members[idx] = updated;
		await writeMembers(members);
		return NextResponse.json(updated);
	} catch {
		return NextResponse.json({ error: "invalid request" }, { status: 400 });
	}
}

export async function DELETE(_req: Request, ctx: RouteContext) {
	const id = ctx.params.id;
	if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

	const members = await readMembers();
	const next = members.filter(m => m.id !== id);
	if (next.length === members.length) return NextResponse.json({ error: "not found" }, { status: 404 });

	await writeMembers(next);
	return NextResponse.json({ ok: true });
}
