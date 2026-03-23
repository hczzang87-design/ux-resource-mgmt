/**
 * 월간 대시보드 UI용 파생 데이터 (fetch/API·기존 집계 로직 없음, `data` 표시용 가공만).
 */
import { mdToHours } from "@/features/time-entries/lib/hours";

export type MonthSummaryLike = {
  totals: { md: number; ot: number };
  members: Array<{
    member_name: string;
    totals: { md: number; ot: number };
    tasks: Array<{
      category: string;
      task_name: string;
      md: number;
      ot: number;
    }>;
  }>;
};

export type MonthInsightItem = {
  id:
    | "resource-external"
    | "resource-misc"
    | "overtime-load"
    | "task-focus";
  /** 리스트 렌더 시 카드별 고유 키 (동일 id 중복 방지) */
  key: string;
  title: string;
  description: string;
};

export type CategoryDonutDatum = { name: string; value: number };
export type MemberBarDatum = {
  name: string;
  hours: number;
  otHours: number;
  hasOtAlert: boolean;
};
export type TaskBarDatum = { name: string; hours: number };

/** 차트 카드 하단 데이터 기반 설명 */
export type MonthChartCaptions = {
  resourceDistribution: string;
  memberLoad: string;
  taskFocus: string;
};

export type MonthDashboardDerived = {
  insights: MonthInsightItem[];
  chartCaptions: MonthChartCaptions;
  categoryDonut: CategoryDonutDatum[];
  memberBars: MemberBarDatum[];
  taskBars: TaskBarDatum[];
};

function roundDisplayHours(h: number) {
  return Math.round(h * 10) / 10;
}

function pctWhole(share: number) {
  return Math.min(100, Math.max(0, Math.round(share * 100)));
}

const EXCLUDED_MISC = "기타";

/** 핵심 인사이트: 해당 카테고리가 전체 MD의 이 비율 이상이면 표시 */
const CATEGORY_ALERT_THRESHOLD = 0.15;
/** API/입력에서 쓰는 카테고리명과 정확히 일치해야 함 */
const CATEGORY_EXTERNAL_REQUEST = "외부 리퀘스트";
const CATEGORY_MISC_INSIGHT = "기타";

/** 업무 집중도: 카테고리 또는 업무명이 「기타」인 행은 제외 */
function excludeFromTaskFocus(category: string, taskName: string) {
  const c = (category || "").trim();
  const t = (taskName || "").trim();
  return c === EXCLUDED_MISC || t === EXCLUDED_MISC;
}

/** 카테고리 MD 합계 기준 최상위 (도넛 value 반올림과 무관하게 실제 MD로 최대값 판단) */
function topCategoryByMd(catMap: Map<string, number>, totalMdSum: number) {
  if (totalMdSum <= 0 || catMap.size === 0) return null;
  const sorted = [...catMap.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko")
  );
  const [name, md] = sorted[0]!;
  return {
    name,
    md,
    share: md / totalMdSum,
    hours: roundDisplayHours(mdToHours(md)),
  };
}

