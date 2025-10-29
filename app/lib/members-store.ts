import { promises as fs } from "fs";
import path from "path";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export type Platform = "discord" | "notice" | "chat";

export type Member = {
	id: string;
	name: string;
	platforms: { discord: boolean; notice: boolean; chat: boolean };
	status: "active" | "inactive";
	lastSeen: string;
	discordLink?: string;
	birthYear?: number;
};

const dataFilePath = path.join(process.cwd(), "data", "members.json");
const STORAGE_BUCKET = "config";
const STORAGE_OBJECT = "members.json";

function shouldUseSupabaseStorage(): boolean {
	// Vercel 배포 환경에서는 파일 시스템이 읽기 전용 → Storage 사용
	return process.env.VERCEL === "1";
}

export async function readMembers(): Promise<Member[]> {
	if (shouldUseSupabaseStorage()) {
		// Supabase Storage에서 members.json 읽기
		// 버킷이 없다면 생성 후 빈 배열 반환
		await ensureBucketExists(STORAGE_BUCKET);
		const { data, error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).download(STORAGE_OBJECT);
		if (error || !data) {
			// 객체가 없으면 로컬 시드 파일을 읽어 스토리지에 업로드(최초 1회 시드)
			try {
				const raw = await fs.readFile(dataFilePath, "utf-8");
				const parsed = JSON.parse(raw);
				if (Array.isArray(parsed)) {
					await writeMembers(parsed as Member[]);
					return parsed as Member[];
				}
			} catch {
				// 시드 파일도 없으면 빈 배열
			}
			return [];
		}
		const text = await data.text();
		try {
			const parsed = JSON.parse(text);
			return Array.isArray(parsed) ? parsed as Member[] : [];
		} catch {
			return [];
		}
	}

	// 로컬 파일 시스템에서 읽기
	try {
		const raw = await fs.readFile(dataFilePath, "utf-8");
		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed)) return parsed as Member[];
		return [];
	} catch (err: any) {
		if (err && (err.code === "ENOENT" || err.code === "MODULE_NOT_FOUND")) {
			return [];
		}
		throw err;
	}
}

export async function writeMembers(members: Member[]): Promise<void> {
	if (shouldUseSupabaseStorage()) {
		await ensureBucketExists(STORAGE_BUCKET);
		const body = Buffer.from(JSON.stringify(members, null, 2) + "\n", "utf-8");
		const { error } = await supabaseAdmin.storage
			.from(STORAGE_BUCKET)
			.upload(STORAGE_OBJECT, body, { upsert: true, contentType: "application/json" });
		if (error) throw error;
		return;
	}

	const json = JSON.stringify(members, null, 2) + "\n";
	await fs.mkdir(path.dirname(dataFilePath), { recursive: true });
	await fs.writeFile(dataFilePath, json, "utf-8");
}

async function ensureBucketExists(bucket: string) {
	// 존재 확인: listBuckets가 없으므로 create 시 이미 존재하면 에러 → getPublicUrl로 간접 확인 불가
	// create를 시도하고, 이미 있다면 무시
	try {
		await supabaseAdmin.storage.createBucket(bucket, { public: false });
	} catch (_err: any) {
		// 이미 존재하는 경우 등은 무시
		return;
	}
}
