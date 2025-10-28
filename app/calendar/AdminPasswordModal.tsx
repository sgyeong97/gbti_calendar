"use client";

import { useState } from "react";

type Props = {
  onClose: () => void;
  onSuccess: () => void;
};

export default function AdminPasswordModal({ onClose, onSuccess }: Props) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!password.trim()) return alert("비밀번호를 입력해주세요.");

    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        alert("비밀번호가 올바르지 않습니다.");
      }
    } catch (err) {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="rounded p-4 w-full max-w-sm space-y-3" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <h2 className="text-lg font-semibold">관리자 인증</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">공지사항 작성을 위해 관리자 비밀번호를 입력해주세요.</p>
        
        <input
          className="w-full border rounded px-2 py-1"
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
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
            {loading ? "확인 중..." : "확인"}
          </button>
        </div>
      </div>
    </div>
  );
}
