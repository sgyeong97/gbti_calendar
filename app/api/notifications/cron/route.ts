import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";
import { sendPushNotificationToUser } from "@/app/lib/push-notifications";

export async function GET(req: NextRequest) {
  console.log("Cron job started at:", new Date().toISOString());
  
  try {
    // KST(UTC+9) 기준으로 30분 후 ~ 35분 후 시작하는 이벤트를 조회
    const LEAD_MIN = 30;     // 알림 리드타임
    const WINDOW_MIN = 5;    // 조회 윈도우 폭

    // 현재 UTC 기준 milliseconds
    const nowUtcMs = Date.now();
    // KST 기준 '지금'의 UTC 시각 = UTC now - 9h (KST 벽시각을 UTC로 보정)
    const kstNowUtcMs = nowUtcMs - 9 * 60 * 60 * 1000;

    const startWindowUtc = new Date(kstNowUtcMs + LEAD_MIN * 60 * 1000);      // KST now + 30m (UTC 보정)
    const endWindowUtc = new Date(kstNowUtcMs + (LEAD_MIN + WINDOW_MIN) * 60 * 1000); // KST now + 35m (UTC 보정)

    const startTime = startWindowUtc.toISOString();
    const endTime = endWindowUtc.toISOString();
    
    const { data: events, error: eventsError } = await supabase
      .from('Event')
      .select('*, attendees:EventParticipant(participant:Participant(*))')
      .gte('startAt', startTime)
      .lte('startAt', endTime)
      .order('startAt', { ascending: true });

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
      return NextResponse.json({ error: eventsError.message }, { status: 500 });
    }

    // 반복 이벤트도 확인 (필요 시 동일 윈도우 사용)
    const { data: recurringSlots, error: slotsError } = await supabase
      .from('RecurringSlot')
      .select('*')
      .gte('startsOn', startTime)
      .lte('startsOn', endTime);

    if (slotsError) {
      console.error('Error fetching recurring slots:', slotsError);
    }

    let notificationsSent = 0;
    const errors = [];

    // 일반 이벤트 알림 발송
    for (const event of events || []) {
      const participants = (event.attendees || []).map((a: any) => a.participant.name);
      
      for (const participantName of participants) {
        try {
          const result = await sendPushNotificationToUser(participantName, {
            title: "이벤트 알림",
            body: `${event.title}이(가) 곧 시작됩니다!`,
            icon: "/favicon.ico",
            url: "/calendar"
          });
          
          if (result.success) {
            notificationsSent++;
            console.log(`Notification sent to ${participantName} for event ${event.title}`);
          } else {
            errors.push(`Failed to send to ${participantName}: ${result.error}`);
          }
        } catch (error: any) {
          errors.push(`Error sending to ${participantName}: ${error.message}`);
        }
      }
    }

    // 반복 이벤트 알림 발송
    for (const slot of recurringSlots || []) {
      try {
        const participantNames = slot.participantNames ? JSON.parse(slot.participantNames) : [];
        
        for (const participantName of participantNames) {
          try {
            const result = await sendPushNotificationToUser(participantName, {
              title: "반복 이벤트 알림",
              body: `${slot.eventTitle}이(가) 곧 시작됩니다!`,
              icon: "/favicon.ico",
              url: "/calendar"
            });
            
            if (result.success) {
              notificationsSent++;
              console.log(`Notification sent to ${participantName} for recurring event ${slot.eventTitle}`);
            } else {
              errors.push(`Failed to send to ${participantName}: ${result.error}`);
            }
          } catch (error: any) {
            errors.push(`Error sending to ${participantName}: ${error.message}`);
          }
        }
      } catch (error: any) {
        console.error('Error parsing participantNames:', error);
      }
    }

    console.log(`Cron job completed. Notifications sent: ${notificationsSent}, Errors: ${errors.length}`);
    
    return NextResponse.json({ 
      success: true, 
      timestamp: new Date().toISOString(),
      notificationsSent,
      errors: errors.slice(0, 10), // 최대 10개 에러만 반환
      eventsProcessed: (events || []).length,
      recurringSlotsProcessed: (recurringSlots || []).length
    });
    
  } catch (error: any) {
    console.error('Cron job failed:', error);
    return NextResponse.json({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}