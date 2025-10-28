import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
	const { pathname } = req.nextUrl;

	// /admin 보호: 쿠키 gbti_role=admin 만 통과
	if (pathname.startsWith("/admin")) {
		const role = req.cookies.get("gbti_role")?.value;
		if (role !== "admin") {
			const url = new URL("/login", req.url);
			url.searchParams.set("redirect", pathname);
			return NextResponse.redirect(url);
		}
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
