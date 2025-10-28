"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

export default function LoginPage() {
	return (
		<Suspense fallback={<div className="min-h-screen flex items-center justify-center p-6" />}> 
			<LoginClient />
		</Suspense>
	);
}

function LoginClient() {
	const router = useRouter();
	const sp = useSearchParams();
	const redirect = sp.get("redirect") ?? "/calendar";
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const submit = async () => {
		setLoading(true);
		setError(null);
		const res = await fetch("/api/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password }),
		});
		setLoading(false);
		if (res.ok) router.push(redirect);
		else setError("비밀번호가 올바르지 않습니다.");
	};

	return (
		<div className="min-h-screen flex items-center justify-center p-6">
			<div className="w-full max-w-sm border rounded p-4 space-y-3">
				<h1 className="text-xl font-semibold">접근 비밀번호 입력</h1>
				<input
					className="w-full border rounded px-3 py-2"
					type="password"
					placeholder="비밀번호"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && submit()}
				/>
				<button className="w-full bg-black text-white rounded py-2" onClick={submit} disabled={loading}>
					{loading ? "확인 중..." : "입장"}
				</button>
				{error && <p className="text-sm text-red-600">{error}</p>}
				<p className="text-xs text-zinc-500">관리자/일반 비밀번호 중 하나를 입력하세요.</p>
			</div>
		</div>
	);
}
