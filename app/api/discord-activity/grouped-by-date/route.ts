import { NextRequest, NextResponse } from "next/server";
import { sanitizeErrorMessage, getSafeErrorMessage } from "../../utils/sanitize-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 날짜별 그룹화된 활동 데이터 조회 (웹 최적화)
// Discord 봇의 최적화된 API를 호출하여 DB에서 직접 집계된 데이터를 가져옵니다
export async function GET(req: NextRequest) {
	const role = req.cookies.get("gbti_role")?.value;
	if (role !== "admin") {
		return NextResponse.json({ error: "Admin only" }, { status: 403 });
	}

	try {
		// Discord 봇 API URL 가져오기
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

		// API 인증 토큰
		const apiToken = process.env.DISCORD_BOT_API_TOKEN;
		if (!apiToken) {
			console.error("DISCORD_BOT_API_TOKEN 환경 변수가 설정되지 않았습니다.");
			return NextResponse.json(
				{ error: "Discord bot API token not configured. Please set DISCORD_BOT_API_TOKEN environment variable." },
				{ status: 500 }
			);
		}

		console.log(`[Grouped By Date API] 봇 API 호출 시작: ${botApiUrl}`);

		// 쿼리 파라미터 가져오기
		const { searchParams } = new URL(req.url);
		const startDate = searchParams.get("startDate");
		const endDate = searchParams.get("endDate");
		const includeInactive = searchParams.get("includeInactive");

		// Discord 봇 API에 전달할 쿼리 파라미터 구성
		const botParams = new URLSearchParams();
		if (startDate) botParams.set("startDate", startDate);
		if (endDate) botParams.set("endDate", endDate);
		if (includeInactive !== null) botParams.set("includeInactive", includeInactive);

		// Discord 봇 API 호출
		// 봇의 엔드포인트: GET /discord-activity/grouped-by-date
		const botApiEndpoint = `${botApiUrl}${botApiUrl.endsWith('/') ? '' : '/'}discord-activity/grouped-by-date`;
		const requestUrl = `${botParams.toString() ? `${botApiEndpoint}?${botParams.toString()}` : botApiEndpoint}`;

		console.log(`[Grouped By Date API] 요청 URL: ${requestUrl}`);
		console.log(`[Grouped By Date API] 인증 토큰 존재: ${apiToken ? '예' : '아니오'}`);
		console.log(`[Grouped By Date API] 요청 시작 시간: ${new Date().toISOString()}`);

		const response = await fetch(requestUrl, {
			method: "GET",
			headers: {
				"Authorization": `Bearer ${apiToken}`,
				"Content-Type": "application/json",
				"User-Agent": "GBTI-Calendar-WebApp/1.0",
				"X-Request-Source": "vercel-api",
			},
			// 타임아웃 설정 (60초 - 집계 작업이 오래 걸릴 수 있음)
			signal: AbortSignal.timeout(60000),
		});

		console.log(`[Grouped By Date API] 응답 상태: ${response.status} ${response.statusText}`);
		console.log(`[Grouped By Date API] 응답 헤더:`, Object.fromEntries(response.headers.entries()));

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`[Grouped By Date API] 봇 API 오류: ${response.status} - ${errorText}`);
			console.error(`[Grouped By Date API] 요청 URL: ${requestUrl}`);
			return NextResponse.json(
				{ 
					error: "Failed to fetch grouped-by-date data from Discord bot",
					details: sanitizeErrorMessage(errorText),
					status: response.status
				},
				{ status: response.status >= 500 ? 502 : response.status }
			);
		}

		const data = await response.json();
		
		console.log(`[Grouped By Date API] 봇 API 응답 성공, 날짜 개수: ${data?.count || 0}`);
		
		// Discord 봇의 응답을 그대로 반환
		return NextResponse.json(data);
	} catch (err: any) {
		console.error("Error fetching grouped-by-date data from Discord bot:", err);
		console.error("[Grouped By Date API] 에러 상세:", {
			name: err?.name,
			message: err?.message,
			stack: err?.stack,
			cause: err?.cause,
			botApiUrl: process.env.DISCORD_BOT_API_URL ? '설정됨' : '설정 안됨',
			apiToken: process.env.DISCORD_BOT_API_TOKEN ? '설정됨' : '설정 안됨',
		});
		
		// 타임아웃 오류 처리
		if (err.name === 'AbortError' || err.name === 'TimeoutError') {
			return NextResponse.json(
				{ error: "Request timeout. Discord bot API did not respond in time." },
				{ status: 504 }
			);
		}

		// 네트워크 오류 처리
		if (err.message?.includes('fetch') || err.message?.includes('ECONNREFUSED') || err.message?.includes('ENOTFOUND')) {
			return NextResponse.json(
				{ 
					error: "Failed to connect to Discord bot API. Please check if the bot is running and DISCORD_BOT_API_URL is correct.",
					hint: "봇 서버가 실행 중인지, 포트포워딩이 올바른지, 방화벽 설정을 확인하세요."
				},
				{ status: 503 }
			);
		}

		return NextResponse.json(
			{ error: "Failed to fetch grouped-by-date data", message: getSafeErrorMessage(err) },
			{ status: 500 }
		);
	}
}

