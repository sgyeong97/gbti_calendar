import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sanitizeErrorMessage, getSafeErrorMessage } from "../../utils/sanitize-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 특정 날짜들의 활동 기록 삭제 (관리자 전용)
export async function POST(req: NextRequest) {
	const cookieStore = await cookies();
	const role = cookieStore.get("gbti_role")?.value;
	if (role !== "admin") {
		return NextResponse.json({ error: "Admin only" }, { status: 403 });
	}

	try {
		const { dates } = await req.json();
		if (!Array.isArray(dates) || dates.length === 0) {
			return NextResponse.json(
				{ success: false, error: "dates array is required" },
				{ status: 400 }
			);
		}

		const botApiUrl = process.env.DISCORD_BOT_API_URL;
		const apiToken = process.env.DISCORD_BOT_API_TOKEN;

		if (!botApiUrl || !apiToken) {
			console.error("Discord bot API URL or token not configured.");
			return NextResponse.json(
				{ error: "Discord bot API configuration missing" },
				{ status: 500 }
			);
		}

		const botApiEndpoint = `${botApiUrl}${botApiUrl.endsWith('/') ? '' : '/'}discord-activity/delete-by-dates`;

		console.log(`[Delete By Dates API] 봇 API 호출 시작: POST ${botApiEndpoint}`);

		const response = await fetch(botApiEndpoint, {
			method: "POST",
			headers: {
				"Authorization": `Bearer ${apiToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ dates }),
			signal: AbortSignal.timeout(30000),
		});

		console.log(`[Delete By Dates API] 응답 상태: ${response.status} ${response.statusText}`);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`[Delete By Dates API] 봇 API 오류: ${response.status} - ${errorText}`);
			return NextResponse.json(
				{
					success: false,
					error: "Failed to delete data from Discord bot",
					details: sanitizeErrorMessage(errorText),
					status: response.status,
				},
				{ status: response.status >= 500 ? 502 : response.status }
			);
		}

		const data = await response.json();
		console.log(`[Delete By Dates API] 봇 API 응답 성공:`, data);

		return NextResponse.json(data);
	} catch (err: any) {
		console.error("Error deleting activity data by dates from Discord bot:", err);

		if (err.name === 'AbortError' || err.name === 'TimeoutError') {
			return NextResponse.json(
				{ error: "Request timeout. Discord bot API did not respond in time." },
				{ status: 504 }
			);
		}

		if (err.message?.includes('fetch')) {
			return NextResponse.json(
				{ error: "Failed to connect to Discord bot API. Please check if the bot is running and DISCORD_BOT_API_URL is correct." },
				{ status: 503 }
			);
		}

		return NextResponse.json(
			{ error: "Failed to delete activity data", message: getSafeErrorMessage(err) },
			{ status: 500 }
		);
	}
}

