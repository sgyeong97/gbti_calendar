import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

type ParamsPromise = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: ParamsPromise) {
	const { id } = await ctx.params;
	
	// 반복 이벤트(R- 으로 시작하는 가상 ID) 처리
	if (id.startsWith('R-')) {
        // R-calendarId-date-slotId 형식에서 날짜에 :가 포함될 수 있음
        // 마지막 - 이후가 slotId이므로 역순으로 파싱
        const parts = id.split('-');
        if (parts.length >= 8) {
            // R-<calendarId>-<yyyy-MM-ddTHH:mm:ss.sssZ>-<uuid(5 parts)>
            const calendarId = parts[1];
            const slotId = parts.slice(-5).join('-'); // UUID 5파트 복원
            const dateStr = parts.slice(2, parts.length - 5).join('-');

            // 1) 슬롯을 우선 조회 (더 견고)
            const { data: slot, error: slotErr } = await supabaseAdmin
                .from('RecurringSlot')
                .select('*')
                .eq('id', slotId)
                .single();
            if (slotErr || !slot) {
                console.error('Slot not found or error:', slotId, slotErr);
                return NextResponse.json({ error: "Slot not found" }, { status: 404 });
            }

            // 2) 캘린더 및 멤버 조회 (없어도 진행 가능)
            const { data: calendar, error: calError } = await supabaseAdmin
                .from('Calendar')
                .select(`
                    *,
                    members:CalendarParticipant(participant:Participant(*))
                `)
                .eq('id', slot.calendarId ?? calendarId)
                .single();
            if (calError) {
                console.warn('Calendar fetch error (continuing without calendar):', calError);
            }

            // 3) 같은 캘린더의 모든 슬롯 (반복 요일 계산용)
            const { data: allSlots } = await supabaseAdmin
                .from('RecurringSlot')
                .select('*')
                .eq('calendarId', slot.calendarId ?? calendarId)
                .order('dayOfWeek', { ascending: true });

            const day = new Date(dateStr);
            const startAt = new Date(day);
            startAt.setHours(0, slot.startMinutes, 0, 0);
            const endAt = new Date(day);
            endAt.setHours(0, slot.endMinutes, 0, 0);

            // 참석자
            let participants: string[] = [];
            if (slot.participantNames) {
                try { participants = JSON.parse(slot.participantNames); } catch {}
            }
            const participantNamesList = participants.length > 0
                ? participants
                : ((calendar?.members || []).map((m: any) => m.participant.name));
            let participantRecords: any[] = [];
            if (participantNamesList && participantNamesList.length > 0) {
                const pr = await supabaseAdmin
                    .from('Participant')
                    .select('*')
                    .in('name', participantNamesList);
                participantRecords = pr.data || [];
            }

            const virtualEvent = {
                id,
                calendarId: slot.calendarId ?? calendarId,
                title: slot.eventTitle,
                description: null,
                startAt: startAt.toISOString(),
                endAt: endAt.toISOString(),
                allDay: false,
                calendar: calendar ?? null,
                attendees: (participantRecords || []).map((p: any) => ({ participant: p })),
                isRecurring: true,
                recurringSlotId: slot.id,
                recurringSlots: allSlots || [],
                recurringDays: (allSlots || []).map((s: any) => s.dayOfWeek) || [],
                recurringStartMinutes: slot.startMinutes,
                recurringEndMinutes: slot.endMinutes
            };

            return NextResponse.json({ event: virtualEvent }, { headers: { 'Cache-Control': 'no-cache' } });
        }
	}
	
	// 일반 이벤트 처리
	const { data: event, error } = await supabase
		.from('Event')
		.select(`
			*,
			attendees:EventParticipant(participant:Participant(*)),
			calendar:Calendar(*)
		`)
		.eq('id', id)
		.single();
	
	if (error) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
	if (!event) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}
	
	return NextResponse.json({ event }, { headers: { 'Cache-Control': 'no-cache' } });
}

