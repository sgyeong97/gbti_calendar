import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 사용자별 그룹화된 활동 데이터 조회 (웹 최적화)
// Discord 봇의 최적화된 API를 호출하여 DB에서 직접 집계된 데이터를 가져옵니다
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

		console.log(`[Grouped By User API] 봇 API 호출 시작: ${botApiUrl}`);

		// 쿼리 파라미터 가져오기
		const { searchParams } = new URL(req.url);
		const startDate = searchParams.get("startDate");
		const endDate = searchParams.get("endDate");

		// Discord 봇 API에 전달할 쿼리 파라미터 구성
		const botParams = new URLSearchParams();
		if (startDate) botParams.set("startDate", startDate);
		if (endDate) botParams.set("endDate", endDate);

		// Discord 봇 API 호출
		// 봇의 엔드포인트: GET /discord-activity/grouped-by-user
		const botApiEndpoint = `${botApiUrl}${botApiUrl.endsWith('/') ? '' : '/'}discord-activity/grouped-by-user`;
		const requestUrl = `${botParams.toString() ? `${botApiEndpoint}?${botParams.toString()}` : botApiEndpoint}`;

		console.log(`[Grouped By User API] 요청 URL: ${requestUrl}`);
		console.log(`[Grouped By User API] 인증 토큰 존재: ${apiToken ? '예' : '아니오'}`);

		const response = await fetch(requestUrl, {
			method: "GET",
			headers: {
				"Authorization": `Bearer ${apiToken}`,
				"Content-Type": "application/json",
			},
			// 타임아웃 설정 (60초 - 집계 작업이 오래 걸릴 수 있음)
			signal: AbortSignal.timeout(60000),
		});

		console.log(`[Grouped By User API] 응답 상태: ${response.status} ${response.statusText}`);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`[Grouped By User API] 봇 API 오류: ${response.status} - ${errorText}`);
			console.error(`[Grouped By User API] 요청 URL: ${requestUrl}`);
			return NextResponse.json(
				{ 
					error: "Failed to fetch grouped-by-user data from Discord bot",
					details: errorText,
					status: response.status,
					requestUrl: requestUrl // 디버깅용
				},
				{ status: response.status >= 500 ? 502 : response.status }
			);
		}

		const data = await response.json();
		
		console.log(`[Grouped By User API] 봇 API 응답 성공, 사용자 개수: ${data?.count || 0}`);
		
		// Discord 봇의 응답을 그대로 반환
		return NextResponse.json(data);
	} catch (err: any) {
		console.error("Error fetching grouped-by-user data from Discord bot:", err);
		
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
			{ error: "Failed to fetch grouped-by-user data", message: err?.message || String(err) },
			{ status: 500 }
		);
	}
}

