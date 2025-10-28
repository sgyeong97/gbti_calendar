import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
	const role = req.cookies.get("gbti_role")?.value ?? null;
	return NextResponse.json({ role });
}


