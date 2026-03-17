import Link from "next/link";

export default function WeekDetailPage({ params }: { params: { week: string } }) {
  return (
    <main className="page-container">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
        주간 상세: {params.week}
      </h1>
      <div className="mt-4">
        <Link href="/week" className="ui-btn">
          ← 주차 카드
        </Link>
      </div>
    </main>
  );
}