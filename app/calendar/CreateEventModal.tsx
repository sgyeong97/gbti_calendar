"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import dayjs, { Dayjs } from "dayjs";

type Props = {
	selectedDate?: Date;
	onClose: () => void;
	onCreated: () => void;
};

const PASTEL_COLORS = [
	{ name: "메인 옐로", value: "#FDC205" },
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
	const [color, setColor] = useState("#FDC205");

	// 선택된 날짜에서 날짜와 시간 추출
	const getInitialDateTime = () => {
		const now = new Date();
		if (selectedDate) {
			// 선택된 날짜가 특정 시간까지 지정되어 있다면 그 시간 사용
			if (selectedDate.getHours() > 0 || selectedDate.getMinutes() > 0) {
				return {
					date: format(selectedDate, "yyyy-MM-dd"),
					start: format(selectedDate, "HH:mm"),
					end: format(new Date(selectedDate.getTime() + 60 * 60 * 1000), "HH:mm"), // 1시간 후
				};
			} else {
				// 날짜만 지정된 경우 현재 시간 사용
				return {
					date: format(selectedDate, "yyyy-MM-dd"),
					start: format(now, "HH:mm"),
					end: format(new Date(now.getTime() + 60 * 60 * 1000), "HH:mm"), // 1시간 후
				};
			}
		} else {
			return {
				date: format(now, "yyyy-MM-dd"),
				start: format(now, "HH:mm"),
				end: format(new Date(now.getTime() + 60 * 60 * 1000), "HH:mm"), // 1시간 후
			};
		}
	};

    const initialDateTime = getInitialDateTime();
    const [startAt, setStartAt] = useState<Dayjs>(dayjs(`${initialDateTime.date}T${initialDateTime.start}:00`));
    const [endAt, setEndAt] = useState<Dayjs>(dayjs(`${initialDateTime.date}T${initialDateTime.end}:00`));
    const [openStartDate, setOpenStartDate] = useState(false);
    const [openEndDate, setOpenEndDate] = useState(false);
    const [openStartTime, setOpenStartTime] = useState(false);
    const [openEndTime, setOpenEndTime] = useState(false);
	const [participantInput, setParticipantInput] = useState("");
	const [participants, setParticipants] = useState<string[]>([]);
	const [allParticipants, setAllParticipants] = useState<string[]>([]);
	const [participantMap, setParticipantMap] = useState<Map<string, { title?: string | null; color?: string | null }>>(new Map());
	const [repeat, setRepeat] = useState<{enabled:boolean, days:Set<number>}>({ enabled: false, days: new Set<number>() });
	const [loading, setLoading] = useState(false);

	// 선택된 날짜가 변경되면 모든 상태 업데이트
    useEffect(() => {
        const newDateTime = getInitialDateTime();
        setStartAt(dayjs(`${newDateTime.date}T${newDateTime.start}:00`));
        setEndAt(dayjs(`${newDateTime.date}T${newDateTime.end}:00`));
    }, [selectedDate]);

	useEffect(() => {
		// 참여자 목록 (모든 사용자 노출)
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

		// 드래프트 복원
		try {
			const raw = localStorage.getItem("gbti_create_event_draft");
			if (raw) {
				const d = JSON.parse(raw);
				if (typeof d.title === "string") setTitle(d.title);
				if (typeof d.color === "string") setColor(d.color);
				if (d.startAt) setStartAt(dayjs(d.startAt));
				if (d.endAt) setEndAt(dayjs(d.endAt));
				if (Array.isArray(d.participants)) setParticipants(d.participants);
				if (d.repeat && typeof d.repeat.enabled === 'boolean' && Array.isArray(d.repeat.days)) {
					setRepeat({ enabled: d.repeat.enabled, days: new Set<number>(d.repeat.days) });
				}
			}
		} catch {}
	}, []);

	// 드래프트 자동 저장
	useEffect(() => {
		try {
			const draft = {
				title,
				color,
				startAt: startAt?.toISOString?.(),
				endAt: endAt?.toISOString?.(),
				participants,
				repeat: { enabled: repeat.enabled, days: Array.from(repeat.days) },
			};
			localStorage.setItem("gbti_create_event_draft", JSON.stringify(draft));
		} catch {}
	}, [title, color, startAt, endAt, participants, repeat]);

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
            if (!startAt.isValid() || !endAt.isValid() || endAt.valueOf() <= startAt.valueOf()) {
                return alert("종료일시가 시작일시보다 늦어야 합니다.");
            }

			// 요청 데이터 구성
			const requestData: any = {
				title,
                startAt: startAt.toDate(),
                endAt: endAt.toDate(),
				allDay: false,
				calendarId: "default",
				calendarName: "기본 캘린더",
				color,
			};

			// 모든 사용자: 참여자/반복 설정 가능
			if (participants.length > 0) {
				requestData.participants = participants;
			}
            if (repeat.enabled && repeat.days.size > 0) {
				requestData.repeat = {
					daysOfWeek: Array.from(repeat.days),
                    startMinutes: startAt.hour() * 60 + startAt.minute(),
                    endMinutes: endAt.hour() * 60 + endAt.minute(),
					color
				};
			}

			const res = await fetch("/api/events", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestData),
			});

			if (res.ok) {
				const result = await res.json();
				console.log("이벤트 생성 성공:", result);
				try { localStorage.removeItem("gbti_create_event_draft"); } catch {}
				onCreated();
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
			<div className="rounded p-4 w-full max-w-sm mx-4 sm:mx-0 space-y-2 max-h-[85vh] overflow-y-auto" style={{ background: "var(--background)", color: "var(--foreground)" }}>
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
						<LocalizationProvider dateAdapter={AdapterDayjs}>
						<div className="space-y-3 relative">
                        {/* 날짜와 시간 한 줄 표시 */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                                <button 
                                    type="button" 
                                    className="px-3 py-1.5 border rounded text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                    onClick={()=>setOpenStartDate(!openStartDate)}
                                >
                                    {startAt.format('M월 D일')} ({['일','월','화','수','목','금','토'][startAt.day()]})
                                </button>
                                {openStartDate && (
                                    <div className="absolute z-50 mt-1 p-2 rounded border bg-white dark:bg-zinc-800 shadow-lg" style={{width:'min(320px,90vw)'}}>
                                        <DateCalendar value={startAt} onChange={(v)=>{ if(v){ setStartAt(startAt.year(v.year()).month(v.month()).date(v.date())); setOpenEndDate(false);} }} />
                                    </div>
                                )}
                                <div className="relative">
                                    <button 
                                        type="button" 
                                        className="px-3 py-1.5 border rounded text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors min-w-[100px]"
                                        onClick={()=>setOpenStartTime(!openStartTime)}
                                    >
                                        {startAt.format('A h:mm')}
                                    </button>
                                    {openStartTime && (
                                        <div className="absolute z-50 mt-1 bg-white dark:bg-zinc-800 border rounded shadow-lg max-h-60 overflow-y-auto min-w-[120px]">
                                            {Array.from({ length: 24 * 4 }, (_, i) => {
                                                const hour = Math.floor(i / 4);
                                                const minute = (i % 4) * 15;
                                                const time = dayjs().hour(hour).minute(minute);
                                                const isSelected = startAt.hour() === hour && startAt.minute() === minute;
                                                return (
                                                    <button
                                                        key={i}
                                                        type="button"
                                                        className={`w-full px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : ''}`}
                                                        onClick={() => {
                                                            setStartAt(startAt.hour(hour).minute(minute));
                                                            setOpenStartTime(false);
                                                        }}
                                                    >
                                                        {time.format('A h:mm')}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                                <span className="text-zinc-500">-</span>
                                <div className="relative">
                                    <button 
                                        type="button" 
                                        className="px-3 py-1.5 border rounded text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors min-w-[100px]"
                                        onClick={()=>setOpenEndTime(!openEndTime)}
                                    >
                                        {endAt.format('A h:mm')}
                                    </button>
                                    {openEndTime && (
                                        <div className="absolute z-50 mt-1 bg-white dark:bg-zinc-800 border rounded shadow-lg max-h-60 overflow-y-auto min-w-[120px]">
                                            {Array.from({ length: 24 * 4 }, (_, i) => {
                                                const hour = Math.floor(i / 4);
                                                const minute = (i % 4) * 15;
                                                const time = dayjs().hour(hour).minute(minute);
                                                const isSelected = endAt.hour() === hour && endAt.minute() === minute;
                                                return (
                                                    <button
                                                        key={i}
                                                        type="button"
                                                        className={`w-full px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : ''}`}
                                                        onClick={() => {
                                                            setEndAt(endAt.hour(hour).minute(minute));
                                                            setOpenEndTime(false);
                                                        }}
                                                    >
                                                        {time.format('A h:mm')}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {openStartDate && (
                                <div className="fixed inset-0 z-40" onClick={()=>setOpenStartDate(false)} />
                            )}
                            {(openStartTime || openEndTime) && (
                                <div className="fixed inset-0 z-40" onClick={()=>{setOpenStartTime(false); setOpenEndTime(false);}} />
                            )}
                        </div>
						</div>
					</LocalizationProvider>

				{/* 참여자 태그 입력 (모든 사용자) */}
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
								return (
									<span 
										key={p} 
										className="px-2 py-0.5 text-xs rounded-full"
										style={{ backgroundColor: bgColor, color: "#000" }}
									>
										{participantInfo?.title && (() => {
											const glowColor = participantInfo?.color || "#ff00ff";
											const hexToRgb = (hex: string) => {
												const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
												return result ? {
													r: parseInt(result[1], 16),
													g: parseInt(result[2], 16),
													b: parseInt(result[3], 16)
												} : { r: 255, g: 0, b: 255 };
											};
											const rgb = hexToRgb(glowColor);
											// 네온 라이트 효과: 부드러운 글로우, 검은 테두리 없음
											// 텍스트 색상: 거의 흰색에 약간의 색상 틴트
											const textColor = `rgb(${Math.min(255, rgb.r + 200)}, ${Math.min(255, rgb.g + 200)}, ${Math.min(255, rgb.b + 200)})`;
											// 다층 네온 글로우 효과 (내부 밝게, 외부로 퍼지며 부드럽게)
											const textShadow = `
												0 0 2px rgb(${rgb.r}, ${rgb.g}, ${rgb.b}),
												0 0 4px rgb(${rgb.r}, ${rgb.g}, ${rgb.b}),
												0 0 6px rgb(${rgb.r}, ${rgb.g}, ${rgb.b}),
												0 0 10px rgb(${rgb.r}, ${rgb.g}, ${rgb.b}),
												0 0 20px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8),
												0 0 30px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6),
												0 0 40px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4),
												0 0 50px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)
											`;
											// 배경: 어두운 색상으로 네온 효과 강조
											const bgColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`;
											return (
												<span 
													className="font-bold mr-0.5 px-1.5 py-0.5 rounded"
													style={{ 
														color: textColor,
														textShadow: textShadow.trim(),
														backgroundColor: bgColor,
														letterSpacing: "0.5px",
														fontWeight: "700",
														animation: "glow-pulse 2s ease-in-out infinite",
														boxShadow: `0 0 10px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3), inset 0 0 10px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`
													}}
												>
													{participantInfo.title}
												</span>
											);
										})()}
										<span>{p}</span>
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
							color === c.value ? "scale-110" : "hover:scale-105"
						}`}
						style={{ backgroundColor: c.value, borderColor: color === c.value ? "#FDC205" : "#d4d4d8" }}
								title={c.name}
							/>
						))}
					</div>
				</div>

				{/* 반복 옵션 (모든 사용자) */}
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
								{["월","화","수","목","금","토","일"].map((w, i) => {
									// Monday-first UI → JS getDay
                  // 이부분 0,1,2,3,4,5,6 이여야함
									const mapping = [0,1,2,3,4,5,6];
									const jsDayOfWeek = mapping[i];
									return (
										<button
											key={i}
											type="button"
											onClick={() => toggleDay(jsDayOfWeek)}
											className={`px-2 py-1 rounded border transition-colors cursor-pointer ${repeat.days.has(jsDayOfWeek) ? "text-black" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
											style={repeat.days.has(jsDayOfWeek) ? { backgroundColor: "#FDC205" } : undefined}
										>
											{w}
										</button>
									);
								})}
							</div>
						)}
					</div>

			<div className="flex justify-end gap-2">
				<button
					className="px-3 py-1 rounded text-black disabled:opacity-50 transition-colors cursor-pointer"
					style={{ backgroundColor: "#FDC205" }}
					onClick={submit}
					disabled={loading}
				>
					{loading ? "추가 중..." : "추가"}
				</button>
				<button
					className="px-3 py-1 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
					onClick={onClose}
					disabled={loading}
				>
					닫기
				</button>
			</div>
			</div>
		</div>
	);
}


