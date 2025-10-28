# Supabase 마이그레이션 완료 ✅

## 완료된 작업

1. ✅ `@supabase/supabase-js` 패키지 설치
2. ✅ Supabase 클라이언트 설정 (`app/lib/supabase.ts`)
3. ✅ 타입 정의 생성 (`app/lib/types.ts`)
4. ✅ Supabase 헬퍼 함수 생성 (`app/lib/supabase-helpers.ts`)
5. ✅ SQL 스키마 생성 (`supabase/schema.sql`)
6. ✅ 모든 API 라우트를 Prisma에서 Supabase로 마이그레이션
7. ✅ 마이그레이션 가이드 작성

## 마이그레이션된 API 라우트

### 완료된 라우트
- `app/api/calendars/route.ts`
- `app/api/events/route.ts` (복잡한 로직 포함)
- `app/api/events/[id]/route.ts` (복잡한 로직 포함)
- `app/api/participants/route.ts`
- `app/api/participants/[id]/route.ts`
- `app/api/calendars/[id]/recurring/route.ts`
- `app/api/calendars/[id]/participants/route.ts`
- `app/api/recurring/update/route.ts`

### 변경되지 않은 라우트 (인증 관련)
- `app/api/login/route.ts` - 쿠키 기반 인증
- `app/api/session/route.ts` - 쿠키 기반 인증

### 백업 파일
- `app/api/events/route.ts.backup` - 원본 Prisma 버전
- `app/api/events/[id]/route.ts.prisma.bak` - 원본 Prisma 버전

## 다음 단계

### 1. Supabase 프로젝트 생성 및 설정

```bash
# Supabase Dashboard 접속
# https://supabase.com

# 새 프로젝트 생성
# Database 비밀번호 설정 (메모해둘 것)
```

### 2. 데이터베이스 스키마 적용

1. Supabase Dashboard → SQL Editor
2. `supabase/schema.sql` 파일 내용을 복사하여 실행
3. 모든 테이블이 생성되었는지 확인

### 3. 환경 변수 설정

`.env.local` 파일에 추가:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
ADMIN_PASSWORD=your-admin-password
USER_PASSWORD=your-user-password
```

API Keys는 Supabase Dashboard → Settings → API에서 가져오기

### 4. Row Level Security (RLS) 설정

Supabase는 기본적으로 RLS를 활성화합니다. 이 프로젝트는 쿠키 기반 인증을 사용하므로:

**옵션 1: RLS 비활성화 (개발용 - 빠름)**
```sql
-- Supabase SQL Editor에서 실행
ALTER TABLE "Calendar" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Event" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Participant" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "CalendarParticipant" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "EventParticipant" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "RecurringSlot" DISABLE ROW LEVEL SECURITY;
```

**옵션 2: RLS 정책 설정 (프로덕션용 - 보안)**
```sql
-- 모든 사용자가 읽기/쓰기 가능하도록 정책 생성
ALTER TABLE "Calendar" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all operations" ON "Calendar" FOR ALL USING (true) WITH CHECK (true);
-- 다른 테이블에도 동일하게 적용
```

### 5. 로컬 테스트

```bash
npm run dev
```

브라우저에서 http://localhost:3000 접속하여 테스트

### 6. Vercel 배포

1. Vercel Dashboard → Settings → Environment Variables
2. Supabase 환경 변수 추가
3. GitHub push → 자동 배포

## 주요 변경사항

### Prisma → Supabase

**Before (Prisma)**
```typescript
const event = await prisma.event.findUnique({ 
  where: { id },
  include: { attendees: { include: { participant: true } } }
});
```

**After (Supabase)**
```typescript
const { data: event } = await supabase
  .from('Event')
  .select('*, attendees:EventParticipant(participant:Participant(*))')
  .eq('id', id)
  .single();
```

### 트랜잭션 처리

Supabase는 Prisma의 `$transaction` 대신 수동으로 트랜잭션을 처리합니다.

## Prisma 제거 (선택사항)

Prisma를 완전히 제거하려면:

```bash
# 패키지 제거
npm uninstall prisma @prisma/client

# 파일 제거
rm -rf prisma/
```

또는 Prisma 파일을 유지하여 향후 필요시 사용할 수 있습니다.

## 문제 해결

### RLS 에러
"new row violates row-level security policy" 에러가 발생하면 → RLS 비활성화 또는 정책 설정 필요

### 관계 쿼리 에러
Supabase의 foreign key 관계가 정의되지 않았을 수 있습니다 → `supabase/schema.sql` 실행 확인

## 참고 문서

- Supabase: https://supabase.com/docs
- Supabase JS Client: https://supabase.com/docs/reference/javascript
- Migration Guide: `MIGRATION_GUIDE.md`
- Setup Guide: `SUPABASE_SETUP.md`

