"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";

type Props = {
	selectedDate?: Date;
	onClose: () => void;
	onCreated: () => void;
};

const PASTEL_COLORS = [
	{ name: "파랑", value: "#93c5fd" },
	{ name: "연두", value: "#bef264" },
	{ name: "분홍", value: "#f9a8d4" },
	{ name: "노랑", value: "#fde047" },
	{ name: "보라", value: "#c4b5fd" },
	{ name: "핑크", value: "#fbcfe8" },
	{ name: "청록", value: "#7dd3fc" },
	{ name: "민트", value: "#6ee7b7" },
	{ name: "복숭아", value: "#fbbf24" },
	{ name: "라벤더", value: "#e9d5ff" },
	{ name: "하늘", value: "#bae6fd" },
	{ name: "라임", value: "#d9f99d" },
];

export default function CreateEventModal({ selectedDate, onClose, onCreated }: Props) {
	const [title, setTitle] = useState("");
	const [startDate, setStartDate] = useState(selectedDate ? format(selectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
	const [endDate, setEndDate] = useState(selectedDate ? format(selectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
	const [start, setStart] = useState("09:00");
	const [end, setEnd] = useState("10:00");
	const [participantInput, setParticipantInput] = useState("");
	const [participants, setParticipants] = useState<string[]>([]);
	const [allParticipants, setAllParticipants] = useState<string[]>([]);
	const [participantMap, setParticipantMap] = useState<Map<string, { title?: string | null; color?: string | null }>>(new Map());
	const [repeat, setRepeat] = useState<{enabled:boolean, days:Set<number>}>({ enabled: false, days: new Set<number>() });
	const [color, setColor] = useState("#93c5fd");
	const [loading, setLoading] = useState(false);
	const [openStartTime, setOpenStartTime] = useState(false);
	const [openEndTime, setOpenEndTime] = useState(false);

	// 선택된 날짜가 변경되면 시작/종료 날짜 상태 업데이트
	useEffect(() => {
		if (selectedDate) {
			const dateStr = format(selectedDate, "yyyy-MM-dd");
			setStartDate(dateStr);
			setEndDate(dateStr);
		}
	}, [selectedDate]);

	useEffect(() => {
		fetch("/api/participants").then((r) => r.json()).then((data) => {
			const participants = data.participants ?? [];
			setAllParticipants(participants.map((p: any) => p.name));
			// 참여자 정보 맵 생성
			const map = new Map<string, { title?: string | null; color?: string | null }>();
			participants.forEach((p: any) => {
				map.set(p.name, { title: p.title, color: p.color });
			});
			setParticipantMap(map);
		});
	}, []);

	function toggleDay(idx: number) {
		const next = new Set(repeat.days);
		if (next.has(idx)) next.delete(idx);
		else next.add(idx);
		setRepeat({ ...repeat, days: next });
	}

	async function submit() {
		if (!title.trim()) return alert("제목을 입력해주세요.");

		setLoading(true);
		try {
			const startAt = new Date(`${startDate}T${start}:00`);
			const endAt = new Date(`${endDate}T${end}:00`);
			const res = await fetch("/api/events", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title,
					startAt,
					endAt,
					allDay: false,
					calendarId: "default",
					calendarName: "기본 캘린더",
					participants,
					color,
					repeat: repeat.enabled ? { daysOfWeek: Array.from(repeat.days), startMinutes: parseInt(start.split(":")[0]) * 60 + parseInt(start.split(":")[1]), endMinutes: parseInt(end.split(":")[0]) * 60 + parseInt(end.split(":")[1]), color } : undefined,
				}),
			});

			if (res.ok) {
				onCreated();
				onClose();
			} else {
				const error = await res.json();
				alert(error.error || "이벤트 생성에 실패했습니다.");
			}
		} catch (err) {
			alert("네트워크 오류가 발생했습니다.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
			<div className="rounded p-4 w-full max-w-sm space-y-2" style={{ background: "var(--background)", color: "var(--foreground)" }}>
				<h2 className="text-lg font-semibold">이벤트 추가</h2>
				{selectedDate && (
					<div className="text-sm text-zinc-600 dark:text-zinc-400">
						선택된 날짜: {format(selectedDate, "yyyy년 MM월 dd일")}
					</div>
				)}
				<input
					className="w-full border rounded px-2 py-1"
					placeholder="제목"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
				/>
				{/* 시작: 날짜 + 시간 */}
				<div>
					<strong>시작:</strong>{" "}
					<div className="mt-1 flex items-center gap-2 flex-wrap relative">
						<input
							className="border rounded px-3 py-1.5"
							type="date"
							value={startDate}
							onChange={(e) => setStartDate(e.target.value)}
						/>
						<div className="relative">
							<button 
								type="button"
								className="px-3 py-1.5 border rounded text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors min-w-[100px]"
								onClick={() => setOpenStartTime(!openStartTime)}
							>
								{(() => {
									const [hours, minutes] = start.split(':');
									const hour = parseInt(hours || '0');
									const min = parseInt(minutes || '0');
									return hour >= 12 ? `오후 ${hour === 12 ? 12 : hour - 12}:${String(min).padStart(2, '0')}` : `오전 ${hour === 0 ? 12 : hour}:${String(min).padStart(2, '0')}`;
								})()}
							</button>
							{openStartTime && (
								<div className="absolute z-50 mt-1 bg-white dark:bg-zinc-800 border rounded shadow-lg max-h-60 overflow-y-auto min-w-[120px]">
									{Array.from({ length: 24 * 4 }, (_, i) => {
										const hour = Math.floor(i / 4);
										const minute = (i % 4) * 15;
										const timeStr = hour >= 12 ? `오후 ${hour === 12 ? 12 : hour - 12}:${String(minute).padStart(2, '0')}` : `오전 ${hour === 0 ? 12 : hour}:${String(minute).padStart(2, '0')}`;
										const [currentHours, currentMinutes] = start.split(':');
										const currentHour = parseInt(currentHours || '0');
										const currentMin = parseInt(currentMinutes || '0');
										const isSelected = currentHour === hour && currentMin === minute;
										return (
											<button
												key={i}
												type="button"
												className={`w-full px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : ''}`}
												onClick={() => {
													setStart(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
													setOpenStartTime(false);
												}}
											>
												{timeStr}
											</button>
										);
									})}
								</div>
							)}
						</div>
						{openStartTime && (
							<div className="fixed inset-0 z-40" onClick={() => setOpenStartTime(false)} />
						)}
					</div>
				</div>
				
				{/* 종료: 날짜 + 시간 */}
				<div>
					<strong>종료:</strong>{" "}
					<div className="mt-1 flex items-center gap-2 flex-wrap relative">
						<input
							className="border rounded px-3 py-1.5"
							type="date"
							value={endDate}
							onChange={(e) => setEndDate(e.target.value)}
						/>
						<div className="relative">
							<button 
								type="button"
								className="px-3 py-1.5 border rounded text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors min-w-[100px]"
								onClick={() => setOpenEndTime(!openEndTime)}
							>
								{(() => {
									const [hours, minutes] = end.split(':');
									const hour = parseInt(hours || '0');
									const min = parseInt(minutes || '0');
									return hour >= 12 ? `오후 ${hour === 12 ? 12 : hour - 12}:${String(min).padStart(2, '0')}` : `오전 ${hour === 0 ? 12 : hour}:${String(min).padStart(2, '0')}`;
								})()}
							</button>
							{openEndTime && (
								<div className="absolute z-50 mt-1 bg-white dark:bg-zinc-800 border rounded shadow-lg max-h-60 overflow-y-auto min-w-[120px]">
									{Array.from({ length: 24 * 4 }, (_, i) => {
										const hour = Math.floor(i / 4);
										const minute = (i % 4) * 15;
										const timeStr = hour >= 12 ? `오후 ${hour === 12 ? 12 : hour - 12}:${String(minute).padStart(2, '0')}` : `오전 ${hour === 0 ? 12 : hour}:${String(minute).padStart(2, '0')}`;
										const [currentHours, currentMinutes] = end.split(':');
										const currentHour = parseInt(currentHours || '0');
										const currentMin = parseInt(currentMinutes || '0');
										const isSelected = currentHour === hour && currentMin === minute;
										return (
											<button
												key={i}
												type="button"
												className={`w-full px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : ''}`}
												onClick={() => {
													setEnd(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
													setOpenEndTime(false);
												}}
											>
												{timeStr}
											</button>
										);
									})}
								</div>
							)}
						</div>
						{openEndTime && (
							<div className="fixed inset-0 z-40" onClick={() => setOpenEndTime(false)} />
						)}
					</div>
				</div>

				{/* 참여자 태그 입력 */}
				<div>
					<label className="text-sm">참여자</label>
					<div className="flex gap-2 mt-1">
						<input
							className="border rounded px-2 py-1 w-full"
							placeholder="이름 입력 후 Enter"
							value={participantInput}
							onChange={(e) => setParticipantInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && participantInput.trim()) {
									e.preventDefault();
									if (!participants.includes(participantInput.trim())) {
										setParticipants([...participants, participantInput.trim()]);
									}
									setParticipantInput("");
								}
							}}
						/>
						<select
							className="border rounded px-2 py-1"
							onChange={(e) => {
								const name = e.target.value;
								if (name && !participants.includes(name)) {
									setParticipants([...participants, name]);
								}
								e.currentTarget.selectedIndex = 0;
							}}
						>
							<option value="">목록에서 추가</option>
							{allParticipants.map((n) => (
								<option key={n} value={n}>{n}</option>
							))}
						</select>
					</div>
					<div className="flex gap-2 flex-wrap mt-2">
						{participants.map((p) => {
							const participantInfo = participantMap.get(p);
							const bgColor = participantInfo?.color || "#e5e7eb";
							
							// 배경색 밝기에 따라 글자색 결정
							const hexToRgb = (hex: string) => {
								const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
								return result ? {
									r: parseInt(result[1], 16),
									g: parseInt(result[2], 16),
									b: parseInt(result[3], 16)
								} : { r: 229, g: 231, b: 235 }; // 기본값
							};
							const rgb = hexToRgb(bgColor);
							const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
							const isBright = brightness > 128;
							const textColor = isBright ? "#000" : "#fff";
							
							// 칭호 네온 효과 (배경이 너무 밝을 때만 어두운 색, 그 외에는 흰색 네온)
							const titleGlowColor = participantInfo?.color || "#ff00ff";
							const titleRgb = hexToRgb(titleGlowColor);
							const isVeryBright = brightness > 200; // 너무 밝은 배경(흰색 계열)일 때만 어두운 색 사용
							// 기본적으로는 흰색 계열로 네온 효과, 너무 밝은 배경일 때만 어두운 색
							const titleTextColor = isVeryBright 
								? `rgb(${Math.max(0, titleRgb.r - 100)}, ${Math.max(0, titleRgb.g - 100)}, ${Math.max(0, titleRgb.b - 100)})`
								: `rgb(${Math.min(255, titleRgb.r + 200)}, ${Math.min(255, titleRgb.g + 200)}, ${Math.min(255, titleRgb.b + 200)})`;
							const titleTextShadow = isVeryBright
								? `0 0 2px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.8),
								   0 0 4px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.6),
								   0 0 6px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.4)`
								: `0 0 2px rgb(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}),
								   0 0 4px rgb(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}),
								   0 0 6px rgb(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}),
								   0 0 10px rgb(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}),
								   0 0 20px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.8),
								   0 0 30px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.6)`;
							const titleBgColor = isVeryBright
								? `rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.3)`
								: `rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.15)`;
							
							return (
								<span 
									key={p} 
									className="px-2 py-0.5 text-xs rounded-full"
									style={{ backgroundColor: bgColor }}
								>
									{participantInfo?.title && (
										<span
											className="font-bold mr-0.5 px-1.5 py-0.5 rounded"
											style={{
												color: titleTextColor,
												textShadow: titleTextShadow.trim(),
												backgroundColor: titleBgColor,
												letterSpacing: "0.5px",
												fontWeight: "700",
												animation: "glow-pulse 2s ease-in-out infinite",
												boxShadow: isVeryBright 
													? `0 0 5px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.3)`
													: `0 0 10px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.3), inset 0 0 10px rgba(${titleRgb.r}, ${titleRgb.g}, ${titleRgb.b}, 0.1)`
											}}
										>
											{participantInfo.title}
										</span>
									)}
									<span style={{ color: textColor }}>{p}</span>
									<button
										className="ml-1 text-zinc-500 hover:text-zinc-700"
										onClick={() => setParticipants(participants.filter(x => x !== p))}
									>
										×
									</button>
								</span>
							);
						})}
					</div>
				</div>

				{/* 색상 선택 */}
				<div>
					<label className="text-sm">색상</label>
					<div className="grid grid-cols-6 gap-2 mt-1">
						{PASTEL_COLORS.map((c) => (
							<button
								key={c.value}
								type="button"
								onClick={() => setColor(c.value)}
								className={`w-full aspect-square rounded border-2 transition-all ${
									color === c.value ? "border-indigo-600 scale-110" : "border-zinc-300 hover:scale-105"
								}`}
								style={{ backgroundColor: c.value }}
								title={c.name}
							/>
						))}
					</div>
				</div>

				{/* 반복 옵션 */}
				<div className="mt-2 space-y-2">
					<label className="inline-flex items-center gap-2">
						<input
							type="checkbox"
							checked={repeat.enabled}
							onChange={(e) => setRepeat({ ...repeat, enabled: e.target.checked })}
						/>
						반복 주기 사용
					</label>
					{repeat.enabled && (
						<div className="flex items-center gap-2 text-sm">
							{["일","월","화","수","목","금","토"].map((w, i) => (
								<button
									key={i}
									type="button"
									onClick={() => toggleDay(i)}
									className={`px-2 py-1 rounded border transition-colors cursor-pointer ${repeat.days.has(i) ? "bg-indigo-600 text-white hover:bg-indigo-700" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
								>
									{w}
								</button>
							))}
						</div>
					)}
				</div>

				<div className="flex justify-end gap-2">
					<button
						className="px-3 py-1 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
						onClick={onClose}
						disabled={loading}
					>
						닫기
					</button>
					<button
						className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors cursor-pointer"
						onClick={submit}
						disabled={loading}
					>
						{loading ? "추가 중..." : "추가"}
					</button>
				</div>
			</div>
		</div>
	);
}


