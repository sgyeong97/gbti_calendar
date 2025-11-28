import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

type ParamsPromise = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: ParamsPromise) {
	const role = req.cookies.get("gbti_role")?.value;
	const { id } = await ctx.params;
	const { name, title, color, currentUserName } = await req.json();
	
	if (!name || !name.trim()) {
		return NextResponse.json({ error: "Name is required" }, { status: 400 });
	}
	
	// 기존 참여자 정보 가져오기 (이름 변경 시 RecurringSlot 업데이트를 위해)
	const { data: oldParticipant, error: fetchError } = await supabase
		.from('Participant')
		.select('name')
		.eq('id', id)
		.single();
	
	if (fetchError || !oldParticipant) {
		return NextResponse.json({ error: "Participant not found" }, { status: 404 });
	}
	
	// 관리자가 아니면 자신의 정보만 수정 가능
	if (role !== "admin") {
		// currentUserName이 제공되고, 기존 이름과 일치하는지 확인
		if (!currentUserName || oldParticipant.name !== currentUserName) {
			return NextResponse.json({ error: "You can only update your own information" }, { status: 403 });
		}
		// 이름 변경은 관리자만 가능
		if (name.trim() !== oldParticipant.name) {
			return NextResponse.json({ error: "Only admins can change names" }, { status: 403 });
		}
	}
	
	const oldName = oldParticipant.name;
	const newName = name.trim();
	
	// 참여자 정보 업데이트
	const { error } = await supabase
		.from('Participant')
		.update({ 
			name: newName,
			title: title?.trim() || null,
			color: color || "#e5e7eb"
		})
		.eq('id', id);
	
	if (error) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
	
	// 이름이 변경된 경우 RecurringSlot의 participantNames 업데이트
	if (oldName !== newName) {
		// 모든 RecurringSlot 가져오기
		const { data: slots, error: slotsError } = await supabaseAdmin
			.from('RecurringSlot')
			.select('id, participantNames');
		
		if (!slotsError && slots) {
			// participantNames에 oldName이 포함된 슬롯 찾아서 업데이트
			for (const slot of slots) {
				if (!slot.participantNames) continue;
				
				try {
					const participants: string[] = JSON.parse(slot.participantNames);
					const index = participants.indexOf(oldName);
					
					if (index !== -1) {
						// oldName을 newName으로 교체
						participants[index] = newName;
						const updatedNames = JSON.stringify(participants);
						
						await supabaseAdmin
							.from('RecurringSlot')
							.update({ participantNames: updatedNames })
							.eq('id', slot.id);
					}
				} catch (e) {
					// JSON 파싱 실패 시 무시
					console.warn('Failed to parse participantNames for slot', slot.id, e);
				}
			}
		}
	}
	
	return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: ParamsPromise) {
	const role = _req.cookies.get("gbti_role")?.value;
	if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
	
	const { id } = await ctx.params;
	
	// 삭제 전에 참여자 이름 가져오기 (RecurringSlot 업데이트를 위해)
	const { data: participant, error: fetchError } = await supabase
		.from('Participant')
		.select('name')
		.eq('id', id)
		.single();
	
	if (fetchError || !participant) {
		return NextResponse.json({ error: "Participant not found" }, { status: 404 });
	}
	
	const participantName = participant.name;
	
	// 관련 이벤트 확인
	const { data: eventParticipants, error: eventCheckError } = await supabase
		.from('EventParticipant')
		.select('eventId')
		.eq('participantId', id);
	
	// RecurringSlot에서 해당 참여자 이름 제거
	const { data: slots, error: slotsError } = await supabaseAdmin
		.from('RecurringSlot')
		.select('id, participantNames');
	
	if (!slotsError && slots) {
		for (const slot of slots) {
			if (!slot.participantNames) continue;
			
			try {
				const participants: string[] = JSON.parse(slot.participantNames);
				const filtered = participants.filter((p: string) => p !== participantName);
				
				// 참여자가 제거된 경우 업데이트
				if (filtered.length !== participants.length) {
					const updatedNames = filtered.length > 0 ? JSON.stringify(filtered) : null;
					
					await supabaseAdmin
						.from('RecurringSlot')
						.update({ participantNames: updatedNames })
						.eq('id', slot.id);
				}
			} catch (e) {
				// JSON 파싱 실패 시 무시
				console.warn('Failed to parse participantNames for slot', slot.id, e);
			}
		}
	}
	
	// 참여자 삭제 (CASCADE로 EventParticipant와 CalendarParticipant도 자동 삭제됨)
	const { error } = await supabase
		.from('Participant')
		.delete()
		.eq('id', id);
	
	if (error) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
	
	return NextResponse.json({ 
		ok: true,
		affectedEvents: eventParticipants?.length || 0
	});
}

