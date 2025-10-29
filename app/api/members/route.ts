import { NextResponse } from "next/server";
import { readMembers, writeMembers, Member } from "@/app/lib/members-store";

export async function GET() {
	const members = await readMembers();
	return NextResponse.json(members);
}

export async function POST(req: Request) {
	try {
		const data = await req.json();
		const name: string | undefined = data?.name?.toString();
		if (!name || !name.trim()) {
			return NextResponse.json({ error: "name is required" }, { status: 400 });
		}

		const members = await readMembers();
		const newMember: Member = {
			id: (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)),
			name: name.trim(),
			platforms: data?.platforms ?? { discord: false, notice: false, chat: false },
			status: (data?.status === "inactive" ? "inactive" : "active"),
			lastSeen: new Date().toISOString().split("T")[0],
			discordLink: data?.discordLink || undefined,
			birthYear: typeof data?.birthYear === "number" ? data.birthYear : undefined,
		};

		members.push(newMember);
		await writeMembers(members);
		return NextResponse.json(newMember, { status: 201 });
	} catch (err) {
		return NextResponse.json({ error: "invalid request" }, { status: 400 });
	}
}
