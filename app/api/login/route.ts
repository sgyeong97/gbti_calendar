import { NextRequest, NextResponse } from "next/server";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const USER_PASSWORD = process.env.USER_PASSWORD ?? "";

export async function POST(req: NextRequest) {
	const { password } = await req.json();
	let role: "admin" | "user" | null = null;
	if (password && ADMIN_PASSWORD && password === ADMIN_PASSWORD) role = "admin";
	else if (password && USER_PASSWORD && password === USER_PASSWORD) role = "user";

	if (!role) return NextResponse.json({ error: "Invalid password" }, { status: 401 });

	const res = NextResponse.json({ ok: true, role });
	res.cookies.set("gbti_role", role, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		path: "/",
		maxAge: 60 * 60 * 24 * 30,
	});
	return res;
}
