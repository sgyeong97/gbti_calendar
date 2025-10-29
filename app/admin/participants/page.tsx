"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Participant = {
	id: string;
	name: string;
};

export default function ParticipantManagementPage() {
	const router = useRouter();
	const [participants, setParticipants] = useState<Participant[]>([]);
	const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
	const [loading, setLoading] = useState(true);
	const [newParticipantName, setNewParticipantName] = useState("");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingName, setEditingName] = useState("");

	useEffect(() => {
		fetchParticipants();
	}, []);

	async function fetchParticipants() {
		setLoading(true);
		try {
			const res = await fetch("/api/participants");
			const data = await res.json();
			setParticipants(data.participants || []);
		} catch (err) {
			console.error("참여자 로딩 실패:", err);
		} finally {
			setLoading(false);
		}
	}

	async function addParticipant() {
		if (!newParticipantName.trim()) return;

		try {
			const res = await fetch("/api/participants", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: newParticipantName.trim() }),
			});

			if (res.ok) {
				setNewParticipantName("");
				fetchParticipants();
			} else {
				alert("참여자 추가에 실패했습니다.");
			}
		} catch (err) {
			alert("네트워크 오류가 발생했습니다.");
		}
	}

	async function updateParticipant(id: string) {
		if (!editingName.trim()) return;

		try {
			const res = await fetch(`/api/participants/${id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: editingName.trim() }),
			});

			if (res.ok) {
				setEditingId(null);
				setEditingName("");
				fetchParticipants();
			} else {
				alert("참여자 수정에 실패했습니다.");
			}
		} catch (err) {
			alert("네트워크 오류가 발생했습니다.");
		}
	}

	async function deleteParticipants() {
		if (!confirm(`선택한 ${selectedParticipants.size}명의 참여자를 삭제하시겠습니까?`)) return;

		for (const id of selectedParticipants) {
			await fetch(`/api/participants/${id}`, { method: "DELETE" });
		}

		setSelectedParticipants(new Set());
		fetchParticipants();
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

	function startEdit(participant: Participant) {
		setEditingId(participant.id);
		setEditingName(participant.name);
	}

	function cancelEdit() {
		setEditingId(null);
		setEditingName("");
	}

	if (loading) {
		return <div className="p-6">로딩 중...</div>;
	}

	return (
		<div className="p-6 max-w-4xl mx-auto">
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-semibold">참여자 관리</h1>
				<button
					className="px-4 py-2 rounded text-black transition-colors cursor-pointer"
					style={{ backgroundColor: "#FDC205" }}
					onClick={() => router.push("/admin")}
				>
					관리자 페이지로 돌아가기
				</button>
			</div>

			{/* 참여자 추가 */}
			<div className="bg-white dark:bg-zinc-900 rounded-lg border p-6 mb-6">
				<h2 className="text-lg font-semibold mb-4">참여자 추가</h2>
				<div className="flex gap-2">
					<input
						type="text"
						placeholder="참여자 이름"
						value={newParticipantName}
						onChange={(e) => setNewParticipantName(e.target.value)}
						className="flex-1 border rounded px-3 py-2"
						onKeyDown={(e) => {
							if (e.key === "Enter") addParticipant();
						}}
					/>
					<button
						className="px-4 py-2 rounded text-black transition-colors cursor-pointer"
						style={{ backgroundColor: "#FDC205" }}
						onClick={addParticipant}
					>
						추가
					</button>
				</div>
			</div>

			{/* 참여자 목록 */}
			<div className="bg-white dark:bg-zinc-900 rounded-lg border p-6">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-lg font-semibold">참여자 목록</h2>
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
							<div key={p.id} className="flex items-center gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded">
								<input
									type="checkbox"
									checked={selectedParticipants.has(p.id)}
									onChange={() => toggleParticipant(p.id)}
									className="cursor-pointer"
								/>
								{editingId === p.id ? (
									<div className="flex-1 flex gap-2">
										<input
											type="text"
											value={editingName}
											onChange={(e) => setEditingName(e.target.value)}
											className="flex-1 border rounded px-2 py-1"
											onKeyDown={(e) => {
												if (e.key === "Enter") updateParticipant(p.id);
												if (e.key === "Escape") cancelEdit();
											}}
											autoFocus
										/>
										<button
											className="px-2 py-1 rounded text-black text-sm"
											style={{ backgroundColor: "#FDC205" }}
											onClick={() => updateParticipant(p.id)}
										>
											저장
										</button>
										<button
											className="px-2 py-1 rounded border text-sm"
											onClick={cancelEdit}
										>
											취소
										</button>
									</div>
								) : (
									<>
										<span className="flex-1">{p.name}</span>
										<button
											className="px-2 py-1 rounded border text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
											onClick={() => startEdit(p)}
										>
											수정
										</button>
									</>
								)}
							</div>
						))
					)}
				</div>
			</div>
		</div>
	);
}
