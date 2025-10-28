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
    // DB 스키마: table notice, columns imageurl, createdat
    const { data, error } = await supabase
      .from('notice')
      .select('*')
      .order('createdat', { ascending: false });

    if (error) throw error;

    const notices = (data || []).map((n: any) => ({
      id: n.id,
      title: n.title,
      content: n.content,
      imageUrl: n.imageurl ?? null,
      author: n.author,
      createdAt: n.createdat,
    }));

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
    const { data, error } = await supabaseAdmin
      .from('notice')
      .insert({
        title: body.title,
        content: body.content,
        imageurl: body.imageUrl || null,
        author: body.author || "관리자"
      })
      .select()
      .single();

    if (error) throw error;

    const created = data
      ? {
          id: data.id,
          title: data.title,
          content: data.content,
          imageUrl: data.imageurl ?? null,
          author: data.author,
          createdAt: data.createdat,
        }
      : null;

    return NextResponse.json({ notice: created }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
