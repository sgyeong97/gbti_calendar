import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";

export const dynamic = "force-dynamic";

export async function GET() {
	try {
		const filePath = join(process.cwd(), "swagger.yaml");
		const fileContents = readFileSync(filePath, "utf-8");
		
		// YAML을 JSON으로 변환
		const jsonSpec = yaml.load(fileContents);
		
		return NextResponse.json(jsonSpec, {
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": "public, max-age=3600",
			},
		});
	} catch (error: any) {
		console.error("Error loading swagger.yaml:", error);
		return NextResponse.json(
			{ error: "Failed to read swagger.yaml file", message: error.message },
			{ status: 500 }
		);
	}
}

