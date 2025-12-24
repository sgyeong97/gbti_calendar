import { NextRequest, NextResponse } from "next/server";
import { sanitizeErrorMessage, getSafeErrorMessage } from "../../utils/sanitize-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 단일 활동 로그 삭제 (관리자 전용)
export async function POST(req: NextRequest) {
	const role = req.cookies.get("gbti_role")?.value;
	if (role !== "admin") {
		return NextResponse.json({ error: "Admin only" }, { status: 403 });
	}

	try {
		const body = await req.json().catch(() => ({}));
		const id = body?.id?.toString?.();

		if (!id) {
			return NextResponse.json(
				{ success: false, error: "id is required" },
				{ status: 400 }
			);
		}

		const botApiUrl = process.env.DISCORD_BOT_API_URL;
		const apiToken = process.env.DISCORD_BOT_API_TOKEN;

		if (!botApiUrl || !apiToken) {
			console.error("[Discord Activity Delete] 환경 변수 누락", {
				hasUrl: !!botApiUrl,
				hasToken: !!apiToken,
			});
			return NextResponse.json(
				{ success: false, error: "Discord bot API is not configured" },
				{ status: 500 }
			);
		}

		const endpointBase = botApiUrl.endsWith("/")
			? `${botApiUrl}discord-activity`
			: `${botApiUrl}/discord-activity`;
		const targetUrl = `${endpointBase}/${encodeURIComponent(id)}`;

		const response = await fetch(targetUrl, {
			method: "DELETE",
			headers: {
				Authorization: `Bearer ${apiToken}`,
				"Content-Type": "application/json",
			},
			signal: AbortSignal.timeout(30000),
		});

		const text = await response.text();
		let data: any;
		try {
			data = text ? JSON.parse(text) : {};
		} catch {
			data = { raw: text };
		}

		if (!response.ok || data?.success === false) {
			console.error("[Discord Activity Delete] 봇 API 오류", {
				status: response.status,
				data,
			});
			// details에서 민감한 정보 제거
			const safeDetails = typeof data === 'string' 
				? sanitizeErrorMessage(data)
				: data;
			return NextResponse.json(
				{
					success: false,
					error: "Failed to delete activity in Discord bot",
					details: safeDetails,
				},
				{ status: response.status >= 500 ? 502 : response.status }
			);
		}

		return NextResponse.json(
			{
				success: true,
				deletedId: data.deletedId ?? id,
			},
			{ status: 200 }
		);
	} catch (err: any) {
		console.error("[Discord Activity Delete] 예외 발생", err);
		return NextResponse.json(
			{
				success: false,
				error: "Unexpected error",
				message: getSafeErrorMessage(err),
			},
			{ status: 500 }
		);
	}
}


