import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

type ParamsPromise = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, ctx: ParamsPromise) {
  const role = req.cookies.get("gbti_role")?.value;
  if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { id } = await ctx.params;

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
