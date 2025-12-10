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
		averageOverlap: number;
		total: number;
	} | null>(null);

	// 기준 옵션
	const [countOffset, setCountOffset] = useState<number>(5); // 평균 + n회
	const [timeOffsetHours, setTimeOffsetHours] = useState<number>(5); // 평균 + n시간
	const [minCount, setMinCount] = useState<number>(3); // 최소 만남 회수

	// 액티비티 캐시
	const [activityCache, setActivityCache] = useState<Record<string, Activity[]>>({});

	const thresholds = useMemo(() => {
		if (!summary) {
			return {
				countThreshold: countOffset,
				overlapThreshold: timeOffsetHours * 60,
			};
		}
		return {
			countThreshold: summary.averageCount + countOffset,
			overlapThreshold: summary.averageOverlap + timeOffsetHours * 60,
		};
	}, [summary, countOffset, timeOffsetHours]);

	const filteredPairs = useMemo(() => {
		if (!summary) return [];
		return pairs
			.filter((p) => p.count >= thresholds.countThreshold && p.overlapMinutes >= thresholds.overlapThreshold && p.count >= minCount)
			.sort((a, b) => b.overlapMinutes - a.overlapMinutes);
	}, [pairs, summary, thresholds, minCount]);

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
						averageOverlap: 0,
						total: 0,
					});
					setPairs([]);
					return;
				}

				const avgCount = data.reduce((s, r) => s + (r.count || 0), 0) / data.length;

				const results: PairMeeting[] = [];
				for (let i = 0; i < data.length; i++) {
					const pair = data[i];

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

				setSummary({
					averageCount: avgCount,
					averageOverlap: avgOverlap,
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
						<div>기준 (평균 + {countOffset}회): <strong>{thresholds.countThreshold.toFixed(2)}회</strong></div>
						<div>평균 같이 있는 시간: <strong>{formatMinutes(summary.averageOverlap)}</strong></div>
						<div>기준 (평균 + {timeOffsetHours}시간): <strong>{formatMinutes(thresholds.overlapThreshold)}</strong></div>
						<div>최소 만남 회수: <strong>{minCount}회 이상</strong></div>
						<div>총 후보 쌍(전체 계산됨): <strong>{summary.total}쌍</strong></div>
						<div>조건 충족 쌍: <strong>{filteredPairs.length}쌍</strong></div>
					</div>
					<div className="mt-3 flex flex-wrap items-end gap-3 text-sm">
						<label className="flex items-center gap-2">
							<span className="opacity-80">만남 기준 +</span>
							<input
								type="number"
								min={0}
								step={1}
								value={countOffset}
								onChange={(e) => setCountOffset(Number(e.target.value) || 0)}
								className="px-2 py-1 rounded border bg-transparent"
								style={{ borderColor: "var(--accent)" }}
							/>
							<span>회</span>
						</label>
						<label className="flex items-center gap-2">
							<span className="opacity-80">시간 기준 +</span>
							<input
								type="number"
								min={0}
								step={0.5}
								value={timeOffsetHours}
								onChange={(e) => setTimeOffsetHours(Number(e.target.value) || 0)}
								className="px-2 py-1 rounded border bg-transparent"
								style={{ borderColor: "var(--accent)" }}
							/>
							<span>시간</span>
						</label>
						<label className="flex items-center gap-2">
							<span className="opacity-80">최소 만남</span>
							<input
								type="number"
								min={0}
								step={1}
								value={minCount}
								onChange={(e) => setMinCount(Number(e.target.value) || 0)}
								className="px-2 py-1 rounded border bg-transparent"
								style={{ borderColor: "var(--accent)" }}
							/>
							<span>회 이상</span>
						</label>
						<button
							className="px-3 py-2 rounded border text-xs cursor-pointer"
							style={{ borderColor: "var(--accent)" }}
							onClick={() => {
								setCountOffset(5);
								setTimeOffsetHours(5);
								setMinCount(3);
							}}
						>
							초기값으로
						</button>
					</div>
				</div>
			)}

			<div className="space-y-6">
				<div>
					<h2 className="text-lg font-semibold mb-2">조건 충족 쌍</h2>
					{filteredPairs.length === 0 ? (
						<div className="text-center py-8" style={{ opacity: 0.7 }}>
							조건을 만족하는 쌍이 없습니다.
						</div>
					) : (
						<div className="space-y-3">
							{filteredPairs.map((p, idx) => (
								<div
									key={`filtered-${p.userId1}-${p.userId2}-${idx}`}
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

				<div>
					<h2 className="text-lg font-semibold mb-2">전체 후보 쌍</h2>
					{pairs.length === 0 ? (
						<div className="text-center py-8" style={{ opacity: 0.7 }}>
							계산된 후보 쌍이 없습니다.
						</div>
					) : (
						<div className="space-y-3">
							{pairs.map((p, idx) => (
								<div
									key={`all-${p.userId1}-${p.userId2}-${idx}`}
									className="p-4 rounded border"
									style={{
										borderColor: "var(--accent)",
										background: "color-mix(in srgb, var(--background) 95%, var(--accent) 5%)",
									}}
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
			</div>
		</div>
	);
}

