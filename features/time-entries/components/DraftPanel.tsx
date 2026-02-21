"use client";

export function DraftPanel({
  added,
  edited,
  deleted,
  errorsCount,
}: {
  added: number;
  edited: number;
  deleted: number;
  errorsCount: number;
}) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>Draft</div>
      <div style={{ fontSize: 13, opacity: 0.8 }}>추가: {added}</div>
      <div style={{ fontSize: 13, opacity: 0.8 }}>수정: {edited}</div>
      <div style={{ fontSize: 13, opacity: 0.8 }}>삭제: {deleted}</div>
      <div style={{ fontSize: 13, marginTop: 8, color: errorsCount ? "crimson" : "inherit" }}>
        검증 에러: {errorsCount}
      </div>
    </div>
  );
}