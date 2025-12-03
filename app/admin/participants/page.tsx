"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { applyColorTheme } from "@/app/lib/color-themes";

type Participant = {
	id: string;
	name: string;
	title?: string | null;
	color?: string | null;
};

export default function ParticipantManagementPage() {
	const router = useRouter();
	const { theme } = useTheme();
	const [colorTheme, setColorTheme] = useState<string>("default");
	const [participants, setParticipants] = useState<Participant[]>([]);
	const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
	const [loading, setLoading] = useState(true);
	const [newParticipantName, setNewParticipantName] = useState("");
	const [newParticipantTitle, setNewParticipantTitle] = useState("");
	const [newParticipantColor, setNewParticipantColor] = useState("#e5e7eb");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingName, setEditingName] = useState("");
	const [editingTitle, setEditingTitle] = useState("");
	const [editingColor, setEditingColor] = useState("#e5e7eb");

	useEffect(() => {
		fetchParticipants();
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
				body: JSON.stringify({ 
					name: newParticipantName.trim(),
					title: newParticipantTitle.trim() || null,
					color: newParticipantColor || "#e5e7eb"
				}),
			});

			if (res.ok) {
				setNewParticipantName("");
				setNewParticipantTitle("");
				setNewParticipantColor("#e5e7eb");
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
				body: JSON.stringify({ 
					name: editingName.trim(),
					title: editingTitle.trim() || null,
					color: editingColor || "#e5e7eb"
				}),
			});

			if (res.ok) {
				setEditingId(null);
				setEditingName("");
				setEditingTitle("");
				setEditingColor("#e5e7eb");
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
		setEditingTitle(participant.title || "");
		setEditingColor(participant.color || "#e5e7eb");
	}

	function cancelEdit() {
		setEditingId(null);
		setEditingName("");
		setEditingTitle("");
		setEditingColor("#e5e7eb");
	}

	if (loading) {
		return <div className="p-6" style={{ background: "var(--background)", color: "var(--foreground)" }}>로딩 중...</div>;
	}

	return (
		<div className="p-6 max-w-4xl mx-auto" style={{ background: "var(--background)", color: "var(--foreground)" }}>
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-semibold">참여자 관리</h1>
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

			{/* 참여자 추가 */}
			<div 
				className="rounded-lg p-6 mb-6"
				style={{ 
					background: "var(--background)", 
					border: "1px solid var(--accent)" 
				}}
			>
				<h2 className="text-lg font-semibold mb-4">참여자 추가</h2>
				<div className="space-y-3">
					<div className="flex gap-2">
						<input
							type="text"
							placeholder="참여자 이름"
							value={newParticipantName}
							onChange={(e) => setNewParticipantName(e.target.value)}
							className="flex-1 rounded px-3 py-2"
							style={{ 
								border: "1px solid var(--accent)", 
								background: "var(--background)", 
								color: "var(--foreground)" 
							}}
							onKeyDown={(e) => {
								if (e.key === "Enter") addParticipant();
							}}
						/>
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
							onClick={addParticipant}
						>
							추가
						</button>
					</div>
					<div className="flex gap-2">
						<input
							type="text"
							placeholder="칭호 (예: 공주)"
							value={newParticipantTitle}
							onChange={(e) => setNewParticipantTitle(e.target.value)}
							className="flex-1 rounded px-3 py-2"
							style={{ 
								border: "1px solid var(--accent)", 
								background: "var(--background)", 
								color: "var(--foreground)" 
							}}
						/>
						<input
							type="color"
							value={newParticipantColor}
							onChange={(e) => setNewParticipantColor(e.target.value)}
							className="w-16 h-10 rounded cursor-pointer"
							style={{ border: "1px solid var(--accent)" }}
							title="색상 선택"
						/>
					</div>
				</div>
			</div>

			{/* 참여자 목록 */}
			<div 
				className="rounded-lg p-6"
				style={{ 
					background: "var(--background)", 
					border: "1px solid var(--accent)" 
				}}
			>
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-lg font-semibold">참여자 목록</h2>
					<button
						className="px-4 py-2 rounded transition-colors cursor-pointer disabled:opacity-50"
						style={{ 
							backgroundColor: selectedParticipants.size > 0 ? "var(--accent)" : "color-mix(in srgb, var(--background) 80%, var(--accent) 20%)",
							color: "var(--foreground)" 
						}}
						onMouseEnter={(e) => {
							if (selectedParticipants.size > 0) {
								e.currentTarget.style.background = "color-mix(in srgb, var(--accent) 80%, var(--foreground) 20%)";
							}
						}}
						onMouseLeave={(e) => {
							if (selectedParticipants.size > 0) {
								e.currentTarget.style.background = "var(--accent)";
							}
						}}
						onClick={deleteParticipants}
						disabled={selectedParticipants.size === 0}
					>
						삭제 ({selectedParticipants.size})
					</button>
				</div>
				<div className="space-y-2 max-h-96 overflow-y-auto">
					{participants.length === 0 ? (
						<div className="text-center py-8" style={{ color: "var(--foreground)", opacity: 0.7 }}>참여자가 없습니다.</div>
					) : (
						participants.map((p) => (
							<div 
								key={p.id} 
								className="flex items-center gap-3 p-3 rounded transition-colors"
								style={{ 
									border: "1px solid var(--accent)",
									background: "var(--background)"
								}}
								onMouseEnter={(e) => {
									e.currentTarget.style.background = "color-mix(in srgb, var(--background) 95%, var(--accent) 5%)";
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.background = "var(--background)";
								}}
							>
								<input
									type="checkbox"
									checked={selectedParticipants.has(p.id)}
									onChange={() => toggleParticipant(p.id)}
									className="cursor-pointer"
								/>
								{editingId === p.id ? (
									<div className="flex-1 space-y-2">
										<div className="flex gap-2">
											<input
												type="text"
												placeholder="이름"
												value={editingName}
												onChange={(e) => setEditingName(e.target.value)}
												className="flex-1 rounded px-2 py-1"
												style={{ 
													border: "1px solid var(--accent)", 
													background: "var(--background)", 
													color: "var(--foreground)" 
												}}
												onKeyDown={(e) => {
													if (e.key === "Enter") updateParticipant(p.id);
													if (e.key === "Escape") cancelEdit();
												}}
												autoFocus
											/>
											<input
												type="text"
												placeholder="칭호"
												value={editingTitle}
												onChange={(e) => setEditingTitle(e.target.value)}
												className="flex-1 rounded px-2 py-1"
												style={{ 
													border: "1px solid var(--accent)", 
													background: "var(--background)", 
													color: "var(--foreground)" 
												}}
											/>
											<input
												type="color"
												value={editingColor}
												onChange={(e) => setEditingColor(e.target.value)}
												className="w-16 h-9 rounded cursor-pointer"
												style={{ border: "1px solid var(--accent)" }}
												title="색상 선택"
											/>
										</div>
										<div className="flex gap-2">
											<button
												className="px-2 py-1 rounded text-sm transition-colors cursor-pointer"
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
												onClick={() => updateParticipant(p.id)}
											>
												저장
											</button>
											<button
												className="px-2 py-1 rounded text-sm transition-colors cursor-pointer"
												style={{ 
													border: "1px solid var(--accent)", 
													background: "var(--background)", 
													color: "var(--foreground)" 
												}}
												onMouseEnter={(e) => {
													e.currentTarget.style.background = "color-mix(in srgb, var(--background) 80%, var(--accent) 20%)";
												}}
												onMouseLeave={(e) => {
													e.currentTarget.style.background = "var(--background)";
												}}
												onClick={cancelEdit}
											>
												취소
											</button>
										</div>
									</div>
								) : (
									<>
										<div className="flex-1 flex items-center gap-2">
											<span className="px-2 py-0.5 text-xs rounded-full" style={{ 
												backgroundColor: p.color || "#e5e7eb",
												color: "#000"
											}}>
												{p.name}{p.title ? p.title : ""}
											</span>
										</div>
										<button
											className="px-2 py-1 rounded text-sm transition-colors cursor-pointer"
											style={{ 
												border: "1px solid var(--accent)", 
												background: "var(--background)", 
												color: "var(--foreground)" 
											}}
											onMouseEnter={(e) => {
												e.currentTarget.style.background = "color-mix(in srgb, var(--background) 80%, var(--accent) 20%)";
											}}
											onMouseLeave={(e) => {
												e.currentTarget.style.background = "var(--background)";
											}}
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
