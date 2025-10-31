"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";

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
    const [date, setDate] = useState(initialDateTime.date);
    const [endDate, setEndDate] = useState(initialDateTime.date);
	const [start, setStart] = useState(initialDateTime.start);
	const [end, setEnd] = useState(initialDateTime.end);
	const [participantInput, setParticipantInput] = useState("");
	const [participants, setParticipants] = useState<string[]>([]);
	const [allParticipants, setAllParticipants] = useState<string[]>([]);
	const [repeat, setRepeat] = useState<{enabled:boolean, days:Set<number>}>({ enabled: false, days: new Set<number>() });
	const [loading, setLoading] = useState(false);

	// 선택된 날짜가 변경되면 모든 상태 업데이트
	useEffect(() => {
		const newDateTime = getInitialDateTime();
		setDate(newDateTime.date);
		setStart(newDateTime.start);
		setEnd(newDateTime.end);
    }, [selectedDate]);

	useEffect(() => {
		// 참여자 목록 (모든 사용자 노출)
		fetch("/api/participants").then((r) => r.json()).then((data) => {
			setAllParticipants((data.participants ?? []).map((p: any) => p.name));
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
            const startAt = new Date(`${date}T${start}:00`);
            const endAt = new Date(`${endDate}T${end}:00`);

            if (endAt <= startAt) {
                return alert("종료일시가 시작일시보다 늦어야 합니다.");
            }

			// 요청 데이터 구성
			const requestData: any = {
				title,
				startAt,
				endAt,
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
					startMinutes: parseInt(start.split(":")[0]) * 60 + parseInt(start.split(":")[1]),
					endMinutes: parseInt(end.split(":")[0]) * 60 + parseInt(end.split(":")[1]),
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
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-xs text-zinc-600">시작 날짜</label>
                        <input
                            className="w-full border rounded px-2 py-1"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-xs text-zinc-600">종료 날짜</label>
                        <input
                            className="w-full border rounded px-2 py-1"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex gap-2">
                    <div className="w-full">
                        <label className="text-xs text-zinc-600">시작 시간</label>
                        <input
                            className="border rounded px-2 py-1 w-full"
                            type="time"
                            value={start}
                            onChange={(e) => setStart(e.target.value)}
                        />
                    </div>
                    <div className="w-full">
                        <label className="text-xs text-zinc-600">종료 시간</label>
                        <input
                            className="border rounded px-2 py-1 w-full"
                            type="time"
                            value={end}
                            onChange={(e) => setEnd(e.target.value)}
                        />
                    </div>
                </div>

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
						className="px-3 py-1 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
						onClick={onClose}
						disabled={loading}
					>
						닫기
					</button>
					<button
						className="px-3 py-1 rounded text-black disabled:opacity-50 transition-colors cursor-pointer"
						style={{ backgroundColor: "#FDC205" }}
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


