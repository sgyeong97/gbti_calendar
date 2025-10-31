"use client";

import { useEffect, useState } from "react";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import dayjs, { Dayjs } from "dayjs";

type Props = { eventId: string | null; onClose: () => void; onChanged: () => void };

export default function EventDetailModal({ eventId, onClose, onChanged }: Props) {
	const [data, setData] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isEditing, setIsEditing] = useState(false);
	const [editTitle, setEditTitle] = useState("");
	const [editParticipants, setEditParticipants] = useState<string[]>([]);
	const [participantInput, setParticipantInput] = useState("");
	const [allParticipants, setAllParticipants] = useState<string[]>([]);
	const [isEditingRecurrence, setIsEditingRecurrence] = useState(false);
	const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set());
const [editStartAt, setEditStartAt] = useState<Dayjs | null>(null);
const [editEndAt, setEditEndAt] = useState<Dayjs | null>(null);
// 팝업 제어 (일반 이벤트)
const [openStartDate, setOpenStartDate] = useState(false);
const [openStartTime, setOpenStartTime] = useState(false);
const [openEndDate, setOpenEndDate] = useState(false);
const [openEndTime, setOpenEndTime] = useState(false);
// 반복 이벤트 시간 편집 팝업
const [openRecurringStartTime, setOpenRecurringStartTime] = useState(false);
const [openRecurringEndTime, setOpenRecurringEndTime] = useState(false);
const [editRecurringStart, setEditRecurringStart] = useState<string>("");
const [editRecurringEnd, setEditRecurringEnd] = useState<string>("");

	useEffect(() => {
		if (!eventId) {
			setLoading(false);
			return;
		}
		setLoading(true);
		setError(null);
		fetch(`/api/events/${eventId}`)
			.then((r) => {
				if (!r.ok) throw new Error("이벤트를 불러올 수 없습니다.");
				return r.json();
			})
			.then((data) => {
				setData(data);
				// 편집 상태 초기화
				setEditTitle(data.event?.title || "");
				// attendees에서 participant.name 추출
				const participantNames = (data.event?.attendees ?? []).map((a: any) => a.participant.name);
				console.log("Event data:", data.event);
				console.log("Participant names:", participantNames);
				setEditParticipants(participantNames);
				setIsEditing(false);
				// 시간 편집 초기값 세팅
        if (data.event) {
            setEditStartAt(dayjs(data.event.startAt));
            setEditEndAt(dayjs(data.event.endAt));
					if (data.event.isRecurring) {
						const rs = data.event.recurringStartMinutes ?? 0;
						const re = data.event.recurringEndMinutes ?? 0;
						const toHHMM = (m:number) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
						setEditRecurringStart(toHHMM(rs));
						setEditRecurringEnd(toHHMM(re));
						setSelectedDays(new Set<number>(data.event.recurringDays || []));
					}
				}
			})
			.catch((err) => setError(err.message))
			.finally(() => setLoading(false));
		
		// 참여자 목록 가져오기
		fetch("/api/participants").then((r) => r.json()).then((data) => {
			setAllParticipants((data.participants ?? []).map((p: any) => p.name));
		});
	}, [eventId]);

	if (!eventId) return null;
	return (
		<div className="fixed inset-0 bg-black/40 flex items-center justify-center">
			<div className="rounded p-4 w-full max-w-sm mx-4 sm:mx-0 space-y-3 max-h-[85vh] overflow-y-auto" style={{ background: "var(--background)", color: "var(--foreground)" }}>
				<h2 className="text-lg font-semibold">이벤트 상세</h2>
				{loading ? (
					<div className="text-sm text-center py-4">불러오는 중...</div>
				) : error ? (
					<div className="text-sm text-red-600 text-center py-4">{error}</div>
				) : data?.event ? (
					<div className="space-y-2 text-sm">
						{data.event.isRecurring && (
							<div className="space-y-2">
								<div className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs rounded">반복 이벤트</div>
								<div>
									<strong>반복 요일:</strong> {data.event.recurringDays && [
										"일", "월", "화", "수", "목", "금", "토"
									].filter((_, i) => data.event.recurringDays.includes(i)).join(", ")}
								</div>
								<div>
									<strong>시간:</strong> {data.event.recurringStartMinutes && 
										`${Math.floor(data.event.recurringStartMinutes / 60).toString().padStart(2, '0')}:${(data.event.recurringStartMinutes % 60).toString().padStart(2, '0')} - ${Math.floor(data.event.recurringEndMinutes / 60).toString().padStart(2, '0')}:${(data.event.recurringEndMinutes % 60).toString().padStart(2, '0')}`
									}
								</div>
							</div>
						)}
						<div>
							<strong>제목:</strong> {
								isEditing ? (
									<input
										className="w-full border rounded px-2 py-1 mt-1"
										value={editTitle}
										onChange={(e) => setEditTitle(e.target.value)}
										autoFocus
									/>
								) : (
									<span>{data.event.title}</span>
								)
							}
						</div>
						<div><strong>캘린더:</strong> {data.event.calendar?.name || "기본 캘린더"}</div>
				<LocalizationProvider dateAdapter={AdapterDayjs}>
				<div>
					<strong>시작:</strong>{" "}
					{isEditing && !data.event.isRecurring ? (
						<div className="mt-1 grid grid-cols-2 gap-2 relative">
							<div className="space-y-1">
								<label className="text-xs text-zinc-600">시작 날짜</label>
								<button type="button" className="w-full border rounded px-2 py-1 text-left" onClick={()=>setOpenStartDate(!openStartDate)}>
									{editStartAt?.format('YYYY-MM-DD')}
								</button>
								{openStartDate && editStartAt && (
									<div className="absolute z-50 mt-1 p-2 rounded border bg-white shadow" style={{width:'min(320px,90vw)'}}>
										<DateCalendar value={editStartAt} onChange={(v)=>{ if(v){ setEditStartAt(editStartAt.year(v.year()).month(v.month()).date(v.date())); setOpenStartDate(false);} }} />
									</div>
								)}
							</div>
							<div className="space-y-1">
								<label className="text-xs text-zinc-600">시작 시간</label>
								<button type="button" className="w-full border rounded px-2 py-1 text-left" onClick={()=>setOpenStartTime(!openStartTime)}>
									{editStartAt?.format('HH:mm')}
								</button>
                                    {openStartTime && editStartAt && (
                                        <div className="fixed inset-0 z-[60] flex items-center justify-center">
                                            <div className="absolute inset-0 bg-black/30" onClick={()=>setOpenStartTime(false)} />
                                            <div className="relative z-[61] p-3 rounded border bg-white shadow">
                                                <div className="flex items-center gap-2">
												<div className="flex flex-col items-center">
													<button type="button" onClick={()=>setEditStartAt(editStartAt.add(1,'hour'))}>▲</button>
													<span className="w-8 text-center">{editStartAt.format('HH')}</span>
													<button type="button" onClick={()=>setEditStartAt(editStartAt.subtract(1,'hour'))}>▼</button>
												</div>
												<span>:</span>
												<div className="flex flex-col items-center">
													<button type="button" onClick={()=>setEditStartAt(editStartAt.add(1,'minute'))}>▲</button>
													<span className="w-8 text-center">{editStartAt.format('mm')}</span>
													<button type="button" onClick={()=>setEditStartAt(editStartAt.subtract(1,'minute'))}>▼</button>
												</div>
											</div>
                                                <div className="text-right mt-2">
                                                    <button type="button" className="px-3 py-1 rounded border" onClick={()=>setOpenStartTime(false)}>확인</button>
                                                </div>
										</div>
									</div>
								)}
							</div>
						</div>
					) : (
						<span>{new Date(data.event.startAt).toLocaleString()}</span>
					)}
				</div>

					{isEditing && data.event.isRecurring && (
						<div className="space-y-2">
							<div className="text-xs text-zinc-600">반복 요일</div>
							<div className="flex gap-1 flex-wrap">
								{["일","월","화","수","목","금","토"].map((w, idx)=>{
									const on = selectedDays.has(idx);
									return (
										<button key={idx} className={`px-2 py-1 text-xs rounded border ${on?"bg-yellow-200":"hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
											onClick={()=>{
											const next = new Set(selectedDays);
											if (on) next.delete(idx); else next.add(idx);
											setSelectedDays(next);
										}}
									>
										{w}
									</button>
								);
								})}
							</div>
							<div className="grid grid-cols-2 gap-2 relative">
								<div className="space-y-1">
									<label className="text-xs text-zinc-600">시작 시간</label>
									<button type="button" className="w-full border rounded px-2 py-1 text-left" onClick={()=>setOpenRecurringStartTime(!openRecurringStartTime)}>
										{editRecurringStart || "--:--"}
									</button>
                                    {openRecurringStartTime && (
                                        <div className="fixed inset-0 z-[60] flex items-center justify-center">
                                            <div className="absolute inset-0 bg-black/30" onClick={()=>setOpenRecurringStartTime(false)} />
                                            <div className="relative z-[61] p-3 rounded border bg-white shadow">
                                                <div className="flex items-center gap-2">
													<div className="flex flex-col items-center">
														<button type="button" onClick={()=>{
															const [hh,mm]= (editRecurringStart||"00:00").split(":").map(Number);
															const d = dayjs().hour(hh).minute(mm).add(1,'hour');
															setEditRecurringStart(`${String(d.hour()).padStart(2,'0')}:${String(d.minute()).padStart(2,'0')}`);
														}}>▲</button>
														<span className="w-8 text-center">{(editRecurringStart||"00:00").split(":")[0]}</span>
														<button type="button" onClick={()=>{
															const [hh,mm]= (editRecurringStart||"00:00").split(":").map(Number);
															const d = dayjs().hour(hh).minute(mm).subtract(1,'hour');
															setEditRecurringStart(`${String(d.hour()).padStart(2,'0')}:${String(d.minute()).padStart(2,'0')}`);
														}}>▼</button>
													</div>
													<span>:</span>
													<div className="flex flex-col items-center">
														<button type="button" onClick={()=>{
															const [hh,mm]= (editRecurringStart||"00:00").split(":").map(Number);
															const d = dayjs().hour(hh).minute(mm).add(1,'minute');
															setEditRecurringStart(`${String(d.hour()).padStart(2,'0')}:${String(d.minute()).padStart(2,'0')}`);
														}}>▲</button>
														<span className="w-8 text-center">{(editRecurringStart||"00:00").split(":")[1]}</span>
														<button type="button" onClick={()=>{
															const [hh,mm]= (editRecurringStart||"00:00").split(":").map(Number);
															const d = dayjs().hour(hh).minute(mm).subtract(1,'minute');
															setEditRecurringStart(`${String(d.hour()).padStart(2,'0')}:${String(d.minute()).padStart(2,'0')}`);
														}}>▼</button>
													</div>
                                                </div>
                                                <div className="text-right mt-2">
                                                    <button type="button" className="px-3 py-1 rounded border" onClick={()=>setOpenRecurringStartTime(false)}>확인</button>
                                                </div>
											</div>
										</div>
									)}
								</div>
								<div className="space-y-1">
									<label className="text-xs text-zinc-600">종료 시간</label>
									<button type="button" className="w-full border rounded px-2 py-1 text-left" onClick={()=>setOpenRecurringEndTime(!openRecurringEndTime)}>
										{editRecurringEnd || "--:--"}
									</button>
                                    {openRecurringEndTime && (
                                        <div className="fixed inset-0 z-[60] flex items-center justify-center">
                                            <div className="absolute inset-0 bg-black/30" onClick={()=>setOpenRecurringEndTime(false)} />
                                            <div className="relative z-[61] p-3 rounded border bg-white shadow">
                                                <div className="flex items-center gap-2">
													<div className="flex flex-col items-center">
														<button type="button" onClick={()=>{
															const [hh,mm]= (editRecurringEnd||"00:00").split(":").map(Number);
															const d = dayjs().hour(hh).minute(mm).add(1,'hour');
															setEditRecurringEnd(`${String(d.hour()).padStart(2,'0')}:${String(d.minute()).padStart(2,'0')}`);
														}}>▲</button>
														<span className="w-8 text-center">{(editRecurringEnd||"00:00").split(":")[0]}</span>
														<button type="button" onClick={()=>{
															const [hh,mm]= (editRecurringEnd||"00:00").split(":").map(Number);
															const d = dayjs().hour(hh).minute(mm).subtract(1,'hour');
															setEditRecurringEnd(`${String(d.hour()).padStart(2,'0')}:${String(d.minute()).padStart(2,'0')}`);
														}}>▼</button>
													</div>
													<span>:</span>
													<div className="flex flex-col items-center">
														<button type="button" onClick={()=>{
															const [hh,mm]= (editRecurringEnd||"00:00").split(":").map(Number);
															const d = dayjs().hour(hh).minute(mm).add(1,'minute');
															setEditRecurringEnd(`${String(d.hour()).padStart(2,'0')}:${String(d.minute()).padStart(2,'0')}`);
														}}>▲</button>
														<span className="w-8 text-center">{(editRecurringEnd||"00:00").split(":")[1]}</span>
														<button type="button" onClick={()=>{
															const [hh,mm]= (editRecurringEnd||"00:00").split(":").map(Number);
															const d = dayjs().hour(hh).minute(mm).subtract(1,'minute');
															setEditRecurringEnd(`${String(d.hour()).padStart(2,'0')}:${String(d.minute()).padStart(2,'0')}`);
														}}>▼</button>
													</div>
                                                </div>
                                                <div className="text-right mt-2">
                                                    <button type="button" className="px-3 py-1 rounded border" onClick={()=>setOpenRecurringEndTime(false)}>확인</button>
                                                </div>
											</div>
										</div>
									)}
								</div>
							</div>
						</div>
					)}
				<div>
					<strong>종료:</strong>{" "}
					{isEditing && !data.event.isRecurring ? (
						<div className="mt-1 grid grid-cols-2 gap-2 relative">
							<div className="space-y-1">
								<label className="text-xs text-zinc-600">종료 날짜</label>
								<button type="button" className="w-full border rounded px-2 py-1 text-left" onClick={()=>setOpenEndDate(!openEndDate)}>
									{editEndAt?.format('YYYY-MM-DD')}
								</button>
								{openEndDate && editEndAt && (
									<div className="absolute z-50 mt-1 p-2 rounded border bg-white shadow" style={{width:'min(320px,90vw)'}}>
										<DateCalendar value={editEndAt} onChange={(v)=>{ if(v){ setEditEndAt(editEndAt.year(v.year()).month(v.month()).date(v.date())); setOpenEndDate(false);} }} />
									</div>
								)}
							</div>
							<div className="space-y-1">
								<label className="text-xs text-zinc-600">종료 시간</label>
								<button type="button" className="w-full border rounded px-2 py-1 text-left" onClick={()=>setOpenEndTime(!openEndTime)}>
									{editEndAt?.format('HH:mm')}
								</button>
                                    {openEndTime && editEndAt && (
                                        <div className="fixed inset-0 z-[60] flex items-center justify-center">
                                            <div className="absolute inset-0 bg-black/30" onClick={()=>setOpenEndTime(false)} />
                                            <div className="relative z-[61] p-3 rounded border bg-white shadow">
                                                <div className="flex items-center gap-2">
												<div className="flex flex-col items-center">
													<button type="button" onClick={()=>setEditEndAt(editEndAt.add(1,'hour'))}>▲</button>
													<span className="w-8 text-center">{editEndAt.format('HH')}</span>
													<button type="button" onClick={()=>setEditEndAt(editEndAt.subtract(1,'hour'))}>▼</button>
												</div>
												<span>:</span>
												<div className="flex flex-col items-center">
													<button type="button" onClick={()=>setEditEndAt(editEndAt.add(1,'minute'))}>▲</button>
													<span className="w-8 text-center">{editEndAt.format('mm')}</span>
													<button type="button" onClick={()=>setEditEndAt(editEndAt.subtract(1,'minute'))}>▼</button>
												</div>
											</div>
                                                <div className="text-right mt-2">
                                                    <button type="button" className="px-3 py-1 rounded border" onClick={()=>setOpenEndTime(false)}>확인</button>
                                                </div>
										</div>
									</div>
								)}
							</div>
						</div>
					) : (
						<span>{new Date(data.event.endAt).toLocaleString()}</span>
					)}
				</div>
				</LocalizationProvider>
						<div className="pt-1">
							<div className="mb-1"><strong>참여자:</strong></div>
							{isEditing ? (
								<div className="space-y-2">
									<div className="flex gap-2">
										<input
											className="border rounded px-2 py-1 text-sm flex-1"
											placeholder="참여자 입력 후 Enter"
											value={participantInput}
											onChange={(e) => setParticipantInput(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === "Enter" && participantInput.trim()) {
													if (!editParticipants.includes(participantInput.trim())) {
														setEditParticipants([...editParticipants, participantInput.trim()]);
													}
													setParticipantInput("");
												}
											}}
										/>
										<select
											className="border rounded px-2 py-1 text-sm cursor-pointer"
											onChange={(e) => {
												const name = e.target.value;
												if (name && !editParticipants.includes(name)) {
													setEditParticipants([...editParticipants, name]);
												}
												e.currentTarget.selectedIndex = 0;
											}}
										>
											<option value="">목록에서</option>
											{allParticipants.map((p) => (
												<option key={p} value={p}>{p}</option>
											))}
										</select>
									</div>
									<div className="flex gap-2 flex-wrap">
										{editParticipants.length === 0 ? (
											<span className="text-xs text-zinc-500">참여자를 추가하세요</span>
										) : (
											editParticipants.map((p) => (
												<span key={p} className="px-2 py-0.5 text-xs rounded-full bg-indigo-200 dark:bg-indigo-700 flex items-center gap-1">
													{p}
													<button
														className="ml-1 hover:text-red-600 cursor-pointer"
														onClick={() => setEditParticipants(editParticipants.filter(x => x !== p))}
													>
														×
													</button>
												</span>
											))
										)}
									</div>
								</div>
							) : (
								<div className="flex gap-2 flex-wrap">
									{(data.event.attendees ?? []).length === 0 && <span className="text-zinc-500">없음</span>}
									{(data.event.attendees ?? []).map((a: any) => (
										<span key={a.participant.id} className="px-2 py-0.5 text-xs rounded-full bg-zinc-200 dark:bg-zinc-700">
											{a.participant.name}
										</span>
									))}
								</div>
							)}
						</div>
					</div>
				) : (
					<div className="text-sm text-red-600 text-center py-4">이벤트를 찾을 수 없습니다.</div>
				)}
				<div className="flex justify-end gap-2">
					{isEditing ? (
						<>
							<button className="px-3 py-1 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer" onClick={() => {
								setIsEditing(false);
								// 원래 값으로 복원
								setEditTitle(data?.event?.title || "");
								const participantNames = (data?.event?.attendees ?? []).map((a: any) => a.participant.name);
								setEditParticipants(participantNames);
							}}>취소</button>
							<button className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer" onClick={async () => {
								if (!editTitle.trim()) return alert("제목을 입력해주세요.");
								
								// 반복 이벤트인 경우
								if (data.event.isRecurring) {
									// 제목과 참여자 업데이트
                                    // HH:MM -> minutes
                                    const toMin = (t:string) => {
                                        const [hh, mm] = t.split(":").map(Number);
                                        return (isNaN(hh)||isNaN(mm)) ? undefined : hh*60+mm;
                                    };
									await fetch(`/api/calendars/${data.event.calendarId}/recurring`, {
										method: "PUT",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({
											eventTitle: data.event.title,
											newTitle: editTitle,
                                            participants: editParticipants,
                                            days: Array.from(selectedDays),
                                            startMinutes: toMin(editRecurringStart),
                                            endMinutes: toMin(editRecurringEnd)
										})
									});
								} else {
									// 일반 이벤트: 제목과 참여자 업데이트
                                    const toIso = (v: Dayjs | null, fallback: string) => (v && v.isValid()) ? v.toDate().toISOString() : fallback;
                                    if (editStartAt && editEndAt && editEndAt.valueOf() <= editStartAt.valueOf()) {
                                        alert("종료일시가 시작일시보다 늦어야 합니다.");
                                        return;
                                    }
									await fetch(`/api/events/${eventId}`, {
										method: "PUT",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({
											title: editTitle,
                                            participants: editParticipants,
                                            startAt: toIso(editStartAt, data.event.startAt),
                                            endAt: toIso(editEndAt, data.event.endAt)
										})
									});
								}
								
								onChanged();
								setIsEditing(false);
							}}>저장</button>
						</>
					) : (
						<>
							<button className="px-3 py-1 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer" onClick={onClose} disabled={loading}>닫기</button>
							{!loading && !error && data?.event && (
								<>
									{data.event.isRecurring ? (
										<>
											<button className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer" onClick={() => setIsEditing(true)}>수정</button>
											<button className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer" onClick={async () => {
												if (!confirm("이 반복 이벤트를 완전히 삭제하시겠습니까?")) return;
												await fetch(`/api/events/${eventId}`, { method: "DELETE" });
												onChanged();
												onClose();
											}}>반복 삭제</button>
											<button className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer" onClick={async () => {
												const eventDate = new Date(data.event.startAt);
												const dateStr = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`;
												if (!confirm(`${dateStr}부터 이 반복을 종료하시겠습니까?`)) return;
												const endsOn = new Date(eventDate);
												endsOn.setHours(23, 59, 59, 999);
												await fetch(`/api/events/${eventId}`, {
													method: "PATCH",
													headers: { "Content-Type": "application/json" },
													body: JSON.stringify({ endsOn: endsOn.toISOString() })
												});
												onChanged();
												onClose();
											}}>반복 종료</button>
										</>
									) : (
										<>
											<button className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer" onClick={() => setIsEditing(true)}>수정</button>
											<button className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer" onClick={async () => {
												if (!confirm("정말로 이 이벤트를 삭제하시겠습니까?")) return;
												await fetch(`/api/events/${eventId}`, { method: "DELETE" });
												onChanged();
												onClose();
											}}>삭제</button>
										</>
									)}
								</>
							)}
						</>
					)}
				</div>
			</div>
		</div>
	);
}


