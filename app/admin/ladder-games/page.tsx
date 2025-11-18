"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LadderGameManagementPage() {
	const router = useRouter();
	const [showCreateModal, setShowCreateModal] = useState(false);

	return (
		<div className="p-6 max-w-6xl mx-auto">
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-semibold">룰렛/사다리타기 만들기</h1>
				<div className="flex gap-2">
					<button
						className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer"
						onClick={() => setShowCreateModal(true)}
					>
						새로 만들기
					</button>
					<button
						className="px-4 py-2 rounded text-black transition-colors cursor-pointer"
						style={{ backgroundColor: "#FDC205" }}
						onClick={() => router.push("/admin")}
					>
						관리자 페이지로 돌아가기
					</button>
				</div>
			</div>

			<div className="text-center py-8 text-zinc-500">
				룰렛 또는 사다리타기를 만들고 결과를 확인하세요!
			</div>

			{showCreateModal && (
				<CreateLadderGameModal
					onClose={() => setShowCreateModal(false)}
					onCreated={() => {
						setShowCreateModal(false);
					}}
				/>
			)}
		</div>
	);
}

function CreateLadderGameModal({
	onClose,
	onCreated,
}: {
	onClose: () => void;
	onCreated: () => void;
}) {
	const router = useRouter();
	const [gameType, setGameType] = useState<"roulette" | "ladder">("roulette");
	const [title, setTitle] = useState("");
	const [winnerInput, setWinnerInput] = useState("");
	const [loserInput, setLoserInput] = useState("");
	const [winnerNames, setWinnerNames] = useState<string[]>([]);
	const [loserNames, setLoserNames] = useState<string[]>([]);

	function addWinner() {
		const name = winnerInput.trim();
		if (name && !winnerNames.includes(name) && !loserNames.includes(name)) {
			setWinnerNames([...winnerNames, name]);
			setWinnerInput("");
		}
	}

	function addLoser() {
		const name = loserInput.trim();
		if (name && !loserNames.includes(name) && !winnerNames.includes(name)) {
			setLoserNames([...loserNames, name]);
			setLoserInput("");
		}
	}

	function removeWinner(name: string) {
		setWinnerNames(winnerNames.filter((n) => n !== name));
	}

	function removeLoser(name: string) {
		setLoserNames(loserNames.filter((n) => n !== name));
	}

	function submit() {
		if (!title.trim()) {
			alert("제목을 입력해주세요.");
			return;
		}

		if (winnerNames.length === 0) {
			alert("당첨영역에 최소 1명을 추가해주세요.");
			return;
		}

		if (loserNames.length === 0) {
			alert("탈락영역에 최소 1명을 추가해주세요.");
			return;
		}

		// 데이터를 base64로 인코딩하여 URL 파라미터로 전달 (한글 처리)
		const gameData = {
			gameType,
			title,
			winnerNames,
			loserNames,
			allNames: [...winnerNames, ...loserNames],
		};

		// UTF-8 인코딩 후 base64 변환 (한글 처리)
		const jsonString = JSON.stringify(gameData);
		const encodedData = btoa(unescape(encodeURIComponent(jsonString)));
		
		// 룰렛 페이지로 이동
		router.push(`/ladder-game?data=${encodeURIComponent(encodedData)}`);
		onCreated();
	}

	return (
		<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
			<div
				className="rounded p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
				style={{ background: "var(--background)", color: "var(--foreground)" }}
			>
				<h2 className="text-xl font-semibold mb-4">새로 만들기</h2>

				<div className="space-y-4">
					<div>
						<label className="block text-sm font-medium mb-2">게임 타입</label>
						<div className="flex gap-4">
							<label className="flex items-center gap-2 cursor-pointer">
								<input
									type="radio"
									name="gameType"
									value="roulette"
									checked={gameType === "roulette"}
									onChange={(e) => setGameType(e.target.value as "roulette" | "ladder")}
									className="w-4 h-4"
								/>
								<span>룰렛</span>
							</label>
							<label className="flex items-center gap-2 cursor-pointer">
								<input
									type="radio"
									name="gameType"
									value="ladder"
									checked={gameType === "ladder"}
									onChange={(e) => setGameType(e.target.value as "roulette" | "ladder")}
									className="w-4 h-4"
								/>
								<span>사다리타기</span>
							</label>
						</div>
					</div>

					<div>
						<label className="block text-sm font-medium mb-1">제목</label>
						<input
							className="w-full border rounded px-3 py-2"
							placeholder="제목"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
						/>
					</div>

					<div className="grid grid-cols-2 gap-4">
						{/* 당첨영역 */}
						<div>
							<label className="block text-sm font-medium mb-1 text-green-600 dark:text-green-400">
								당첨영역
							</label>
							<div className="flex gap-2 mb-2">
								<input
									className="flex-1 border rounded px-3 py-2"
									placeholder="이름 입력 후 Enter"
									value={winnerInput}
									onChange={(e) => setWinnerInput(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											addWinner();
										}
									}}
								/>
								<button
									type="button"
									className="px-3 py-2 rounded bg-green-600 hover:bg-green-700 text-white transition-colors cursor-pointer"
									onClick={addWinner}
								>
									추가
								</button>
							</div>
							<div className="flex flex-wrap gap-2 min-h-[60px] p-2 border rounded">
								{winnerNames.map((name) => (
									<span
										key={name}
										className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded flex items-center gap-1"
									>
										{name}
										<button
											type="button"
											className="text-green-600 hover:text-green-800"
											onClick={() => removeWinner(name)}
										>
											×
										</button>
									</span>
								))}
							</div>
						</div>

						{/* 탈락영역 */}
						<div>
							<label className="block text-sm font-medium mb-1 text-red-600 dark:text-red-400">
								탈락영역
							</label>
							<div className="flex gap-2 mb-2">
								<input
									className="flex-1 border rounded px-3 py-2"
									placeholder="이름 입력 후 Enter"
									value={loserInput}
									onChange={(e) => setLoserInput(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											addLoser();
										}
									}}
								/>
								<button
									type="button"
									className="px-3 py-2 rounded bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer"
									onClick={addLoser}
								>
									추가
								</button>
							</div>
							<div className="flex flex-wrap gap-2 min-h-[60px] p-2 border rounded">
								{loserNames.map((name) => (
									<span
										key={name}
										className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded flex items-center gap-1"
									>
										{name}
										<button
											type="button"
											className="text-red-600 hover:text-red-800"
											onClick={() => removeLoser(name)}
										>
											×
										</button>
									</span>
								))}
							</div>
						</div>
					</div>
				</div>

				<div className="flex justify-end gap-2 mt-6">
					<button
						className="px-4 py-2 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
						onClick={onClose}
					>
						취소
					</button>
					<button
						className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer"
						onClick={submit}
					>
						생성
					</button>
				</div>
			</div>
		</div>
	);
}

