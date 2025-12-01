import { NextResponse, NextRequest } from "next/server";
import { supabase } from "@/app/lib/supabase";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

type RouteContext = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, ctx: RouteContext) {
    const { id } = await ctx.params;
	if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    function requireAdmin(req: NextRequest) {
        const role = req.cookies.get("gbti_role")?.value;
        if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
        return null;
    }

    const block = requireAdmin(req);
    if (block) return block;

    try {
        const patch = await req.json();
        const updates: any = { updatedat: new Date().toISOString() };
        
        // 이름 변경 시 기존 이름 저장 (Participant와 RecurringSlot 업데이트를 위해)
        let oldName: string | null = null;
        if (patch?.name !== undefined) {
            const { data: oldMember } = await supabaseAdmin
                .from('member')
                .select('name')
                .eq('id', id)
                .single();
            if (oldMember) oldName = oldMember.name;
            updates.name = String(patch.name);
        }
        
        if (patch?.platforms) {
            if (typeof patch.platforms.discord === 'boolean') updates.discord = patch.platforms.discord;
            if (typeof patch.platforms.notice === 'boolean') updates.notice = patch.platforms.notice;
            if (typeof patch.platforms.chat === 'boolean') updates.chat = patch.platforms.chat;
        }
        if (patch?.status === 'active' || patch?.status === 'inactive') updates.status = patch.status;
        if (patch?.discordLink !== undefined) updates.discordlink = patch.discordLink || null;
        if (patch?.birthYear !== undefined) updates.birthyear = typeof patch.birthYear === 'number' ? patch.birthYear : null;
        if (patch?.birthMonth !== undefined) updates.birthmonth = typeof patch.birthMonth === 'number' ? patch.birthMonth : null;
        if (patch?.birthDay !== undefined) updates.birthday = typeof patch.birthDay === 'number' ? patch.birthDay : null;

        const { data, error } = await supabaseAdmin
            .from('member')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        
        // 이름이 변경된 경우, 같은 이름의 Participant도 업데이트하고 RecurringSlot도 업데이트
        if (oldName && patch?.name !== undefined && oldName !== String(patch.name)) {
            const newName = String(patch.name);
            
            // 같은 이름의 Participant 찾아서 업데이트
            const { data: participant } = await supabaseAdmin
                .from('Participant')
                .select('id')
                .eq('name', oldName)
                .single();
            
            if (participant) {
                // Participant 이름 업데이트
                await supabaseAdmin
                    .from('Participant')
                    .update({ name: newName })
                    .eq('id', participant.id);
                
                // RecurringSlot의 participantNames 업데이트
                const { data: slots } = await supabaseAdmin
                    .from('RecurringSlot')
                    .select('id, participantNames');
                
                if (slots) {
                    for (const slot of slots) {
                        if (!slot.participantNames) continue;
                        
                        try {
                            const participants: string[] = JSON.parse(slot.participantNames);
                            const index = participants.indexOf(oldName);
                            
                            if (index !== -1) {
                                participants[index] = newName;
                                const updatedNames = JSON.stringify(participants);
                                
                                await supabaseAdmin
                                    .from('RecurringSlot')
                                    .update({ participantNames: updatedNames })
                                    .eq('id', slot.id);
                            }
                        } catch (e) {
                            console.warn('Failed to parse participantNames for slot', slot.id, e);
                        }
                    }
                }
            }
        }

        const updated = {
            id: data.id,
            name: data.name,
            platforms: { discord: !!data.discord, notice: !!data.notice, chat: !!data.chat },
            status: data.status === 'inactive' ? 'inactive' : 'active',
            lastSeen: data.lastseen ?? new Date().toISOString().slice(0,10),
            discordLink: data.discordlink ?? undefined,
            birthYear: typeof data.birthyear === 'number' ? data.birthyear : undefined,
            birthMonth: typeof data.birthmonth === 'number' ? data.birthmonth : undefined,
            birthDay: typeof data.birthday === 'number' ? data.birthday : undefined,
        };
        return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: "invalid request", message: err?.message || String(err) }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
    const { id } = await ctx.params;
	if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    function requireAdmin() {
        // DELETE는 서버에서만 호출되며 admin만 허용
        return null;
    }
    const block = requireAdmin();
    if (block) return block as any;

    // 삭제 전에 이름 가져오기 (Participant와 RecurringSlot 업데이트를 위해)
    const { data: member } = await supabaseAdmin
        .from('member')
        .select('name')
        .eq('id', id)
        .single();
    
    const memberName = member?.name;
    
    // 같은 이름의 Participant가 있으면 RecurringSlot에서 제거
    if (memberName) {
        const { data: participant } = await supabaseAdmin
            .from('Participant')
            .select('id')
            .eq('name', memberName)
            .single();
        
        if (participant) {
            // RecurringSlot에서 해당 참여자 이름 제거
            const { data: slots } = await supabaseAdmin
                .from('RecurringSlot')
                .select('id, participantNames');
            
            if (slots) {
                for (const slot of slots) {
                    if (!slot.participantNames) continue;
                    
                    try {
                        const participants: string[] = JSON.parse(slot.participantNames);
                        const filtered = participants.filter((p: string) => p !== memberName);
                        
                        if (filtered.length !== participants.length) {
                            const updatedNames = filtered.length > 0 ? JSON.stringify(filtered) : null;
                            
                            await supabaseAdmin
                                .from('RecurringSlot')
                                .update({ participantNames: updatedNames })
                                .eq('id', slot.id);
                        }
                    } catch (e) {
                        console.warn('Failed to parse participantNames for slot', slot.id, e);
                    }
                }
            }
        }
    }

    const { error } = await supabaseAdmin
        .from('member')
        .delete()
        .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}
