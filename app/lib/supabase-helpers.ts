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

// 반복 이벤트 관련 함수는 app/lib/recurring-events.ts로 이동
// 하위 호환성을 위해 re-export
export { expandRecurringSlots, prepareRecurringSlots, getDayNameKo, DAY_OF_WEEK, DAY_NAMES_KO } from './recurring-events';
export type { RecurringSlot, ExpandedEvent, CreateRecurringEventParams } from './recurring-events';

