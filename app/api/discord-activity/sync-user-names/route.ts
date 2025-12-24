import { NextRequest, NextResponse } from "next/server";
import { sanitizeErrorMessage, getSafeErrorMessage } from "../../utils/sanitize-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 사용자 이름 동기화 API
// Discord 서버의 닉네임과 DB의 userName을 비교하여 동기화
export async function POST(req: NextRequest) {
	const role = req.cookies.get("gbti_role")?.value;
	if (role !== "admin") {
		return NextResponse.json({ error: "Admin only" }, { status: 403 });
	}

	try {
		// 길드 ID는 필수
		const searchParams = req.nextUrl.searchParams;
		const guildId = searchParams.get("guildId") || "1373916592294985828";
		if (!guildId) {
			return NextResponse.json(
				{ error: "guildId is required" },
				{ status: 400 },
			);
		}

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

		console.log(`[Sync User Names API] 봇 API 호출 시작: ${botApiUrl}`);

		// Discord 봇 API 호출
		// 봇의 엔드포인트: POST /discord-activity/sync-user-names?guildId=...
		const botApiEndpoint = `${botApiUrl}${botApiUrl.endsWith('/') ? '' : '/'}discord-activity/sync-user-names?guildId=${encodeURIComponent(guildId)}`;
		
		console.log(`[Sync User Names API] 요청 URL: ${botApiEndpoint}`);
		console.log(`[Sync User Names API] 인증 토큰 존재: ${apiToken ? '예' : '아니오'}`);

		const response = await fetch(botApiEndpoint, {
			method: "POST",
			headers: {
				"Authorization": `Bearer ${apiToken}`,
				"Content-Type": "application/json",
			},
			// 타임아웃 설정 (120초 - 동기화 작업이 오래 걸릴 수 있음)
			signal: AbortSignal.timeout(120000),
		});

		console.log(`[Sync User Names API] 응답 상태: ${response.status} ${response.statusText}`);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`[Sync User Names API] 봇 API 오류: ${response.status} - ${errorText}`);
			return NextResponse.json(
				{ 
					error: "Failed to sync user names from Discord bot",
					details: sanitizeErrorMessage(errorText),
					status: response.status,
				},
				{ status: response.status >= 500 ? 502 : response.status }
			);
		}

		const data = await response.json();
		
		console.log(`[Sync User Names API] 봇 API 응답 성공`);
		console.log(`[Sync User Names API] 업데이트된 사용자: ${data?.summary?.updatedCount || 0}명`);
		
		// Discord 봇의 응답을 그대로 반환
		return NextResponse.json(data);
	} catch (err: any) {
		console.error("Error syncing user names from Discord bot:", err);
		
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
			{ error: "Failed to sync user names", message: getSafeErrorMessage(err) },
			{ status: 500 }
		);
	}
}

