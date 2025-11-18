"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type LadderGame = {
	title: string;
	winnerNames: string[];
	loserNames: string[];
	allNames: string[];
};

function LadderGameContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [game, setGame] = useState<LadderGame | null>(null);
	const [loading, setLoading] = useState(true);
	const [started, setStarted] = useState(false);
	const [revealedResults, setRevealedResults] = useState<Set<string>>(new Set());
	const [animating, setAnimating] = useState(false);

	useEffect(() => {
		const dataParam = searchParams.get("data");
		if (dataParam) {
			try {
				const decodedData = JSON.parse(atob(decodeURIComponent(dataParam)));
				setGame({
					title: decodedData.title,
					winnerNames: decodedData.winnerNames,
					loserNames: decodedData.loserNames,
					allNames: decodedData.allNames || [...decodedData.winnerNames, ...decodedData.loserNames],
				});
			} catch (err) {
				console.error("데이터 파싱 실패:", err);
			} finally {
				setLoading(false);
			}
		} else {
			setLoading(false);
		}
	}, [searchParams]);

	function getResult(name: string): "win" | "lose" {
		if (!game) return "lose";
		return game.winnerNames.includes(name) ? "win" : "lose";
	}

	function handleStart() {
		setAnimating(true);
		setStarted(true);
		// 애니메이션 효과를 위해 약간의 딜레이
		setTimeout(() => {
			setAnimating(false);
		}, 2000);
	}

	function handleNameClick(name: string) {
		if (!started) return;
		setRevealedResults((prev) => {
			const next = new Set(prev);
			next.add(name);
			return next;
		});
	}

	if (loading) {
		return (
			<div className="p-6 max-w-6xl mx-auto text-center">
				<div>로딩 중...</div>
			</div>
		);
	}

	if (!game) {
		return (
			<div className="p-6 max-w-6xl mx-auto text-center">
				<div>사다리타기 데이터가 없습니다.</div>
				<button
					className="mt-4 px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer"
					onClick={() => router.push("/calendar")}
				>
					캘린더로 돌아가기
				</button>
			</div>
		);
	}

	// 사다리 그리기용 데이터 생성 (랜덤하게 보이지만 결과는 조작됨)
	const ladderData = generateLadderData(game.allNames, game.winnerNames);

	return (
		<div className="p-6 max-w-6xl mx-auto">
			<div className="mb-6">
				<h1 className="text-3xl font-bold mb-2">{game.title}</h1>
				<div className="flex items-center gap-4">
					{!started && (
						<button
							className="px-6 py-3 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-semibold transition-colors cursor-pointer"
							onClick={handleStart}
						>
							사다리타기 시작
						</button>
					)}
					<button
						className="px-4 py-2 rounded text-black transition-colors cursor-pointer"
						style={{ backgroundColor: "#FDC205" }}
						onClick={() => router.push("/calendar")}
					>
						캘린더로 돌아가기
					</button>
				</div>
			</div>

			<div className="bg-white dark:bg-zinc-900 rounded-lg border p-6">
				{/* 사다리타기 시각화 */}
				<div className="relative overflow-x-auto" style={{ minHeight: "400px" }}>
					<div className="inline-block min-w-full">
						<svg
							width="100%"
							height={Math.max(400, game.allNames.length * 80)}
							className="border rounded"
							style={{ background: "var(--background)", minWidth: "600px" }}
							viewBox="0 0 1000 400"
							preserveAspectRatio="xMidYMid meet"
						>
							{/* 세로선 (참여자) */}
							{game.allNames.map((name, idx) => {
								const x = 50 + (idx - (game.allNames.length - 1) / 2) * (900 / Math.max(1, game.allNames.length - 1));
								const isRevealed = revealedResults.has(name);
								const result = getResult(name);
								return (
									<g key={`line-${idx}`}>
										<line
											x1={x}
											y1={50}
											x2={x}
											y2={350}
											stroke="currentColor"
											strokeWidth="3"
											opacity={started ? 1 : 0.3}
										/>
										{/* 이름 클릭 영역 */}
										{started && (
											<rect
												x={x - 60}
												y={10}
												width={120}
												height={30}
												fill="transparent"
												style={{ cursor: "pointer" }}
												onClick={() => handleNameClick(name)}
											/>
										)}
										{/* 이름 */}
										<text
											x={x}
											y={30}
											textAnchor="middle"
											className="text-sm font-semibold fill-current"
											style={{ cursor: started ? "pointer" : "default", pointerEvents: "none" }}
										>
											{name}
										</text>
										{/* 결과 */}
										{started && isRevealed && (
											<>
												<rect
													x={x - 40}
													y={360}
													width={80}
													height={30}
													rx={5}
													fill={result === "win" ? "#10b981" : "#ef4444"}
													opacity={0.2}
												/>
												<text
													x={x}
													y={380}
													textAnchor="middle"
													className="text-base font-bold"
													fill={result === "win" ? "#10b981" : "#ef4444"}
												>
													{result === "win" ? "당첨" : "탈락"}
												</text>
											</>
										)}
									</g>
								);
							})}

							{/* 가로선 (사다리) */}
							{started &&
								ladderData.horizontalLines.map((line, idx) => {
									const opacity = animating ? 0.3 + (idx / ladderData.horizontalLines.length) * 0.7 : 1;
									const x1 = 50 + (line.x1 / 100) * 900;
									const x2 = 50 + (line.x2 / 100) * 900;
									const y = 50 + (line.y / 100) * 300;
									return (
										<line
											key={`h-line-${idx}`}
											x1={x1}
											y1={y}
											x2={x2}
											y2={y}
											stroke="currentColor"
											strokeWidth="2"
											opacity={opacity}
											style={{
												transition: "opacity 0.1s",
											}}
										/>
									);
								})}
						</svg>
					</div>
				</div>

				{/* 결과 표시 영역 */}
				{started && (
					<div className="mt-6 grid grid-cols-2 gap-4">
						<div>
							<h3 className="text-lg font-semibold text-green-600 dark:text-green-400 mb-2">
								당첨 영역
							</h3>
							<div className="space-y-2">
								{game.allNames
									.filter((name) => getResult(name) === "win")
									.map((name) => (
										<div
											key={name}
											className={`p-3 rounded border-2 transition-all cursor-pointer ${
												revealedResults.has(name)
													? "border-green-500 bg-green-50 dark:bg-green-900/20"
													: "border-transparent hover:border-green-300"
											}`}
											onClick={() => handleNameClick(name)}
										>
											<div className="font-semibold">{name}</div>
											{revealedResults.has(name) && (
												<div className="text-green-600 dark:text-green-400 mt-1">
													✓ 당첨
												</div>
											)}
										</div>
									))}
							</div>
						</div>
						<div>
							<h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
								탈락 영역
							</h3>
							<div className="space-y-2">
								{game.allNames
									.filter((name) => getResult(name) === "lose")
									.map((name) => (
										<div
											key={name}
											className={`p-3 rounded border-2 transition-all cursor-pointer ${
												revealedResults.has(name)
													? "border-red-500 bg-red-50 dark:bg-red-900/20"
													: "border-transparent hover:border-red-300"
											}`}
											onClick={() => handleNameClick(name)}
										>
											<div className="font-semibold">{name}</div>
											{revealedResults.has(name) && (
												<div className="text-red-600 dark:text-red-400 mt-1">
													✗ 탈락
												</div>
											)}
										</div>
									))}
							</div>
						</div>
					</div>
				)}

				{/* 안내 메시지 */}
				{started && (
					<div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded text-sm text-blue-800 dark:text-blue-200">
						💡 이름을 클릭하면 해당 사람의 결과를 확인할 수 있습니다.
					</div>
				)}
			</div>
		</div>
	);
}

// 사다리 데이터 생성 함수 (랜덤하게 보이지만 실제 결과는 조작됨)
function generateLadderData(allNames: string[], winnerNames: string[]) {
	const numPeople = allNames.length;
	const horizontalLines: { x1: number; x2: number; y: number }[] = [];

	// 각 참여자 위치 계산
	const positions: number[] = [];
	for (let i = 0; i < numPeople; i++) {
		positions.push((i + 1) * (100 / (numPeople + 1)));
	}

	// 랜덤하게 가로선 생성 (하지만 결과는 조작됨)
	const numLines = Math.max(10, numPeople * 3);
	for (let i = 0; i < numLines; i++) {
		const y = 10 + (i / numLines) * 80; // 10% ~ 90% 사이
		const startIdx = Math.floor(Math.random() * (numPeople - 1));
		const x1 = positions[startIdx];
		const x2 = positions[startIdx + 1];
		horizontalLines.push({ x1, x2, y });
	}

	return { horizontalLines };
}

export default function LadderGamePage() {
	return (
		<Suspense fallback={<div className="p-6 max-w-6xl mx-auto text-center">로딩 중...</div>}>
			<LadderGameContent />
		</Suspense>
	);
}

