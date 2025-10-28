"use client";

import { useState } from "react";

type Props = {
  onClose: () => void;
  onCreated: () => void;
};

export default function CreateNoticeModal({ onClose, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [author, setAuthor] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!title.trim()) return alert("제목을 입력해주세요.");
    if (!content.trim()) return alert("내용을 입력해주세요.");

    setLoading(true);
    try {
      const res = await fetch("/api/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          imageUrl: imageUrl || null,
          author: author || "관리자"
        }),
      });

      if (res.ok) {
        onCreated();
        onClose();
      } else {
        const error = await res.json();
        alert(error.error || "공지 작성에 실패했습니다.");
      }
    } catch (err) {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="rounded p-4 w-full max-w-md space-y-3" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <h2 className="text-lg font-semibold">공지사항 작성</h2>
        
        <input
          className="w-full border rounded px-2 py-1"
          placeholder="제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        
        <input
          className="w-full border rounded px-2 py-1"
          placeholder="작성자 (선택사항)"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
        />
        
        <textarea
          className="w-full border rounded px-2 py-1 h-24 resize-none"
          placeholder="내용"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        
        <input
          className="w-full border rounded px-2 py-1"
          placeholder="이미지 URL (선택사항)"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
        />

        <div className="flex justify-end gap-2">
          <button
            className="px-3 py-1 rounded border hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            onClick={onClose}
            disabled={loading}
          >
            취소
          </button>
          <button
            className="px-3 py-1 rounded text-black disabled:opacity-50 transition-colors cursor-pointer"
            style={{ backgroundColor: "#FDC205" }}
            onClick={submit}
            disabled={loading}
          >
            {loading ? "작성 중..." : "작성"}
          </button>
        </div>
      </div>
    </div>
  );
}
