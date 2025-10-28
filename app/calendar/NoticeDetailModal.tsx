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

export default function NoticeDetailModal({ notice, onClose, onDeleted }: { notice: Notice; onClose: () => void; onDeleted?: () => void }) {
  async function handleDelete() {
    if (!confirm('해당 공지를 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/notices/${notice.id}`, { method: 'DELETE' });
      if (res.ok) {
        onDeleted && onDeleted();
        onClose();
      } else {
        const err = await res.json();
        alert(err.error || '삭제에 실패했습니다.');
      }
    } catch (e) {
      alert('네트워크 오류로 삭제에 실패했습니다.');
    }
  }
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="rounded p-4 w-full max-w-2xl space-y-3" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold">{notice.title}</h2>
          <div className="flex gap-2">
            <button
              className="px-3 py-1 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              onClick={handleDelete}
            >
              삭제
            </button>
            <button
              className="px-3 py-1 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              onClick={onClose}
            >
              닫기
            </button>
          </div>
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
