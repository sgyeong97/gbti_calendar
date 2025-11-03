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
			setAllParticipants((data.participants ?? []).map((p: any) => p.name));
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
                        {/* 인라인 입력 */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <label className="text-xs text-zinc-600">시작 날짜</label>
                                <button type="button" className="w-full border rounded px-2 py-1 text-left" onClick={()=>setOpenStartDate(!openStartDate)}>
                                    {startAt.format('YYYY-MM-DD')}
                                </button>
                                {openStartDate && (
                                    <div className="absolute z-50 mt-1 p-2 rounded border bg-white shadow" style={{width:'min(320px,90vw)'}}>
                                        <DateCalendar value={startAt} onChange={(v)=>{ if(v){ setStartAt(startAt.year(v.year()).month(v.month()).date(v.date())); setOpenStartDate(false);} }} />
                                    </div>
                                )}
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-zinc-600">시작 시간</label>
                                <button type="button" className="w-full border rounded px-2 py-1 text-left" onClick={()=>setOpenStartTime(!openStartTime)}>
                                    {startAt.format('HH:mm')}
                                </button>
                                {openStartTime && (
                                    <div className="fixed inset-0 z-[60] flex items-center justify-center">
                                        <div className="absolute inset-0 bg-black/30" onClick={()=>setOpenStartTime(false)} />
                                        <div className="relative z-[61] p-3 rounded border bg-white shadow">
                                            <div className="flex items-center gap-2">
                                                <div className="flex flex-col items-center">
                                                    <button type="button" onClick={()=>setStartAt(startAt.add(1,'hour'))}>▲</button>
                                                    <input
                                                        className="w-12 text-center border rounded px-1 py-0.5"
                                                        value={startAt.format('HH')}
                                                        onChange={(e)=>{
                                                            const v = e.target.value.replace(/\D/g,'');
                                                            const n = Math.min(23, Math.max(0, Number(v||'0')));
                                                            setStartAt(startAt.hour(n));
                                                        }}
                                                    />
                                                    <button type="button" onClick={()=>setStartAt(startAt.subtract(1,'hour'))}>▼</button>
                                                </div>
                                                <span>:</span>
                                                <div className="flex flex-col items-center">
                                                    <button type="button" onClick={()=>setStartAt(startAt.add(1,'minute'))}>▲</button>
                                                    <input
                                                        className="w-12 text-center border rounded px-1 py-0.5"
                                                        value={startAt.format('mm')}
                                                        onChange={(e)=>{
                                                            const v = e.target.value.replace(/\D/g,'');
                                                            const n = Math.min(59, Math.max(0, Number(v||'0')));
                                                            setStartAt(startAt.minute(n));
                                                        }}
                                                    />
                                                    <button type="button" onClick={()=>setStartAt(startAt.subtract(1,'minute'))}>▼</button>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 justify-between mt-2">
                                                <div className="flex items-center gap-2">
                                                    <button type="button" className="px-2 py-1 rounded border" onClick={()=>setStartAt(startAt.add(5,'minute'))}>+5분</button>
                                                    <button type="button" className="px-2 py-1 rounded border" onClick={()=>setStartAt(startAt.add(10,'minute'))}>+10분</button>
                                                    <button type="button" className="px-2 py-1 rounded border" onClick={()=>setStartAt(startAt.add(30,'minute'))}>+30분</button>
                                                </div>
                                                <div className="text-right">
                                                <button type="button" className="px-3 py-1 rounded border" onClick={()=>setOpenStartTime(false)}>확인</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <label className="text-xs text-zinc-600">종료 날짜</label>
                                <button type="button" className="w-full border rounded px-2 py-1 text-left" onClick={()=>setOpenEndDate(!openEndDate)}>
                                    {endAt.format('YYYY-MM-DD')}
                                </button>
                                {openEndDate && (
                                    <div className="absolute z-50 mt-1 p-2 rounded border bg-white shadow" style={{width:'min(320px,90vw)'}}>
                                        <DateCalendar value={endAt} onChange={(v)=>{ if(v){ setEndAt(endAt.year(v.year()).month(v.month()).date(v.date())); setOpenEndDate(false);} }} />
                                    </div>
                                )}
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-zinc-600">종료 시간</label>
                                <button type="button" className="w-full border rounded px-2 py-1 text-left" onClick={()=>setOpenEndTime(!openEndTime)}>
                                    {endAt.format('HH:mm')}
                                </button>
                                {openEndTime && (
                                    <div className="fixed inset-0 z-[60] flex items-center justify-center">
                                        <div className="absolute inset-0 bg-black/30" onClick={()=>setOpenEndTime(false)} />
                                        <div className="relative z-[61] p-3 rounded border bg-white shadow">
                                            <div className="flex items-center gap-2">
                                                <div className="flex flex-col items-center">
                                                    <button type="button" onClick={()=>setEndAt(endAt.add(1,'hour'))}>▲</button>
                                                    <input
                                                        className="w-12 text-center border rounded px-1 py-0.5"
                                                        value={endAt.format('HH')}
                                                        onChange={(e)=>{
                                                            const v = e.target.value.replace(/\D/g,'');
                                                            const n = Math.min(23, Math.max(0, Number(v||'0')));
                                                            setEndAt(endAt.hour(n));
                                                        }}
                                                    />
                                                    <button type="button" onClick={()=>setEndAt(endAt.subtract(1,'hour'))}>▼</button>
                                                </div>
                                                <span>:</span>
                                                <div className="flex flex-col items-center">
                                                    <button type="button" onClick={()=>setEndAt(endAt.add(1,'minute'))}>▲</button>
                                                    <input
                                                        className="w-12 text-center border rounded px-1 py-0.5"
                                                        value={endAt.format('mm')}
                                                        onChange={(e)=>{
                                                            const v = e.target.value.replace(/\D/g,'');
                                                            const n = Math.min(59, Math.max(0, Number(v||'0')));
                                                            setEndAt(endAt.minute(n));
                                                        }}
                                                    />
                                                    <button type="button" onClick={()=>setEndAt(endAt.subtract(1,'minute'))}>▼</button>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 justify-between mt-2">
                                                <div className="flex items-center gap-2">
                                                    <button type="button" className="px-2 py-1 rounded border" onClick={()=>setEndAt(endAt.add(5,'minute'))}>+5분</button>
                                                    <button type="button" className="px-2 py-1 rounded border" onClick={()=>setEndAt(endAt.add(10,'minute'))}>+10분</button>
                                                    <button type="button" className="px-2 py-1 rounded border" onClick={()=>setEndAt(endAt.add(30,'minute'))}>+30분</button>
                                                </div>
                                                <div className="text-right">
                                                <button type="button" className="px-3 py-1 rounded border" onClick={()=>setOpenEndTime(false)}>확인</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
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
							{participants.map((p) => (
								<span key={p} className="px-2 py-0.5 text-xs rounded-full bg-zinc-200 dark:bg-zinc-700">
									{p}
									<button
										className="ml-1 text-zinc-500 hover:text-zinc-700"
										onClick={() => setParticipants(participants.filter(x => x !== p))}
									>
										×
									</button>
								</span>
							))}
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


