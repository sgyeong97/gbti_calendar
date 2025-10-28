import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || "";
  return NextResponse.json({ publicKey: pub });
}


