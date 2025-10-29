"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

export default function EventManagementPage() {
	const router = useRouter();
	const [events, setEvents] = useState<Event[]>([]);
	const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetchEvents();
	}, []);

	async function fetchEvents() {
		setLoading(true);
		try {
			const res = await fetch("/api/events?start=2020-01-01&end=2050-12-31");
			const data = await res.json();
			
			// 반복 이벤트 그룹화
			const groupedEvents = groupRecurringEvents(data.events || []);
			setEvents(groupedEvents);
		} catch (err) {
			console.error("이벤트 로딩 실패:", err);
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

	async function deleteEvents() {
		if (!confirm(`선택한 ${selectedEvents.size}개의 이벤트를 삭제하시겠습니까?`)) return;

		for (const id of selectedEvents) {
			try {
				if (id.startsWith('recurring-')) {
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
		fetchEvents();
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
		<div className="p-6 max-w-6xl mx-auto">
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-semibold">이벤트 관리</h1>
				<button
					className="px-4 py-2 rounded text-black transition-colors cursor-pointer"
					style={{ backgroundColor: "#FDC205" }}
					onClick={() => router.push("/admin")}
				>
					관리자 페이지로 돌아가기
				</button>
			</div>

			<div className="bg-white dark:bg-zinc-900 rounded-lg border p-6">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-lg font-semibold">이벤트 목록</h2>
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
							<div key={e.id} className="flex items-start gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded">
								<input
									type="checkbox"
									checked={selectedEvents.has(e.id)}
									onChange={() => toggleEvent(e.id)}
									className="cursor-pointer mt-1"
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
							</div>
						))
					)}
				</div>
			</div>
		</div>
	);
}
