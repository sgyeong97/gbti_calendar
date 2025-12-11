"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { applyColorTheme } from "@/app/lib/color-themes";

type ChannelInfo = {
	channelId: string;
	channelName: string;
	createdAt?: string; // 채널 생성 시각
	deletedAt?: string; // 채널 사라진 시각
	titles: string[]; // 로그별 기록된 제목들
	participants: {
		userId: string;
		userName: string;
		totalMinutes: number; // 해당 채널에서 머문 시간
	}[];
	totalActivityCount: number; // 총 활동 로그 수
};

export default function ChannelAnalysisPage() {
	const router = useRouter();
	const { theme } = useTheme();

	const [colorTheme, setColorTheme] = useState<string>("default");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string>("");
	const [channels, setChannels] = useState<ChannelInfo[]>([]);
	const [searchTerm, setSearchTerm] = useState<string>("");
	const [sortBy, setSortBy] = useState<"name" | "createdAt" | "participants" | "totalMinutes">("name");
	const [expandedChannelId, setExpandedChannelId] = useState<string | null>(null);

	useEffect(() => {
		const savedColorTheme = localStorage.getItem("gbti_color_theme") || "default";
		setColorTheme(savedColorTheme);
		applyColorTheme();
		const handleStorageChange = () => {
			const newColorTheme = localStorage.getItem("gbti_color_theme") || "default";
			if (newColorTheme !== colorTheme) {
				setColorTheme(newColorTheme);
			}
		};
		window.addEventListener("storage", handleStorageChange);
		return () => window.removeEventListener("storage", handleStorageChange);
	}, [theme]);

	useEffect(() => {
		applyColorTheme();
	}, [colorTheme]);

	function formatMinutes(minutes: number): string {
		const mins = Math.round(minutes);
		const h = Math.floor(mins / 60);
		const m = mins % 60;
		if (h > 0) return `${h}시간 ${m}분`;
		return `${m}분`;
	}

	function formatDateTime(dateStr?: string): string {
		if (!dateStr) return "알 수 없음";
		return new Date(dateStr).toLocaleString("ko-KR", {
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	}

	useEffect(() => {
		async function load() {
			setLoading(true);
			setError("");
			try {
				const res = await fetch(`/api/discord-activity/channel-analysis`);
				if (!res.ok) {
					const errorText = await res.text();
					throw new Error(errorText || "채널 분석 데이터를 불러오지 못했습니다.");
				}
				const json = await res.json();
				const data: ChannelInfo[] = json.data || [];
				setChannels(data);
			} catch (err: any) {
				console.error(err);
				setError(err?.message || "로딩 실패");
			} finally {
				setLoading(false);
			}
		}
		load();
	}, []);

	const filteredAndSortedChannels = useMemo(() => {
		let filtered = channels;
		
		// 검색 필터
		if (searchTerm.trim()) {
			const q = searchTerm.trim().toLowerCase();
			filtered = filtered.filter((ch) =>
				ch.channelId.toLowerCase().includes(q) ||
				ch.channelName.toLowerCase().includes(q) ||
				ch.titles.some((t) => t.toLowerCase().includes(q)) ||
				ch.participants.some((p) => p.userName.toLowerCase().includes(q) || p.userId.toLowerCase().includes(q))
			);
		}

		// 정렬
		const sorted = [...filtered].sort((a, b) => {
			switch (sortBy) {
				case "name":
					return a.channelName.localeCompare(b.channelName);
				case "createdAt":
					const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
					const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
					return bTime - aTime; // 최신순
				case "participants":
					return b.participants.length - a.participants.length;
				case "totalMinutes":
					const aTotal = a.participants.reduce((sum, p) => sum + p.totalMinutes, 0);
					const bTotal = b.participants.reduce((sum, p) => sum + p.totalMinutes, 0);
					return bTotal - aTotal;
				default:
					return 0;
			}
		});

		return sorted;
	}, [channels, searchTerm, sortBy]);

	return (
		<div className="p-6 max-w-7xl mx-auto" style={{ background: "var(--background)", color: "var(--foreground)" }}>
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-semibold">채널별 분석</h1>
				<button
					className="px-4 py-2 rounded transition-colors cursor-pointer"
					style={{
						backgroundColor: "var(--accent)",
						color: "var(--foreground)"
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.background = "color-mix(in srgb, var(--accent) 80%, var(--foreground) 20%)";
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.background = "var(--accent)";
					}}
					onClick={() => router.push("/admin/activity-dashboard")}
				>
					대시보드로
				</button>
			</div>

			{loading && (
				<div className="text-center py-8">데이터 로딩 중...</div>
			)}

			{error && (
				<div className="text-center py-8 text-red-500">오류: {error}</div>
			)}

			{!loading && !error && (
				<>
					{/* 검색 및 정렬 */}
					<div
						className="rounded-lg p-4 mb-4"
						style={{
							background: "color-mix(in srgb, var(--accent) 10%, transparent)",
							border: "1px solid var(--accent)"
						}}
					>
						<div className="flex flex-wrap gap-3 items-center">
							<label className="flex items-center gap-2 flex-1 min-w-[200px]">
								<span className="opacity-80 whitespace-nowrap">검색</span>
								<input
									type="text"
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
									placeholder="채널명, 제목, 사용자명 또는 ID"
									className="px-3 py-2 rounded border bg-transparent w-full"
									style={{ borderColor: "var(--accent)" }}
								/>
							</label>
							<label className="flex items-center gap-2">
								<span className="opacity-80 whitespace-nowrap">정렬 기준</span>
								<select
									value={sortBy}
									onChange={(e) => setSortBy(e.target.value as any)}
									className="px-3 py-2 rounded border bg-transparent"
									style={{ borderColor: "var(--accent)" }}
								>
									<option value="name">채널명</option>
									<option value="createdAt">생성 시각</option>
									<option value="participants">참여자 수</option>
									<option value="totalMinutes">총 활동 시간</option>
								</select>
							</label>
						</div>
						<div className="mt-2 text-sm opacity-70">
							총 {filteredAndSortedChannels.length}개 채널
						</div>
					</div>

					{/* 채널 목록 */}
					{filteredAndSortedChannels.length === 0 ? (
						<div className="text-center py-12" style={{ opacity: 0.7 }}>
							{searchTerm ? "검색 결과가 없습니다." : "채널 데이터가 없습니다."}
						</div>
					) : (
						<div className="space-y-3">
							{filteredAndSortedChannels.map((channel) => {
								const isExpanded = expandedChannelId === channel.channelId;
								const totalMinutes = channel.participants.reduce((sum, p) => sum + p.totalMinutes, 0);

								return (
									<div
										key={channel.channelId}
										className="p-4 rounded border transition-colors"
										style={{
											borderColor: "var(--accent)",
											background: "var(--background)"
										}}
										onMouseEnter={(e) => {
											e.currentTarget.style.background = "color-mix(in srgb, var(--background) 95%, var(--accent) 5%)";
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.background = "var(--background)";
										}}
									>
										<div
											className="flex items-center justify-between cursor-pointer"
											onClick={() => setExpandedChannelId(isExpanded ? null : channel.channelId)}
										>
											<div className="flex-1">
												<div className="font-medium text-lg">
													{isExpanded ? "▼" : "▶"} {channel.channelName}
												</div>
												<div className="text-sm opacity-70 mt-1">
													ID: {channel.channelId}
												</div>
											</div>
											<div className="text-right">
												<div className="text-sm opacity-80">
													참여자: {channel.participants.length}명
												</div>
												<div className="text-sm opacity-80">
													총 활동: {formatMinutes(totalMinutes)}
												</div>
											</div>
										</div>

										{isExpanded && (
											<div className="mt-4 pt-4 border-t border-dashed" style={{ borderColor: "var(--accent)" }}>
												<div className="space-y-4">
													{/* 채널 정보 */}
													<div>
														<h3 className="text-sm font-semibold mb-2">채널 정보</h3>
														<div className="text-sm space-y-1 opacity-80">
															<div>생성 시각: {formatDateTime(channel.createdAt)}</div>
															{channel.deletedAt && (
																<div>삭제 시각: {formatDateTime(channel.deletedAt)}</div>
															)}
															<div>총 활동 로그: {channel.totalActivityCount}개</div>
														</div>
													</div>

													{/* 기록된 제목들 */}
													{channel.titles.length > 0 && (
														<div>
															<h3 className="text-sm font-semibold mb-2">기록된 제목들 ({channel.titles.length}개)</h3>
															<div className="flex flex-wrap gap-2">
																{channel.titles.map((title, idx) => (
																	<span
																		key={idx}
																		className="px-2 py-1 rounded text-xs"
																		style={{
																			background: "color-mix(in srgb, var(--accent) 20%, transparent)",
																			border: "1px solid var(--accent)"
																		}}
																	>
																		{title}
																	</span>
																))}
															</div>
														</div>
													)}

													{/* 참여자 목록 */}
													<div>
														<h3 className="text-sm font-semibold mb-2">참여자 목록 ({channel.participants.length}명)</h3>
														<div className="space-y-2">
															{channel.participants
																.sort((a, b) => b.totalMinutes - a.totalMinutes)
																.map((participant) => (
																	<div
																		key={participant.userId}
																		className="flex items-center justify-between p-2 rounded"
																		style={{
																			background: "color-mix(in srgb, var(--accent) 10%, transparent)"
																		}}
																	>
																		<div>
																			<div className="font-medium">{participant.userName}</div>
																			<div className="text-xs opacity-70">{participant.userId}</div>
																		</div>
																		<div className="text-sm font-semibold">
																			{formatMinutes(participant.totalMinutes)}
																		</div>
																	</div>
																))}
														</div>
													</div>
												</div>
											</div>
										)}
									</div>
								);
							})}
						</div>
					)}
				</>
			)}
		</div>
	);
}

