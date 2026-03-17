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
    <div className="sticky bottom-4 flex items-center justify-between gap-3 ui-card ui-card-pad">
      <div className="text-sm text-zinc-600">
        {errors.length > 0
          ? `저장 불가: 에러 ${errors.length}건`
          : dirty
            ? "변경사항 있음"
            : "변경사항 없음"}
      </div>

      <div className="flex items-center gap-2">
        <button className="ui-btn" onClick={onReset} disabled={saving || !dirty}>
          초기화
        </button>
        <button
          className="ui-btn ui-btn-primary disabled:opacity-60"
          onClick={onSave}
          disabled={disabled}
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}