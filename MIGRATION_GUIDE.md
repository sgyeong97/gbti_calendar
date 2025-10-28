# Prisma → Supabase 마이그레이션 가이드

## 1. Supabase 프로젝트 생성

1. https://supabase.com 접속
2. 새 프로젝트 생성
3. 프로젝트 설정:
   - Database → SQL Editor → `supabase/schema.sql` 실행
   - Settings → API → URL과 anon key 복사

## 2. 환경 변수 설정

`.env.local` 또는 Vercel 환경 변수에 추가:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 3. 기존 데이터 마이그레이션 (선택사항)

만약 기존 Prisma 데이터가 있다면:

```bash
# Prisma에서 데이터 추출
npx prisma studio

# Supabase Dashboard에서 직접 SQL 실행하여 데이터 입력
# 또는 migration script 사용
```

## 4. 배포

```bash
git add .
git commit -m "Migrate from Prisma to Supabase"
git push
```

Vercel에서 환경 변수 설정 후 자동 배포됩니다.

## 주요 변경사항

1. **ORM 변경**: Prisma → Supabase Client
2. **쿼리 방식**: ORM 메서드 → SQL 쿼리
3. **타입 안정성**: Prisma의 타입 자동 생성 → 수동 타입 정의 필요

## 주요 차이점

### Prisma
```typescript
const event = await prisma.event.findUnique({ where: { id } });
```

### Supabase
```typescript
const { data: event } = await supabase
  .from('Event')
  .select('*, attendees:EventParticipant(participant:Participant(*))')
  .eq('id', id)
  .single();
```

