"use client";

import type { ValidationError } from "../types";

export function SaveBar({
  dirty,
  saving,
  errors,
  onSave,
  onReset,
}: {
  dirty: boolean;
  saving: boolean;
  errors: ValidationError[];
  onSave: () => void;
  onReset: () => void;
}) {
  const disabled = saving || errors.length > 0 || !dirty;

  return (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        background: "white",
        border: "1px solid #eee",
        borderRadius: 12,
        padding: 12,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div style={{ fontSize: 13, opacity: 0.8 }}>
        {errors.length > 0 ? `저장 불가: 에러 ${errors.length}건` : dirty ? "변경사항 있음" : "변경사항 없음"}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onReset} disabled={saving || !dirty}>
          초기화
        </button>
        <button onClick={onSave} disabled={disabled}>
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}