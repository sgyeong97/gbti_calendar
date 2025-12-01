"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import dayjs, { Dayjs } from "dayjs";
import {
	getDayOfWeekFromUIIndex,
	toggleDayOfWeek,
	normalizeDaysOfWeek,
	formatDaysOfWeekForDebug,
	debugRecurringEventCreation,
	DAY_NAMES_KO,
} from "@/app/lib/recurring-events";
import { EVENT_COLOR_PALETTES, getCurrentEventColorPalette } from "@/app/lib/color-themes";

type Props = {
	selectedDate?: Date;
	onClose: () => void;
	onCreated: () => void;
};

export default function CreateEventModal({ selectedDate, onClose, onCreated }: Props) {
	const [title, setTitle] = useState("");
	const [color, setColor] = useState("#FDC205");
  const [palette, setPalette] = useState(EVENT_COLOR_PALETTES.default);

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
    // 컬러 테마에 따른 팔레트 설정
    try {
      setPalette(getCurrentEventColorPalette());
    } catch {
      setPalette(EVENT_COLOR_PALETTES.default);
    }

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

		// localStorage에서 현재 사용자명 가져오기
		const savedUserName = localStorage.getItem("gbti_current_user_name");
		const initialParticipants: string[] = [];
		
		// 드래프트 복원
		try {
			const raw = localStorage.getItem("gbti_create_event_draft");
			if (raw) {
				const d = JSON.parse(raw);
				if (typeof d.title === "string") setTitle(d.title);
				if (typeof d.color === "string") setColor(d.color);
				if (d.startAt) setStartAt(dayjs(d.startAt));
				if (d.endAt) setEndAt(dayjs(d.endAt));
				if (Array.isArray(d.participants)) {
					initialParticipants.push(...d.participants);
				}
				if (d.repeat && typeof d.repeat.enabled === 'boolean' && Array.isArray(d.repeat.days)) {
					setRepeat({ enabled: d.repeat.enabled, days: new Set<number>(d.repeat.days) });
				}
			}
		} catch {}
		
		// 드래프트에 참여자가 없고, localStorage에 사용자명이 있으면 기본 참여자로 추가
		if (savedUserName && initialParticipants.length === 0 && !initialParticipants.includes(savedUserName)) {
			initialParticipants.push(savedUserName);
		}
		
		if (initialParticipants.length > 0) {
			setParticipants(initialParticipants);
		}
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

	function toggleDay(uiIndex: number) {
		// UI 인덱스를 JavaScript getDay() 값으로 변환
		const dayOfWeek = getDayOfWeekFromUIIndex(uiIndex);
		// 공용 모듈의 toggleDayOfWeek 함수 사용
		const next = toggleDayOfWeek(repeat.days, dayOfWeek, true);
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
				const daysOfWeek = normalizeDaysOfWeek(Array.from(repeat.days));
				const startMinutes = startAt.hour() * 60 + startAt.minute();
				const endMinutes = endAt.hour() * 60 + endAt.minute();
				
				// 공용 모듈의 디버깅 함수 사용
				debugRecurringEventCreation({
					title,
					startAt: startAt.toDate(),
					endAt: endAt.toDate(),
					daysOfWeek,
					startMinutes,
					endMinutes,
				});
				
				requestData.repeat = {
					daysOfWeek: daysOfWeek,
					startMinutes,
					endMinutes,
					color
				};
				
				console.log(`[CreateEventModal] 전송할 requestData.repeat:`, requestData.repeat);
			}

			console.log(`[CreateEventModal] API 요청 전송:`, JSON.stringify(requestData, null, 2));

			const res = await fetch("/api/events", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestData),
			});

			if (res.ok) {
				const result = await res.json();
				console.log("[CreateEventModal] 이벤트 생성 성공:", result);
				try { localStorage.removeItem("gbti_create_event_draft"); } catch {}
				onCreated();
			} else {
				const error = await res.json();
				console.error("[CreateEventModal] API 오류:", error);
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
                        {/* 시작: 날짜 + 시간 */}
                        <div>
                            <strong>시작:</strong>{" "}
                            <div className="mt-1 flex items-center gap-2 flex-wrap relative">
                                <button 
                                    type="button" 
                                    className="px-3 py-1.5 border rounded text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                    onClick={()=>setOpenStartDate(!openStartDate)}
                                >
                                    {startAt.format('M월 D일')} ({['일','월','화','수','목','금','토'][startAt.day()]})
                                </button>
                                {openStartDate && (
                                    <div className="absolute z-50 mt-1 p-2 rounded border bg-white dark:bg-zinc-800 shadow-lg" style={{width:'min(320px,90vw)'}}>
                                        <DateCalendar value={startAt} onChange={(v)=>{ if(v){ setStartAt(startAt.year(v.year()).month(v.month()).date(v.date())); setOpenStartDate(false);} }} />
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
                                {openStartDate && (
                                    <div className="fixed inset-0 z-40" onClick={()=>setOpenStartDate(false)} />
                                )}
                                {openStartTime && (
                                    <div className="fixed inset-0 z-40" onClick={()=>setOpenStartTime(false)} />
                                )}
                            </div>
                        </div>
                        
                        {/* 종료: 날짜 + 시간 */}
                        <div>
                            <strong>종료:</strong>{" "}
                            <div className="mt-1 flex items-center gap-2 flex-wrap relative">
                                <button 
                                    type="button" 
                                    className="px-3 py-1.5 border rounded text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                    onClick={()=>setOpenEndDate(!openEndDate)}
                                >
                                    {endAt.format('M월 D일')} ({['일','월','화','수','목','금','토'][endAt.day()]})
                                </button>
                                {openEndDate && (
                                    <div className="absolute z-50 mt-1 p-2 rounded border bg-white dark:bg-zinc-800 shadow-lg" style={{width:'min(320px,90vw)'}}>
                                        <DateCalendar value={endAt} onChange={(v)=>{ if(v){ setEndAt(endAt.year(v.year()).month(v.month()).date(v.date())); setOpenEndDate(false);} }} />
                                    </div>
                                )}
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
                                {openEndDate && (
                                    <div className="fixed inset-0 z-40" onClick={()=>setOpenEndDate(false)} />
                                )}
                                {openEndTime && (
                                    <div className="fixed inset-0 z-40" onClick={()=>setOpenEndTime(false)} />
                                )}
                            </div>
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
										className="px-3 py-1.5 text-sm rounded-full flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
										style={{ backgroundColor: bgColor }}
									>
										{participantInfo?.title && (
											<span
												className="font-bold mr-0.5 px-2 py-0.5 rounded"
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
											className="ml-1 text-zinc-500 hover:text-zinc-700 text-base font-bold"
											onClick={(e) => {
												e.stopPropagation();
												setParticipants(participants.filter(x => x !== p));
											}}
											title="제거"
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
						{palette.map((c) => (
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
								{DAY_NAMES_KO.map((w, i) => {
									// UI 인덱스를 JavaScript getDay() 값으로 변환
									const jsDayOfWeek = getDayOfWeekFromUIIndex(i);
									return (
										<button
											key={i}
											type="button"
											onClick={() => toggleDay(i)} // UI 인덱스 전달
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


