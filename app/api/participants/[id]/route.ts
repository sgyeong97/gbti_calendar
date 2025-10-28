import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";

type ParamsPromise = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, ctx: ParamsPromise) {
	const role = _req.cookies.get("gbti_role")?.value;
	if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
	
	const { id } = await ctx.params;
	
	await prisma.participant.delete({ where: { id } });
	
	return NextResponse.json({ ok: true });
}