export function computeMonthDashboardDerived(
  data: MonthSummaryLike
): MonthDashboardDerived {
  const catMap = new Map<string, number>();
  const taskMap = new Map<string, number>();
  const taskMapNoMisc = new Map<string, number>();
  let totalMdSum = 0;

  for (const m of data.members) {
    for (const t of m.tasks) {
      const md = Number(t.md ?? 0);
      totalMdSum += md;
      const cat = (t.category || "").trim() || "미분류";
      catMap.set(cat, (catMap.get(cat) ?? 0) + md);
      const taskName = (t.task_name || "").trim() || "—";
      taskMap.set(taskName, (taskMap.get(taskName) ?? 0) + md);
      if (!excludeFromTaskFocus(cat, taskName)) {
        taskMapNoMisc.set(
          taskName,
          (taskMapNoMisc.get(taskName) ?? 0) + md
        );
      }
    }
  }

  const insights: MonthInsightItem[] = [];
  const totalHoursAll = roundDisplayHours(mdToHours(totalMdSum));

  /* --- 외부 리퀘스트 / 기타: 각각 전체 투입(MD)의 15% 이상일 때만 인사이트 --- */
  if (totalMdSum > 0) {
    const extMd = catMap.get(CATEGORY_EXTERNAL_REQUEST) ?? 0;
    const extShare = extMd / totalMdSum;
    if (extShare >= CATEGORY_ALERT_THRESHOLD) {
      const p = pctWhole(extShare);
      const h = roundDisplayHours(mdToHours(extMd));
      insights.push({
        id: "resource-external",
        key: "resource-external",
        title: "외부 리퀘스트 비중",
        description: `「${CATEGORY_EXTERNAL_REQUEST}」 ${p}%·${h}h (전체 ${totalHoursAll}h 중, 15% 기준 이상)`,
      });
    }

    const miscMd = catMap.get(CATEGORY_MISC_INSIGHT) ?? 0;
    const miscShare = miscMd / totalMdSum;
    if (miscShare >= CATEGORY_ALERT_THRESHOLD) {
      const p = pctWhole(miscShare);
      const h = roundDisplayHours(mdToHours(miscMd));
      insights.push({
        id: "resource-misc",
        key: "resource-misc",
        title: "기타 업무 비중",
        description: `「${CATEGORY_MISC_INSIGHT}」 ${p}%·${h}h (전체 ${totalHoursAll}h 중, 15% 기준 이상)`,
      });
    }
  }

  /* --- OT: 0 초과, 숫자·대상 포함 --- */
  const otMembers = data.members
    .map((m) => ({
      name: m.member_name,
      otHours: mdToHours(m.totals.ot),
    }))
    .filter((x) => x.otHours > 0)
    .sort((a, b) => b.otHours - a.otHours || a.name.localeCompare(b.name, "ko"));

  if (otMembers.length >= 2) {
    const max = otMembers[0]!;
    const maxH = roundDisplayHours(max.otHours);
    insights.push({
      id: "overtime-load",
      key: "overtime-load",
      title: "인원 부하 · OT",
      description: `${otMembers.length}명 OT 발생 (${max.name} ${maxH}h 최다)`,
    });
  } else if (otMembers.length === 1) {
    const only = otMembers[0]!;
    const h = roundDisplayHours(only.otHours);
    insights.push({
      id: "overtime-load",
      key: "overtime-load",
      title: "인원 부하 · OT",
      description: `1명 OT 발생 (${only.name} ${h}h)`,
    });
  }

  /* --- 업무 집중도: 기타 제외, Top2 / 합계 ≥ 70% --- */
  const totalTaskMdExcluded = [...taskMapNoMisc.values()].reduce(
    (s, v) => s + v,
    0
  );
  const totalTaskHExcluded = roundDisplayHours(mdToHours(totalTaskMdExcluded));

  if (totalTaskMdExcluded > 0) {
    const taskEntriesEx = [...taskMapNoMisc.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko")
    );
    if (taskEntriesEx.length >= 2) {
      const [n1, m1] = taskEntriesEx[0]!;
      const [n2, m2] = taskEntriesEx[1]!;
      const top2sum = m1 + m2;
      const ratio2 = top2sum / totalTaskMdExcluded;
      if (ratio2 >= 0.7) {
        const p = pctWhole(ratio2);
        const h1 = roundDisplayHours(mdToHours(m1));
        const h2 = roundDisplayHours(mdToHours(m2));
        const top2h = roundDisplayHours(mdToHours(top2sum));
        insights.push({
          id: "task-focus",
          key: "task-focus",
          title: "업무 집중도 높음",
          description: `「${n1}」·「${n2}」 2개 업무 ${p}%·${top2h}h (기타 제외 ${totalTaskHExcluded}h 중 상위 2개)`,
        });
      }
    }
  }

  const categoryDonut: CategoryDonutDatum[] = [...catMap.entries()].map(
    ([name, md]) => ({
      name,
      value: roundDisplayHours(mdToHours(md)),
    })
  );

  const memberBars: MemberBarDatum[] = data.members.map((m) => {
    const otH = mdToHours(m.totals.ot);
    return {
      name: m.member_name,
      hours: roundDisplayHours(mdToHours(m.totals.md)),
      otHours: roundDisplayHours(otH),
      hasOtAlert: otH > 0,
    };
  });

  const sortedTasks = [...taskMap.entries()].sort((a, b) => b[1] - a[1]);
  const top3 = sortedTasks.slice(0, 3);
  const restMd = sortedTasks.slice(3).reduce((s, [, v]) => s + v, 0);
  const taskBars: TaskBarDatum[] = top3.map(([name, md]) => ({
    name,
    hours: roundDisplayHours(mdToHours(md)),
  }));
  if (restMd > 0) {
    taskBars.push({
      name: "기타",
      hours: roundDisplayHours(mdToHours(restMd)),
    });
  }

  const chartCaptions = buildChartCaptions({
    catMap,
    totalMdSum,
    otMembers,
    taskMapNoMisc,
    totalTaskMdExcluded,
  });

  return {
    insights,
    chartCaptions,
    categoryDonut,
    memberBars,
    taskBars,
  };
}

