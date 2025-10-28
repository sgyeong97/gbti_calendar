-- Notice 테이블 생성
CREATE TABLE Notice (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  imageUrl TEXT,
  author TEXT NOT NULL,
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 비활성화 (API에서 관리자 검증 처리)
ALTER TABLE Notice DISABLE ROW LEVEL SECURITY;

-- 인덱스 추가
CREATE INDEX idx_notice_created_at ON Notice(createdAt DESC);