export async function PUT(req: NextRequest, ctx: ParamsPromise) {
	const role = req.cookies.get("gbti_role")?.value;
	if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
	const { id } = await ctx.params;
	const { title, participants, ...otherData } = await req.json();
	
	try {
		// 이벤트 기본 정보 업데이트
		const { data: updated, error: updateError } = await supabase
			.from('Event')
			.update({ title, ...otherData, updatedAt: new Date().toISOString() })
			.eq('id', id)
			.select()
			.single();
		
		if (updateError) throw updateError;
		
		// 참여자 정보 업데이트
		if (participants !== undefined && Array.isArray(participants)) {
			// 기존 참여자 관계 삭제
			await supabase
				.from('EventParticipant')
				.delete()
				.eq('eventId', id);
			
			// 새 참여자 관계 추가
			if (participants.length > 0) {
				const calendarId = updated.calendarId;
				
				for (const name of participants) {
					const participantId = await getOrCreateParticipant(name);
					await supabase
						.from('EventParticipant')
						.insert({ eventId: id, participantId });
					
					await supabase
						.from('CalendarParticipant')
						.upsert({ calendarId, participantId }, { onConflict: 'calendarId,participantId' });
				}
			}
		}
		
		return NextResponse.json({ event: updated });
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

export async function DELETE(_req: NextRequest, ctx: ParamsPromise) {
	const role = _req.cookies.get("gbti_role")?.value;
	if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
	const { id } = await ctx.params;
	
	try {
		// 반복 이벤트 처리: 같은 이벤트의 모든 슬롯 삭제
		if (id.startsWith('recurring-')) {
			// recurring-<slotId> 형식
			const slotId = id.replace('recurring-', '');
			
			// 해당 슬롯 정보 가져오기
			const { data: slot, error: slotError } = await supabase
				.from('RecurringSlot')
				.select('*')
				.eq('id', slotId)
				.single();
			
			if (slotError || !slot) {
				console.error('Slot fetch error:', slotError);
				return NextResponse.json({ error: "Slot not found" }, { status: 404 });
			}
			
			console.log('Deleting recurring slots for:', slot.eventTitle, slot.calendarId);
			
			// 같은 이벤트 제목, 시간대를 가진 모든 슬롯 삭제
			const { error: deleteError } = await supabaseAdmin
				.from('RecurringSlot')
				.delete()
				.eq('calendarId', slot.calendarId)
				.eq('eventTitle', slot.eventTitle)
				.eq('startMinutes', slot.startMinutes)
				.eq('endMinutes', slot.endMinutes);
			
			if (deleteError) {
				console.error('Delete error:', deleteError);
				return NextResponse.json({ error: deleteError.message }, { status: 500 });
			}
			
			return NextResponse.json({ ok: true });
        } else if (id.startsWith('R-')) {
            // R-<calendarId>-<iso>-<uuid(5 parts)>
            const parts = id.split('-');
            if (parts.length >= 8) {
                const slotId = parts.slice(-5).join('-');
                const { data: slot, error: slotError } = await supabase
                    .from('RecurringSlot')
                    .select('*')
                    .eq('id', slotId)
                    .single();
                if (slotError || !slot) {
                    return NextResponse.json({ error: "Slot not found" }, { status: 404 });
                }
                const { error: deleteError } = await supabaseAdmin
                    .from('RecurringSlot')
                    .delete()
                    .eq('calendarId', slot.calendarId)
                    .eq('eventTitle', slot.eventTitle)
                    .eq('startMinutes', slot.startMinutes)
                    .eq('endMinutes', slot.endMinutes);
                if (deleteError) {
                    return NextResponse.json({ error: deleteError.message }, { status: 500 });
                }
                return NextResponse.json({ ok: true });
            } else {
                return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
            }
        }
		
		// 일반 이벤트 삭제
		const { error } = await supabase
			.from('Event')
			.delete()
			.eq('id', id);
		
		if (error) throw error;
		
		return NextResponse.json({ ok: true });
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

export async function PATCH(req: NextRequest, ctx: ParamsPromise) {
	const role = req.cookies.get("gbti_role")?.value;
	if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
	const { id } = await ctx.params;
	const { endsOn } = await req.json();

	try {
		// 반복 이벤트 처리: 같은 이벤트의 모든 슬롯의 endsOn 설정
		if (id.startsWith('R-')) {
			const parts = id.split('-');
			if (parts.length >= 4) {
				const slotId = parts[parts.length - 1];
				
				// 해당 슬롯 정보 가져오기
                const { data: slot, error: slotError } = await supabase
					.from('RecurringSlot')
					.select('*')
					.eq('id', slotId)
					.single();
				
				if (slotError || !slot) {
					return NextResponse.json({ error: "Slot not found" }, { status: 404 });
				}
				
				// 같은 이벤트 제목, 시간대를 가진 모든 슬롯 업데이트
                const { error: updateError } = await supabaseAdmin
					.from('RecurringSlot')
					.update({ endsOn: new Date(endsOn).toISOString() })
					.eq('calendarId', slot.calendarId)
					.eq('eventTitle', slot.eventTitle)
					.eq('startMinutes', slot.startMinutes)
					.eq('endMinutes', slot.endMinutes);
				
				if (updateError) throw updateError;
				
				return NextResponse.json({ ok: true });
			}
		}

		// 일반 이벤트 처리
		const { data: event, error: eventError } = await supabase
			.from('Event')
			.select('*')
			.eq('id', id)
			.single();
		
		if (eventError || !event) {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}

		// 이벤트 시간대를 기준으로 해당 요일/시간 슬롯 종료 처리
		const dow = new Date(event.startAt).getDay();
		const startMinutes = new Date(event.startAt).getHours() * 60 + new Date(event.startAt).getMinutes();
		const endMinutes = new Date(event.endAt).getHours() * 60 + new Date(event.endAt).getMinutes();

        const { error: updateError } = await supabaseAdmin
			.from('RecurringSlot')
			.update({ endsOn: new Date(endsOn).toISOString() })
			.eq('calendarId', event.calendarId)
			.eq('dayOfWeek', dow)
			.eq('startMinutes', startMinutes)
			.eq('endMinutes', endMinutes);

		if (updateError) throw updateError;

		return NextResponse.json({ ok: true });
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

async function getOrCreateParticipant(name: string): Promise<string> {
	const { data: existing } = await supabase
		.from('Participant')
		.select('id')
		.eq('name', name)
		.single();
	
	if (existing) return existing.id;
	
	const { data: created, error } = await supabase
		.from('Participant')
		.insert({ name })
		.select('id')
		.single();
	
	if (error) throw error;
	return created.id;
}

