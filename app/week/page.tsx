import Link from "next/link";

export default function WeekPage() {
  return (
    <main className="page-container">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
        주차 카드
      </h1>
      <p className="mt-2 text-sm text-zinc-600">
        카드를 눌러 해당 주의 입력 목록으로 이동해.
      </p>
      <div className="mt-4">
        <Link href="/" className="ui-btn">
          ← 메인으로
        </Link>
      </div>
    </main>
  );
}