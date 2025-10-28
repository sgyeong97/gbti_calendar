# Vercel 배포 가이드

## 현재 상태
✅ Postgres 데이터베이스 생성 완료
✅ 환경 변수 준비 완료

## 배포 순서

### 1. 환경 변수 설정

**옵션 A: Vercel 대시보드에서 설정 (추천)**
1. https://vercel.com 대시보드 접속
2. 프로젝트 선택
3. Settings > Environment Variables
4. 다음 변수 추가:
   - `DATABASE_URL` = `postgres://204872992555d6f610cd2163ae9524828c1c9a34869c49583a2460563be1dcea:sk_ME8CovMbrWIRb4altj_9d@db.prisma.io:5432/postgres?sslmode=require`

**옵션 B: Vercel CLI로 설정**
```bash
# Vercel CLI 로그인
vercel login

# 프로젝트 연결
vercel link

# 환경 변수 추가
vercel env add DATABASE_URL
# 값 입력: postgres://204872992555d6f610cd2163ae9524828c1c9a34869c49583a2460563be1dcea:sk_ME8CovMbrWIRb4altj_9d@db.prisma.io:5432/postgres?sslmode=require
# Environment: Production 선택
```

### 2. 로컬에서 Prisma 생성

```bash
# 환경 변수 설정 (.env.production 파일 생성 또는 export)
export DATABASE_URL="postgres://204872992555d6f610cd2163ae9524828c1c9a34869c49583a2460563be1dcea:sk_ME8CovMbrWIRb4altj_9d@db.prisma.io:5432/postgres?sslmode=require"

# Prisma 클라이언트 생성
npx prisma generate --schema=prisma/schema.prisma
```

### 3. Vercel에 배포

```bash
# GitHub에 커밋 및 푸시
git add .
git commit -m "Add participantNames to RecurringSlot"
git push origin main

# Vercel 자동 배포 (GitHub 연동시 자동)
# 또는 수동 배포:
vercel --prod
```

### 4. 배포 후 스키마 적용

배포가 완료되면 Vercel Postgres에 스키마를 적용해야 합니다:

#### 방법 1: Vercel 대시보드 터미널 사용
1. Vercel 대시보드에서 프로젝트 클릭
2. Deployments 탭 → 최신 배포 클릭
3. 상단 메뉴에서 "Terminal" 탭 클릭
4. 터미널에서 실행:
```bash
npx prisma db push
```

#### 방법 2: Vercel CLI 사용 (대안)
만약 CLI를 사용한다면:
```bash
# 프로젝트 연결 확인
vercel link

# 배포
vercel --prod
```

### 5. 확인

배포 완료 후 브라우저에서 사이트 접속하여 동작 확인

## 참고사항

### 환경별 스키마
- **로컬 개발**: `prisma/schema.mysql.prisma` (MySQL)
- **Vercel 프로덕션**: `prisma/schema.prisma` (PostgreSQL)

### 빌드 설정
`vercel.json`에 이미 다음 설정이 포함되어 있습니다:
```json
{
  "buildCommand": "npx prisma generate && npm run build"
}
```

이 설정으로 자동으로 Prisma 클라이언트가 생성됩니다.

