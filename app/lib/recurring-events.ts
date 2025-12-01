/**
 * 반복 이벤트 관련 공통 모듈
 * 
 * 이 모듈은 반복 이벤트의 생성, 확장, 필터링 등의 로직을 중앙화하여 관리합니다.
 */

// 요일 상수 (JavaScript getDay() 값)
export const DAY_OF_WEEK = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
} as const;

// 요일 한글 이름
export const DAY_NAMES_KO = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 요일 번호를 한글 이름으로 변환
 */
export function getDayNameKo(dayOfWeek: number): string {
  return DAY_NAMES_KO[dayOfWeek] || "?";
}

/**
 * 날짜 문자열을 로컬 날짜로 파싱 (타임존 무시)
 */
export function parseLocalDate(dateStr: string): Date {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  // 매칭 실패 시 일반 파싱 후 로컬 날짜로 정규화
  const date = new Date(dateStr);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * 날짜 범위 내의 모든 날짜 배열 생성 (로컬 날짜 기준)
 */
export function generateDateRange(startStr: string, endStr: string): Date[] {
  const startDate = parseLocalDate(startStr);
  const endDate = parseLocalDate(endStr);
  
  const days: Date[] = [];
  let currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endDateLocal = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  
  while (currentDate <= endDateLocal) {
    // 로컬 날짜로 명시적으로 생성하여 타임존 문제 방지
    const normalizedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    days.push(normalizedDate);
    // 다음 날로 이동 (로컬 날짜 기준)
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1);
  }
  
  return days;
}

/**
 * RecurringSlot 타입 정의
 */
export type RecurringSlot = {
  id: string;
  calendarId: string;
  dayOfWeek: number; // 0=일요일, 1=월요일, ..., 6=토요일
  startMinutes: number;
  endMinutes: number;
  startsOn: string;
  endsOn?: string | null;
  eventTitle: string;
  eventStartDate: string;
  participantNames?: string | null;
  color: string;
};

/**
 * 확장된 이벤트 타입 (expandRecurringSlots 결과)
 */
export type ExpandedEvent = {
  id: string;
  calendarId: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  participants: string[];
  color: string;
  isRecurring: boolean;
  recurringSlotId: string;
  recurringDays: number[];
  recurringStartMinutes: number;
  recurringEndMinutes: number;
};

/**
 * 반복 이벤트 슬롯을 실제 이벤트로 확장
 * 
 * @param slots 반복 이벤트 슬롯 배열
 * @param start 시작 날짜 (YYYY-MM-DD 형식, 선택)
 * @param end 종료 날짜 (YYYY-MM-DD 형식, 선택)
 * @returns 확장된 이벤트 배열
 */
export function expandRecurringSlots(
  slots: RecurringSlot[],
  start?: string,
  end?: string
): ExpandedEvent[] {
  // 날짜 범위 결정
  let startDate: Date;
  let endDate: Date;
  
  if (start) {
    startDate = parseLocalDate(start);
  } else {
    const now = new Date();
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  
  if (end) {
    endDate = parseLocalDate(end);
  } else {
    endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate());
  }
  
  // 날짜 배열 생성
  const days = generateDateRange(
    `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`,
    `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
  );
  
  const results: ExpandedEvent[] = [];
  
  for (const slot of slots) {
    // 각 날짜에 대해 요일이 일치하는지 확인
    for (const compareDay of days) {
      // 핵심: 선택한 요일(dayOfWeek)과 비교 날짜의 요일이 일치하는지 확인
      const slotDayOfWeek = slot.dayOfWeek;
      const compareDayOfWeek = compareDay.getDay();
      
      // 요일이 일치하지 않으면 스킵
      if (slotDayOfWeek !== compareDayOfWeek) continue;
      
      // endsOn 체크 (종료일 제한)
      let isWithinEndDate = true;
      if (slot.endsOn) {
        const endDateLocal = parseLocalDate(slot.endsOn);
        isWithinEndDate = compareDay <= endDateLocal;
      }
      
      if (!isWithinEndDate) continue;
      
      // 시간 설정 (분 단위를 시간:분으로 변환)
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
      
      // 참여자 파싱
      let participants: string[] = [];
      if (slot.participantNames) {
        try {
          const parsed = typeof slot.participantNames === 'string' 
            ? JSON.parse(slot.participantNames) 
            : slot.participantNames;
          participants = Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          console.warn('Failed to parse participantNames:', slot.participantNames, e);
          participants = [];
        }
      }
      
      // 동일 이벤트(제목+시간대)로 묶이는 모든 요일 수집
      const siblingSlots = slots.filter((s) =>
        s.calendarId === slot.calendarId &&
        s.eventTitle === slot.eventTitle &&
        s.startMinutes === slot.startMinutes &&
        s.endMinutes === slot.endMinutes
      );
      const recurringDays = Array.from(new Set(siblingSlots.map((s) => s.dayOfWeek))).sort((a, b) => a - b);
      
      // 확장된 이벤트 생성
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

/**
 * 반복 이벤트 생성 파라미터
 */
export type CreateRecurringEventParams = {
  calendarId: string;
  title: string;
  daysOfWeek: number[]; // JavaScript getDay() 값 배열 (0=일요일, 1=월요일, ...)
  startMinutes: number; // 시작 시간 (분 단위)
  endMinutes: number; // 종료 시간 (분 단위)
  color: string;
  participantNames?: string[];
  eventStartDate: Date; // 이벤트 시작 날짜 (참고용)
};

/**
 * 반복 이벤트 슬롯 생성 데이터 준비
 * 
 * @param params 반복 이벤트 생성 파라미터
 * @returns RecurringSlot insert 데이터 배열
 */
export function prepareRecurringSlots(params: CreateRecurringEventParams): Array<{
  calendarId: string;
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
  startsOn: string;
  eventTitle: string;
  eventStartDate: string;
  participantNames: string | null;
  color: string;
}> {
  const participantNamesStr = params.participantNames && params.participantNames.length > 0
    ? JSON.stringify(params.participantNames)
    : null;
  
  // startsOn을 과거 날짜로 설정하여 항상 표시되도록 함
  // 실제 반복은 dayOfWeek만으로 결정됨
  const startsOnISO = "1970-01-01T00:00:00.000Z";
  
  // eventStartDate를 로컬 날짜로 정규화
  const eventStartDateLocal = new Date(
    params.eventStartDate.getFullYear(),
    params.eventStartDate.getMonth(),
    params.eventStartDate.getDate()
  );
  
  return params.daysOfWeek.map((dow) => {
    console.log(`[RecurringSlot 생성] dayOfWeek: ${dow} (${getDayNameKo(dow)}), startsOn: ${startsOnISO}`);
    
    return {
      calendarId: params.calendarId,
      dayOfWeek: dow, // 핵심: 선택한 요일 그대로 저장
      startMinutes: params.startMinutes,
      endMinutes: params.endMinutes,
      startsOn: startsOnISO,
      eventTitle: params.title,
      eventStartDate: eventStartDateLocal.toISOString(),
      participantNames: participantNamesStr,
      color: params.color,
    };
  });
}

