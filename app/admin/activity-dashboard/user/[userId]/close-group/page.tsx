"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Activity = {
	startTime?: string;
	startAt?: string;
	endTime?: string;
	endAt?: string;
	date?: string;
	durationMinutes?: number;
	channelId?: string;
	channelName?: string;
};

type ChannelOverlap = {
	channelId: string;
	channelName: string;
	totalMinutes: number;
};

type CloseMember = {
	userId: string;
	userName: string;
	count: number;
	lastMetAt?: string;
	updatedAt?: string;
	overlapMinutes: number;
};

export default function CloseGroupPage() {
	const params = useParams();
	const router = useRouter();
	const userId = params.userId as string;

	const [loading, setLoading] = useState(false);
	const [progress, setProgress] = useState<string>("");
	const [error, setError] = useState<string>("");
	const [members, setMembers] = useState<CloseMember[]>([]);
	const [summary, setSummary] = useState<{
		averageCount: number;
		countThreshold: number;
		averageOverlap: number;
		overlapThreshold: number;
		totalCandidates: number;
	} | null>(null);

	// 겹친 시간 계산
	function computeOverlapMinutes(myActs: Activity[], otherActs: Activity[]): number {
		let total = 0;
		const mine = (myActs || []).filter(Boolean).map((a) => ({
			start: new Date(a.startTime || a.startAt || a.date || "").getTime(),
			end: a.endTime || a.endAt
				? new Date(a.endTime || a.endAt).getTime()
				: new Date(a.startTime || a.startAt || a.date || "").getTime() +
				  ((typeof a.durationMinutes === "number" ? a.durationMinutes : 0) * 60000),
			channelId: a.channelId,
		}));
		const yours = (otherActs || []).filter(Boolean).map((a) => ({
			start: new Date(a.startTime || a.startAt || a.date || "").getTime(),
			end: a.endTime || a.endAt
				? new Date(a.endTime || a.endAt).getTime()
				: new Date(a.startTime || a.startAt || a.date || "").getTime() +
				  ((typeof a.durationMinutes === "number" ? a.durationMinutes : 0) * 60000),
			channelId: a.channelId,
		}));
		for (const a of mine) {
			if (!a.channelId) continue;
			for (const b of yours) {
				if (a.channelId !== b.channelId) continue;
				const overlapStart = Math.max(a.start, b.start);
				const overlapEnd = Math.min(a.end, b.end);
				const diff = overlapEnd - overlapStart;
				if (diff > 0) {
					total += Math.round(diff / 60000);
				}
			}
		}
		return total;
	}

	useEffect(() => {
		async function load() {
			setLoading(true);
			setError("");
			try {
				// 내 활동
				const meRes = await fetch(`/api/discord-activity?groupBy=user&userId=${encodeURIComponent(userId)}`);
				if (!meRes.ok) throw new Error("내 활동 데이터를 불러오지 못했습니다.");
				const meJson = await meRes.json();
				const myActs: Activity[] = meJson.data?.[userId]?.activities || [];

				// 만남 횟수 목록
				const meetRes = await fetch(`/api/discord-activity/meeting-counts?userId=${encodeURIComponent(userId)}`);
				if (!meetRes.ok) throw new Error("만남 횟수를 불러오지 못했습니다.");
				const meetJson = await meetRes.json();
				const meetList: any[] = meetJson.data || [];

				if (meetList.length === 0) {
					setMembers([]);
					setSummary({
						averageCount: 0,
						countThreshold: 5,
						averageOverlap: 0,
						overlapThreshold: 300,
						totalCandidates: 0,
					});
					return;
				}

				// 평균 계산
				const avgCount = meetList.reduce((s, m) => s + (m.count || 0), 0) / meetList.length;
				const countThreshold = avgCount + 5;

				const result: CloseMember[] = [];
				for (let i = 0; i < meetList.length; i++) {
					const m = meetList[i];
					setProgress(`상대 활동 조회 중 ${i + 1}/${meetList.length}`);
					const otherId = m.otherUserId;
					const otherRes = await fetch(`/api/discord-activity?groupBy=user&userId=${encodeURIComponent(otherId)}`);
					if (!otherRes.ok) continue;
					const otherJson = await otherRes.json();
					const otherActs: Activity[] = otherJson.data?.[otherId]?.activities || [];
					const overlap = computeOverlapMinutes(myActs, otherActs);
					result.push({
						userId: otherId,
						userName: m.otherUserName || otherId,
						count: m.count || 0,
						lastMetAt: m.lastMetAt,
						updatedAt: m.updatedAt,
						overlapMinutes: overlap,
					});
				}

				const avgOverlap = result.reduce((s, r) => s + r.overlapMinutes, 0) / (result.length || 1);
				const overlapThreshold = avgOverlap + 300; // +5시간

				const filtered = result
					.filter((r) => r.count >= countThreshold && r.overlapMinutes >= overlapThreshold)
					.sort((a, b) => b.overlapMinutes - a.overlapMinutes);

				setMembers(filtered);
				setSummary({
					averageCount: avgCount,
					countThreshold,
					averageOverlap: avgOverlap,
					overlapThreshold,
					totalCandidates: filtered.length,
				});
			} catch (err: any) {
				console.error(err);
				setError(err?.message || "로딩 실패");
			} finally {
				setLoading(false);
				setProgress("");
			}
		}
		if (userId) {
			load();
		}
	}, [userId]);

	function formatMinutes(minutes: number): string {
		const mins = Math.round(minutes);
		const h = Math.floor(mins / 60);
		const m = mins % 60;
		if (h > 0) return `${h}시간 ${m}분`;
		return `${m}분`;
	}

	return (
		<div className="p-6 max-w-7xl mx-auto" style={{ background: "var(--background)", color: "var(--foreground)" }}>
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-semibold">끼리끼리 분석</h1>
				<div className="flex gap-2">
					<button
						className="px-3 py-2 rounded border text-sm cursor-pointer"
						style={{ borderColor: "var(--accent)" }}
						onClick={() => router.push(`/admin/activity-dashboard/user/${userId}`)}
					>
						사용자 상세로
					</button>
				</div>
			</div>

			{loading && (
				<div className="mb-4 text-sm opacity-70">
					분석 중... {progress}
				</div>
			)}
			{error && (
				<div className="mb-4 text-sm text-red-500">
					오류: {error}
				</div>
			)}

			{summary && (
				<div
					className="rounded-lg p-4 mb-4"
					style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", border: "1px solid var(--accent)" }}
				>
					<div className="text-sm space-y-1">
						<div>평균 만남 횟수: <strong>{summary.averageCount.toFixed(2)}회</strong></div>
						<div>기준 (평균 + 5회): <strong>{summary.countThreshold.toFixed(2)}회</strong></div>
						<div>평균 같이 있는 시간: <strong>{formatMinutes(summary.averageOverlap)}</strong></div>
						<div>기준 (평균 + 5시간): <strong>{formatMinutes(summary.overlapThreshold)}</strong></div>
						<div>해당 인원: <strong>{summary.totalCandidates}명</strong> (3명 이상일 때 의미 있음)</div>
					</div>
				</div>
			)}

			{members.length === 0 ? (
				<div className="text-center py-12" style={{ opacity: 0.7 }}>
					조건을 만족하는 사용자가 없습니다.
				</div>
			) : (
				<div className="space-y-3">
					{members.map((m) => (
						<div
							key={m.userId}
							className="p-4 rounded border"
							style={{ borderColor: "var(--accent)", background: "var(--background)" }}
						>
							<div className="flex items-center justify-between">
								<div className="font-medium text-lg">{m.userName}</div>
								<div className="text-sm opacity-70">{m.userId}</div>
							</div>
							<div className="mt-1 text-sm flex flex-wrap gap-3">
								<span className="font-semibold">{m.count}회</span>
								<span className="opacity-80">{formatMinutes(m.overlapMinutes)}</span>
								{m.lastMetAt && (
									<span className="opacity-70">
										마지막 만남: {new Date(m.lastMetAt).toLocaleString("ko-KR", {
											year: "numeric",
											month: "long",
											day: "numeric",
											hour: "2-digit",
											minute: "2-digit",
										})}
									</span>
								)}
								{m.updatedAt && (
									<span className="opacity-50 text-xs">
										업데이트: {new Date(m.updatedAt).toLocaleString("ko-KR", {
											year: "numeric",
											month: "long",
											day: "numeric",
											hour: "2-digit",
											minute: "2-digit",
										})}
									</span>
								)}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

