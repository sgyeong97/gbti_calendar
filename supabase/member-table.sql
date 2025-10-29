-- Member table for managing admin members list
CREATE TABLE IF NOT EXISTS member (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  discord BOOLEAN NOT NULL DEFAULT false,
  notice  BOOLEAN NOT NULL DEFAULT false,
  chat    BOOLEAN NOT NULL DEFAULT false,
  status  TEXT NOT NULL DEFAULT 'active', -- 'active' | 'inactive'
  lastseen DATE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  discordlink TEXT,
  birthyear INTEGER,
  createdat TIMESTAMPTZ NOT NULL DEFAULT now(),
  updatedat TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS member_name_idx ON member(name);
