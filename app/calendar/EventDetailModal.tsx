"use client";

import { useEffect, useState } from "react";

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
			<div className="rounded p-4 w-full max-w-sm space-y-3" style={{ background: "var(--background)", color: "var(--foreground)" }}>
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
						<div><strong>시작:</strong> {new Date(data.event.startAt).toLocaleString()}</div>
						<div><strong>종료:</strong> {new Date(data.event.endAt).toLocaleString()}</div>
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
									await fetch(`/api/calendars/${data.event.calendarId}/recurring`, {
										method: "PUT",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({
											eventTitle: data.event.title,
											newTitle: editTitle,
											participants: editParticipants
										})
									});
								} else {
									// 일반 이벤트: 제목과 참여자 업데이트
									await fetch(`/api/events/${eventId}`, {
										method: "PUT",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({
											title: editTitle,
											participants: editParticipants
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


