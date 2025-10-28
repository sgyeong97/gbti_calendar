import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

function requireAdmin(req: NextRequest) {
  const role = req.cookies.get("gbti_role")?.value;
  if (role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  try {
    const { data: notices, error } = await supabase
      .from('Notice')
      .select('*')
      .order('createdAt', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ notices });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // 관리자만 공지 작성 가능
  const block = requireAdmin(req);
  if (block) return block;

  const body = await req.json();
  
  try {
    const { data: created, error } = await supabaseAdmin
      .from('Notice')
      .insert({
        title: body.title,
        content: body.content,
        imageUrl: body.imageUrl || null,
        author: body.author || "관리자"
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ notice: created }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
