"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Participant = {
	id: string;
	name: string;
};

type Event = {
	id: string;
	title: string;
	startAt: string;
	endAt: string;
	participants?: string[];
	isRecurring?: boolean;
	recurringSlotId?: string;
	recurringDays?: number[];
	recurringStartMinutes?: number;
	recurringEndMinutes?: number;
};

export default function AdminPage() {
	const router = useRouter();
	const [participants, setParticipants] = useState<Participant[]>([]);
	const [events, setEvents] = useState<Event[]>([]);
	const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
	const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetchData();
	}, []);

	async function fetchData() {
		setLoading(true);
		try {
			const [participantsRes, eventsRes] = await Promise.all([
				fetch("/api/participants"),
				fetch("/api/events?start=2020-01-01&end=2050-12-31")
			]);

			const participantsData = await participantsRes.json();
			const eventsData = await eventsRes.json();

			setParticipants(participantsData.participants || []);
			
			// 반복 이벤트 그룹화
			const groupedEvents = groupRecurringEvents(eventsData.events || []);
			setEvents(groupedEvents);
		} catch (err) {
			console.error("데이터 로딩 실패:", err);
		} finally {
			setLoading(false);
		}
	}

	// 반복 이벤트를 그룹화하는 함수
	function groupRecurringEvents(events: Event[]): Event[] {
		const recurringGroups = new Map<string, { count: number; rep: Event }>();
		const regularEvents: Event[] = [];

		events.forEach(event => {
			if (event.isRecurring && event.recurringSlotId !== undefined) {
				// 제목 + 시간대 + 캘린더 기준으로 대표만 노출 (slotId 아님)
				const startKey = event.recurringStartMinutes ?? new Date(event.startAt).getHours() * 60 + new Date(event.startAt).getMinutes();
				const endKey = event.recurringEndMinutes ?? new Date(event.endAt).getHours() * 60 + new Date(event.endAt).getMinutes();
				const groupKey = `${event.title}-${startKey}-${endKey}-${(event as any).calendarId ?? ''}`;
				if (!recurringGroups.has(groupKey)) {
					recurringGroups.set(groupKey, { count: 1, rep: event });
				} else {
					const cur = recurringGroups.get(groupKey)!;
					cur.count += 1;
				}
			} else {
				regularEvents.push(event);
			}
		});

		const groupedRecurringEvents: Event[] = [];
		recurringGroups.forEach(({ count, rep }) => {
			const groupedEvent: Event = {
				...rep,
				id: `recurring-${rep.recurringSlotId}`,
				title: `${rep.title}`,
				isRecurring: true,
				recurringSlotId: rep.recurringSlotId,
				recurringDays: rep.recurringDays,
				recurringStartMinutes: rep.recurringStartMinutes,
				recurringEndMinutes: rep.recurringEndMinutes,
			};
			groupedRecurringEvents.push(groupedEvent);
		});

		return [...regularEvents, ...groupedRecurringEvents];
	}

	async function deleteParticipants() {
		if (!confirm(`선택한 ${selectedParticipants.size}명의 참여자를 삭제하시겠습니까?`)) return;

		for (const id of selectedParticipants) {
			await fetch(`/api/participants/${id}`, { method: "DELETE" });
		}

		setSelectedParticipants(new Set());
		fetchData();
	}

	async function deleteEvents() {
		if (!confirm(`선택한 ${selectedEvents.size}개의 이벤트를 삭제하시겠습니까?`)) return;

		for (const id of selectedEvents) {
			try {
				// 반복 이벤트인 경우 특별 처리
				if (id.startsWith('recurring-')) {
					// recurring-<slotId> 형식 그대로 사용
					const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
					if (!res.ok) {
						const error = await res.json();
						console.error('Delete error:', error);
					}
				} else {
					await fetch(`/api/events/${id}`, { method: "DELETE" });
				}
			} catch (err) {
				console.error('Failed to delete event:', id, err);
			}
		}

		setSelectedEvents(new Set());
		fetchData();
	}

	function toggleParticipant(id: string) {
		const newSelected = new Set(selectedParticipants);
		if (newSelected.has(id)) {
			newSelected.delete(id);
		} else {
			newSelected.add(id);
		}
		setSelectedParticipants(newSelected);
	}

	function toggleEvent(id: string) {
		const newSelected = new Set(selectedEvents);
		if (newSelected.has(id)) {
			newSelected.delete(id);
		} else {
			newSelected.add(id);
		}
		setSelectedEvents(newSelected);
	}

	if (loading) {
		return <div className="p-6">로딩 중...</div>;
	}

	return (
		<div className="p-6 max-w-7xl mx-auto">
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-semibold">관리자 페이지</h1>
				<button
					className="px-4 py-2 rounded text-black transition-colors cursor-pointer"
					style={{ backgroundColor: "#FDC205" }}
					onClick={() => router.push("/calendar")}
				>
					캘린더로 돌아가기
				</button>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* 참여자 관리 */}
				<div className="bg-white dark:bg-zinc-900 rounded-lg border p-6">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-xl font-semibold">참여자 관리</h2>
						<button
					className="px-4 py-2 rounded text-black transition-colors cursor-pointer disabled:opacity-50"
					style={{ backgroundColor: "#FDC205" }}
							onClick={deleteParticipants}
							disabled={selectedParticipants.size === 0}
						>
							삭제 ({selectedParticipants.size})
						</button>
					</div>
					<div className="space-y-2 max-h-96 overflow-y-auto">
						{participants.length === 0 ? (
							<div className="text-center text-zinc-500 py-8">참여자가 없습니다.</div>
						) : (
							participants.map((p) => (
								<label key={p.id} className="flex items-center gap-3 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded cursor-pointer">
									<input
										type="checkbox"
										checked={selectedParticipants.has(p.id)}
										onChange={() => toggleParticipant(p.id)}
										className="cursor-pointer"
									/>
									<span>{p.name}</span>
								</label>
							))
						)}
					</div>
				</div>

				{/* 이벤트 관리 */}
				<div className="bg-white dark:bg-zinc-900 rounded-lg border p-6">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-xl font-semibold">이벤트 관리</h2>
						<button
					className="px-4 py-2 rounded text-black transition-colors cursor-pointer disabled:opacity-50"
					style={{ backgroundColor: "#FDC205" }}
							onClick={deleteEvents}
							disabled={selectedEvents.size === 0}
						>
							삭제 ({selectedEvents.size})
						</button>
					</div>
					<div className="space-y-2 max-h-96 overflow-y-auto">
						{events.length === 0 ? (
							<div className="text-center text-zinc-500 py-8">이벤트가 없습니다.</div>
						) : (
							events.map((e) => (
								<label key={e.id} className="flex items-center gap-3 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded cursor-pointer">
									<input
										type="checkbox"
										checked={selectedEvents.has(e.id)}
										onChange={() => toggleEvent(e.id)}
										className="cursor-pointer"
									/>
									<div className="flex-1">
										<div className="font-medium">{e.title}</div>
										{e.isRecurring ? (
											<div className="text-sm text-zinc-500">
												반복 이벤트 - 요일: {e.recurringDays?.map(d => ['일', '월', '화', '수', '목', '금', '토'][d]).join(', ')}
												<br />
												시간: {Math.floor((e.recurringStartMinutes || 0) / 60)}:{(e.recurringStartMinutes || 0) % 60 < 10 ? '0' : ''}{(e.recurringStartMinutes || 0) % 60} - {Math.floor((e.recurringEndMinutes || 0) / 60)}:{(e.recurringEndMinutes || 0) % 60 < 10 ? '0' : ''}{(e.recurringEndMinutes || 0) % 60}
											</div>
										) : (
											<div className="text-sm text-zinc-500">
												{new Date(e.startAt).toLocaleString()} - {new Date(e.endAt).toLocaleString()}
											</div>
										)}
										{e.participants && e.participants.length > 0 && (
											<div className="text-xs text-zinc-400">
												참여자: {e.participants.join(", ")}
											</div>
										)}
									</div>
								</label>
							))
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

