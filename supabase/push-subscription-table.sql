-- PushSubscription 테이블 생성
CREATE TABLE IF NOT EXISTS PushSubscription (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  userId TEXT NOT NULL, -- 즐겨찾기 사용자 이름
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_push_subscription_user_id ON PushSubscription(userId);
CREATE INDEX IF NOT EXISTS idx_push_subscription_endpoint ON PushSubscription(endpoint);
