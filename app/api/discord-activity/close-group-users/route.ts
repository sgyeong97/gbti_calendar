import { NextRequest, NextResponse } from "next/server";
import { sanitizeErrorMessage, getSafeErrorMessage } from "../../utils/sanitize-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 끼리끼리 인원 계산 API (최적화)
// 백엔드에서 직접 집계하여 반환
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

		console.log(`[Close Group Users API] 봇 API 호출 시작: ${botApiUrl}`);

		// 쿼리 파라미터 가져오기
		const { searchParams } = new URL(req.url);
		const minGroupSize = searchParams.get("minGroupSize") || "5";
		const countOffset = searchParams.get("countOffset") || "10";
		const includeInactive = searchParams.get("includeInactive");

		// Discord 봇 API에 전달할 쿼리 파라미터 구성
		const botParams = new URLSearchParams();
		botParams.set("minGroupSize", minGroupSize);
		botParams.set("countOffset", countOffset);
		if (includeInactive !== null) botParams.set("includeInactive", includeInactive);

		// Discord 봇 API 호출
		// 봇의 엔드포인트: GET /discord-activity/close-group-users
		const botApiEndpoint = `${botApiUrl}${botApiUrl.endsWith('/') ? '' : '/'}discord-activity/close-group-users`;
		const requestUrl = `${botApiEndpoint}?${botParams.toString()}`;

		console.log(`[Close Group Users API] 요청 URL: ${requestUrl}`);
		console.log(`[Close Group Users API] 인증 토큰 존재: ${apiToken ? '예' : '아니오'}`);

		const response = await fetch(requestUrl, {
			method: "GET",
			headers: {
				"Authorization": `Bearer ${apiToken}`,
				"Content-Type": "application/json",
			},
			// 타임아웃 설정 (60초 - 집계 작업이 오래 걸릴 수 있음)
			signal: AbortSignal.timeout(60000),
		});

		console.log(`[Close Group Users API] 응답 상태: ${response.status} ${response.statusText}`);

		// 404는 백엔드에 아직 구현되지 않았음을 의미
		if (response.status === 404) {
			console.log(`[Close Group Users API] 백엔드에 아직 구현되지 않았습니다.`);
			return NextResponse.json(
				{ error: "Not implemented yet" },
				{ status: 404 }
			);
		}

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`[Close Group Users API] 봇 API 오류: ${response.status} - ${errorText}`);
			console.error(`[Close Group Users API] 요청 URL: ${requestUrl}`);
			return NextResponse.json(
				{ 
					error: "Failed to fetch close group users from Discord bot",
					details: sanitizeErrorMessage(errorText),
					status: response.status
				},
				{ status: response.status >= 500 ? 502 : response.status }
			);
		}

		const data = await response.json();
		
		console.log(`[Close Group Users API] 봇 API 응답 성공, 사용자 개수: ${data?.count || 0}`);
		
		// Discord 봇의 응답을 그대로 반환
		return NextResponse.json(data);
	} catch (err: any) {
		console.error("Error fetching close group users from Discord bot:", err);
		
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
			{ error: "Failed to fetch close group users", message: getSafeErrorMessage(err) },
			{ status: 500 }
		);
	}
}

