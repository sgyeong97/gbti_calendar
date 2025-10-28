import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import webpush from "web-push";

export const runtime = "nodejs"; // web-push는 Edge에서 동작하지 않음

function minutes(ms: number) { return Math.floor(ms / 60000); }

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const origin = `${url.protocol}//${url.host}`;

  const pub = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return NextResponse.json({ error: "VAPID keys missing" }, { status: 500 });

  webpush.setVapidDetails(`mailto:no-reply@${url.host}`, pub, priv!);

  const now = new Date();
  const windowMin = 5; // send notifications for triggers in next 5 minutes
  const nowMs = now.getTime();

  // Load subscriptions
  const { data: subs, error } = await supabaseAdmin.from("PushSubscription").select("endpoint,p256dh,auth,targets,leads");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!subs || subs.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  // Fetch events for today+1 day (rough window)
  const startStr = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0,10);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1);
  const endStr = end.toISOString().slice(0,10);
  const eventsRes = await fetch(`${origin}/api/events?start=${startStr}&end=${endStr}`);
  const eventsJson = await eventsRes.json();
  const events = (eventsJson.events || []) as Array<{ id:string; title:string; startAt:string; participants?:string[] }>; 

  let sent = 0;
  for (const sub of subs) {
    const targets = new Set((sub.targets || []) as string[]);
    const leads = ((sub.leads || [30]) as number[]).filter((m) => m > 0).slice(0, 6);
    if (targets.size === 0 || leads.length === 0) continue;

    for (const ev of events) {
      if (!ev.participants || ev.participants.length === 0) continue;
      const has = ev.participants.some((p) => targets.has(p));
      if (!has) continue;
      const startMs = new Date(ev.startAt).getTime();
      for (const m of leads) {
        const triggerMs = startMs - m * 60000;
        const diffMin = minutes(triggerMs - nowMs);
        if (diffMin >= 0 && diffMin < windowMin) {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              } as any,
              JSON.stringify({
                title: `${ev.title} (${new Date(ev.startAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})})`,
                body: `${m}분 후 시작합니다`,
                url: `${origin}/calendar`,
              })
            );
            sent++;
          } catch (err) {
            // On gone subscriptions, delete
            if ((err as any)?.statusCode === 410 || (err as any)?.statusCode === 404) {
              await supabaseAdmin.from("PushSubscription").delete().eq("endpoint", sub.endpoint);
            }
          }
        }
      }
    }
  }

  return NextResponse.json({ ok: true, sent });
}


