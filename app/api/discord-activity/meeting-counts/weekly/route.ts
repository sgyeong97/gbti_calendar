import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sanitizeErrorMessage, getSafeErrorMessage } from "../../../utils/sanitize-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
	const role = (await cookies()).get("gbti_role")?.value;
	if (role !== "admin") {
		return NextResponse.json({ error: "Admin only" }, { status: 403 });
	}

	try {
		let botApiUrl = process.env.DISCORD_BOT_API_URL;
		const apiToken = process.env.DISCORD_BOT_API_TOKEN;

		if (!botApiUrl || !apiToken) {
			console.error("Discord bot API URL or token not configured.");
			return NextResponse.json(
				{ error: "Discord bot API configuration missing" },
				{ status: 500 }
			);
		}

		// 프로토콜이 없으면 http:// 자동 추가
		if (!botApiUrl.startsWith('http://') && !botApiUrl.startsWith('https://')) {
			botApiUrl = `http://${botApiUrl}`;
		}

		const { searchParams } = new URL(req.url);
		const userId = searchParams.get("userId");
		const month = searchParams.get("month");

		if (!userId) {
			return NextResponse.json(
				{ error: "userId is required" },
				{ status: 400 }
			);
		}

		const botParams = new URLSearchParams();
		botParams.set("userId", userId);
		if (month) botParams.set("month", month);

		const botApiEndpoint = `${botApiUrl}${botApiUrl.endsWith('/') ? '' : '/'}meeting-counts/weekly`;
		const requestUrl = `${botApiEndpoint}?${botParams.toString()}`;

		console.log(`[Weekly Meeting Counts API] 봇 API 호출 시작: ${requestUrl}`);

		const response = await fetch(requestUrl, {
			method: "GET",
			headers: {
				"Authorization": `Bearer ${apiToken}`,
				"Content-Type": "application/json",
			},
			signal: AbortSignal.timeout(30000),
		});

		console.log(`[Weekly Meeting Counts API] 응답 상태: ${response.status} ${response.statusText}`);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`[Weekly Meeting Counts API] 봇 API 오류: ${response.status} - ${errorText}`);
			return NextResponse.json(
				{
					error: "Failed to fetch weekly meeting counts from Discord bot",
					details: sanitizeErrorMessage(errorText),
					status: response.status,
				},
				{ status: response.status >= 500 ? 502 : response.status }
			);
		}

		const data = await response.json();
		console.log(`[Weekly Meeting Counts API] 봇 API 응답 성공, 데이터 개수: ${data?.count || 0}`);

		return NextResponse.json(data);
	} catch (err: any) {
		console.error("Error fetching weekly meeting counts from Discord bot:", err);
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
			{ error: "Failed to fetch weekly meeting counts", message: getSafeErrorMessage(err) },
			{ status: 500 }
		);
	}
}

