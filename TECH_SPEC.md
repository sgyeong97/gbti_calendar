# GBTI 캘린더 기술 스펙 문서

## 📋 프로젝트 개요

GBTI 서버 전용 스케줄 정리 캘린더 애플리케이션입니다. 이벤트 관리, 참여자 관리, 반복 이벤트, 푸시 알림 등의 기능을 제공합니다.

## 🛠 기술 스택

### 프론트엔드
- **Framework**: Next.js 16.0.0 (App Router)
- **Language**: TypeScript 5
- **UI Library**: React 19.2.0
- **Styling**: 
  - Tailwind CSS 4
  - Material-UI (@mui/material 7.3.4)
  - Emotion (@emotion/react, @emotion/styled)
- **Date/Time Libraries**:
  - date-fns 4.1.0
  - dayjs 1.11.19
  - @mui/x-date-pickers 8.16.0
  - flatpickr 4.6.13
- **Utilities**:
  - html2canvas 1.4.1 (이미지 저장)
  - zod 4.1.12 (스키마 검증)

### 백엔드
- **Database**: Supabase (PostgreSQL)
- **ORM/Client**: @supabase/supabase-js 2.76.1
- **API**: Next.js API Routes

### 인프라
- **Deployment**: Vercel
- **Push Notifications**: Web Push API (web-push 3.6.7)

### 개발 도구
- **Linter**: ESLint 9
- **Package Manager**: npm

## 📁 프로젝트 구조

```
gbti_calendar/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── admin/               # 관리자 API
│   │   ├── calendars/           # 캘린더 API
│   │   ├── events/              # 이벤트 API
│   │   ├── members/             # 멤버 관리 API
│   │   ├── notices/             # 공지사항 API
│   │   ├── notifications/       # 알림 API
│   │   ├── participants/        # 참여자 API
│   │   ├── push-subscription/   # 푸시 구독 API
│   │   ├── recurring/           # 반복 이벤트 API
│   │   └── session/              # 세션 API
│   ├── admin/                   # 관리자 페이지
│   │   ├── events/              # 이벤트 관리
│   │   └── members/             # 멤버 관리
│   ├── calendar/                # 캘린더 페이지
│   │   ├── page.tsx             # 메인 캘린더 뷰
│   │   ├── CreateEventModal.tsx  # 이벤트 생성 모달
│   │   ├── EventDetailModal.tsx # 이벤트 상세 모달
│   │   └── AdminCreateModal.tsx # 관리자 이벤트 생성 모달
│   ├── components/              # 공통 컴포넌트
│   ├── lib/                     # 유틸리티 함수
│   │   ├── supabase.ts         # Supabase 클라이언트
│   │   └── types.ts            # TypeScript 타입 정의
│   ├── login/                   # 로그인 페이지
│   ├── globals.css              # 전역 스타일
│   ├── layout.tsx               # 루트 레이아웃
│   └── page.tsx                 # 홈 페이지
├── supabase/                    # Supabase 스키마 및 마이그레이션
│   ├── schema.sql               # 데이터베이스 스키마
│   └── member-table.sql         # 멤버 테이블 스키마
├── public/                      # 정적 파일
├── types/                       # 타입 정의
├── middleware.ts                # Next.js 미들웨어
├── next.config.ts               # Next.js 설정
├── tsconfig.json               # TypeScript 설정
└── package.json                # 프로젝트 의존성
```

## 🗄 데이터베이스 스키마

### 주요 테이블

#### Calendar (캘린더)
```sql
- id: TEXT (PK)
- name: TEXT (NOT NULL)
- color: TEXT (DEFAULT '#4f46e5')
- createdAt: TIMESTAMPTZ
- updatedAt: TIMESTAMPTZ
```

#### Participant (참여자)
```sql
- id: TEXT (PK)
- name: TEXT (NOT NULL, UNIQUE)
- title: TEXT (칭호, nullable)
- color: TEXT (색상, nullable)
- createdAt: TIMESTAMPTZ
```

#### Event (이벤트)
```sql
- id: TEXT (PK)
- calendarId: TEXT (FK → Calendar)
- title: TEXT (NOT NULL)
- description: TEXT
- startAt: TIMESTAMPTZ (NOT NULL)
- endAt: TIMESTAMPTZ (NOT NULL)
- allDay: BOOLEAN (DEFAULT false)
- color: TEXT (DEFAULT '#60a5fa')
- createdAt: TIMESTAMPTZ
- updatedAt: TIMESTAMPTZ
```

#### EventParticipant (이벤트-참여자 연결)
```sql
- id: TEXT (PK)
- eventId: TEXT (FK → Event)
- participantId: TEXT (FK → Participant)
- UNIQUE(eventId, participantId)
```

#### RecurringSlot (반복 이벤트 슬롯)
```sql
- calendarId: TEXT (FK → Calendar)
- dayOfWeek: INTEGER (0-6, 일요일=0)
- startMinutes: INTEGER (시작 시간을 분 단위로)
- endMinutes: INTEGER (종료 시간을 분 단위로)
- startsOn: TIMESTAMPTZ
- endsOn: TIMESTAMPTZ (nullable)
- eventTitle: TEXT
- eventStartDate: TIMESTAMPTZ
- participantNames: TEXT (JSON 배열)
- color: TEXT
```

