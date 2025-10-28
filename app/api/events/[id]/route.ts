import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";

type ParamsPromise = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: ParamsPromise) {
	const { id } = await ctx.params;
	
	// 반복 이벤트(R- 으로 시작하는 가상 ID) 처리
	if (id.startsWith('R-')) {
		const parts = id.split('-');
		if (parts.length >= 4) {
			const calendarId = parts[1];
			const dateStr = parts.slice(2, -1).join('-');
			const slotId = parts[parts.length - 1];
			
			const calendar = await prisma.calendar.findUnique({
				where: { id: calendarId },
				include: {
					members: { include: { participant: true } },
					recurringSlots: { where: { id: slotId } }
				}
			});
			
			if (!calendar || calendar.recurringSlots.length === 0) {
				return NextResponse.json({ error: "Not found" }, { status: 404 });
			}
			
			const slot = calendar.recurringSlots[0];
			const day = new Date(dateStr);
			const startAt = new Date(day);
			startAt.setHours(0, slot.startMinutes, 0, 0);
			const endAt = new Date(day);
			endAt.setHours(0, slot.endMinutes, 0, 0);
			
			// 해당 캘린더의 모든 반복 슬롯 가져오기
			const allSlots = await prisma.recurringSlot.findMany({
				where: { calendarId: calendar.id },
				orderBy: { dayOfWeek: 'asc' }
			});
			
		// 슬롯에 저장된 참석자 정보 사용
		let participants: string[] = [];
		if (slot.participantNames) {
			participants = JSON.parse(slot.participantNames);
		}
		
		// 참석자 이름으로 Participant 객체 찾기
		const participantRecords = await prisma.participant.findMany({
			where: { name: { in: participants } }
		});
		
		const virtualEvent = {
			id,
			calendarId: calendar.id,
			title: slot.eventTitle,
			description: null,
			startAt: startAt.toISOString(),
			endAt: endAt.toISOString(),
			allDay: false,
			calendar: calendar,
			attendees: participantRecords.map((p: { id: string; name: string }) => ({
				participant: p
			})),
			isRecurring: true,
			recurringSlotId: slot.id,
			recurringSlots: allSlots,
			recurringDays: allSlots.map(s => s.dayOfWeek),
			recurringStartMinutes: slot.startMinutes,
			recurringEndMinutes: slot.endMinutes
		};
			
			return NextResponse.json({ event: virtualEvent }, { headers: { 'Cache-Control': 'no-cache' } });
		}
	}
	
	// 일반 이벤트 처리
	const event = await prisma.event.findUnique({
		where: { id },
		include: {
			attendees: {
				include: {
					participant: true
				}
			},
			calendar: true
		},
	});
	if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
	return NextResponse.json({ event }, { headers: { 'Cache-Control': 'no-cache' } });
}

export async function PUT(req: NextRequest, ctx: ParamsPromise) {
	const role = req.cookies.get("gbti_role")?.value;
	if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
	const { id } = await ctx.params;
	const { title, participants, ...otherData } = await req.json();
	
	const event = await prisma.$transaction(async (tx) => {
		// 이벤트 기본 정보 업데이트
		const updated = await tx.event.update({ 
			where: { id }, 
			data: { title, ...otherData } 
		});
		
		// 참여자 정보 업데이트
		if (participants !== undefined && Array.isArray(participants)) {
			// 기존 참여자 관계 삭제
			await tx.eventParticipant.deleteMany({ where: { eventId: id } });
			
			// 새 참여자 관계 추가
			if (participants.length > 0) {
				const participantNames: string[] = participants;
				const calendarId = updated.calendarId;
				
				for (const name of participantNames) {
					const p = await tx.participant.upsert({ where: { name }, update: {}, create: { name } });
					await tx.eventParticipant.create({ data: { eventId: id, participantId: p.id } });
					await tx.calendarParticipant.upsert({ 
						where: { calendarId_participantId: { calendarId, participantId: p.id } }, 
						update: {}, 
						create: { calendarId, participantId: p.id } 
					});
				}
			}
		}
		
		return updated;
	});
	
	return NextResponse.json({ event });
}

export async function DELETE(_req: NextRequest, ctx: ParamsPromise) {
	const role = _req.cookies.get("gbti_role")?.value;
	if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
	const { id } = await ctx.params;
	
	// 반복 이벤트 처리: 같은 이벤트의 모든 슬롯 삭제
	if (id.startsWith('R-')) {
		const parts = id.split('-');
		if (parts.length >= 4) {
			const slotId = parts[parts.length - 1];
			
			// 해당 슬롯 정보 가져오기
			const slot = await prisma.recurringSlot.findUnique({ where: { id: slotId } });
			if (!slot) return NextResponse.json({ error: "Slot not found" }, { status: 404 });
			
			// 같은 이벤트 제목, 시간대를 가진 모든 슬롯 삭제
			await prisma.recurringSlot.deleteMany({
				where: {
					calendarId: slot.calendarId,
					eventTitle: slot.eventTitle,
					startMinutes: slot.startMinutes,
					endMinutes: slot.endMinutes
				}
			});
			
			return NextResponse.json({ ok: true });
		}
	}
	
	// 일반 이벤트 삭제
	await prisma.event.delete({ where: { id } });
	return NextResponse.json({ ok: true });
}

// 반복 종료: 해당 캘린더의 특정 요일/시간 슬롯을 종료일로 마감
export async function PATCH(req: NextRequest, ctx: ParamsPromise) {
	const role = req.cookies.get("gbti_role")?.value;
	if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
	const { id } = await ctx.params;
	const { endsOn } = await req.json();

	// 반복 이벤트 처리: 같은 이벤트의 모든 슬롯의 endsOn 설정
	if (id.startsWith('R-')) {
		const parts = id.split('-');
		if (parts.length >= 4) {
			const slotId = parts[parts.length - 1];
			
			// 해당 슬롯 정보 가져오기
			const slot = await prisma.recurringSlot.findUnique({ where: { id: slotId } });
			if (!slot) return NextResponse.json({ error: "Slot not found" }, { status: 404 });
			
			// 같은 이벤트 제목, 시간대를 가진 모든 슬롯 업데이트
			await prisma.recurringSlot.updateMany({
				where: {
					calendarId: slot.calendarId,
					eventTitle: slot.eventTitle,
					startMinutes: slot.startMinutes,
					endMinutes: slot.endMinutes
				},
				data: { endsOn: new Date(endsOn) }
			});
			
			return NextResponse.json({ ok: true });
		}
	}

	// 일반 이벤트 처리
	const event = await prisma.event.findUnique({ where: { id } });
	if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

	// 이벤트 시간대를 기준으로 해당 요일/시간 슬롯 종료 처리
	const dow = new Date(event.startAt).getDay();
	const startMinutes = new Date(event.startAt).getHours() * 60 + new Date(event.startAt).getMinutes();
	const endMinutes = new Date(event.endAt).getHours() * 60 + new Date(event.endAt).getMinutes();

	await prisma.recurringSlot.updateMany({
		where: {
			calendarId: event.calendarId,
			dayOfWeek: dow,
			startMinutes,
			endMinutes,
			OR: [{ endsOn: null }, { endsOn: { gt: new Date(endsOn) } }],
		},
		data: { endsOn: new Date(endsOn) },
	});

	return NextResponse.json({ ok: true });
}
