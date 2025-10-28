# Supabase 스키마 설정 방법

## 방법 1: Supabase Dashboard (권장)

1. **Supabase Dashboard 접속**
   - https://supabase.com
   - 프로젝트 선택

2. **기존 테이블 삭제 (있는 경우)**
   - SQL Editor 열기
   - `supabase/drop-all-tables.sql` 내용 복사하여 실행
   - 또는 직접: Table Editor → 각 테이블 → Delete

3. **스키마 생성**
   - SQL Editor 열기
   - `supabase/schema.sql` 내용 전체 복사
   - 붙여넣기
   - "RUN" 버튼 클릭

4. **확인**
   - Table Editor에서 모든 테이블이 생성되었는지 확인
   - 다음 테이블이 있어야 함:
     - Calendar
     - Participant
     - CalendarParticipant
     - Event
     - EventParticipant
     - RecurringSlot

## 방법 2: Supabase CLI (고급)

```bash
# Supabase CLI 설치
npm install -g supabase

# 로그인
supabase login

# 프로젝트 연결
supabase link --project-ref your-project-ref

# SQL 실행
supabase db reset
```

## 문제 해결

### "relation already exists" 에러
→ 먼저 `supabase/drop-all-tables.sql` 실행

### "syntax error" 에러
→ 각 구문이 제대로 세미콜론으로 끝나는지 확인
→ 한 번에 하나의 구문만 실행해보기

### 권한 에러
→ Supabase Dashboard에서 프로젝트 소유자인지 확인

