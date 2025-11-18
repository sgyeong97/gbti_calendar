"use client";

import { useEffect, useState, useMemo, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Game = {
	gameType: "roulette" | "ladder";
	title: string;
	winnerNames: string[];
	loserNames: string[];
	allNames: string[];
};

type StoredGame = {
	id: string;
	createdAt: number;
	data: Game;
};

const STORAGE_KEY = "gbti_games";

function GameContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [game, setGame] = useState<Game | null>(null);
	const [loading, setLoading] = useState(true);
	const [started, setStarted] = useState(false);
	const [revealedResults, setRevealedResults] = useState<Set<string>>(new Set());
	const [spinning, setSpinning] = useState<string | null>(null);
	const [spinningResult, setSpinningResult] = useState<"win" | "lose" | null>(null);

	useEffect(() => {
		const loadGame = () => {
			const idParam = searchParams.get("id");
			if (idParam && typeof window !== "undefined") {
				try {
					const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as StoredGame[];
					const entry = stored.find((g) => g.id === idParam);
					if (entry) {
						setGame(entry.data);
						setLoading(false);
						return;
					}
				} catch (err) {
					console.error("저장된 게임을 불러오지 못했습니다.", err);
				}
			}

			const dataParam = searchParams.get("data");
			if (dataParam) {
				try {
					const decodedBase64 = atob(decodeURIComponent(dataParam));
					const jsonString = decodeURIComponent(escape(decodedBase64));
					const decodedData = JSON.parse(jsonString);
					setGame({
						gameType: decodedData.gameType || "roulette",
						title: decodedData.title,
						winnerNames: decodedData.winnerNames,
						loserNames: decodedData.loserNames,
						allNames:
							decodedData.allNames || [...decodedData.winnerNames, ...decodedData.loserNames],
					});
				} catch (err) {
					console.error("데이터 파싱 실패:", err);
				} finally {
					setLoading(false);
				}
			} else {
				setLoading(false);
			}
		};

		loadGame();
	}, [searchParams]);

	function getResult(name: string): "win" | "lose" {
		if (!game) return "lose";
		return game.winnerNames.includes(name) ? "win" : "lose";
	}

	function handleStart() {
		setStarted(true);
	}

	function handleNameClick(name: string) {
		if (!started || revealedResults.has(name)) return;

		if (game?.gameType === "roulette") {
			if (spinning) return;
			const finalResult = getResult(name);
			setSpinning(name);
			setSpinningResult(null);

			const spinDuration = 2000 + Math.random() * 1000;

			setTimeout(() => {
				setSpinningResult(finalResult);
				setTimeout(() => {
					setRevealedResults((prev) => {
						const next = new Set(prev);
						next.add(name);
						return next;
					});
					setSpinning(null);
					setSpinningResult(null);
				}, 800);
			}, spinDuration);
		} else {
			// 사다리타기는 바로 결과 표시
			setRevealedResults((prev) => {
				const next = new Set(prev);
				next.add(name);
				return next;
			});
		}
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
				<div>게임 데이터가 없습니다.</div>
				<button
					className="mt-4 px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer"
					onClick={() => router.push("/calendar")}
				>
					캘린더로 돌아가기
				</button>
			</div>
		);
	}

	// 참가자 순서를 랜덤하게 섞기 (당첨/탈락 구분이 보이지 않도록) - 한 번만 생성
	const shuffledNames = useMemo(() => {
		if (!game) return [];
		return [...game.allNames].sort(() => Math.random() - 0.5);
	}, [game]);

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
							{game.gameType === "roulette" ? "룰렛 시작" : "사다리타기 시작"}
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
				{game.gameType === "roulette" ? (
					<>
						{/* 룰렛 시각화 */}
						{started && (
							<div className="flex justify-center mb-8">
								<div className="relative">
									<RouletteWheel spinning={spinning !== null} result={spinningResult} />
								</div>
							</div>
						)}
					</>
				) : (
					<>
						{/* 사다리타기 시각화 */}
						{started && (
							<div className="mb-8">
								<LadderVisualization
									names={shuffledNames}
									winnerNames={game.winnerNames}
									revealedResults={revealedResults}
									onNameClick={handleNameClick}
									getResult={getResult}
								/>
							</div>
						)}
					</>
				)}

				{/* 참가자 목록 */}
				{started && (
					<div className="mt-6">
						<h3 className="text-lg font-semibold mb-4">참가자 목록</h3>
						<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
							{shuffledNames.map((name) => {
								const isRevealed = revealedResults.has(name);
								const isSpinning = spinning === name;
								const result = getResult(name);
								return (
									<div
										key={name}
										className={`p-4 rounded border-2 transition-all ${
											isSpinning
												? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 animate-pulse"
												: isRevealed
												? result === "win"
													? "border-green-500 bg-green-50 dark:bg-green-900/20"
													: "border-red-500 bg-red-50 dark:bg-red-900/20"
												: "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 cursor-pointer"
										}`}
										onClick={() => handleNameClick(name)}
									>
										<div className="font-semibold text-center">{name}</div>
										{isSpinning && (
											<div className="text-center mt-2 text-indigo-600 dark:text-indigo-400 text-sm">
												룰렛 돌리는 중...
											</div>
										)}
										{isRevealed && !isSpinning && (
											<div
												className={`text-center mt-2 font-bold ${
													result === "win"
														? "text-green-600 dark:text-green-400"
														: "text-red-600 dark:text-red-400"
												}`}
											>
												{result === "win" ? "✓ 당첨" : "✗ 탈락"}
											</div>
										)}
									</div>
								);
							})}
						</div>
					</div>
				)}

				{/* 안내 메시지 */}
				{started && (
					<div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded text-sm text-blue-800 dark:text-blue-200">
						💡 이름을 클릭하면 {game.gameType === "roulette" ? "룰렛이 돌아가며" : ""} 결과를 확인할 수 있습니다.
					</div>
				)}
			</div>
		</div>
	);
}

