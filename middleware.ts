import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
	// 모든 경로에 대해 인증 없이 접근 허용
	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
