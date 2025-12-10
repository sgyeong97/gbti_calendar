"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// Swagger UI는 클라이언트 사이드에서만 동작하므로 dynamic import 사용
const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });
import "swagger-ui-react/swagger-ui.css";

export default function SwaggerPage() {
	const [spec, setSpec] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		// 빌드 시 생성된 정적 JSON 파일 로드
		fetch("/swagger.json")
			.then((res) => {
				if (!res.ok) {
					throw new Error(`Failed to load swagger.json: ${res.status}`);
				}
				return res.json();
			})
			.then((jsonSpec) => {
				setSpec(jsonSpec);
				setLoading(false);
			})
			.catch((err) => {
				console.error("Error loading swagger spec:", err);
				setError(err.message);
				setLoading(false);
			});
	}, []);

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-gray-50">
				<div className="text-lg text-gray-600">Swagger 문서를 불러오는 중...</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-gray-50">
				<div className="text-lg text-red-500">
					오류: {error}
					<br />
					<button
						onClick={() => window.location.reload()}
						className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
					>
						다시 시도
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-white">
			<SwaggerUI spec={spec} />
		</div>
	);
}

