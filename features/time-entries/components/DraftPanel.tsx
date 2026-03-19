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
    <div className="ui-card ui-card-pad">
      <div className="mb-2 text-sm font-semibold text-zinc-900">Draft</div>
      <div className="text-sm text-zinc-600">추가: {added}</div>
      <div className="text-sm text-zinc-600">수정: {edited}</div>
      <div className="text-sm text-zinc-600">삭제: {deleted}</div>
      <div className={`mt-2 text-sm ${errorsCount ? "text-red-600" : "text-zinc-600"}`}>
        검증 에러: {errorsCount}
      </div>
    </div>
  );
}