"use client";

import type { MonthInsightRichBody } from "./_monthDashboardDerived";

const num = "font-semibold tabular-nums text-foreground";
const numAccent = "font-semibold tabular-nums text-primary";
const muted = "text-muted-foreground";
const quote = "font-semibold text-foreground";

export function MonthInsightCardBody({ body }: { body: MonthInsightRichBody }) {
  switch (body.variant) {
    case "category":
      return (
        <p className="text-base leading-relaxed">
          <span className={quote}>「{body.quote}」</span>{" "}
          <span className={num}>{body.percent}%</span>
          <span className={numAccent}> ({body.hours}h)</span>
        </p>
      );
    case "ot_multi":
      return (
        <p className="text-base leading-relaxed">
          <span className={num}>{body.count}명</span>
          <span className={muted}> OT 발생</span>
        </p>
      );
    case "ot_single":
      return (
        <p className="text-base leading-relaxed">
          <span className={num}>1명</span>
          <span className={muted}> OT 발생 · </span>
          <span className={quote}>{body.name}</span>
          <span className={numAccent}> {body.hours}h</span>
        </p>
      );
    case "task_focus":
      return (
        <p className="text-base leading-relaxed">
          <span className={quote}>「{body.name1}」</span>
          <span className={muted}> · </span>
          <span className={quote}>「{body.name2}」</span>
          <span className={muted}> 2개 업무 </span>
          <span className={num}>{body.percent}%</span>
          <span className={numAccent}> ({body.top2h}h)</span>
        </p>
      );
    default:
      return null;
  }
}
