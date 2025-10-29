"use client";

import { useRouter } from "next/navigation";

export default function AdminPage() {
	const router = useRouter();

	const adminCards = [
		{
			title: "참여자 관리",
			description: "참여자 생성, 수정, 삭제",
			icon: "👥",
			path: "/admin/participants"
		},
		{
			title: "이벤트 관리", 
			description: "이벤트 생성, 수정, 삭제",
			icon: "📅",
			path: "/admin/events"
		},
		{
			title: "활동인원 관리",
			description: "게스트, 디코, 단톡방, 공지방 인원 관리",
			icon: "👤",
			path: "/admin/members"
		}
	];

	return (
		<div className="p-6 max-w-6xl mx-auto">
			<div className="flex items-center justify-between mb-8">
				<h1 className="text-3xl font-bold">관리자 페이지</h1>
				<button
					className="px-4 py-2 rounded text-black transition-colors cursor-pointer"
					style={{ backgroundColor: "#FDC205" }}
					onClick={() => router.push("/calendar")}
				>
					캘린더로 돌아가기
				</button>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{adminCards.map((card) => (
					<div
						key={card.title}
						className="bg-white dark:bg-zinc-900 rounded-lg border p-6 hover:shadow-lg transition-all cursor-pointer group"
						onClick={() => router.push(card.path)}
					>
						<div className="text-center">
							<div className="text-4xl mb-4 group-hover:scale-110 transition-transform">
								{card.icon}
							</div>
							<h2 className="text-xl font-semibold mb-2">{card.title}</h2>
							<p className="text-zinc-600 dark:text-zinc-400 text-sm">
								{card.description}
							</p>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

