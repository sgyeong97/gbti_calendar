"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

type PairMeeting = {
	userId1: string;
	userId2: string;
	userName1?: string;
	userName2?: string;
	count: number;
	lastMetAt?: string;
	updatedAt?: string;
	overlapMinutes: number;
};

export default function CloseGroupGlobalPage() {
	const router = useRouter();

	const [loading, setLoading] = useState(false);
	const [progress, setProgress] = useState<string>("");
	const [error, setError] = useState<string>("");
	const [pairs, setPairs] = useState<PairMeeting[]>([]);
	const [summary, setSummary] = useState<{
		averageCount: number;
		countThreshold: number;
		averageOverlap: number;
		overlapThreshold: number;
		total: number;
	} | null>(null);

	// 액티비티 캐시
	const [activityCache, setActivityCache] = useState<Record<string, Activity[]>>({});

	const filteredPairs = useMemo(() => {
		if (!summary) return [];
		return pairs
			.filter((p) => p.count >= summary.countThreshold && p.overlapMinutes >= summary.overlapThreshold && p.count >= 3)
			.sort((a, b) => b.overlapMinutes - a.overlapMinutes);
	}, [pairs, summary]);

	function formatMinutes(minutes: number): string {
		const mins = Math.round(minutes);
		const h = Math.floor(mins / 60);
		const m = mins % 60;
		if (h > 0) return `${h}시간 ${m}분`;
		return `${m}분`;
	}

	function computeOverlapMinutes(myActs: Activity[], otherActs: Activity[]): number {
		let total = 0;
		const mine = (myActs || []).filter(Boolean).map((a) => {
			const startRaw = a.startTime ?? a.startAt ?? a.date;
			const startMs = startRaw ? new Date(startRaw).getTime() : NaN;
			const endRaw = a.endTime ?? a.endAt;
			const endMs = endRaw
				? new Date(endRaw).getTime()
				: startMs + ((typeof a.durationMinutes === "number" ? a.durationMinutes : 0) * 60000);
			return { start: startMs, end: endMs, channelId: a.channelId };
		}).filter((x) => Number.isFinite(x.start) && Number.isFinite(x.end));

		const yours = (otherActs || []).filter(Boolean).map((a) => {
			const startRaw = a.startTime ?? a.startAt ?? a.date;
			const startMs = startRaw ? new Date(startRaw).getTime() : NaN;
			const endRaw = a.endTime ?? a.endAt;
			const endMs = endRaw
				? new Date(endRaw).getTime()
				: startMs + ((typeof a.durationMinutes === "number" ? a.durationMinutes : 0) * 60000);
			return { start: startMs, end: endMs, channelId: a.channelId };
		}).filter((x) => Number.isFinite(x.start) && Number.isFinite(x.end));

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

	async function loadActivities(userId: string): Promise<Activity[]> {
		if (activityCache[userId]) return activityCache[userId];
		const res = await fetch(`/api/discord-activity?groupBy=user&userId=${encodeURIComponent(userId)}`);
		if (!res.ok) throw new Error("활동 데이터를 불러오지 못했습니다.");
		const json = await res.json();
		const acts: Activity[] = json.data?.[userId]?.activities || [];
		setActivityCache((prev) => ({ ...prev, [userId]: acts }));
		return acts;
	}

	useEffect(() => {
		async function load() {
			setLoading(true);
			setError("");
			try {
				setProgress("만남 횟수 로딩...");
				const meetRes = await fetch(`/api/discord-activity/meeting-counts/all`);
				if (!meetRes.ok) throw new Error("만남 횟수 목록을 불러오지 못했습니다.");
				const meetJson = await meetRes.json();
				const data: any[] = meetJson.data || [];
				if (!data.length) {
					setSummary({
						averageCount: 0,
						countThreshold: 5,
						averageOverlap: 0,
						overlapThreshold: 300,
						total: 0,
					});
					setPairs([]);
					return;
				}

				const avgCount = data.reduce((s, r) => s + (r.count || 0), 0) / data.length;
				const countThreshold = avgCount + 5;

				const results: PairMeeting[] = [];
				for (let i = 0; i < data.length; i++) {
					const pair = data[i];
					if ((pair.count || 0) < countThreshold || (pair.count || 0) < 3) continue;

					setProgress(`겹친 시간 계산 중 ${i + 1}/${data.length}`);
					const acts1 = await loadActivities(pair.userId1);
					const acts2 = await loadActivities(pair.userId2);
					const overlap = computeOverlapMinutes(acts1, acts2);

					results.push({
						userId1: pair.userId1,
						userId2: pair.userId2,
						userName1: pair.userName1 || pair.userId1,
						userName2: pair.userName2 || pair.userId2,
						count: pair.count || 0,
						lastMetAt: pair.lastMetAt,
						updatedAt: pair.updatedAt,
						overlapMinutes: overlap,
					});
				}

				const avgOverlap = results.reduce((s, r) => s + r.overlapMinutes, 0) / (results.length || 1);
				const overlapThreshold = avgOverlap + 300; // +5시간

				setSummary({
					averageCount: avgCount,
					countThreshold,
					averageOverlap: avgOverlap,
					overlapThreshold,
					total: results.length,
				});
				setPairs(results);
			} catch (err: any) {
				console.error(err);
				setError(err?.message || "로딩 실패");
			} finally {
				setLoading(false);
				setProgress("");
			}
		}
		load();
	}, []);

	return (
		<div className="p-6 max-w-7xl mx-auto" style={{ background: "var(--background)", color: "var(--foreground)" }}>
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-semibold">끼리끼리 분석 (전체)</h1>
				<button
					className="px-3 py-2 rounded border text-sm cursor-pointer"
					style={{ borderColor: "var(--accent)" }}
					onClick={() => router.push("/admin/activity-dashboard")}
				>
					대시보드로
				</button>
			</div>

			{loading && (
				<div className="mb-3 text-sm opacity-70">로딩 중... {progress}</div>
			)}
			{error && (
				<div className="mb-3 text-sm text-red-500">오류: {error}</div>
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
						<div>총 후보 쌍: <strong>{summary.total}쌍</strong></div>
						<div>해당 쌍: <strong>{filteredPairs.length}쌍</strong></div>
					</div>
				</div>
			)}

			{filteredPairs.length === 0 ? (
				<div className="text-center py-12" style={{ opacity: 0.7 }}>
					조건을 만족하는 쌍이 없습니다.
				</div>
			) : (
				<div className="space-y-3">
					{filteredPairs.map((p, idx) => (
						<div
							key={`${p.userId1}-${p.userId2}-${idx}`}
							className="p-4 rounded border"
							style={{ borderColor: "var(--accent)", background: "var(--background)" }}
						>
							<div className="flex items-center justify-between">
								<div className="font-medium text-lg">
									{p.userName1} · {p.userName2}
								</div>
								<div className="text-sm opacity-70">
									{p.userId1} / {p.userId2}
								</div>
							</div>
							<div className="mt-1 text-sm flex flex-wrap gap-3">
								<span className="font-semibold">{p.count}회</span>
								<span className="opacity-80">{formatMinutes(p.overlapMinutes)}</span>
								{p.lastMetAt && (
									<span className="opacity-70">
										마지막 만남: {new Date(p.lastMetAt).toLocaleString("ko-KR", {
											year: "numeric",
											month: "long",
											day: "numeric",
											hour: "2-digit",
											minute: "2-digit",
										})}
									</span>
								)}
								{p.updatedAt && (
									<span className="opacity-50 text-xs">
										업데이트: {new Date(p.updatedAt).toLocaleString("ko-KR", {
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

