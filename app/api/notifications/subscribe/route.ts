import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export const runtime = "nodejs";

// Table: PushSubscription (endpoint TEXT primary key, p256dh TEXT, auth TEXT, targets TEXT[], leads INT[], userAgent TEXT, timezone TEXT, createdAt TIMESTAMPTZ, updatedAt TIMESTAMPTZ)

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { subscription, targets, leads } = body as {
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
    targets?: string[];
    leads?: number[];
  };

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const userAgent = req.headers.get("user-agent") || "";
  let tz: string | undefined = undefined;
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone as string; } catch {}

  const payload = {
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    targets: (targets || []).slice(0, 3),
    leads: (leads || [30]).slice(0, 6),
    userAgent,
    timezone: tz,
    updatedAt: new Date().toISOString(),
  } as any;

  // upsert
  const { error } = await supabaseAdmin
    .from("PushSubscription")
    .upsert([{ ...payload, createdAt: new Date().toISOString() }], { onConflict: "endpoint" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}


