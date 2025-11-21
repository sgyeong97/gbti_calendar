"use client";

import { useEffect, useState, useMemo, Suspense, useRef, useCallback } from "react";
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
	const [shuffledNames, setShuffledNames] = useState<string[]>([]);

	useEffect(() => {
		// 게임이 로드되면 참가자 순서를 랜덤하게 섞기 (한 번만)
		if (game?.allNames && game.allNames.length > 0) {
			setShuffledNames([...game.allNames].sort(() => Math.random() - 0.5));
		} else {
			setShuffledNames([]);
		}
	}, [game ? game.allNames?.join(",") : null]);

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

			// 룰렛 애니메이션 시간
			const spinDuration = 2000 + Math.random() * 1000;

			setTimeout(() => {
				// 결과를 설정하여 룰렛이 정확한 위치로 조정되도록 함
				setSpinningResult(finalResult);
				setTimeout(() => {
					setRevealedResults((prev) => {
						const next = new Set(prev);
						next.add(name);
						return next;
					});
					setSpinning(null);
					setSpinningResult(null);
				}, 1000); // 조정 애니메이션을 위한 시간 증가
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
	const [animatingName, setAnimatingName] = useState<string | null>(null);
	const [dotPosition, setDotPosition] = useState<{ x: number; y: number } | null>(null);

	// 사다리 경로를 따라 결과 계산 함수
	const calculateResultFromPath = useCallback((startIdx: number, lines: { x1: number; x2: number; y: number }[]) => {
		let currentLineIdx = startIdx;

		// 가로선을 y 순서대로 확인하며 경로 계산
		for (const hLine of lines) {
			// 가로선이 현재 세로선과 연결되어 있는지 확인
			const currentLineX = startX + currentLineIdx * lineSpacing;
			const tolerance = 2;
			
			if (Math.abs(hLine.x1 - currentLineX) < tolerance) {
				// 왼쪽에서 오른쪽으로 이동
				currentLineIdx++;
			} else if (Math.abs(hLine.x2 - currentLineX) < tolerance) {
				// 오른쪽에서 왼쪽으로 이동
				currentLineIdx--;
			}
		}

		return currentLineIdx;
	}, [lineSpacing]);

	// 가로선 생성 (올바른 결과로 가도록)
	const horizontalLines = useMemo(() => {
		if (numPeople < 2) return [];
		
		// 각 이름의 목표 결과 인덱스 계산
		// 당첨자들은 앞쪽 인덱스, 탈락자들은 뒤쪽 인덱스
		const targetIndices: Map<number, number> = new Map();
		const winnerList: number[] = [];
		const loserList: number[] = [];
		
		for (let i = 0; i < names.length; i++) {
			const name = names[i];
			if (winnerNames.includes(name)) {
				winnerList.push(i);
			} else {
				loserList.push(i);
			}
		}
		
		// 목표 인덱스 설정
		for (let i = 0; i < winnerList.length; i++) {
			targetIndices.set(winnerList[i], i);
		}
		for (let i = 0; i < loserList.length; i++) {
			targetIndices.set(loserList[i], winnerList.length + i);
		}

		// 역방향으로 사다리 생성 (하단에서 상단으로)
		// 현재 위치: 각 이름이 어느 하단 인덱스에 있는지
		let currentMapping = new Map<number, number>(); // [상단 인덱스] -> [하단 인덱스]
		for (let i = 0; i < numPeople; i++) {
			currentMapping.set(i, targetIndices.get(i)!);
		}

		const lines: { x1: number; x2: number; y: number }[] = [];
		const numLines = Math.max(8, numPeople * 2);
		const ySpacing = lineHeight / (numLines + 1);
		
		// 하단부터 상단으로 가로선 생성
		const linePositions: number[] = [];
		for (let i = 1; i <= numLines; i++) {
			linePositions.push(topY + ySpacing * i);
		}

		// 역방향으로 가로선 생성
		for (let level = linePositions.length - 1; level >= 0; level--) {
			const y = linePositions[level];
			
			// 필요한 교환 찾기
			let swapFound = false;
			for (let i = 0; i < numPeople - 1; i++) {
				const posI = currentMapping.get(i);
				const posJ = currentMapping.get(i + 1);
				
				// 교환이 필요한 경우 (목표 인덱스가 반대인 경우)
				if (posI !== undefined && posJ !== undefined && posI > posJ) {
					// 교환
					currentMapping.set(i, posJ);
					currentMapping.set(i + 1, posI);
					lines.push({
						x1: startX + i * lineSpacing,
						x2: startX + (i + 1) * lineSpacing,
						y: y,
					});
					swapFound = true;
					break; // 한 번에 하나씩만 교환
				}
			}
			
			// 교환이 필요 없으면 랜덤하게 가로선 추가 (시각적 효과, 결과에 영향 없음)
			if (!swapFound && Math.random() > 0.4) {
				const lineIndex = Math.floor(Math.random() * (numPeople - 1));
				lines.push({
					x1: startX + lineIndex * lineSpacing,
					x2: startX + (lineIndex + 1) * lineSpacing,
					y: y,
				});
			}
		}

		// y 순서대로 정렬 (상단부터)
		return lines.sort((a, b) => a.y - b.y);
	}, [numPeople, names, winnerNames, lineHeight, lineSpacing, startX, topY]);

	// 사다리 경로 계산 함수 (경로와 최종 인덱스 반환)
	const calculatePath = useCallback((startIdx: number): { path: { x: number; y: number }[]; finalIdx: number } => {
		const path: { x: number; y: number }[] = [];
		let currentX = startX + startIdx * lineSpacing;
		let currentY = topY;
		let currentLineIdx = startIdx;

		path.push({ x: currentX, y: currentY });

		// 가로선을 y 순서대로 확인하며 경로 계산
		for (const hLine of horizontalLines) {
			// 현재 위치에서 가로선까지 내려가기
			if (currentY < hLine.y) {
				path.push({ x: currentX, y: hLine.y });
				currentY = hLine.y;
			}

			// 가로선이 현재 세로선과 연결되어 있는지 확인
			const currentLineX = startX + currentLineIdx * lineSpacing;
			const tolerance = 2; // 허용 오차
			
			if (Math.abs(hLine.x1 - currentLineX) < tolerance) {
				// 왼쪽에서 오른쪽으로 이동
				currentX = hLine.x2;
				currentLineIdx++;
				path.push({ x: currentX, y: currentY });
			} else if (Math.abs(hLine.x2 - currentLineX) < tolerance) {
				// 오른쪽에서 왼쪽으로 이동
				currentX = hLine.x1;
				currentLineIdx--;
				path.push({ x: currentX, y: currentY });
			}
		}

		// 마지막으로 하단까지 내려가기
		if (currentY < bottomY) {
			path.push({ x: currentX, y: bottomY });
		}

		return { path, finalIdx: currentLineIdx };
	}, [horizontalLines, startX, lineSpacing, topY, bottomY]);

	// 사다리 경로를 따라 결과 계산 함수
	const getResultFromPath = useCallback((startIdx: number): "win" | "lose" => {
		const { finalIdx } = calculatePath(startIdx);
		// 하단 인덱스가 당첨 영역(0 ~ winnerNames.length - 1)이면 당첨
		return finalIdx < winnerNames.length ? "win" : "lose";
	}, [calculatePath, winnerNames.length]);

	// 애니메이션 처리
	const handleNameClickWithAnimation = useCallback((name: string) => {
		if (animatingName || revealedResults.has(name)) return;

		const nameIdx = names.indexOf(name);
		if (nameIdx === -1) return;

		setAnimatingName(name);
		const { path } = calculatePath(nameIdx);

		// 경로를 따라 점 이동 애니메이션
		const totalDuration = 2000; // 2초
		const startTime = Date.now();

		const animate = () => {
			const elapsed = Date.now() - startTime;
			const progress = Math.min(elapsed / totalDuration, 1);
			
			if (progress < 1) {
				// 전체 경로에서 현재 위치 계산
				const totalLength = path.reduce((sum, point, idx) => {
					if (idx === 0) return 0;
					const prev = path[idx - 1];
					const dist = Math.sqrt(Math.pow(point.x - prev.x, 2) + Math.pow(point.y - prev.y, 2));
					return sum + dist;
				}, 0);
				
				let currentLength = totalLength * progress;
				let currentPoint = path[0];
				
				for (let i = 1; i < path.length; i++) {
					const prev = path[i - 1];
					const curr = path[i];
					const segmentLength = Math.sqrt(Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2));
					
					if (currentLength <= segmentLength) {
						// 현재 세그먼트 내에 있음
						const segmentProgress = currentLength / segmentLength;
						currentPoint = {
							x: prev.x + (curr.x - prev.x) * segmentProgress,
							y: prev.y + (curr.y - prev.y) * segmentProgress,
						};
						break;
					} else {
						currentLength -= segmentLength;
						currentPoint = curr;
					}
				}
				
				setDotPosition(currentPoint);
				requestAnimationFrame(animate);
			} else {
				// 애니메이션 완료
				setDotPosition({ x: path[path.length - 1].x, y: path[path.length - 1].y });
				setTimeout(() => {
					// onNameClick을 호출하여 결과 표시 (부모 컴포넌트에서 revealedResults 업데이트)
					onNameClick(name);
					setAnimatingName(null);
					setDotPosition(null);
				}, 300);
			}
		};

		requestAnimationFrame(animate);
	}, [animatingName, revealedResults, names, calculatePath, getResultFromPath]);

	return (
		<div className="flex justify-center overflow-x-auto">
			<svg width={startX * 2 + (numPeople - 1) * lineSpacing} height={bottomY + 60} className="border rounded bg-white dark:bg-zinc-800">
				{/* 세로선 */}
				{names.map((name, idx) => {
					const x = startX + idx * lineSpacing;
					const isRevealed = revealedResults.has(name);
					// 사다리 경로를 따라 계산한 결과 사용 (항상 경로 기반으로 계산)
					const result = getResultFromPath(idx);
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
							<g onClick={() => handleNameClickWithAnimation(name)} style={{ cursor: animatingName ? "not-allowed" : "pointer" }}>
								<text
									x={x}
									y={topY - 20}
									textAnchor="middle"
									className="text-base font-semibold fill-current"
									style={{ pointerEvents: "all", opacity: animatingName === name ? 0.5 : 1 }}
								>
									{String(name)}
								</text>
							</g>
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
									{String(result === "win" ? "당첨" : "탈락")}
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

				{/* 애니메이션 점 */}
				{dotPosition && (
					<g>
						<circle
							cx={dotPosition.x}
							cy={dotPosition.y}
							r="8"
							fill="#ef4444"
							stroke="white"
							strokeWidth="2"
							style={{
								filter: "drop-shadow(0 0 6px rgba(239, 68, 68, 0.9))",
							}}
						>
							<animate
								attributeName="r"
								values="8;10;8"
								dur="0.6s"
								repeatCount="indefinite"
							/>
						</circle>
						<circle
							cx={dotPosition.x}
							cy={dotPosition.y}
							r="8"
							fill="none"
							stroke="#ef4444"
							strokeWidth="2"
							opacity="0.6"
						>
							<animate
								attributeName="r"
								values="8;16;8"
								dur="1s"
								repeatCount="indefinite"
							/>
							<animate
								attributeName="opacity"
								values="0.6;0;0.6"
								dur="1s"
								repeatCount="indefinite"
							/>
						</circle>
					</g>
				)}
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
	const resultAppliedRef = useRef<string | null>(null);

	useEffect(() => {
		if (spinning) {
			// 결과가 이미 적용되었는지 확인하고 리셋
			resultAppliedRef.current = null;
			
			// 랜덤한 회전 (최소 5바퀴 이상)
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
		}

		return () => {
			if (animationRef.current) {
				cancelAnimationFrame(animationRef.current);
			}
		};
	}, [spinning, rotation]);

	// 결과에 따라 정확한 위치로 조정 (별도 useEffect로 분리)
	useEffect(() => {
		if (result !== null && !isAnimating && !spinning && resultAppliedRef.current !== result) {
			// 결과가 이미 적용되었는지 확인
			resultAppliedRef.current = result;
			
			// 결과에 따라 정확한 위치로 조정
			// 화살표가 상단(0도)에 있으므로:
			// - 당첨: 룰렛의 당첨 섹션 중앙(90도)이 상단에 오도록
			// - 탈락: 룰렛의 탈락 섹션 중앙(270도)이 상단에 오도록
			const targetAngle = result === "win" ? 90 : 270;
			
			// 현재 rotation 값을 직접 사용
			setRotation((currentRotation) => {
				const currentAngle = currentRotation % 360;
				
				// 현재 각도에서 목표 각도까지의 최단 거리 계산
				let adjustment = targetAngle - currentAngle;
				if (adjustment < 0) adjustment += 360;
				if (adjustment > 180) adjustment -= 360;
				
				// 추가 회전을 더해서 자연스럽게 멈추도록 (최소 1바퀴 이상)
				return currentRotation + adjustment + 360;
			});
		}
	}, [result, isAnimating, spinning]);

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
