-- Notice 테이블 생성
CREATE TABLE IF NOT EXISTS Notice (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  imageUrl TEXT,
  author TEXT NOT NULL,
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 정책 설정 (모든 사용자가 읽기 가능, 관리자만 작성 가능)
ALTER TABLE Notice ENABLE ROW LEVEL SECURITY;

-- 읽기 정책: 모든 사용자가 공지사항을 볼 수 있음
CREATE POLICY "Anyone can view notices" ON Notice
  FOR SELECT
  USING (true);

-- 쓰기 정책: 관리자만 공지사항을 작성할 수 있음
CREATE POLICY "Only admins can insert notices" ON Notice
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- 수정 정책: 관리자만 공지사항을 수정할 수 있음
CREATE POLICY "Only admins can update notices" ON Notice
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- 삭제 정책: 관리자만 공지사항을 삭제할 수 있음
CREATE POLICY "Only admins can delete notices" ON Notice
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- 인덱스 추가 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_notice_created_at ON Notice(createdAt DESC);