// 사다리타기 시각화 컴포넌트
function LadderVisualization({
	names,
	winnerNames,
	revealedResults,
	onNameClick,
	getResult,
}: {
	names: string[];
	winnerNames: string[];
	revealedResults: Set<string>;
	onNameClick: (name: string) => void;
	getResult: (name: string) => "win" | "lose";
}) {
	const numPeople = names.length;
	const lineSpacing = 120;
	const startX = 100;
	const topY = 80;
	const bottomY = 500;
	const lineHeight = bottomY - topY;

	// 가로선 생성 (깔끔하게)
	const horizontalLines = useMemo(() => {
		const lines: { x1: number; x2: number; y: number }[] = [];
		const numLines = Math.max(8, numPeople * 2);
		const ySpacing = lineHeight / (numLines + 1);

		for (let i = 1; i <= numLines; i++) {
			const y = topY + ySpacing * i;
			// 인접한 두 세로선 사이에 가로선 연결
			const lineIndex = Math.floor(Math.random() * (numPeople - 1));
			const x1 = startX + lineIndex * lineSpacing;
			const x2 = startX + (lineIndex + 1) * lineSpacing;
			lines.push({ x1, x2, y });
		}

		return lines.sort((a, b) => a.y - b.y);
	}, [numPeople, lineHeight]);

	return (
		<div className="flex justify-center overflow-x-auto">
			<svg width={startX * 2 + (numPeople - 1) * lineSpacing} height={bottomY + 60} className="border rounded bg-white dark:bg-zinc-800">
				{/* 세로선 */}
				{names.map((name, idx) => {
					const x = startX + idx * lineSpacing;
					const isRevealed = revealedResults.has(name);
					const result = getResult(name);
					return (
						<g key={idx}>
							{/* 세로선 */}
							<line
								x1={x}
								y1={topY}
								x2={x}
								y2={bottomY}
								stroke="currentColor"
								strokeWidth="3"
								className="text-zinc-700 dark:text-zinc-300"
							/>
							{/* 상단 원 */}
							<circle
								cx={x}
								cy={topY}
								r="8"
								fill="currentColor"
								className="text-zinc-700 dark:text-zinc-300"
							/>
							{/* 이름 */}
							<text
								x={x}
								y={topY - 20}
								textAnchor="middle"
								className="text-base font-semibold fill-current cursor-pointer"
								onClick={() => onNameClick(name)}
								style={{ pointerEvents: "all" }}
							>
								{name}
							</text>
							{/* 하단 원 또는 X */}
							{isRevealed ? (
								result === "win" ? (
									<circle
										cx={x}
										cy={bottomY}
										r="8"
										fill="#10b981"
										stroke="white"
										strokeWidth="2"
									/>
								) : (
									<g>
										<circle
											cx={x}
											cy={bottomY}
											r="8"
											fill="#ef4444"
											stroke="white"
											strokeWidth="2"
										/>
										<line
											x1={x - 5}
											y1={bottomY - 5}
											x2={x + 5}
											y2={bottomY + 5}
											stroke="white"
											strokeWidth="2"
										/>
										<line
											x1={x + 5}
											y1={bottomY - 5}
											x2={x - 5}
											y2={bottomY + 5}
											stroke="white"
											strokeWidth="2"
										/>
									</g>
								)
							) : (
								<circle
									cx={x}
									cy={bottomY}
									r="8"
									fill="currentColor"
									className="text-zinc-400 dark:text-zinc-600"
								/>
							)}
							{/* 결과 텍스트 */}
							{isRevealed && (
								<text
									x={x}
									y={bottomY + 30}
									textAnchor="middle"
									className={`text-sm font-bold ${
										result === "win" ? "fill-green-600 dark:fill-green-400" : "fill-red-600 dark:fill-red-400"
									}`}
								>
									{result === "win" ? "당첨" : "탈락"}
								</text>
							)}
						</g>
					);
				})}

				{/* 가로선 */}
				{horizontalLines.map((line, idx) => (
					<line
						key={idx}
						x1={line.x1}
						y1={line.y}
						x2={line.x2}
						y2={line.y}
						stroke="currentColor"
						strokeWidth="2"
						className="text-zinc-700 dark:text-zinc-300"
					/>
				))}
			</svg>
		</div>
	);
}

