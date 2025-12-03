"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { applyColorTheme } from "@/app/lib/color-themes";

type GameType = "roulette" | "ladder";

type StoredGame = {
	id: string;
	createdAt: number;
	data: {
		gameType: GameType;
		title: string;
		winnerNames: string[];
		loserNames: string[];
		allNames: string[];
	};
};

const STORAGE_KEY = "gbti_games";

export default function LadderGameManagementPage() {
	const router = useRouter();
	const { theme } = useTheme();
	const [colorTheme, setColorTheme] = useState<string>("default");
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [savedGames, setSavedGames] = useState<StoredGame[]>([]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		try {
			const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as StoredGame[];
			setSavedGames(stored);
		} catch (err) {
			console.error("저장된 게임을 불러오지 못했습니다.", err);
		}
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

	function updateSavedGames(next: StoredGame[]) {
		setSavedGames(next);
		try {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
		} catch (err) {
			console.error("저장된 게임을 저장하지 못했습니다.", err);
			alert("로컬 저장에 실패했습니다. 브라우저 저장 공간을 확인해주세요.");
		}
	}

	function handleDelete(id: string) {
		if (!confirm("이 저장된 게임을 삭제하시겠습니까?")) return;
		updateSavedGames(savedGames.filter((game) => game.id !== id));
	}

	function handleView(id: string) {
		router.push(`/ladder-game?id=${id}`);
	}

	function handleClearAll() {
		if (!confirm("모든 저장된 게임을 삭제하시겠습니까?")) return;
		updateSavedGames([]);
	}

	return (
		<div className="p-6 max-w-6xl mx-auto" style={{ background: "var(--background)", color: "var(--foreground)" }}>
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-semibold">룰렛/사다리타기 만들기</h1>
				<div className="flex gap-2">
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
						onClick={() => setShowCreateModal(true)}
					>
						새로 만들기
					</button>
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
			</div>

			<div className="text-center py-8" style={{ color: "var(--foreground)", opacity: 0.7 }}>
				룰렛 또는 사다리타기를 만들고 결과를 확인하세요!
			</div>

			<div className="mt-8">
				<div className="flex items-center justify-between mb-3">
					<h2 className="text-lg font-semibold">저장된 게임</h2>
					<button
						className="text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
						onClick={handleClearAll}
					>
						전체 삭제
					</button>
				</div>
				{savedGames.length === 0 ? (
					<div 
						className="text-sm rounded p-4"
						style={{ 
							color: "var(--foreground)", 
							opacity: 0.7,
							border: "1px solid var(--accent)",
							background: "var(--background)"
						}}
					>
						저장된 게임이 없습니다. 새로 만들어보세요!
					</div>
				) : (
					<div className="space-y-3">
						{savedGames.map((game) => (
							<div
								key={game.id}
								className="flex items-center justify-between rounded-lg p-4"
								style={{ 
									border: "1px solid var(--accent)",
									background: "var(--background)"
								}}
							>
								<div>
									<div className="font-semibold">{game.data.title}</div>
									<div className="text-sm" style={{ color: "var(--foreground)", opacity: 0.7 }}>
										{game.data.gameType === "roulette" ? "룰렛" : "사다리타기"} ·{" "}
										{new Date(game.createdAt).toLocaleString("ko-KR")}
									</div>
								</div>
								<div className="flex gap-2">
									<button
										className="px-3 py-1 rounded text-sm transition-colors cursor-pointer"
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
										onClick={() => handleView(game.id)}
									>
										보기
									</button>
									<button
										className="px-3 py-1 rounded text-sm transition-colors cursor-pointer"
										style={{ 
											border: "1px solid #ef4444",
											background: "var(--background)",
											color: "#ef4444"
										}}
										onMouseEnter={(e) => {
											e.currentTarget.style.background = "color-mix(in srgb, #ef4444 20%, var(--background) 80%)";
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.background = "var(--background)";
										}}
										onClick={() => handleDelete(game.id)}
									>
										삭제
									</button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{showCreateModal && (
				<CreateLadderGameModal
					onSaved={(games) => updateSavedGames(games)}
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
	onSaved,
	onClose,
	onCreated,
}: {
	onSaved: (games: StoredGame[]) => void;
	onClose: () => void;
	onCreated: () => void;
}) {
	const router = useRouter();
	const [gameType, setGameType] = useState<GameType>("roulette");
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

		const id =
			typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());

		const gameData = {
			gameType,
			title,
			winnerNames,
			loserNames,
			allNames: [...winnerNames, ...loserNames],
		};

		const storedGame: StoredGame = {
			id,
			createdAt: Date.now(),
			data: gameData,
		};

		// UTF-8 인코딩 후 base64 변환 (한글 처리, 공유용)
		const jsonString = JSON.stringify(gameData);
		const encodedData = btoa(unescape(encodeURIComponent(jsonString)));

		try {
			const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as StoredGame[];
			const next = [storedGame, ...stored];
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
			onSaved(next);
		} catch (err) {
			console.error("로컬 저장에 실패했습니다.", err);
		}

		// 게임 페이지로 이동 (id 기반, data는 fallback)
		router.push(`/ladder-game?id=${id}&data=${encodeURIComponent(encodedData)}`);
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
									onChange={(e) => setGameType(e.target.value as GameType)}
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
									onChange={(e) => setGameType(e.target.value as GameType)}
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
						className="px-4 py-2 rounded transition-colors cursor-pointer"
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
						onClick={onClose}
					>
						취소
					</button>
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
						onClick={submit}
					>
						생성
					</button>
				</div>
			</div>
		</div>
	);
}

