import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  
  // 간단한 비밀번호 체크 (실제로는 환경변수나 DB에서 관리)
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  
  if (password === adminPassword) {
    const response = NextResponse.json({ success: true });
    response.cookies.set("gbti_role", "admin", { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 // 24시간
    });
    return response;
  } else {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }
}
