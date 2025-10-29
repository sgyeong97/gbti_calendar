"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type MemberType = "guest" | "discord" | "groupchat" | "notice";

type Member = {
	id: string;
	name: string;
	type: MemberType;
	status: "active" | "inactive";
	joinedAt: string;
};

export default function MemberManagementPage() {
	const router = useRouter();
	const [activeTab, setActiveTab] = useState<MemberType>("guest");
	const [members, setMembers] = useState<Member[]>([]);
	const [newMemberName, setNewMemberName] = useState("");
	const [loading, setLoading] = useState(false);

	const memberTypes = {
		guest: { name: "게스트 관리", icon: "👤", description: "게스트 사용자 관리" },
		discord: { name: "디코 인원 리스트", icon: "💬", description: "Discord 서버 멤버 관리" },
		groupchat: { name: "단톡방 인원 리스트", icon: "📱", description: "단체 채팅방 멤버 관리" },
		notice: { name: "공지방 인원 리스트", icon: "📢", description: "공지사항 채널 멤버 관리" }
	};

	// 임시 데이터 (실제로는 API에서 가져와야 함)
	const mockMembers: Record<MemberType, Member[]> = {
		guest: [
			{ id: "1", name: "게스트1", type: "guest", status: "active", joinedAt: "2025-10-01" },
			{ id: "2", name: "게스트2", type: "guest", status: "inactive", joinedAt: "2025-10-15" },
		],
		discord: [
			{ id: "3", name: "디코유저1", type: "discord", status: "active", joinedAt: "2025-09-01" },
			{ id: "4", name: "디코유저2", type: "discord", status: "active", joinedAt: "2025-09-15" },
		],
		groupchat: [
			{ id: "5", name: "단톡멤버1", type: "groupchat", status: "active", joinedAt: "2025-08-01" },
			{ id: "6", name: "단톡멤버2", type: "groupchat", status: "active", joinedAt: "2025-08-15" },
		],
		notice: [
			{ id: "7", name: "공지멤버1", type: "notice", status: "active", joinedAt: "2025-07-01" },
			{ id: "8", name: "공지멤버2", type: "notice", status: "active", joinedAt: "2025-07-15" },
		]
	};

	useEffect(() => {
		setMembers(mockMembers[activeTab]);
	}, [activeTab]);

	async function addMember() {
		if (!newMemberName.trim()) return;

		setLoading(true);
		try {
			// 실제로는 API 호출
			const newMember: Member = {
				id: Date.now().toString(),
				name: newMemberName.trim(),
				type: activeTab,
				status: "active",
				joinedAt: new Date().toISOString().split('T')[0]
			};
			
			setMembers([...members, newMember]);
			setNewMemberName("");
		} catch (err) {
			alert("멤버 추가에 실패했습니다.");
		} finally {
			setLoading(false);
		}
	}

	async function toggleMemberStatus(memberId: string) {
		setMembers(members.map(m => 
			m.id === memberId 
				? { ...m, status: m.status === "active" ? "inactive" : "active" }
				: m
		));
	}

	async function deleteMember(memberId: string) {
		if (!confirm("이 멤버를 삭제하시겠습니까?")) return;
		
		setMembers(members.filter(m => m.id !== memberId));
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
				{Object.entries(memberTypes).map(([key, type]) => (
					<button
						key={key}
						className={`px-4 py-2 rounded transition-colors cursor-pointer ${
							activeTab === key 
								? "text-black" 
								: "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
						}`}
						style={activeTab === key ? { backgroundColor: "#FDC205" } : undefined}
						onClick={() => setActiveTab(key as MemberType)}
					>
						{type.icon} {type.name}
					</button>
				))}
			</div>

			{/* 현재 탭 정보 */}
			<div className="bg-white dark:bg-zinc-900 rounded-lg border p-6 mb-6">
				<div className="flex items-center gap-3 mb-4">
					<span className="text-2xl">{memberTypes[activeTab].icon}</span>
					<div>
						<h2 className="text-lg font-semibold">{memberTypes[activeTab].name}</h2>
						<p className="text-sm text-zinc-600 dark:text-zinc-400">{memberTypes[activeTab].description}</p>
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

			{/* 멤버 목록 */}
			<div className="bg-white dark:bg-zinc-900 rounded-lg border p-6">
				<h3 className="text-lg font-semibold mb-4">멤버 목록</h3>
				<div className="space-y-2">
					{members.length === 0 ? (
						<div className="text-center text-zinc-500 py-8">멤버가 없습니다.</div>
					) : (
						members.map((member) => (
							<div key={member.id} className="flex items-center gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded">
								<div className="flex-1">
									<div className="font-medium">{member.name}</div>
									<div className="text-sm text-zinc-500">
										가입일: {member.joinedAt} | 
										상태: <span className={member.status === "active" ? "text-green-600" : "text-red-600"}>
											{member.status === "active" ? "활성" : "비활성"}
										</span>
									</div>
								</div>
								<button
									className={`px-3 py-1 rounded text-sm transition-colors cursor-pointer ${
										member.status === "active" 
											? "bg-red-100 text-red-700 hover:bg-red-200" 
											: "bg-green-100 text-green-700 hover:bg-green-200"
									}`}
									onClick={() => toggleMemberStatus(member.id)}
								>
									{member.status === "active" ? "비활성화" : "활성화"}
								</button>
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
