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
			setEvents(eventsData.events || []);
		} catch (err) {
			console.error("데이터 로딩 실패:", err);
		} finally {
			setLoading(false);
		}
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
			await fetch(`/api/events/${id}`, { method: "DELETE" });
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
					className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer"
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
							className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer disabled:opacity-50"
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
							className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer disabled:opacity-50"
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
										<div className="text-sm text-zinc-500">
											{new Date(e.startAt).toLocaleString()} - {new Date(e.endAt).toLocaleString()}
										</div>
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

