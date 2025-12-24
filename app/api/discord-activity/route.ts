import { NextRequest, NextResponse } from "next/server";
import { sanitizeErrorMessage, getSafeErrorMessage } from "../utils/sanitize-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Discord 활동 시간 데이터 조회
// 웹사이트는 Discord 봇의 API를 호출하여 데이터를 가져옵니다
export async function GET(req: NextRequest) {
	const role = req.cookies.get("gbti_role")?.value;
	if (role !== "admin") {
		return NextResponse.json({ error: "Admin only" }, { status: 403 });
	}

	try {
		// Discord 봇 API URL 가져오기
		const botApiUrl = process.env.DISCORD_BOT_API_URL;
		if (!botApiUrl) {
			console.error("DISCORD_BOT_API_URL 환경 변수가 설정되지 않았습니다.");
			return NextResponse.json(
				{ error: "Discord bot API URL not configured. Please set DISCORD_BOT_API_URL environment variable." },
				{ status: 500 }
			);
		}

		// API 인증 토큰
		const apiToken = process.env.DISCORD_BOT_API_TOKEN;
		if (!apiToken) {
			console.error("DISCORD_BOT_API_TOKEN 환경 변수가 설정되지 않았습니다.");
			return NextResponse.json(
				{ error: "Discord bot API token not configured. Please set DISCORD_BOT_API_TOKEN environment variable." },
				{ status: 500 }
			);
		}

		console.log(`[Discord Activity API] 봇 API 호출 시작: ${botApiUrl}`);

		// 쿼리 파라미터 가져오기
		const { searchParams } = new URL(req.url);
		const userId = searchParams.get("userId");
		const startDate = searchParams.get("startDate");
		const endDate = searchParams.get("endDate");
		const groupBy = searchParams.get("groupBy") || "day";

		// Discord 봇 API에 전달할 쿼리 파라미터 구성
		const botParams = new URLSearchParams();
		if (userId) botParams.set("userId", userId);
		if (startDate) botParams.set("startDate", startDate);
		if (endDate) botParams.set("endDate", endDate);
		if (groupBy) botParams.set("groupBy", groupBy);

		// Discord 봇 API 호출
		// 봇의 엔드포인트: GET /discord-activity
		const botApiEndpoint = `${botApiUrl}${botApiUrl.endsWith('/') ? '' : '/'}discord-activity`;
		const requestUrl = `${botParams.toString() ? `${botApiEndpoint}?${botParams.toString()}` : botApiEndpoint}`;

		console.log(`[Discord Activity API] 요청 URL: ${requestUrl}`);
		console.log(`[Discord Activity API] 인증 토큰 존재: ${apiToken ? '예' : '아니오'}`);

		const response = await fetch(requestUrl, {
			method: "GET",
			headers: {
				"Authorization": `Bearer ${apiToken}`,
				"Content-Type": "application/json",
			},
			// 타임아웃 설정 (30초)
			signal: AbortSignal.timeout(30000),
		});

		console.log(`[Discord Activity API] 응답 상태: ${response.status} ${response.statusText}`);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`[Discord Activity API] 봇 API 오류: ${response.status} - ${errorText}`);
			console.error(`[Discord Activity API] 요청 URL: ${requestUrl}`);
			return NextResponse.json(
				{ 
					error: "Failed to fetch data from Discord bot",
					details: sanitizeErrorMessage(errorText),
					status: response.status
				},
				{ status: response.status >= 500 ? 502 : response.status }
			);
		}

		const data = await response.json();
		
		console.log(`[Discord Activity API] 봇 API 응답 성공, 데이터 개수: ${data?.count || 0}`);
		
		// Discord 봇의 응답을 그대로 반환
		// 봇이 이미 그룹화된 데이터를 반환한다고 가정
		return NextResponse.json(data);
	} catch (err: any) {
		console.error("Error fetching activity data from Discord bot:", err);
		
		// 타임아웃 오류 처리
		if (err.name === 'AbortError' || err.name === 'TimeoutError') {
			return NextResponse.json(
				{ error: "Request timeout. Discord bot API did not respond in time." },
				{ status: 504 }
			);
		}

		// 네트워크 오류 처리
		if (err.message?.includes('fetch')) {
			return NextResponse.json(
				{ error: "Failed to connect to Discord bot API. Please check if the bot is running and DISCORD_BOT_API_URL is correct." },
				{ status: 503 }
			);
		}

		return NextResponse.json(
			{ error: "Failed to fetch activity data", message: getSafeErrorMessage(err) },
			{ status: 500 }
		);
	}
}

