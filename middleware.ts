import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/login", "/_next", "/favicon.ico", "/robots.txt", "/sitemap.xml", "/api/events"]; // GET은 미들웨어에서 허용

export function middleware(req: NextRequest) {
	const { pathname } = req.nextUrl;
	if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
		if (pathname.startsWith("/api/events") && req.method !== "GET") {
			// 이벤트 쓰기 요청은 보호
			return requireAuth(req);
		}
		return NextResponse.next();
	}
	return requireAuth(req);
}

function requireAuth(req: NextRequest) {
	const role = req.cookies.get("gbti_role")?.value; // "admin" | "user"
	if (role === "admin" || role === "user") return NextResponse.next();
	const url = req.nextUrl.clone();
	url.pathname = "/login";
	url.searchParams.set("redirect", req.nextUrl.pathname);
	return NextResponse.redirect(url);
}

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
