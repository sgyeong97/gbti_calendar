"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { applyColorTheme } from "@/app/lib/color-themes";

type Platform = "discord" | "notice" | "chat";

type Member = {
	id: string;
	name: string;
	platforms: {
		discord: boolean;
		notice: boolean;
		chat: boolean;
	};
	status: "active" | "inactive";
	lastSeen: string;
	discordLink?: string; // 디코 자기소개 링크
	birthYear?: number; // 탄생년도
	birthMonth?: number; // 생일(월)
	birthDay?: number; // 생일(일)
};

export default function MemberManagementPage() {
	const router = useRouter();
	const { theme } = useTheme();
	const [colorTheme, setColorTheme] = useState<string>("default");
	const [activeTab, setActiveTab] = useState<"all" | "discord-only" | "notice-only" | "missing">("all");
	const [members, setMembers] = useState<Member[]>([]);
	const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
	const [newMemberName, setNewMemberName] = useState("");
	const [searchTerm, setSearchTerm] = useState("");
	const [loading, setLoading] = useState(false);
	const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
	const [editingField, setEditingField] = useState<null | "discordLink" | "birthYear" | "birthday">(null);
	const [editingDiscordLink, setEditingDiscordLink] = useState("");
	const [editingBirthYear, setEditingBirthYear] = useState<number | null>(null);
	const [editingBirthMonth, setEditingBirthMonth] = useState<number | null>(null);
	const [editingBirthDay, setEditingBirthDay] = useState<number | null>(null);
	const [sortBy, setSortBy] = useState<"name" | "birthYear">("name");
	const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
	const [filterBirthYear, setFilterBirthYear] = useState<number | null>(null);
	const [missingFilter, setMissingFilter] = useState<Set<Platform>>(new Set());
	const [exportFormat, setExportFormat] = useState<"excel" | "csv" | "text">("csv");

	const tabTypes = {
		all: { name: "전체 멤버", icon: "👥", description: "모든 플랫폼 멤버 현황" },
		"discord-only": { name: "디코 전용", icon: "💬", description: "Discord에만 있는 멤버" },
		"notice-only": { name: "공지방 전용", icon: "📢", description: "디코방과 공지방 둘 다 있는 멤버" },
		"missing": { name: "누락 체크", icon: "⚠️", description: "일부 플랫폼에서 누락된 멤버" }
	};

	// 서버의 JSON 파일과 동기화
	useEffect(() => {
		fetchMembers();
	}, []);

	useEffect(() => {
		const savedColorTheme = localStorage.getItem("gbti_color_theme") || "default";
		setColorTheme(savedColorTheme);

		// 테마 변경 감지
		const handleStorageChange = () => {
			const newColorTheme = localStorage.getItem("gbti_color_theme") || "default";
			setColorTheme(newColorTheme);
		};

		window.addEventListener("storage", handleStorageChange);
		
		// MutationObserver로 html 클래스 변경 감지
		const observer = new MutationObserver(() => {
			const newColorTheme = localStorage.getItem("gbti_color_theme") || "default";
			setColorTheme(newColorTheme);
		});

		const html = document.documentElement;
		observer.observe(html, { attributes: true, attributeFilter: ["class"] });

		return () => {
			window.removeEventListener("storage", handleStorageChange);
			observer.disconnect();
		};
	}, [theme]);

	async function fetchMembers() {
		setLoading(true);
		try {
			const res = await fetch("/api/members", { cache: "no-store" });
			if (!res.ok) throw new Error("failed to load");
			const data: Member[] = await res.json();
			setMembers(data);
		} catch (err) {
			alert("멤버 목록을 불러오지 못했습니다.");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		let filtered = members;

		// 탭별 필터링
		switch (activeTab) {
			case "discord-only":
				filtered = members.filter(m => 
					m.platforms.discord && !m.platforms.notice && !m.platforms.chat
				);
				break;
			case "notice-only":
				filtered = members.filter(m => 
					m.platforms.discord && m.platforms.notice && !m.platforms.chat
				);
				break;
		case "missing":
			filtered = members.filter(m => {
				// 누락 체크: 모든 플랫폼을 가진 멤버는 제외
				const platformCount = Object.values(m.platforms).filter(Boolean).length;
				if (platformCount === 3) return false;
				
				// 필터가 설정된 경우: 정확히 선택된 플랫폼만 있는 멤버만 표시
				if (missingFilter.size > 0) {
					// 선택된 플랫폼을 모두 가져야 함
					for (const p of missingFilter) {
						if (!m.platforms[p]) return false;
					}
					// 선택되지 않은 플랫폼은 가져서는 안 됨
					for (const p of ["discord", "notice", "chat"] as Platform[]) {
						if (!missingFilter.has(p) && m.platforms[p]) return false;
					}
				}
				
				return true;
			});
			break;
			default:
				filtered = members;
				// 전체 멤버 탭에서도 플랫폼 필터 적용 (AND 조건)
				if (missingFilter.size > 0) {
					filtered = filtered.filter(m => {
						// 선택된 플랫폼을 모두 가져야 함
						for (const p of missingFilter) {
							if (!m.platforms[p]) return false;
						}
						return true;
					});
				}
		}

		// 검색어 필터링
		if (searchTerm.trim()) {
			filtered = filtered.filter(m => 
				m.name.toLowerCase().includes(searchTerm.toLowerCase())
			);
		}

		// 년도별 필터링
		if (filterBirthYear !== null) {
			filtered = filtered.filter(m => m.birthYear === filterBirthYear);
		}

		// 정렬
		filtered.sort((a, b) => {
			let aValue: any, bValue: any;
			
			switch (sortBy) {
				case "name":
					aValue = a.name;
					bValue = b.name;
					break;
				case "birthYear":
					aValue = a.birthYear || 0;
					bValue = b.birthYear || 0;
					break;
				default:
					aValue = a.name;
					bValue = b.name;
			}

			if (sortOrder === "asc") {
				return aValue > bValue ? 1 : -1;
			} else {
				return aValue < bValue ? 1 : -1;
			}
		});

		setFilteredMembers(filtered);
	}, [activeTab, members, searchTerm, sortBy, sortOrder, filterBirthYear, missingFilter]);

	async function addMember() {
		if (!newMemberName.trim()) return;

		setLoading(true);
		try {
			const res = await fetch("/api/members", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: newMemberName.trim() })
			});
			if (!res.ok) throw new Error("failed to add");
			const created: Member = await res.json();
			setMembers([...members, created]);
			setNewMemberName("");
		} catch (err) {
			alert("멤버 추가에 실패했습니다.");
		} finally {
			setLoading(false);
		}
	}

	async function togglePlatform(memberId: string, platform: Platform) {
		const target = members.find(m => m.id === memberId);
		if (!target) return;
		const nextPlatforms = { ...target.platforms, [platform]: !target.platforms[platform] };
		await updateMember(memberId, { platforms: nextPlatforms });
	}

	async function deleteMember(memberId: string) {
		if (!confirm("이 멤버를 삭제하시겠습니까?")) return;
		try {
			const res = await fetch(`/api/members/${memberId}`, { method: "DELETE" });
			if (!res.ok) throw new Error("failed to delete");
		setMembers(members.filter(m => m.id !== memberId));
		} catch {
			alert("삭제에 실패했습니다.");
		}
	}

