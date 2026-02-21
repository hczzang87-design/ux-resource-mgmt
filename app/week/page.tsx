import Link from "next/link";

export default function WeekPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>주차 카드</h1>
      <p style={{ opacity: 0.7 }}>카드를 눌러 해당 주의 입력 목록으로 이동해.</p>
      <Link href="/">← 메인으로</Link>
    </main>
  );
}