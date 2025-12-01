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
 * UI 순서(일,월,화,수,목,금,토)를 JavaScript getDay() 값으로 매핑
 * UI 인덱스 0(일) → getDay() 0(일요일)
 * UI 인덱스 1(월) → getDay() 1(월요일)
 * ...
 */
export function getDayOfWeekFromUIIndex(uiIndex: number): number {
  const mapping = [0, 1, 2, 3, 4, 5, 6]; // 일(0)→0, 월(1)→1, ..., 토(6)→6
  return mapping[uiIndex] ?? uiIndex;
}

/**
 * 요일 Set을 토글 (선택/해제)
 * @param days 현재 선택된 요일 Set
 * @param dayOfWeek 토글할 요일 (JavaScript getDay() 값: 0=일, 1=월, ..., 6=토)
 * @param enableDebug 디버깅 로그 출력 여부
 * @returns 새로운 요일 Set
 */
export function toggleDayOfWeek(
  days: Set<number>,
  dayOfWeek: number,
  enableDebug: boolean = true
): Set<number> {
  const next = new Set(days);
  const wasSelected = next.has(dayOfWeek);
  
  if (wasSelected) {
    next.delete(dayOfWeek);
  } else {
    next.add(dayOfWeek);
  }
  
  if (enableDebug) {
    const selectedDays = Array.from(next).sort();
    console.log(
      `[toggleDayOfWeek] ${getDayNameKo(dayOfWeek)} (${dayOfWeek}) → ${wasSelected ? '해제됨' : '선택됨'}, ` +
      `현재 선택된 요일: [${selectedDays.map(d => `${d}(${getDayNameKo(d)})`).join(', ')}]`
    );
  }
  
  return next;
}

/**
 * 요일 배열을 정렬하고 검증
 * @param daysOfWeek 요일 배열 (JavaScript getDay() 값)
 * @returns 정렬된 요일 배열
 */
export function normalizeDaysOfWeek(daysOfWeek: number[]): number[] {
  const unique = Array.from(new Set(daysOfWeek));
  const sorted = unique.sort((a, b) => a - b);
  
  // 유효성 검증 (0-6 범위)
  const valid = sorted.filter(d => d >= 0 && d <= 6);
  
  if (valid.length !== sorted.length) {
    console.warn(`[normalizeDaysOfWeek] 유효하지 않은 요일 값 제거: ${sorted.filter(d => d < 0 || d > 6).join(', ')}`);
  }
  
  return valid;
}

/**
 * 반복 요일 정보를 디버깅용 문자열로 변환
 */
export function formatDaysOfWeekForDebug(daysOfWeek: number[]): string {
  return `[${daysOfWeek.map(d => `${d}(${getDayNameKo(d)})`).join(', ')}]`;
}

/**
 * 반복 이벤트 생성 파라미터 검증 및 디버깅 로그 출력
 */
