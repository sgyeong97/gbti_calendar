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
      
      // Check if dayOfWeek matches and is within date range
      if (slot.dayOfWeek !== compareDay.getDay()) continue;
      
      let isWithinEndDate = true;
      if (slot.endsOn) {
        const endDate = new Date(slot.endsOn);
        const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        const dayDateOnly = new Date(compareDay.getFullYear(), compareDay.getMonth(), compareDay.getDate());
        isWithinEndDate = dayDateOnly <= endDateOnly;
      }
      
      if (compareDayDate < startsOnDate || !isWithinEndDate) continue;
      
      const startAt = new Date(compareDay);
      startAt.setHours(0, slot.startMinutes, 0, 0);
      const endAt = new Date(compareDay);
      endAt.setHours(0, slot.endMinutes, 0, 0);
      
      let participants: string[] = [];
      if (slot.participantNames) {
        participants = JSON.parse(slot.participantNames);
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

