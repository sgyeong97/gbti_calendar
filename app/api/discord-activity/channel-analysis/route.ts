import { NextRequest, NextResponse } from "next/server";
import { sanitizeErrorMessage, getSafeErrorMessage } from "../../utils/sanitize-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 채널별 분석 데이터 조회
// Discord 봇의 API를 호출하여 채널별 집계 데이터를 가져옵니다
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

		console.log(`[Channel Analysis API] 봇 API 호출 시작: ${botApiUrl}`);

		// 쿼리 파라미터 가져오기 (필요시 사용)
		const { searchParams } = new URL(req.url);
		const startDate = searchParams.get("startDate");
		const endDate = searchParams.get("endDate");

		// Discord 봇 API에 전달할 쿼리 파라미터 구성
		const botParams = new URLSearchParams();
		if (startDate) botParams.set("startDate", startDate);
		if (endDate) botParams.set("endDate", endDate);

		// Discord 봇 API 호출
		// 봇의 엔드포인트: GET /discord-activity/channel-analysis
		const botApiEndpoint = `${botApiUrl}${botApiUrl.endsWith('/') ? '' : '/'}discord-activity/channel-analysis`;
		const requestUrl = `${botParams.toString() ? `${botApiEndpoint}?${botParams.toString()}` : botApiEndpoint}`;

		console.log(`[Channel Analysis API] 요청 URL: ${requestUrl}`);
		console.log(`[Channel Analysis API] 인증 토큰 존재: ${apiToken ? '예' : '아니오'}`);

		const response = await fetch(requestUrl, {
			method: "GET",
			headers: {
				"Authorization": `Bearer ${apiToken}`,
				"Content-Type": "application/json",
			},
			// 타임아웃 설정 (60초 - 채널 분석은 데이터가 많을 수 있음)
			signal: AbortSignal.timeout(60000),
		});

		console.log(`[Channel Analysis API] 응답 상태: ${response.status} ${response.statusText}`);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`[Channel Analysis API] 봇 API 오류: ${response.status} - ${errorText}`);
			console.error(`[Channel Analysis API] 요청 URL: ${requestUrl}`);
			return NextResponse.json(
				{ 
					error: "Failed to fetch channel analysis data from Discord bot",
					details: sanitizeErrorMessage(errorText),
					status: response.status
				},
				{ status: response.status >= 500 ? 502 : response.status }
			);
		}

		const data = await response.json();
		
		console.log(`[Channel Analysis API] 봇 API 응답 성공, 채널 개수: ${Array.isArray(data?.data) ? data.data.length : 0}`);
		
		// Discord 봇의 응답을 그대로 반환
		// 봇이 채널별 집계 데이터를 반환한다고 가정
		return NextResponse.json(data);
	} catch (err: any) {
		console.error("Error fetching channel analysis data from Discord bot:", err);
		
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
			{ error: "Failed to fetch channel analysis data", message: getSafeErrorMessage(err) },
			{ status: 500 }
		);
	}
}