// 룰렛 휠 컴포넌트
function RouletteWheel({ spinning, result }: { spinning: boolean; result: "win" | "lose" | null }) {
	const size = 300;
	const center = size / 2;
	const radius = size / 2 - 20;
	const [rotation, setRotation] = useState(0);
	const [isAnimating, setIsAnimating] = useState(false);
	const animationRef = useRef<number | null>(null);
	const startRotationRef = useRef(0);
	const targetRotationRef = useRef(0);
	const startTimeRef = useRef(0);

	useEffect(() => {
		if (spinning) {
			const baseRotation = 1800 + Math.random() * 720;
			startRotationRef.current = rotation;
			targetRotationRef.current = rotation + baseRotation;
			startTimeRef.current = Date.now();
			setIsAnimating(true);

			const animate = () => {
				const elapsed = Date.now() - startTimeRef.current;
				const duration = 2500;
				const progress = Math.min(elapsed / duration, 1);
				const easeOut = 1 - Math.pow(1 - progress, 3);
				const currentRotation = startRotationRef.current + (targetRotationRef.current - startRotationRef.current) * easeOut;
				setRotation(currentRotation);

				if (progress < 1) {
					animationRef.current = requestAnimationFrame(animate);
				} else {
					setIsAnimating(false);
				}
			};

			animationRef.current = requestAnimationFrame(animate);
		} else if (result !== null && !isAnimating) {
			const targetAngle = result === "win" ? 0 : 180;
			const currentAngle = rotation % 360;
			let adjustment = targetAngle - currentAngle;
			if (adjustment < 0) adjustment += 360;
			if (adjustment > 180) adjustment -= 360;
			setRotation((prev) => prev + adjustment + 360);
		}

		return () => {
			if (animationRef.current) {
				cancelAnimationFrame(animationRef.current);
			}
		};
	}, [spinning, result]);

	const sections = [
		{ label: "당첨", color: "#10b981", startAngle: 0, endAngle: 180 },
		{ label: "탈락", color: "#ef4444", startAngle: 180, endAngle: 360 },
	];

	return (
		<div className="relative" style={{ width: size, height: size }}>
			<svg width={size} height={size}>
				<defs>
					<filter id="shadow">
						<feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3" />
					</filter>
				</defs>
				<g
					transform={`rotate(${rotation} ${center} ${center})`}
					style={{
						transition: !isAnimating ? "transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)" : "none",
					}}
				>
					<circle
						cx={center}
						cy={center}
						r={radius}
						fill="white"
						stroke="currentColor"
						strokeWidth="3"
						filter="url(#shadow)"
					/>
					{sections.map((section, idx) => {
						const startAngle = (section.startAngle * Math.PI) / 180;
						const endAngle = (section.endAngle * Math.PI) / 180;
						const largeArcFlag = section.endAngle - section.startAngle > 180 ? 1 : 0;
						const x1 = center + radius * Math.cos(startAngle);
						const y1 = center + radius * Math.sin(startAngle);
						const x2 = center + radius * Math.cos(endAngle);
						const y2 = center + radius * Math.sin(endAngle);
						const pathData = [`M ${center} ${center}`, `L ${x1} ${y1}`, `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`, "Z"].join(" ");
						return (
							<path key={idx} d={pathData} fill={section.color} opacity={0.7} stroke="white" strokeWidth="2" />
						);
					})}
					<text x={center} y={center - radius / 2} textAnchor="middle" className="text-lg font-bold fill-white">
						당첨
					</text>
					<text x={center} y={center + radius / 2} textAnchor="middle" className="text-lg font-bold fill-white">
						탈락
					</text>
					<circle cx={center} cy={center} r={30} fill="white" stroke="currentColor" strokeWidth="3" />
				</g>
				<polygon
					points={`${center},${center - radius - 10} ${center - 10},${center - radius + 10} ${center + 10},${center - radius + 10}`}
					fill="currentColor"
					stroke="white"
					strokeWidth="2"
				/>
				{result && !spinning && (
					<>
						<circle
							cx={center}
							cy={center}
							r={radius + 5}
							fill="none"
							stroke={result === "win" ? "#10b981" : "#ef4444"}
							strokeWidth="4"
							opacity="0.5"
							className="animate-pulse"
						/>
						<text
							x={center}
							y={center + 5}
							textAnchor="middle"
							className="text-xl font-bold"
							fill={result === "win" ? "#10b981" : "#ef4444"}
						>
							{result === "win" ? "당첨!" : "탈락"}
						</text>
					</>
				)}
			</svg>
		</div>
	);
}

export default function GamePage() {
	return (
		<Suspense fallback={<div className="p-6 max-w-6xl mx-auto text-center">로딩 중...</div>}>
			<GameContent />
		</Suspense>
	);
}