function buildChartCaptions(args: {
  catMap: Map<string, number>;
  totalMdSum: number;
  otMembers: { name: string; otHours: number }[];
  taskMapNoMisc: Map<string, number>;
  totalTaskMdExcluded: number;
}): MonthChartCaptions {
  const { catMap, totalMdSum, otMembers, taskMapNoMisc, totalTaskMdExcluded } =
    args;

  let resourceDistribution: string;
  const topCat = topCategoryByMd(catMap, totalMdSum);
  if (!topCat) {
    resourceDistribution =
      "카테고리 0건·0h (표시할 투입 데이터 없음)";
  } else {
    const p = pctWhole(topCat.share);
    const totalH = roundDisplayHours(mdToHours(totalMdSum));
    resourceDistribution = `「${topCat.name}」 최대 비중 ${p}%·${topCat.hours}h (전체 ${totalH}h 중)`;
    if (topCat.name === EXCLUDED_MISC) {
      resourceDistribution += " · 업무 분류 체계 개선 필요";
    }
  }

  let memberLoad: string;
  if (otMembers.length === 0) {
    memberLoad = "OT 0명 (발생 인원 없음)";
  } else {
    const max = otMembers[0]!;
    const maxH = roundDisplayHours(max.otHours);
    memberLoad = `${otMembers.length}명 OT (${max.name} ${maxH}h 최다)`;
  }

  let taskFocus: string;
  if (totalTaskMdExcluded <= 0) {
    taskFocus =
      "기타 제외 업무 0h (집중도 분석 대상 없음)";
  } else {
    const entries = [...taskMapNoMisc.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko")
    );
    if (entries.length >= 2) {
      const [n1, m1] = entries[0]!;
      const [n2, m2] = entries[1]!;
      const top2sum = m1 + m2;
      const ratio = top2sum / totalTaskMdExcluded;
      const p2 = pctWhole(ratio);
      const h1 = roundDisplayHours(mdToHours(m1));
      const h2 = roundDisplayHours(mdToHours(m2));
      const top2h = roundDisplayHours(mdToHours(top2sum));
      const totalExH = roundDisplayHours(mdToHours(totalTaskMdExcluded));
      if (ratio >= 0.7) {
        taskFocus = `「${n1}」${h1}h·「${n2}」${h2}h 상위 2개 ${p2}%·${top2h}h (기타 제외 ${totalExH}h 중 대부분)`;
      } else {
        taskFocus = `「${n1}」${h1}h·「${n2}」${h2}h 상위 2개 ${p2}%·${top2h}h (기타 제외 ${totalExH}h 중)`;
      }
    } else if (entries.length === 1) {
      const [n, md] = entries[0]!;
      const h = roundDisplayHours(mdToHours(md));
      const totalExH = roundDisplayHours(mdToHours(totalTaskMdExcluded));
      taskFocus = `「${n}」 단일 업무 ${h}h (기타 제외 합계 ${totalExH}h 전부)`;
    } else {
      taskFocus = "기타 제외 업무 항목 0건";
    }
  }

  return { resourceDistribution, memberLoad, taskFocus };
}