function startEditDiscordLink(member: Member) {
	setEditingMemberId(member.id);
	setEditingField("discordLink");
	setEditingDiscordLink(member.discordLink || "");
}

	async function updateMember(memberId: string, patch: any) {
		try {
			const res = await fetch(`/api/members/${memberId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(patch),
			});
			if (!res.ok) throw new Error("failed to update");
			const updated: Member = await res.json();
			setMembers(prev => prev.map(m => m.id === memberId ? updated : m));
		} catch {
			alert("저장에 실패했습니다.");
		}
	}

	function removeDiscordLink(memberId: string) {
		// 사용되지 않지만, 이전 호환 목적: 비우기 동작은 saveDiscordLink에서 처리
		void updateMember(memberId, { discordLink: "" });
	}

	async function saveDiscordLink() {
	if (!editingMemberId) return;
		await updateMember(editingMemberId, { discordLink: editingDiscordLink.trim() });
	setEditingMemberId(null);
	setEditingField(null);
	setEditingDiscordLink("");
}

function cancelEditDiscordLink() {
	setEditingMemberId(null);
	setEditingField(null);
	setEditingDiscordLink("");
}



function startEditBirthYear(member: Member) {
	setEditingMemberId(member.id);
	setEditingField("birthYear");
	setEditingBirthYear(member.birthYear || null);
}

	async function saveBirthYear() {
	if (!editingMemberId) return;
		await updateMember(editingMemberId, { birthYear: editingBirthYear ?? null });
	setEditingMemberId(null);
	setEditingField(null);
	setEditingBirthYear(null);
}

function cancelEditBirthYear() {
	setEditingMemberId(null);
	setEditingField(null);
	setEditingBirthYear(null);
}

	function startEditBirthday(member: Member) {
		setEditingMemberId(member.id);
		setEditingField("birthday");
		setEditingBirthMonth(member.birthMonth ?? null);
		setEditingBirthDay(member.birthDay ?? null);
	}

	async function saveBirthday() {
		if (!editingMemberId) return;
		await updateMember(editingMemberId, {
			birthMonth: editingBirthMonth ?? null,
			birthDay: editingBirthDay ?? null,
		});
		setEditingMemberId(null);
		setEditingField(null);
		setEditingBirthMonth(null);
		setEditingBirthDay(null);
	}

	function cancelEditBirthday() {
		setEditingMemberId(null);
		setEditingField(null);
		setEditingBirthMonth(null);
		setEditingBirthDay(null);
	}

	function getPlatformStatus(member: Member) {
		const platforms = [];
		if (member.platforms.discord) platforms.push("디코");
		if (member.platforms.notice) platforms.push("공지방");
		if (member.platforms.chat) platforms.push("채팅방");
		
		if (platforms.length === 0) return "없음";
		if (platforms.length === 3) return "전체";
		return platforms.join(", ");
	}

	// 동적 년도 범위 계산
	function getBirthYearRange() {
		const years = members
			.map(m => m.birthYear)
			.filter(year => year !== undefined) as number[];
		
		if (years.length === 0) return { min: 1990, max: 2005 };
		
		return {
			min: Math.min(...years),
			max: Math.max(...years)
		};
	}

	function formatDateForFilename(d: Date) {
		const yyyy = d.getFullYear();
		const mm = String(d.getMonth() + 1).padStart(2, "0");
		const dd = String(d.getDate()).padStart(2, "0");
		return `${yyyy}${mm}${dd}`;
	}

	function downloadBlob(content: string, mime: string, ext: string) {
		const dateStr = formatDateForFilename(new Date());
		const filename = `GBTI_${dateStr}.${ext}`;
		const blob = new Blob([content], { type: mime });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	}

	function toCsvRow(values: (string | number | undefined)[]) {
		return values
			.map((v) => {
				if (v === undefined || v === null) return "";
				const s = String(v);
				// CSV escape
				if (/[",\n]/.test(s)) {
					return '"' + s.replaceAll('"', '""') + '"';
				}
				return s;
			})
			.join(",");
	}

	function handleDownload() {
		// 현재 화면의 필터 결과를 기준으로 내보냄
		const rows = filteredMembers.map((m) => ({
			name: m.name,
			discord: m.platforms.discord ? "Y" : "",
			notice: m.platforms.notice ? "Y" : "",
			chat: m.platforms.chat ? "Y" : "",
			birthYear: m.birthYear ?? "",
			discordLink: m.discordLink ?? "",
		}));

		if (exportFormat === "csv") {
			const header = toCsvRow(["이름", "디코", "공지", "채팅", "탄생년도", "디코링크"]);
			const body = rows.map(r => toCsvRow([r.name, r.discord, r.notice, r.chat, r.birthYear, r.discordLink])).join("\n");
			const csv = header + "\n" + body + "\n";
			downloadBlob(csv, "text/csv;charset=utf-8", "csv");
			return;
		}

		if (exportFormat === "text") {
			const lines = [
				"이름\t디코\t공지\t채팅\t탄생년도\t디코링크",
				...rows.map(r => `${r.name}\t${r.discord}\t${r.notice}\t${r.chat}\t${r.birthYear}\t${r.discordLink}`)
			];
			const txt = lines.join("\n") + "\n";
			downloadBlob(txt, "text/plain;charset=utf-8", "txt");
			return;
		}

		// excel: 탭-구분 텍스트를 .xls로 저장 (Excel에서 바로 열기 가능)
		const xlsLines = [
			"이름\t디코\t공지\t채팅\t탄생년도\t디코링크",
			...rows.map(r => `${r.name}\t${r.discord}\t${r.notice}\t${r.chat}\t${r.birthYear}\t${r.discordLink}`)
		];
		const xls = xlsLines.join("\n") + "\n";
		downloadBlob(xls, "application/vnd.ms-excel;charset=utf-8", "xls");
	}

	return (
		<div className="p-6 max-w-6xl mx-auto" style={{ background: "var(--background)", color: "var(--foreground)" }}>
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-semibold">활동인원 관리</h1>
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
					onClick={() => router.push("/admin")}
				>
					관리자 페이지로 돌아가기
				</button>
			</div>

			{/* 탭 네비게이션 */}
			<div className="flex gap-2 mb-6">
				{Object.entries(tabTypes).map(([key, type]) => (
					<button
						key={key}
						className="px-4 py-2 rounded transition-colors cursor-pointer"
						style={activeTab === key 
							? { 
								backgroundColor: "var(--accent)", 
								color: "var(--foreground)" 
							}
							: { 
								background: "color-mix(in srgb, var(--background) 90%, var(--accent) 10%)",
								color: "var(--foreground)",
								border: "1px solid var(--accent)"
							}
						}
						onMouseEnter={(e) => {
							if (activeTab !== key) {
								e.currentTarget.style.background = "color-mix(in srgb, var(--background) 80%, var(--accent) 20%)";
							}
						}}
						onMouseLeave={(e) => {
							if (activeTab !== key) {
								e.currentTarget.style.background = "color-mix(in srgb, var(--background) 90%, var(--accent) 10%)";
							}
						}}
						onClick={() => setActiveTab(key as typeof activeTab)}
					>
						{type.icon} {type.name}
					</button>
				))}
			</div>

			{/* 현재 탭 정보 */}
			<div 
				className="rounded-lg p-6 mb-6"
				style={{ 
					background: "var(--background)", 
					border: "1px solid var(--accent)" 
				}}
			>
				<div className="flex items-center gap-3 mb-4">
					<span className="text-2xl">{tabTypes[activeTab].icon}</span>
					<div>
						<h2 className="text-lg font-semibold">{tabTypes[activeTab].name}</h2>
						<p className="text-sm" style={{ color: "var(--foreground)", opacity: 0.7 }}>{tabTypes[activeTab].description}</p>
					</div>
				</div>

				{/* 검색 및 멤버 추가 */}
				<div className="space-y-3">
						{/* 검색 */}
					<div className="flex gap-2">
						<input
							type="text"
							placeholder="멤버 이름으로 검색..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="flex-1 border rounded px-3 py-2"
						/>
						{searchTerm && (
							<button
								className="px-3 py-2 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800"
								onClick={() => setSearchTerm("")}
							>
								초기화
							</button>
						)}
					</div>

					{/* 정렬 및 필터링 */}
					<div className="flex gap-2 flex-wrap items-center">
					{/* 정렬 기준 */}
						<select
						value={sortBy}
						onChange={(e) => setSortBy(e.target.value as "name" | "birthYear")}
							className="border rounded px-3 py-2"
						>
							<option value="name">이름순</option>
							<option value="birthYear">탄생년도순</option>
						</select>

						{/* 정렬 순서 */}
						<select
							value={sortOrder}
							onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
							className="border rounded px-3 py-2"
						>
							<option value="asc">오름차순</option>
							<option value="desc">내림차순</option>
						</select>

						{/* 년도 필터링 */}
						<select
							value={filterBirthYear || ""}
							onChange={(e) => setFilterBirthYear(e.target.value ? parseInt(e.target.value) : null)}
							className="border rounded px-3 py-2"
						>
							<option value="">전체 년도</option>
							{(() => {
								const { min, max } = getBirthYearRange();
								const options = [];
								for (let year = min; year <= max; year++) {
									options.push(
										<option key={year} value={year}>{year}년</option>
									);
								}
								return options;
							})()}
						</select>

						{/* 플랫폼 필터 (전체 멤버 & 누락 체크) */}
						{(activeTab === "all" || activeTab === "missing") && (
						<div className="flex items-center gap-2">
								<span className="text-sm text-zinc-600">플랫폼 필터:</span>
							<button
								className={`px-3 py-2 rounded text-sm border ${missingFilter.size === 0 ? "bg-zinc-100" : ""}`}
								onClick={() => setMissingFilter(new Set())}
							>
									전체
								</button>
							<button
								className={`px-3 py-2 rounded text-sm border ${missingFilter.has("discord") ? "bg-blue-100" : ""}`}
								onClick={() => {
									const next = new Set(missingFilter);
									if (next.has("discord")) next.delete("discord"); else next.add("discord");
									setMissingFilter(next);
								}}
							>
									디코
								</button>
							<button
								className={`px-3 py-2 rounded text-sm border ${missingFilter.has("notice") ? "bg-green-100" : ""}`}
								onClick={() => {
									const next = new Set(missingFilter);
									if (next.has("notice")) next.delete("notice"); else next.add("notice");
									setMissingFilter(next);
								}}
							>
									공지방
								</button>
							<button
								className={`px-3 py-2 rounded text-sm border ${missingFilter.has("chat") ? "bg-purple-100" : ""}`}
								onClick={() => {
									const next = new Set(missingFilter);
									if (next.has("chat")) next.delete("chat"); else next.add("chat");
									setMissingFilter(next);
								}}
							>
									채팅방
								</button>
							</div>
						)}

						{/* 필터 초기화 */}
						{(filterBirthYear !== null || searchTerm || missingFilter.size > 0) && (
							<button
								className="px-3 py-2 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800"
								onClick={() => {
									setFilterBirthYear(null);
									setSearchTerm("");
									setMissingFilter(new Set());
								}}
							>
								필터 초기화
							</button>
						)}

						{/* 내보내기 */}
						<div className="flex items-center gap-2 ml-auto">
							<select
								value={exportFormat}
								onChange={(e) => setExportFormat(e.target.value as any)}
								className="border rounded px-3 py-2"
							>
								<option value="excel">엑셀(.xls)</option>
								<option value="csv">CSV(.csv)</option>
								<option value="text">Text(.txt)</option>
							</select>
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
								onClick={handleDownload}
							>
								다운로드
							</button>
						</div>
					</div>

					{/* 멤버 추가 */}
					<div className="flex gap-2">
						<input
							type="text"
							placeholder="멤버 이름"
							value={newMemberName}
							onChange={(e) => setNewMemberName(e.target.value)}
							className="flex-1 border rounded px-3 py-2"
							onKeyDown={(e) => {
								if (e.key === "Enter") addMember();
							}}
						/>
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
							onClick={addMember}
							disabled={loading}
						>
							{loading ? "추가 중..." : "추가"}
						</button>
					</div>
				</div>
			</div>

			{/* 멤버 목록 */}
			<div 
				className="rounded-lg p-6"
				style={{ 
					background: "var(--background)", 
					border: "1px solid var(--accent)" 
				}}
			>
				<h3 className="text-lg font-semibold mb-4">멤버 목록 ({filteredMembers.length}명)</h3>
				<div className="space-y-3">
					{filteredMembers.length === 0 ? (
						<div className="text-center py-8" style={{ color: "var(--foreground)", opacity: 0.7 }}>해당 조건의 멤버가 없습니다.</div>
					) : (
						filteredMembers.map((member) => (
							<div 
								key={member.id} 
								className="flex items-center gap-4 p-4 rounded transition-colors"
								style={{ 
									border: "1px solid var(--accent)",
									background: "var(--background)"
								}}
								onMouseEnter={(e) => {
									e.currentTarget.style.background = "color-mix(in srgb, var(--background) 95%, var(--accent) 5%)";
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.background = "var(--background)";
								}}
							>
								<div className="flex-1">
									<div className="font-medium flex items-center gap-2">
										{member.name}
										{member.platforms.discord && member.discordLink && (
											<a
												href={member.discordLink}
												target="_blank"
												rel="noopener noreferrer"
												className="text-blue-500 hover:text-blue-700 text-sm"
												title="디코 자기소개 보기"
											>
												🔗
											</a>
										)}
									</div>
									<div className="text-sm text-zinc-500">
										플랫폼: {getPlatformStatus(member)} | 
										{member.birthYear && `탄생년도: ${member.birthYear}년 | `}
										상태: <span className={member.status === "active" ? "text-green-600" : "text-red-600"}>
											{member.status === "active" ? "활성" : "비활성"}
										</span>
									</div>
									
									{/* 디코 링크 및 탄생년도 편집 */}
									<div className="mt-2 space-y-2">
										{/* 디코 링크 편집 */}
									{member.platforms.discord && (
											<div>
											{editingMemberId === member.id && editingField === "discordLink" ? (
													<div className="flex gap-2">
														<input
															type="text"
															placeholder="디코 자기소개 링크"
															value={editingDiscordLink}
															onChange={(e) => setEditingDiscordLink(e.target.value)}
															className="flex-1 border rounded px-2 py-1 text-sm"
															onKeyDown={(e) => {
																if (e.key === "Enter") saveDiscordLink();
																if (e.key === "Escape") cancelEditDiscordLink();
															}}
															autoFocus
														/>
														<button
															className="px-2 py-1 rounded text-sm bg-green-100 text-green-700 hover:bg-green-200"
															onClick={saveDiscordLink}
														>
															저장
														</button>
														<button
															className="px-2 py-1 rounded text-sm border"
															onClick={cancelEditDiscordLink}
														>
															취소
														</button>
													</div>
												) : (
													<div className="flex gap-2">
														<button
															className="px-2 py-1 rounded text-xs border hover:bg-zinc-100 dark:hover:bg-zinc-800"
															onClick={() => startEditDiscordLink(member)}
														>
															{member.discordLink ? "링크 수정" : "링크 추가"}
														</button>
													{/* 삭제 버튼 제거: 빈칸 저장으로 삭제 */}
													</div>
												)}
											</div>
										)}

										{/* 탄생년도 편집 */}
										<div>
											{editingMemberId === member.id && editingField === "birthYear" ? (
												<div className="flex gap-2">
													<input
														type="number"
														placeholder="탄생년도"
														value={editingBirthYear || ""}
														onChange={(e) => setEditingBirthYear(e.target.value ? parseInt(e.target.value) : null)}
														className="flex-1 border rounded px-2 py-1 text-sm"
														min="1990"
														max="2010"
														onKeyDown={(e) => {
															if (e.key === "Enter") saveBirthYear();
															if (e.key === "Escape") cancelEditBirthYear();
														}}
														autoFocus
													/>
													<button
														className="px-2 py-1 rounded text-sm bg-green-100 text-green-700 hover:bg-green-200"
														onClick={saveBirthYear}
													>
														저장
													</button>
													<button
														className="px-2 py-1 rounded text-sm border"
														onClick={cancelEditBirthYear}
													>
														취소
													</button>
												</div>
											) : (
												<div className="flex gap-2 flex-wrap items-center">
													<button
														className="px-2 py-1 rounded text-xs border hover:bg-zinc-100 dark:hover:bg-zinc-800"
														onClick={() => startEditBirthYear(member)}
													>
														{member.birthYear ? "탄생년도 수정" : "탄생년도 추가"}
													</button>
													{/* 생일(월/일) 편집 */}
													<button
														className="px-2 py-1 rounded text-xs border hover:bg-zinc-100 dark:hover:bg-zinc-800"
														onClick={() => startEditBirthday(member)}
													>
														{member.birthMonth && member.birthDay ? "생일 수정" : "생일 추가"}
													</button>
													{member.birthMonth && member.birthDay && (
														<span className="text-xs text-zinc-600 dark:text-zinc-400">
															현재 생일: {member.birthMonth}월 {member.birthDay}일
														</span>
													)}
												</div>
											)}
										</div>

										{/* 생일(월/일) 편집 폼 */}
										{editingMemberId === member.id && editingField === "birthday" && (
											<div className="mt-1 flex gap-2 items-center">
												<input
													type="number"
													placeholder="월"
													value={editingBirthMonth ?? ""}
													onChange={(e) => setEditingBirthMonth(e.target.value ? parseInt(e.target.value) : null)}
													className="w-16 border rounded px-2 py-1 text-sm"
													min="1"
													max="12"
												/>
												<span className="text-sm">월</span>
												<input
													type="number"
													placeholder="일"
													value={editingBirthDay ?? ""}
													onChange={(e) => setEditingBirthDay(e.target.value ? parseInt(e.target.value) : null)}
													className="w-16 border rounded px-2 py-1 text-sm"
													min="1"
													max="31"
												/>
												<span className="text-sm">일</span>
												<button
													className="px-2 py-1 rounded text-sm bg-green-100 text-green-700 hover:bg-green-200"
													onClick={saveBirthday}
												>
													저장
												</button>
												<button
													className="px-2 py-1 rounded text-sm border"
													onClick={cancelEditBirthday}
												>
													취소
												</button>
											</div>
										)}
									</div>
								</div>
								
								{/* 플랫폼 토글 버튼들 */}
								<div className="flex gap-2">
									<button
										className={`px-3 py-1 rounded text-sm transition-colors cursor-pointer ${
											member.platforms.discord 
												? "bg-blue-100 text-blue-700 hover:bg-blue-200" 
												: "bg-gray-100 text-gray-600 hover:bg-gray-200"
										}`}
										onClick={() => togglePlatform(member.id, "discord")}
									>
										디코 {member.platforms.discord ? "✓" : "✗"}
									</button>
									<button
										className={`px-3 py-1 rounded text-sm transition-colors cursor-pointer ${
											member.platforms.notice 
												? "bg-green-100 text-green-700 hover:bg-green-200" 
												: "bg-gray-100 text-gray-600 hover:bg-gray-200"
										}`}
										onClick={() => togglePlatform(member.id, "notice")}
									>
										공지방 {member.platforms.notice ? "✓" : "✗"}
									</button>
									<button
										className={`px-3 py-1 rounded text-sm transition-colors cursor-pointer ${
											member.platforms.chat 
												? "bg-purple-100 text-purple-700 hover:bg-purple-200" 
												: "bg-gray-100 text-gray-600 hover:bg-gray-200"
										}`}
										onClick={() => togglePlatform(member.id, "chat")}
									>
										채팅방 {member.platforms.chat ? "✓" : "✗"}
									</button>
								</div>
								
								<button
									className="px-3 py-1 rounded border text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
									onClick={() => deleteMember(member.id)}
								>
									삭제
								</button>
							</div>
						))
					)}
				</div>
			</div>
		</div>
	);
}
