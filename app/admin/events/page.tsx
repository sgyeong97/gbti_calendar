"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { applyColorTheme } from "@/app/lib/color-themes";

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
	const { theme } = useTheme();
	const [colorTheme, setColorTheme] = useState<string>("default");
	const [events, setEvents] = useState<Event[]>([]);
	const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetchEvents();
	}, []);

	useEffect(() => {
		const savedColorTheme = localStorage.getItem("gbti_color_theme") || "default";
		setColorTheme(savedColorTheme);

		// 테마 적용
		applyColorTheme();

		// 테마 변경 감지 (다른 탭에서 변경된 경우)
		const handleStorageChange = () => {
			const newColorTheme = localStorage.getItem("gbti_color_theme") || "default";
			if (newColorTheme !== colorTheme) {
			setColorTheme(newColorTheme);
			}
		};

		window.addEventListener("storage", handleStorageChange);

		return () => {
			window.removeEventListener("storage", handleStorageChange);
		};
	}, [theme]);

	// colorTheme 변경 시 테마 적용
	useEffect(() => {
		applyColorTheme();
	}, [colorTheme]);

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
		return <div className="p-6" style={{ background: "var(--background)", color: "var(--foreground)" }}>로딩 중...</div>;
	}

	return (
		<div className="p-6 max-w-6xl mx-auto" style={{ background: "var(--background)", color: "var(--foreground)" }}>
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-semibold">이벤트 관리</h1>
				<button
					className="px-4 py-2 rounded transition-colors cursor-pointer"
					style={{ 
						backgroundColor: "var(--accent)", 
						color: "var(--foreground)" 
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.background = "color-mix(in srgb, var(--accent) 80%, var(--foreground) 20%)";
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.background = "var(--accent)";
					}}
					onClick={() => router.push("/admin")}
				>
					관리자 페이지로 돌아가기
				</button>
			</div>

			<div 
				className="rounded-lg p-6"
				style={{ 
					background: "var(--background)", 
					border: "1px solid var(--accent)" 
				}}
			>
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-lg font-semibold">이벤트 목록</h2>
					<button
						className="px-4 py-2 rounded transition-colors cursor-pointer disabled:opacity-50"
						style={{ 
							backgroundColor: selectedEvents.size > 0 ? "var(--accent)" : "color-mix(in srgb, var(--background) 80%, var(--accent) 20%)",
							color: "var(--foreground)" 
						}}
						onMouseEnter={(e) => {
							if (selectedEvents.size > 0) {
								e.currentTarget.style.background = "color-mix(in srgb, var(--accent) 80%, var(--foreground) 20%)";
							}
						}}
						onMouseLeave={(e) => {
							if (selectedEvents.size > 0) {
								e.currentTarget.style.background = "var(--accent)";
							}
						}}
						onClick={deleteEvents}
						disabled={selectedEvents.size === 0}
					>
						삭제 ({selectedEvents.size})
					</button>
				</div>
				<div className="space-y-2 max-h-96 overflow-y-auto">
					{events.length === 0 ? (
						<div className="text-center py-8" style={{ color: "var(--foreground)", opacity: 0.7 }}>이벤트가 없습니다.</div>
					) : (
						events.map((e) => (
							<div 
								key={e.id} 
								className="flex items-start gap-3 p-3 rounded transition-colors"
								style={{ 
									border: "1px solid var(--accent)",
									background: "var(--background)"
								}}
								onMouseEnter={(el) => {
									el.currentTarget.style.background = "color-mix(in srgb, var(--background) 95%, var(--accent) 5%)";
								}}
								onMouseLeave={(el) => {
									el.currentTarget.style.background = "var(--background)";
								}}
							>
								<input
									type="checkbox"
									checked={selectedEvents.has(e.id)}
									onChange={() => toggleEvent(e.id)}
									className="cursor-pointer mt-1"
								/>
								<div className="flex-1">
									<div className="font-medium">{e.title}</div>
									{e.isRecurring ? (
										<div className="text-sm" style={{ color: "var(--foreground)", opacity: 0.7 }}>
											반복 이벤트 - 요일: {e.recurringDays?.map(d => ['일', '월', '화', '수', '목', '금', '토'][d]).join(', ')}
											<br />
											시간: {Math.floor((e.recurringStartMinutes || 0) / 60)}:{(e.recurringStartMinutes || 0) % 60 < 10 ? '0' : ''}{(e.recurringStartMinutes || 0) % 60} - {Math.floor((e.recurringEndMinutes || 0) / 60)}:{(e.recurringEndMinutes || 0) % 60 < 10 ? '0' : ''}{(e.recurringEndMinutes || 0) % 60}
										</div>
									) : (
										<div className="text-sm" style={{ color: "var(--foreground)", opacity: 0.7 }}>
											{new Date(e.startAt).toLocaleString()} - {new Date(e.endAt).toLocaleString()}
										</div>
									)}
									{e.participants && e.participants.length > 0 && (
										<div className="text-xs" style={{ color: "var(--foreground)", opacity: 0.6 }}>
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
