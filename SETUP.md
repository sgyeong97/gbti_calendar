# 환경 설정 가이드

## 로컬 개발 환경 (MySQL)

1. `.env.local` 파일 생성:

```bash
# MySQL 설정
DATABASE_URL="mysql://user:password@localhost:3306/database_name"

# 비밀번호 설정
ADMIN_PASSWORD="your-admin-password"
USER_PASSWORD="your-user-password"
```

2. MySQL 데이터베이스 생성:
```sql
CREATE DATABASE database_name;
```

3. 스키마 적용:
```bash
npm run db:push:mysql
```

4. 개발 서버 실행:
```bash
npm run dev:mysql
```

## Vercel 프로덕션 환경

### 1. Vercel Postgres 설정

**Vercel 대시보드에서:**
1. 프로젝트 > Storage > Create Database
2. Postgres 선택
3. 데이터베이스 생성

**환경 변수 자동 설정:**
- Vercel이 `DATABASE_URL`을 자동으로 설정
- 별도 설정 불필요

### 2. 배포 전 준비

Vercel에서 Prisma 마이그레이션 실행:

1. Vercel 대시보드 > Project Settings > Commands
2. Build Command: `npx prisma generate && npm run build`
3. Deploy

또는 Vercel CLI 사용:
```bash
vercel env add DATABASE_URL
# 값 입력: postgres://... (Vercel Postgres에서 제공)

# 마이그레이션 (배포 후)
vercel exec -- npm run prisma migrate deploy
```

### 3. 최초 마이그레이션

배포 후 Vercel Postgres에 스키마 적용:

**옵션 1: Vercel CLI**
```bash
vercel exec -- npm run prisma db push
```

**옵션 2: Vercel 대시보드 Functions**
- Vercel 대시보드 > Functions에서 직접 실행

**옵션 3: 수동 접속**
```bash
# Vercel CLI로 터미널 접속
vercel exec

# Prisma 마이그레이션 실행
npx prisma db push
```

## 스키마 파일 구조

- `prisma/schema.prisma` - Vercel 프로덕션용 (PostgreSQL)
- `prisma/schema.mysql.prisma` - 로컬 개발용 (MySQL)
- `prisma/schema.sqlite.prisma` - SQLite용 (사용 안 함)

## 주요 명령어

### 로컬 개발
```bash
npm run dev:mysql        # MySQL로 개발
npm run db:push:mysql    # MySQL 스키마 적용
```

### 프로덕션
```bash
npm run build            # 빌드 (Prisma generate 자동 실행)
npm run start            # 프로덕션 서버 시작
```

## Troubleshooting

### Vercel 배포 실패
1. `DATABASE_URL` 환경 변수 확인
2. Vercel Postgres 연결 상태 확인
3. Prisma 클라이언트 생성 확인: `npx prisma generate`

### 로컬 MySQL 연결 실패
1. MySQL 서버 실행 확인
2. `.env.local` 파일의 `DATABASE_URL` 확인
3. 사용자 권한 확인

