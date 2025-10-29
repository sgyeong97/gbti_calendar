import { promises as fs } from "fs";
import path from "path";

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

export async function readMembers(): Promise<Member[]> {
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
	const json = JSON.stringify(members, null, 2) + "\n";
	await fs.mkdir(path.dirname(dataFilePath), { recursive: true });
	await fs.writeFile(dataFilePath, json, "utf-8");
}