#### Member (멤버)
```sql
- id: TEXT (PK)
- name: TEXT (NOT NULL)
- discord: BOOLEAN
- notice: BOOLEAN
- chat: BOOLEAN
- status: TEXT (DEFAULT 'active')
- lastseen: DATE
- discordlink: TEXT
- birthyear: INTEGER
- createdat: TIMESTAMPTZ
- updatedat: TIMESTAMPTZ
```

## 🔌 API 엔드포인트

### 이벤트 API
- `GET /api/events` - 이벤트 목록 조회
  - Query params: `calendarId`, `start`, `end`, `participantName`
- `GET /api/events/[id]` - 이벤트 상세 조회
- `POST /api/events` - 이벤트 생성 (관리자)
- `PUT /api/events/[id]` - 이벤트 수정
- `DELETE /api/events/[id]` - 이벤트 삭제

### 캘린더 API
- `GET /api/calendars` - 캘린더 목록 조회
- `POST /api/calendars` - 캘린더 생성 (관리자)

### 참여자 API
- `GET /api/participants` - 참여자 목록 조회
- `POST /api/participants` - 참여자 생성 (관리자)
- `PUT /api/participants/[id]` - 참여자 수정 (관리자)
- `DELETE /api/participants/[id]` - 참여자 삭제 (관리자)

### 반복 이벤트 API
- `GET /api/calendars/[id]/recurring` - 반복 이벤트 조회
- `POST /api/calendars/[id]/recurring` - 반복 이벤트 생성 (관리자)
- `PUT /api/calendars/[id]/recurring` - 반복 이벤트 수정
- `DELETE /api/calendars/[id]/recurring` - 반복 이벤트 삭제

### 알림 API
- `POST /api/push-subscription` - 푸시 구독 등록
- `POST /api/notifications/test` - 테스트 알림 전송 (관리자)

## 🎨 주요 기능

### 1. 캘린더 뷰
- 월간 캘린더 뷰
- 참여자 필터링
- 즐겨찾기 기능
- 오늘의 파티 목록 (행 형태 카드 레이아웃)
- 이미지 저장 기능 (html2canvas)

### 2. 이벤트 관리
- 이벤트 생성/수정/삭제
- 반복 이벤트 관리
- 참여자 추가/제거
- 시간대별 필터링

### 3. 참여자 관리
- 참여자 목록 관리
- 칭호(Title) 시스템
- 색상 커스터마이징
- 네온 효과 스타일링 (배경 밝기에 따른 동적 색상 조정)

### 4. 푸시 알림
- Web Push API 기반
- 이벤트 시작 전 알림 (설정 가능한 시간 전)
- 참여자별 알림 필터링

### 5. 관리자 기능
- 관리자 인증 (비밀번호 기반)
- 이벤트/참여자/멤버 관리
- 공지사항 관리

## 🎯 주요 UI/UX 특징

### 칭호 시스템
- 참여자별 칭호 표시
- 네온 효과 스타일링 (깜빡이는 애니메이션)
- 배경 밝기에 따른 동적 색상 조정:
  - 배경이 매우 밝을 때 (brightness > 200): 어두운 색 칭호
  - 그 외: 흰색 계열 네온 효과

### 참여자 태그
- 배경색 밝기에 따른 텍스트 색상 자동 조정
- 칭호 + 이름 순서 표시
- 즐겨찾기 기능 (더블클릭으로 추가/제거)

### 시간 입력 UI
- 15분 간격 드롭다운 선택
- AM/PM 형식
- 날짜와 시간 분리 표시

## 🔐 인증 및 권한

### 관리자 인증
- 비밀번호 기반 인증
- `/api/login` 엔드포인트 사용
- 세션 기반 관리

### API 권한
- 대부분의 읽기 작업: 공개
- 쓰기 작업: 관리자 전용
- `requireAdmin()` 함수로 권한 체크

## 🌐 환경 변수

필요한 환경 변수 (`.env.local`):
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_URL=your_supabase_url (서버 사이드)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key (서버 사이드)

# Vercel (배포 시)
VERCEL_URL=your_vercel_url
```

## 🚀 개발 환경 설정

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 변수 설정
```bash
cp env.example .env.local
# .env.local 파일에 Supabase 정보 입력
```

### 3. 개발 서버 실행
```bash
npm run dev
```

### 4. 빌드
```bash
npm run build
npm start
```

## 📝 코딩 컨벤션

### TypeScript
- Strict mode 활성화
- 타입 명시적 선언
- 인터페이스 사용 권장

### 스타일링
- Tailwind CSS 우선 사용
- 인라인 스타일은 동적 값일 때만 사용
- CSS 변수 활용 (`var(--background)`, `var(--foreground)`)

### 컴포넌트 구조
- 함수형 컴포넌트 사용
- `"use client"` 지시어로 클라이언트 컴포넌트 명시
- API Routes는 서버 컴포넌트

### 네이밍
- 컴포넌트: PascalCase
- 함수/변수: camelCase
- 상수: UPPER_SNAKE_CASE
- 파일명: 컴포넌트는 PascalCase, 그 외는 camelCase