import { supabase } from './supabase';

// Helper function to upsert participant and return ID
export async function getOrCreateParticipant(name: string): Promise<string> {
  const { data: existing } = await supabase
    .from('Participant')
    .select('id')
    .eq('name', name)
    .single();
  
  if (existing) return existing.id;
  
  const { data: created, error } = await supabase
    .from('Participant')
    .insert({ name })
    .select('id')
    .single();
  
  if (error) throw error;
  return created.id;
}

// Helper to link participant to calendar
export async function linkParticipantToCalendar(calendarId: string, participantId: string): Promise<void> {
  const { error } = await supabase
    .from('CalendarParticipant')
    .upsert({ calendarId, participantId }, { onConflict: 'calendarId,participantId' });
  
  if (error) throw error;
}

// Helper to expand recurring slots into events
export function expandRecurringSlots(slots: any[], start?: string, end?: string) {
  // start와 end를 로컬 날짜로 파싱 (타임존 무시)
  let startDate: Date;
  let endDate: Date;
  
  if (start) {
    const startMatch = start.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (startMatch) {
      const [, year, month, day] = startMatch;
      startDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } else {
      startDate = new Date(start);
      startDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    }
  } else {
    const now = new Date();
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  
  if (end) {
    const endMatch = end.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (endMatch) {
      const [, year, month, day] = endMatch;
      endDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } else {
      endDate = new Date(end);
      endDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    }
  } else {
    endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate());
  }
  
  // 날짜 배열 생성: 각 날짜를 로컬 날짜로 정규화하여 타임존 문제 방지
  const days: Date[] = [];
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    // 로컬 날짜로 정규화하여 타임존 문제 방지
    const normalizedDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    days.push(normalizedDate);
  }
  
  const results: any[] = [];
  for (const slot of slots) {
    // startsOn을 로컬 날짜로 파싱 (타임존 무시)
    // ISO 문자열에서 날짜 부분만 추출하여 로컬 날짜로 변환
    const startsOnStr = slot.startsOn;
    const startsOnMatch = startsOnStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!startsOnMatch) continue;
    const [, year, month, day] = startsOnMatch;
    const startsOnLocal = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    for (const compareDay of days) {
      // days 배열의 각 날짜는 이미 로컬 날짜로 정규화되어 있음
      // slot.dayOfWeek는 JavaScript getDay() 값 (0=일요일, 1=월요일, ..., 6=토요일)
      // 핵심: 선택한 요일(dayOfWeek)과 비교 날짜의 요일이 일치하는지 확인
      const slotDayOfWeek = slot.dayOfWeek;
      const compareDayOfWeek = compareDay.getDay();
      
      // 디버깅: 월요일(1) 슬롯과 12월 1일 주변 날짜만 로그 출력
      if (slotDayOfWeek === 1 && compareDay.getMonth() === 11 && compareDay.getDate() <= 7) {
        console.log(`[expandRecurringSlots] slot.dayOfWeek: ${slotDayOfWeek} (${['일','월','화','수','목','금','토'][slotDayOfWeek]}), compareDay: ${compareDay.getFullYear()}-${String(compareDay.getMonth() + 1).padStart(2, '0')}-${String(compareDay.getDate()).padStart(2, '0')} (${['일','월','화','수','목','금','토'][compareDayOfWeek]}), 매칭: ${slotDayOfWeek === compareDayOfWeek}, slot.title: ${slot.eventTitle}`);
      }
      
      // 핵심 로직: 선택한 요일과 비교 날짜의 요일이 일치해야 함
      if (slotDayOfWeek !== compareDayOfWeek) continue;
      
      let isWithinEndDate = true;
      if (slot.endsOn) {
        const endDateStr = slot.endsOn;
        const endDateMatch = endDateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (endDateMatch) {
          const [, year, month, day] = endDateMatch;
          const endDateLocal = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          isWithinEndDate = compareDay <= endDateLocal;
        }
      }
      
      // startsOn 이후의 날짜만 표시
      if (compareDay < startsOnLocal || !isWithinEndDate) continue;
      
      // 타임존 문제 해결: 날짜는 로컬 기준으로 유지하고, 시간만 분 단위로 설정
      // slot.startMinutes는 분 단위 (예: 21:00 = 1260분)
      const startAt = new Date(compareDay);
      const startHours = Math.floor(slot.startMinutes / 60);
      const startMins = slot.startMinutes % 60;
      startAt.setHours(startHours, startMins, 0, 0);
      
      const endAt = new Date(compareDay);
      const endHours = Math.floor(slot.endMinutes / 60);
      const endMins = slot.endMinutes % 60;
      endAt.setHours(endHours, endMins, 0, 0);
      
      // 종료 시간이 시작 시간보다 작으면 다음날로 넘어가는 경우
      if (slot.endMinutes < slot.startMinutes) {
        endAt.setDate(endAt.getDate() + 1);
      }
      
      let participants: string[] = [];
      if (slot.participantNames) {
        try {
          const parsed = typeof slot.participantNames === 'string' ? JSON.parse(slot.participantNames) : slot.participantNames;
          participants = Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          console.warn('Failed to parse participantNames:', slot.participantNames, e);
          participants = [];
        }
      }
      
      // 동일 이벤트(제목+시간대)로 묶이는 모든 요일 수집
      const siblingSlots = (slots || []).filter((s: any) =>
        s.calendarId === slot.calendarId &&
        s.eventTitle === slot.eventTitle &&
        s.startMinutes === slot.startMinutes &&
        s.endMinutes === slot.endMinutes
      );
      const recurringDays = Array.from(new Set(siblingSlots.map((s: any) => s.dayOfWeek))).sort();

      results.push({
        id: `R-${slot.calendarId}-${compareDay.toISOString()}-${slot.id}`,
        calendarId: slot.calendarId,
        title: slot.eventTitle,
        description: null,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        allDay: false,
        participants,
        color: slot.color,
        // Admin UI가 대표로 묶을 수 있도록 메타데이터 제공
        isRecurring: true,
        recurringSlotId: slot.id,
        recurringDays,
        recurringStartMinutes: slot.startMinutes,
        recurringEndMinutes: slot.endMinutes,
      });
    }
  }
  
  return results;
}

