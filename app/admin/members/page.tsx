"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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
};

export default function MemberManagementPage() {
	const router = useRouter();
	const [activeTab, setActiveTab] = useState<"all" | "discord-only" | "notice-only" | "missing">("all");
	const [members, setMembers] = useState<Member[]>([]);
	const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
	const [newMemberName, setNewMemberName] = useState("");
	const [searchTerm, setSearchTerm] = useState("");
	const [loading, setLoading] = useState(false);
	const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
	const [editingField, setEditingField] = useState<null | "discordLink" | "birthYear">(null);
	const [editingDiscordLink, setEditingDiscordLink] = useState("");
	const [editingBirthYear, setEditingBirthYear] = useState<number | null>(null);
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

	// 실제 인원 데이터
	const mockMembers: Member[] = [
		// 단톡방 인원들 (디코 + 공지방 + 채팅방)
		{ id: "1", name: "디프", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1996, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1391819081967206411" },
		{ id: "2", name: "루아", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1996, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1423572078337982464" },
		{ id: "3", name: "여름", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1996, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1417888962810482749" },
		{ id: "4", name: "하이안", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1996, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1427958074538201179" },
		{ id: "5", name: "까망", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1997, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1429815110896976025" },
		{ id: "6", name: "부릉", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1997, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1432330792444362754" },
		{ id: "7", name: "산이", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1997, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1393023543255634021" },
		{ id: "8", name: "새로", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1997, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1425102828929679472" },
		{ id: "9", name: "죠르디", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1997, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1430813166702690377" },
		{ id: "10", name: "초르", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1997, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1389657982354329600" },
		{ id: "11", name: "허성", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1997, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1432755595282354176" },
		{ id: "12", name: "링크", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1998, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1416314996563902494" },
		{ id: "13", name: "앵귀", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1998, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1430456143909617768" },
		{ id: "14", name: "여우", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1998, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1432206326158590134" },
		{ id: "15", name: "재웅", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1998, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1390311511280582717" },
		{ id: "16", name: "주누", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1998, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1431159226113331210" },
		{ id: "17", name: "콩콩", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1991, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1411574168809635840" },
		{ id: "18", name: "하늘", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1998, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1429181648355725504" },
		{ id: "19", name: "함니", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1998, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1389764417184333865" },
		{ id: "20", name: "홍이", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1998, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1430764323730620517" },
		{ id: "21", name: "도비", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1999, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1432880125128605828" },
		{ id: "22", name: "뱅", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1999, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1419899879353880657" },
		{ id: "23", name: "사나이", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1999, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1425550833155703006" },
		{ id: "24", name: "한국산", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1999, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1432763700074254378" },
		{ id: "25", name: "딩고", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1997, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1411579484536176770" },
		{ id: "26", name: "아로", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1991, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1389615658354081793" },
		{ id: "27", name: "밀리", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1993, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1389859230101667920" },
		{ id: "28", name: "설탕", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 2000, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1395721741849853982" },
		{ id: "29", name: "냐하", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 2001, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1409531629004918835" },
		{ id: "30", name: "미정", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 2001, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1422565173725499473" },
		{ id: "31", name: "키미", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 2001, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1415978328074092554" },
		{ id: "32", name: "그림", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1990, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1429873584746135796" },
		{ id: "33", name: "용이", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1990, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1424777078712303636" },
		{ id: "34", name: "박준", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1991, discordLink: "https://discord.com/users/박준ID" },
		{ id: "35", name: "코난", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1991, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1418828834882588692" },
		{ id: "36", name: "콩", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1991, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1426874580282380362" },
		{ id: "37", name: "타이슨", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1991, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1416756869896339506" },
		{ id: "38", name: "꼬기", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1992, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1395355263954976808" },
		{ id: "39", name: "낭낭", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1992, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1403925472743653508" },
		{ id: "40", name: "도도", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1992, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1429146692699029554" },
		{ id: "41", name: "푸들", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1992, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1431088284418969691" },
		{ id: "42", name: "혀니앙", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1995, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1431603294383378482" },
		{ id: "43", name: "복희", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1993, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1389750003400048650" },
		{ id: "44", name: "기류", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1994, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1412031160741003334" },
		{ id: "45", name: "벼리", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1994, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1432350415495761960" },
		{ id: "46", name: "장산", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1994, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1432356102585978953" },
		{ id: "47", name: "히리", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1994, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1395565900098175057" },
		{ id: "48", name: "가지", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1995, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1431843322095341599" },
		{ id: "49", name: "노린재", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1995, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1398348242164383828" },
		{ id: "50", name: "독자", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1995, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1426459124719161417" },
		{ id: "51", name: "숑숑", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1995, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1406684402163122248" },
		{ id: "52", name: "갱이", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1996, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1416771760963059977" },
		{ id: "53", name: "냥구", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1996, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1410867806148362250" },
		{ id: "54", name: "담", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1996, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1426201767204622449" },

		// 공지방에만 있는 사람들
		{ id: "55", name: "저스트", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1997, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1407977092695593060" },
		{ id: "56", name: "츄잉", platforms: { discord: true, notice: true, chat: false }, status: "active", lastSeen: "2025-01-15", birthYear: 1997, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1426823296359596172" },
		{ id: "57", name: "만두", platforms: { discord: true, notice: true, chat: false }, status: "active", lastSeen: "2025-01-15", birthYear: 1998, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1424758824815824970" },
		{ id: "58", name: "도현", platforms: { discord: true, notice: true, chat: false }, status: "active", lastSeen: "2025-01-15", birthYear: 2001, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1425364472825905272" },
		{ id: "59", name: "보라", platforms: { discord: true, notice: true, chat: false }, status: "active", lastSeen: "2025-01-15", birthYear: 1991, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1389772773987192853" },
		{ id: "60", name: "어피치", platforms: { discord: true, notice: true, chat: false }, status: "active", lastSeen: "2025-01-15", birthYear: 1997 },
		{ id: "61", name: "양치", platforms: { discord: true, notice: true, chat: false }, status: "active", lastSeen: "2025-01-15", birthYear: 1997, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1417138790979338250" },
		{ id: "62", name: "깨", platforms: { discord: true, notice: true, chat: false }, status: "active", lastSeen: "2025-01-15", birthYear: 1993, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1404515939378004048" },
		{ id: "63", name: "뀨름", platforms: { discord: true, notice: true, chat: false }, status: "active", lastSeen: "2025-01-15", birthYear: 1995 },

		// 디코에만 있는 게스트들
		{ id: "64", name: "퐝건", platforms: { discord: true, notice: false, chat: false }, status: "active", lastSeen: "2025-01-15", birthYear: 1992},
		{ id: "65", name: "이라", platforms: { discord: true, notice: false, chat: false }, status: "active", lastSeen: "2025-01-15", birthYear: 1996},
		{ id: "66", name: "영리", platforms: { discord: true, notice: false, chat: false }, status: "active", lastSeen: "2025-01-15", birthYear: 1991},
		{ id: "67", name: "아이폰", platforms: { discord: true, notice: false, chat: false }, status: "active", lastSeen: "2025-01-15", birthYear: 1993},
		{ id: "68", name: "류비아", platforms: { discord: true, notice: false, chat: false }, status: "active", lastSeen: "2025-01-15", birthYear: 1997},
		{ id: "69", name: "동동", platforms: { discord: true, notice: false, chat: false }, status: "active", lastSeen: "2025-01-15", birthYear: 1993},
		{ id: "70", name: "도장", platforms: { discord: true, notice: false, chat: false }, status: "active", lastSeen: "2025-01-15", birthYear: 1991},
		{ id: "71", name: "집사", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1997, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1432693432718983280" },
		{ id: "72", name: "웅", platforms: { discord: true, notice: true, chat: true }, status: "active", lastSeen: "2025-01-15", birthYear: 1997, discordLink: "https://discord.com/channels/1373916592294985828/1373948962569977986/1432060590276345899" },
	];

	useEffect(() => {
		setMembers(mockMembers);
	}, []);

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
			const platformCount = Object.values(m.platforms).filter(Boolean).length;
			return platformCount > 0 && platformCount < 3; // 일부 플랫폼에만 있는 경우
		});
		// 추가: 누락 체크 내 플랫폼 필터 (다중 선택 - AND 조건)
		if (missingFilter.size > 0) {
			filtered = filtered.filter(m => {
				for (const p of missingFilter) {
					if (!m.platforms[p]) return false;
				}
				return true;
			});
		}
		break;
			default:
				filtered = members;
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
			// 실제로는 API 호출
			const newMember: Member = {
				id: Date.now().toString(),
				name: newMemberName.trim(),
				platforms: { discord: false, notice: false, chat: false },
				status: "active",
				lastSeen: new Date().toISOString().split('T')[0],
				discordLink: undefined
			};
			
			setMembers([...members, newMember]);
			setNewMemberName("");
		} catch (err) {
			alert("멤버 추가에 실패했습니다.");
		} finally {
			setLoading(false);
		}
	}

	async function togglePlatform(memberId: string, platform: Platform) {
		setMembers(members.map(m => 
			m.id === memberId 
				? { ...m, platforms: { ...m.platforms, [platform]: !m.platforms[platform] } }
				: m
		));
	}

	async function deleteMember(memberId: string) {
		if (!confirm("이 멤버를 삭제하시겠습니까?")) return;
		
		setMembers(members.filter(m => m.id !== memberId));
	}

function startEditDiscordLink(member: Member) {
	setEditingMemberId(member.id);
	setEditingField("discordLink");
	setEditingDiscordLink(member.discordLink || "");
}

function saveDiscordLink() {
	if (!editingMemberId) return;

	setMembers(members.map(m => 
		m.id === editingMemberId 
			? { ...m, discordLink: (editingDiscordLink.trim() || undefined) }
			: m
	));

	setEditingMemberId(null);
	setEditingField(null);
	setEditingDiscordLink("");
}

function cancelEditDiscordLink() {
	setEditingMemberId(null);
	setEditingField(null);
	setEditingDiscordLink("");
}

	function removeDiscordLink(memberId: string) {
		setMembers(members.map(m => 
			m.id === memberId 
				? { ...m, discordLink: undefined }
				: m
		));
	}

function startEditBirthYear(member: Member) {
	setEditingMemberId(member.id);
	setEditingField("birthYear");
	setEditingBirthYear(member.birthYear || null);
}

function saveBirthYear() {
	if (!editingMemberId) return;

	setMembers(members.map(m => 
		m.id === editingMemberId 
			? { ...m, birthYear: editingBirthYear || undefined }
			: m
	));

	setEditingMemberId(null);
	setEditingField(null);
	setEditingBirthYear(null);
}

function cancelEditBirthYear() {
	setEditingMemberId(null);
	setEditingField(null);
	setEditingBirthYear(null);
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
		<div className="p-6 max-w-6xl mx-auto">
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-semibold">활동인원 관리</h1>
				<button
					className="px-4 py-2 rounded text-black transition-colors cursor-pointer"
					style={{ backgroundColor: "#FDC205" }}
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
						className={`px-4 py-2 rounded transition-colors cursor-pointer ${
							activeTab === key 
								? "text-black" 
								: "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
						}`}
						style={activeTab === key ? { backgroundColor: "#FDC205" } : undefined}
						onClick={() => setActiveTab(key as typeof activeTab)}
					>
						{type.icon} {type.name}
					</button>
				))}
			</div>

			{/* 현재 탭 정보 */}
			<div className="bg-white dark:bg-zinc-900 rounded-lg border p-6 mb-6">
				<div className="flex items-center gap-3 mb-4">
					<span className="text-2xl">{tabTypes[activeTab].icon}</span>
					<div>
						<h2 className="text-lg font-semibold">{tabTypes[activeTab].name}</h2>
						<p className="text-sm text-zinc-600 dark:text-zinc-400">{tabTypes[activeTab].description}</p>
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

						{/* 누락 체크 전용 플랫폼 필터 */}
						{activeTab === "missing" && (
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
						{(filterBirthYear !== null || searchTerm) && (
							<button
								className="px-3 py-2 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800"
								onClick={() => {
									setFilterBirthYear(null);
									setSearchTerm("");
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
								className="px-4 py-2 rounded text-black transition-colors cursor-pointer"
								style={{ backgroundColor: "#FDC205" }}
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
							className="px-4 py-2 rounded text-black transition-colors cursor-pointer"
							style={{ backgroundColor: "#FDC205" }}
							onClick={addMember}
							disabled={loading}
						>
							{loading ? "추가 중..." : "추가"}
						</button>
					</div>
				</div>
			</div>

			{/* 멤버 목록 */}
			<div className="bg-white dark:bg-zinc-900 rounded-lg border p-6">
				<h3 className="text-lg font-semibold mb-4">멤버 목록 ({filteredMembers.length}명)</h3>
				<div className="space-y-3">
					{filteredMembers.length === 0 ? (
						<div className="text-center text-zinc-500 py-8">해당 조건의 멤버가 없습니다.</div>
					) : (
						filteredMembers.map((member) => (
							<div key={member.id} className="flex items-center gap-4 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded border">
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
											{editingMemberId === member.id && editingBirthYear !== null ? (
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
												<div className="flex gap-2">
													<button
														className="px-2 py-1 rounded text-xs border hover:bg-zinc-100 dark:hover:bg-zinc-800"
														onClick={() => startEditBirthYear(member)}
													>
														{member.birthYear ? "탄생년도 수정" : "탄생년도 추가"}
													</button>
												</div>
											)}
										</div>
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
