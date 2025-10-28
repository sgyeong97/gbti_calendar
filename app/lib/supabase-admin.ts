import { createClient } from '@supabase/supabase-js';

// 서버 전용 Supabase 클라이언트 (서비스 롤 키 사용)
// 절대 클라이언트 컴포넌트에서 import 하지 마세요.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey || anonKey);


