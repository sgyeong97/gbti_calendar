import { NextRequest, NextResponse } from "next/server";
import { sanitizeErrorMessage, getSafeErrorMessage } from "../../../utils/sanitize-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Discord 봇의 모든 만남 횟수 API 프록시 (전체 쌍)
export async function GET(req: NextRequest) {
	const role = req.cookies.get("gbti_role")?.value;
	if (role !== "admin") {
		return NextResponse.json({ error: "Admin only" }, { status: 403 });
	}

	try {
		let botApiUrl = process.env.DISCORD_BOT_API_URL;
		if (!botApiUrl) {
			console.error("DISCORD_BOT_API_URL 환경 변수가 설정되지 않았습니다.");
			return NextResponse.json(
				{ error: "Discord bot API URL not configured. Please set DISCORD_BOT_API_URL environment variable." },
				{ status: 500 }
			);
		}

		// 프로토콜이 없으면 http:// 자동 추가
		if (!botApiUrl.startsWith('http://') && !botApiUrl.startsWith('https://')) {
			botApiUrl = `http://${botApiUrl}`;
		}

		const apiToken = process.env.DISCORD_BOT_API_TOKEN;
		if (!apiToken) {
			console.error("DISCORD_BOT_API_TOKEN 환경 변수가 설정되지 않았습니다.");
			return NextResponse.json(
				{ error: "Discord bot API token not configured. Please set DISCORD_BOT_API_TOKEN environment variable." },
				{ status: 500 }
			);
		}

		const botApiEndpoint = `${botApiUrl}${botApiUrl.endsWith("/") ? "" : "/"}meeting-counts/all`;

		console.log(`[Meeting Counts ALL API] 봇 API 호출: ${botApiEndpoint}`);

		const response = await fetch(botApiEndpoint, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${apiToken}`,
				"Content-Type": "application/json",
			},
			signal: AbortSignal.timeout(30000),
		});

		console.log(`[Meeting Counts ALL API] 응답 상태: ${response.status} ${response.statusText}`);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`[Meeting Counts ALL API] 봇 API 오류: ${response.status} - ${errorText}`);
			return NextResponse.json(
				{
					error: "Failed to fetch meeting counts (all) from Discord bot",
					details: sanitizeErrorMessage(errorText),
					status: response.status,
				},
				{ status: response.status >= 500 ? 502 : response.status }
			);
		}

		const data = await response.json();
		console.log(`[Meeting Counts ALL API] 봇 API 응답 성공, 데이터 개수: ${data?.count || data?.length || 0}`);

		return NextResponse.json(data);
	} catch (err: any) {
		console.error("Error fetching meeting counts (all) from Discord bot:", err);

		if (err.name === "AbortError" || err.name === "TimeoutError") {
			return NextResponse.json(
				{ error: "Request timeout. Discord bot API did not respond in time." },
				{ status: 504 }
			);
		}

		if (err.message?.includes("fetch")) {
			return NextResponse.json(
				{ error: "Failed to connect to Discord bot API. Please check if the bot is running and DISCORD_BOT_API_URL is correct." },
				{ status: 503 }
			);
		}

		return NextResponse.json(
			{ error: "Failed to fetch meeting counts (all)", message: getSafeErrorMessage(err) },
			{ status: 500 }
		);
	}
}

