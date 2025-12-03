"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { applyColorTheme } from "@/app/lib/color-themes";

export default function AdminPage() {
	const router = useRouter();
	const { theme } = useTheme();
	const [colorTheme, setColorTheme] = useState<string>("default");
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
		const savedColorTheme = localStorage.getItem("gbti_color_theme") || "default";
		setColorTheme(savedColorTheme);

		// 테마 적용
		applyColorTheme();

		// 테마 변경 감지 (다른 탭에서 변경된 경우)
		const handleStorageChange = () => {
			const newColorTheme = localStorage.getItem("gbti_color_theme") || "default";
			if (newColorTheme !== colorTheme) {
			setColorTheme(newColorTheme);
			}
		};

		window.addEventListener("storage", handleStorageChange);

		return () => {
			window.removeEventListener("storage", handleStorageChange);
		};
	}, [theme]);

	// colorTheme 변경 시 테마 적용
	useEffect(() => {
		if (mounted) {
			applyColorTheme();
		}
	}, [colorTheme, mounted]);

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
		},
		{
			title: "사다리타기",
			description: "사다리타기 생성 및 관리",
			icon: "🪜",
			path: "/admin/ladder-games"
		},
		{
			title: "활동 시간 대시보드",
			description: "Discord 사용자 활동 시간 통계 및 분석",
			icon: "📊",
			path: "/admin/activity-dashboard"
		}
	];

	return (
		<div className="p-6 max-w-6xl mx-auto" style={{ background: "var(--background)", color: "var(--foreground)" }}>
			<div className="flex items-center justify-between mb-8">
				<h1 className="text-3xl font-bold">관리자 페이지</h1>
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
					onClick={() => router.push("/calendar")}
				>
					캘린더로 돌아가기
				</button>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{adminCards.map((card) => (
					<div
						key={card.title}
						className="rounded-lg p-6 transition-all cursor-pointer group"
						style={{ 
							background: "var(--background)", 
							border: "1px solid var(--accent)",
							boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
							e.currentTarget.style.background = "color-mix(in srgb, var(--background) 95%, var(--accent) 5%)";
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
							e.currentTarget.style.background = "var(--background)";
						}}
						onClick={() => router.push(card.path)}
					>
						<div className="text-center">
							<div className="text-4xl mb-4 group-hover:scale-110 transition-transform">
								{card.icon}
							</div>
							<h2 className="text-xl font-semibold mb-2">{card.title}</h2>
							<p className="text-sm" style={{ color: "var(--foreground)", opacity: 0.7 }}>
								{card.description}
							</p>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

