import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const role = req.cookies.get("gbti_role")?.value;
  if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const id = params.id;

  try {
    const { error } = await supabaseAdmin
      .from('notice')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
