import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sanitizeErrorMessage, getSafeErrorMessage } from "../../utils/sanitize-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 특정 주의 만남 횟수 및 시간기록 삭제 (관리자 전용)
export async function DELETE(req: NextRequest) {
	const role = (await cookies()).get("gbti_role")?.value;
	if (role !== "admin") {
		return NextResponse.json({ error: "Admin only" }, { status: 403 });
	}

	try {
		const { searchParams } = new URL(req.url);
		const weekKey = searchParams.get("weekKey");
		const deleteActivities = searchParams.get("deleteActivities") !== "false";
		const deleteMeetingCounts = searchParams.get("deleteMeetingCounts") !== "false";

		if (!weekKey) {
			return NextResponse.json(
				{ success: false, error: "weekKey is required" },
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

		const botParams = new URLSearchParams();
		if (deleteActivities !== undefined) botParams.set("deleteActivities", String(deleteActivities));
		if (deleteMeetingCounts !== undefined) botParams.set("deleteMeetingCounts", String(deleteMeetingCounts));

		const botApiEndpoint = `${botApiUrl}${botApiUrl.endsWith('/') ? '' : '/'}discord-activity/week/${encodeURIComponent(weekKey)}`;
		const requestUrl = botParams.toString() ? `${botApiEndpoint}?${botParams.toString()}` : botApiEndpoint;

		console.log(`[Delete Week API] 봇 API 호출 시작: DELETE ${requestUrl}`);

		const response = await fetch(requestUrl, {
			method: "DELETE",
			headers: {
				"Authorization": `Bearer ${apiToken}`,
				"Content-Type": "application/json",
			},
			signal: AbortSignal.timeout(30000),
		});

		console.log(`[Delete Week API] 응답 상태: ${response.status} ${response.statusText}`);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`[Delete Week API] 봇 API 오류: ${response.status} - ${errorText}`);
			return NextResponse.json(
				{
					success: false,
					error: "Failed to delete week data from Discord bot",
					details: sanitizeErrorMessage(errorText),
					status: response.status,
				},
				{ status: response.status >= 500 ? 502 : response.status }
			);
		}

		const data = await response.json();
		console.log(`[Delete Week API] 봇 API 응답 성공:`, data);

		return NextResponse.json(data);
	} catch (err: any) {
		console.error("Error deleting week data from Discord bot:", err);

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
			{ error: "Failed to delete week data", message: getSafeErrorMessage(err) },
			{ status: 500 }
		);
	}
}

