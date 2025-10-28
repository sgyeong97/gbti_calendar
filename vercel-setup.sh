#!/bin/bash

# Vercel 환경 변수 설정 스크립트
# 이 스크립트를 실행하려면: chmod +x vercel-setup.sh && ./vercel-setup.sh

echo "Vercel 환경 변수 설정 중..."

# DATABASE_URL 설정
vercel env add DATABASE_URL production
# 값 입력: postgres://204872992555d6f610cd2163ae9524828c1c9a34869c49583a2460563be1dcea:sk_ME8CovMbrWIRb4altj_9d@db.prisma.io:5432/postgres?sslmode=require

echo ""
echo "환경 변수 설정이 완료되었습니다."
echo "이제 다음 명령어를 실행하세요:"
echo ""
echo "1. 로컬에서 Prisma 클라이언트 생성:"
echo "   npx prisma generate"
echo ""
echo "2. Vercel에 배포:"
echo "   vercel --prod"
echo ""
echo "3. 배포 후 Vercel Postgres에 스키마 적용:"
echo "   vercel exec -- npx prisma db push"

