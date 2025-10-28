"use client";

import { format } from "date-fns";

type Notice = {
  id: string;
  title: string;
  content: string;
  imageUrl?: string | null;
  author: string;
  createdAt: string;
};

export default function NoticeDetailModal({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="rounded p-4 w-full max-w-2xl space-y-3" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold">{notice.title}</h2>
          <button
            className="px-3 py-1 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            onClick={onClose}
          >
            닫기
          </button>
        </div>

        {notice.imageUrl && (
          <img src={notice.imageUrl} alt={notice.title} className="w-full max-h-96 object-contain rounded" />
        )}

        <div className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-line break-words">
          {notice.content}
        </div>

        <div className="flex justify-between items-center text-xs text-zinc-500 dark:text-zinc-400">
          <span>{notice.author || "관리자"}</span>
          <span>{format(new Date(notice.createdAt), "yyyy.MM.dd HH:mm")}</span>
        </div>
      </div>
    </div>
  );
}
