import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

export async function POST(req: NextRequest) {
  const { userId, subscription } = await req.json();
  
  if (!userId || !subscription) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    // 기존 구독이 있으면 업데이트, 없으면 생성
    const { data: existing } = await supabase
      .from('PushSubscription')
      .select('id')
      .eq('userId', userId)
      .single();

    if (existing) {
      // 업데이트
      const { error } = await supabase
        .from('PushSubscription')
        .update({
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        })
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      // 생성
      const { error } = await supabase
        .from('PushSubscription')
        .insert({
          userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        });

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { userId } = await req.json();
  
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from('PushSubscription')
      .delete()
      .eq('userId', userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
