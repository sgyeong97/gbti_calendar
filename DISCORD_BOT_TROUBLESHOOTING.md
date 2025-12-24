# Discord Bot API 외부 호출 문제 해결 가이드

## 🔍 문제 진단

외부 호출 시 로그가 없다면 다음을 확인하세요:

### 1. 봇 서버 설정 확인

#### 1.1 환경 변수 확인

봇 서버의 `.env` 파일에서 다음을 확인:

```env
# 봇 서버 .env 파일
HTTP_PORT=8999
DISCORD_BOT_API_TOKEN=your_secure_token_here

# ⚠️ 중요: Vercel 도메인을 ALLOWED_ORIGINS에 추가
ALLOWED_ORIGINS=https://gbti-calendar.vercel.app,http://localhost:3000
```

**주의사항**:
- `ALLOWED_ORIGINS`에 Vercel 도메인(`https://gbti-calendar.vercel.app`)이 포함되어 있어야 합니다
- 여러 도메인은 쉼표로 구분합니다
- 서버-서버 통신이므로 Origin 검증이 필요 없을 수도 있지만, 봇 서버가 CORS를 엄격하게 검사한다면 설정이 필요합니다

#### 1.2 봇 서버 로그 확인

봇 서버에서 다음 명령으로 로그 확인:

```bash
# PM2 사용 시
pm2 logs gbti-discord-bot

# 또는 일반 실행 시
npm run dev
```

**확인할 사항**:
- 요청이 도달하는지 (로그에 요청이 나타나는지)
- CORS 오류가 발생하는지
- 인증 오류가 발생하는지

### 2. Vercel 환경 변수 확인

Vercel 대시보드에서 다음 환경 변수가 설정되어 있는지 확인:

```env
DISCORD_BOT_API_URL=http://YOUR_PUBLIC_IP:8999
DISCORD_BOT_API_TOKEN=your_secure_token_here
```

**⚠️ 중요**:
- `DISCORD_BOT_API_URL`은 **공인 IP 주소**여야 합니다 (내부 IP `192.168.x.x`가 아님)
- `DISCORD_BOT_API_TOKEN`은 봇 서버의 `.env` 파일과 **정확히 일치**해야 합니다

### 3. 네트워크 연결 확인

#### 3.1 포트포워딩 확인

공유기에서 다음 설정이 되어 있는지 확인:
- 외부 포트: 8999
- 내부 IP: 192.168.1.154
- 내부 포트: 8999
- 프로토콜: TCP

#### 3.2 방화벽 확인

Windows 방화벽에서 포트 8999가 열려 있는지 확인:

```powershell
# PowerShell (관리자 권한)
netsh advfirewall firewall show rule name="WSL2 Port 8999"
```

#### 3.3 외부 접근 테스트

인터넷이 연결된 다른 기기에서 테스트:

```bash
# 헬스 체크
curl http://YOUR_PUBLIC_IP:8999/health

# API 호출 테스트 (토큰 필요)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://YOUR_PUBLIC_IP:8999/discord-activity/grouped-by-date?startDate=2025-11-24&endDate=2025-12-24"
```

**성공 시**: JSON 응답이 반환됩니다
**실패 시**: 연결 오류 또는 타임아웃 발생

### 4. 봇 서버 CORS 설정 확인

봇 서버 코드에서 CORS 설정을 확인하세요. 서버-서버 통신의 경우:

1. **Origin 헤더가 없는 경우**: CORS 검증을 건너뛰어야 합니다
2. **User-Agent 기반 검증**: 서버 요청을 구분할 수 있도록 `User-Agent` 헤더 확인
3. **인증 토큰 검증**: `Authorization` 헤더의 Bearer 토큰이 올바른지 확인

### 5. Next.js API 라우트 로그 확인

Vercel 대시보드의 Functions 로그에서 확인:

1. Vercel 대시보드 → 프로젝트 → Functions 탭
2. 최근 배포의 로그 확인
3. 다음 로그 메시지 확인:
   - `[Grouped By Date API] 봇 API 호출 시작: ...`
   - `[Grouped By Date API] 요청 URL: ...`
   - `[Grouped By Date API] 응답 상태: ...`
   - 에러 메시지

## 🔧 해결 방법

### 방법 1: 봇 서버 CORS 설정 수정

봇 서버 코드에서 서버-서버 통신을 허용하도록 수정:

```javascript
// 봇 서버 코드 예시
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const userAgent = req.headers['user-agent'];
  
  // 서버-서버 통신 (User-Agent에 특정 값이 있거나 Origin이 없음)
  if (!origin || userAgent?.includes('GBTI-Calendar-WebApp')) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    return next();
  }
  
  // 브라우저 요청 (Origin 검증)
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    return next();
  }
  
  res.status(403).json({ error: 'Origin not allowed' });
});
```

### 방법 2: 봇 서버 로깅 강화

봇 서버에 더 자세한 로깅 추가:

```javascript
// 모든 요청 로깅
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  console.log('Headers:', {
    origin: req.headers.origin,
    'user-agent': req.headers['user-agent'],
    authorization: req.headers.authorization ? 'Present' : 'Missing',
  });
  next();
});
```

### 방법 3: Vercel 환경 변수 재설정

1. Vercel 대시보드 → 프로젝트 → Settings → Environment Variables
2. `DISCORD_BOT_API_URL` 확인:
   - ✅ 올바른 형식: `http://YOUR_PUBLIC_IP:8999`
   - ❌ 잘못된 형식: `http://192.168.1.154:8999` (내부 IP)
3. 환경 변수 저장 후 **재배포** 필수

### 방법 4: 공인 IP 확인

공인 IP가 변경되었을 수 있습니다:

```bash
# 공인 IP 확인
curl ifconfig.me
# 또는
curl ipinfo.io/ip
```

공인 IP가 변경되었다면:
1. Vercel 환경 변수 `DISCORD_BOT_API_URL` 업데이트
2. 공유기 포트포워딩 설정 확인
3. 재배포

## 📋 체크리스트

외부 호출 문제 해결을 위한 체크리스트:

- [ ] 봇 서버가 실행 중인가? (`pm2 status` 또는 `npm start`)
- [ ] 봇 서버의 `.env` 파일에 `ALLOWED_ORIGINS`에 Vercel 도메인이 포함되어 있는가?
- [ ] Vercel 환경 변수 `DISCORD_BOT_API_URL`이 공인 IP로 설정되어 있는가?
- [ ] Vercel 환경 변수 `DISCORD_BOT_API_TOKEN`이 봇 서버와 일치하는가?
- [ ] 공유기 포트포워딩이 올바르게 설정되어 있는가?
- [ ] Windows 방화벽에서 포트 8999가 열려 있는가?
- [ ] 외부에서 직접 API 호출이 가능한가? (`curl` 테스트)
- [ ] 봇 서버 로그에 요청이 도달하는가?
- [ ] Vercel Functions 로그에 에러가 있는가?

## 🆘 추가 도움

위 방법으로 해결되지 않으면:

1. **봇 서버 로그 전체 공유**: `pm2 logs gbti-discord-bot --lines 100`
2. **Vercel Functions 로그 공유**: Vercel 대시보드에서 Functions 로그 복사
3. **에러 응답 전체 공유**: 브라우저 개발자 도구 Network 탭에서 에러 응답 확인

