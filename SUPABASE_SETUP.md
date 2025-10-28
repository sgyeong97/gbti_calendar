# Supabase 설정 가이드

## 1. Supabase 프로젝트 생성

1. https://supabase.com 접속
2. 새 프로젝트 생성
3. Database 비밀번호 설정 (메모해둘 것)

## 2. 데이터베이스 스키마 적용

1. Supabase Dashboard → SQL Editor
2. `supabase/schema.sql` 파일 내용을 복사하여 실행
3. 모든 테이블이 생성되었는지 확인

## 3. 환경 변수 설정

### 로컬 개발
`.env.local` 파일에 추가:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
ADMIN_PASSWORD=your-admin-password
USER_PASSWORD=your-user-password
```

### Vercel 배포
1. Vercel Dashboard → Settings → Environment Variables
2. 다음 변수 추가:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ADMIN_PASSWORD`
   - `USER_PASSWORD`

## 4. API Keys 가져오기

Supabase Dashboard → Settings → API에서:
- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 5. 테스트

```bash
npm run dev
```

브라우저에서 http://localhost:3000 접속하여 테스트

## 중요 참고사항

1. **Row Level Security (RLS)**: Supabase는 기본적으로 RLS를 활성화합니다. 
   - 이 프로젝트는 쿠키 기반 인증을 사용하므로 RLS 정책을 비활성화하거나 특정 정책을 설정해야 할 수 있습니다.
   - Supabase Dashboard → Authentication → Policies에서 설정

2. **Migration from Prisma**: 
   - 기존 Prisma 데이터가 있다면 수동으로 마이그레이션해야 합니다.
   - Supabase Dashboard → Table Editor에서 직접 데이터 입력 가능

3. **Prisma 제거**: 
   - `package.json`에서 `@prisma/client`와 `prisma` 제거 가능
   - 또는 유지하여 향후 필요한 경우 사용

## Prisma 제거하기

```bash
npm uninstall prisma @prisma/client
rm -rf prisma/
```

