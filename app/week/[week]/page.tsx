import Link from "next/link";

export default function WeekDetailPage({ params }: { params: { week: string } }) {
  return (
    <main style={{ padding: 24 }}>
      <h1>주간 상세: {params.week}</h1>
      <Link href="/week">← 주차 카드</Link>
    </main>
  );
}