export function debugRecurringEventCreation(params: {
  title: string;
  startAt: Date;
  endAt: Date;
  daysOfWeek: number[];
  startMinutes: number;
  endMinutes: number;
}): void {
  const dayNames = DAY_NAMES_KO;
  const normalizedDays = normalizeDaysOfWeek(params.daysOfWeek);
  
  console.log(`\n========== [반복 이벤트 생성 디버깅] ==========`);
  console.log(`제목: "${params.title}"`);
  console.log(`시작 시간: ${params.startAt.toISOString()}, getDay()=${params.startAt.getDay()} (${dayNames[params.startAt.getDay()]})`);
  console.log(`종료 시간: ${params.endAt.toISOString()}, getDay()=${params.endAt.getDay()} (${dayNames[params.endAt.getDay()]})`);
  console.log(`시작 분: ${params.startMinutes} (${Math.floor(params.startMinutes / 60)}:${String(params.startMinutes % 60).padStart(2, '0')})`);
  console.log(`종료 분: ${params.endMinutes} (${Math.floor(params.endMinutes / 60)}:${String(params.endMinutes % 60).padStart(2, '0')})`);
  console.log(`선택된 요일: ${formatDaysOfWeekForDebug(normalizedDays)}`);
  console.log(`========================================\n`);
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
  console.log(`[generateDateRange] 입력: startStr="${startStr}", endStr="${endStr}"`);
  
  const startDate = parseLocalDate(startStr);
  const endDate = parseLocalDate(endStr);
  
  console.log(`[generateDateRange] 파싱 결과: startDate=${startDate.toISOString()}, getDay()=${startDate.getDay()} (${getDayNameKo(startDate.getDay())})`);
  console.log(`[generateDateRange] 파싱 결과: endDate=${endDate.toISOString()}, getDay()=${endDate.getDay()} (${getDayNameKo(endDate.getDay())})`);
  
  const days: Date[] = [];
  let currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endDateLocal = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  
  let iterationCount = 0;
  while (currentDate <= endDateLocal) {
    // 로컬 날짜로 명시적으로 생성하여 타임존 문제 방지
    const normalizedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    
    // 처음 3개와 마지막 3개만 상세 로그
    if (iterationCount < 3 || days.length === 0) {
      const dateStr = `${normalizedDate.getFullYear()}-${String(normalizedDate.getMonth() + 1).padStart(2, '0')}-${String(normalizedDate.getDate()).padStart(2, '0')}`;
      console.log(`[generateDateRange] 날짜 추가[${iterationCount}]: ${dateStr}, getDay()=${normalizedDate.getDay()} (${getDayNameKo(normalizedDate.getDay())}), ISO=${normalizedDate.toISOString()}`);
    }
    
    days.push(normalizedDate);
    // 다음 날로 이동 (로컬 날짜 기준)
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1);
    iterationCount++;
    
    // 무한 루프 방지
    if (iterationCount > 1000) {
      console.error(`[generateDateRange] 경고: 1000번 이상 반복됨. 루프 중단.`);
      break;
    }
  }
  
  console.log(`[generateDateRange] 완료: 총 ${days.length}개 날짜 생성`);
  
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
  console.log(`\n========== [expandRecurringSlots 시작] ==========`);
  console.log(`입력 파라미터: start=${start || '없음'}, end=${end || '없음'}, slots.length=${slots.length}`);
  
  // 날짜 범위 결정
  let startDate: Date;
  let endDate: Date;
  
  if (start) {
    startDate = parseLocalDate(start);
    console.log(`[날짜 파싱] start="${start}" → startDate: ${startDate.toISOString()}, getDay()=${startDate.getDay()} (${getDayNameKo(startDate.getDay())})`);
  } else {
    const now = new Date();
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    console.log(`[날짜 파싱] start 없음 → 오늘 날짜 사용: ${startDate.toISOString()}, getDay()=${startDate.getDay()} (${getDayNameKo(startDate.getDay())})`);
  }
  
  if (end) {
    endDate = parseLocalDate(end);
    console.log(`[날짜 파싱] end="${end}" → endDate: ${endDate.toISOString()}, getDay()=${endDate.getDay()} (${getDayNameKo(endDate.getDay())})`);
  } else {
    endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate());
    console.log(`[날짜 파싱] end 없음 → 한 달 후: ${endDate.toISOString()}, getDay()=${endDate.getDay()} (${getDayNameKo(endDate.getDay())})`);
  }
  
  // 날짜 배열 생성
  const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
  const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
  console.log(`[날짜 범위] generateDateRange 호출: "${startStr}" ~ "${endStr}"`);
  
  const days = generateDateRange(startStr, endStr);
  console.log(`[날짜 배열] 생성된 날짜 수: ${days.length}개`);
  
  // 날짜 배열의 처음 5개와 마지막 5개 출력
  if (days.length > 0) {
    console.log(`[날짜 배열 샘플] 처음 5개:`);
    days.slice(0, 5).forEach((d, idx) => {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      console.log(`  [${idx}] ${dateStr}: getDay()=${d.getDay()} (${getDayNameKo(d.getDay())}), ISO=${d.toISOString()}`);
    });
    if (days.length > 10) {
      console.log(`[날짜 배열 샘플] 마지막 5개:`);
      days.slice(-5).forEach((d, idx) => {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        console.log(`  [${days.length - 5 + idx}] ${dateStr}: getDay()=${d.getDay()} (${getDayNameKo(d.getDay())}), ISO=${d.toISOString()}`);
      });
    }
  }
  
  const results: ExpandedEvent[] = [];
  
  // 슬롯 정보 출력
  if (slots.length > 0) {
    console.log(`\n[슬롯 정보] 총 ${slots.length}개 슬롯:`);
    slots.forEach((slot, idx) => {
      console.log(`  슬롯[${idx}]: id=${slot.id}, dayOfWeek=${slot.dayOfWeek} (${getDayNameKo(slot.dayOfWeek)}), title="${slot.eventTitle}", startMinutes=${slot.startMinutes}, endMinutes=${slot.endMinutes}`);
    });
  }
  
  // 각 슬롯에 대해 날짜 배열을 순회하며 이벤트 생성
  for (const slot of slots) {
    console.log(`\n[슬롯 처리 시작] slot.id=${slot.id}, dayOfWeek=${slot.dayOfWeek} (${getDayNameKo(slot.dayOfWeek)}), title="${slot.eventTitle}"`);
    let matchCount = 0;
    
    for (const compareDay of days) {
      const slotDayOfWeek = slot.dayOfWeek;
      const compareDayOfWeek = compareDay.getDay();
      const dateStr = `${compareDay.getFullYear()}-${String(compareDay.getMonth() + 1).padStart(2, '0')}-${String(compareDay.getDate()).padStart(2, '0')}`;
      const isMatch = slotDayOfWeek === compareDayOfWeek;
      
      // 디버깅: 매칭되는 경우와 12월 1일 주변 날짜 상세 로그
      const shouldLog = isMatch || (compareDay.getMonth() === 11 && compareDay.getDate() <= 7);
      
      if (shouldLog) {
        console.log(`  [날짜 비교] ${dateStr}: slot.dayOfWeek=${slotDayOfWeek} (${getDayNameKo(slotDayOfWeek)}) vs compareDay.getDay()=${compareDayOfWeek} (${getDayNameKo(compareDayOfWeek)}) → ${isMatch ? '✓ 매칭' : '✗ 불일치'}`);
      }
      
      // 핵심: 요일이 정확히 일치해야만 이벤트 생성
      if (slotDayOfWeek !== compareDayOfWeek) continue;
      
      matchCount++;
      
      // endsOn 체크 (종료일 제한)
      let isWithinEndDate = true;
      if (slot.endsOn) {
        const endDateLocal = parseLocalDate(slot.endsOn);
        isWithinEndDate = compareDay <= endDateLocal;
        if (!isWithinEndDate && shouldLog) {
          console.log(`  [종료일 체크] ${dateStr}: endsOn=${slot.endsOn} 이후이므로 제외`);
        }
      }
      
      if (!isWithinEndDate) continue;
      
      // 시간 설정 (분 단위를 시간:분으로 변환)
      // 중요: compareDay는 이미 로컬 날짜로 정규화되어 있으므로, 시간만 추가
      // 타임존 문제 방지: 로컬 시간으로 생성한 후 ISO 문자열로 변환
      const startHour = Math.floor(slot.startMinutes / 60);
      const startMin = slot.startMinutes % 60;
      const endHour = Math.floor(slot.endMinutes / 60);
      const endMin = slot.endMinutes % 60;
      
      // 반복 이벤트는 날짜만 중요하므로, compareDay의 날짜를 그대로 사용하여 ISO 문자열 생성
      // toISOString()을 사용하면 타임존 변환으로 날짜가 변경될 수 있으므로,
      // 날짜 부분을 직접 구성하여 타임존 변환 문제를 완전히 방지
      
      // 종료 시간이 시작 시간보다 작으면 다음날로 넘어가는 경우
      const endDateStr = slot.endMinutes < slot.startMinutes
        ? (() => {
            const nextDay = new Date(compareDay);
            nextDay.setDate(nextDay.getDate() + 1);
            return `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
          })()
        : dateStr; // 같은 날이면 compareDay의 날짜 사용
      
      // 날짜 부분을 직접 구성하여 ISO 문자열 생성 (타임존 변환 없음)
      // compareDay의 날짜를 그대로 사용하여 정확한 날짜 보장
      const finalStartAtISO = `${dateStr}T${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00.000Z`;
      const finalEndAtISO = `${endDateStr}T${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00.000Z`;
      
      // 검증: 생성된 ISO 문자열을 파싱했을 때 날짜가 변경되는지 확인
      const verifyStartDate = new Date(finalStartAtISO);
      const verifyStartDateStr = `${verifyStartDate.getFullYear()}-${String(verifyStartDate.getMonth() + 1).padStart(2, '0')}-${String(verifyStartDate.getDate()).padStart(2, '0')}`;
      
      if (dateStr !== verifyStartDateStr) {
        console.error(`  [오류] ISO 문자열 파싱 시 날짜 변경! 원본: ${dateStr}, 파싱 후: ${verifyStartDateStr}`);
        console.error(`    finalStartAtISO: ${finalStartAtISO}, verifyStartDate: ${verifyStartDate.toLocaleString('ko-KR')}`);
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
      const eventId = `R-${slot.calendarId}-${dateStr}T00:00:00.000Z-${slot.id}`;
      
      if (shouldLog) {
        console.log(`  [이벤트 생성] id=${eventId}, date=${dateStr}, startAt=${finalStartAtISO}, endAt=${finalEndAtISO}`);
      }
      
      results.push({
        id: eventId,
        calendarId: slot.calendarId,
        title: slot.eventTitle,
        description: null,
        startAt: finalStartAtISO,
        endAt: finalEndAtISO,
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
    
    console.log(`[슬롯 처리 완료] slot.id=${slot.id}: ${matchCount}개 이벤트 생성됨`);
  }
  
  console.log(`\n========== [expandRecurringSlots 완료] ==========`);
  console.log(`총 ${results.length}개 이벤트 생성됨\n`);
  
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
  
  console.log(`\n========== [prepareRecurringSlots 시작] ==========`);
  console.log(`입력 파라미터:`);
  console.log(`  calendarId: ${params.calendarId}`);
  console.log(`  title: "${params.title}"`);
  console.log(`  daysOfWeek: [${params.daysOfWeek.join(', ')}] → [${params.daysOfWeek.map(d => `${d}(${getDayNameKo(d)})`).join(', ')}]`);
  console.log(`  startMinutes: ${params.startMinutes} (${Math.floor(params.startMinutes / 60)}:${String(params.startMinutes % 60).padStart(2, '0')})`);
  console.log(`  endMinutes: ${params.endMinutes} (${Math.floor(params.endMinutes / 60)}:${String(params.endMinutes % 60).padStart(2, '0')})`);
  console.log(`  eventStartDate: ${params.eventStartDate.toISOString()}, getDay()=${params.eventStartDate.getDay()} (${getDayNameKo(params.eventStartDate.getDay())})`);
  console.log(`  eventStartDateLocal: ${eventStartDateLocal.toISOString()}, getDay()=${eventStartDateLocal.getDay()} (${getDayNameKo(eventStartDateLocal.getDay())})`);
  
  const slots = params.daysOfWeek.map((dow) => {
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
  
  console.log(`[prepareRecurringSlots 완료] 총 ${slots.length}개 슬롯 생성\n`);
  
  return slots;
}

