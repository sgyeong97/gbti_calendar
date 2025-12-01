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
  const startDate = start ? new Date(start) : new Date();
  const endDate = end ? new Date(end) : new Date(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate());
  const days: Date[] = [];
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  
  const results: any[] = [];
  for (const slot of slots) {
    const day = new Date(slot.startsOn);
    const startsOnDate = new Date(day);
    startsOnDate.setHours(0, 0, 0, 0);
    
    for (const compareDay of days) {
      const compareDayDate = new Date(compareDay);
      compareDayDate.setHours(0, 0, 0, 0);
      
      // slot.dayOfWeek는 JavaScript getDay() 값 (0=일요일, 1=월요일, ..., 6=토요일)
      // compareDay.getDay()도 같은 형식이므로 직접 비교
      if (slot.dayOfWeek !== compareDay.getDay()) continue;
      
      let isWithinEndDate = true;
      if (slot.endsOn) {
        const endDate = new Date(slot.endsOn);
        const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        const dayDateOnly = new Date(compareDay.getFullYear(), compareDay.getMonth(), compareDay.getDate());
        isWithinEndDate = dayDateOnly <= endDateOnly;
      }
      
      if (compareDayDate < startsOnDate || !isWithinEndDate) continue;
      
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

