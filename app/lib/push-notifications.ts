import webpush from 'web-push';

// VAPID 키 설정 (환경변수에서 가져오기)
const vapidKeys = {
  publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  privateKey: process.env.VAPID_PRIVATE_KEY || '',
};

if (vapidKeys.publicKey && vapidKeys.privateKey) {
  webpush.setVapidDetails(
    'mailto:your-email@example.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export async function sendPushNotification(
  subscription: PushSubscription,
  payload: {
    title: string;
    body: string;
    icon?: string;
    url?: string;
  }
) {
  try {
    const result = await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { success: true, result };
  } catch (error: any) {
    console.error('Push notification failed:', error);
    return { success: false, error: error.message };
  }
}

export async function sendPushNotificationToUser(
  userId: string,
  payload: {
    title: string;
    body: string;
    icon?: string;
    url?: string;
  }
) {
  // Supabase에서 사용자의 구독 정보 가져오기
  const { supabase } = await import('@/app/lib/supabase');
  
  const { data: subscriptions, error } = await supabase
    .from('PushSubscription')
    .select('*')
    .eq('userId', userId);

  if (error || !subscriptions || subscriptions.length === 0) {
    return { success: false, error: 'No subscription found' };
  }

  const results = [];
  for (const sub of subscriptions) {
    const subscription: PushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    };

    const result = await sendPushNotification(subscription, payload);
    results.push(result);
  }

  return { success: true, results };
}
