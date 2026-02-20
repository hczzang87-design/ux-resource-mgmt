import Link from "next/link";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// 월요일(주 시작) 구하기
function startOfWeekMonday(today = new Date()) {
  const d = new Date(today);
  const day = d.getDay(); // 0(일)~6(토)
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export default async function WeekPage() {
  // ✅ 월간 계산 잠깐 접고, 무조건 카드 뜨게: "오늘 기준 5주 카드"
  const baseMonday = startOfWeekMonday(new Date());

  const cards = Array.from({ length: 5 }).map((_, idx) => {
    const start = addDays(baseMonday, (idx - 2) * 7); // 과거 2주 ~ 미래 2주
    const end = addDays(start, 4);
    return {
      weekNoLabel: idx === 2 ? "이번 주" : idx < 2 ? `이전 ${2 - idx}주` : `다음 ${idx - 2}주`,
      start: toYMD(start),
      end: toYMD(end),
    };
  });

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>[NEW] 주차 카드</h1>
      <p style={{ marginTop: 8, opacity: 0.7 }}>
        카드를 눌러 해당 주의 입력 목록으로 이동해.
      </p>

      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {cards.map((c) => (
          <Link
            key={c.start}
            href={`/week/${c.start}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 16,
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div>
              <div style={{ fontWeight: 800 }}>{c.weekNoLabel}</div>
              <div style={{ marginTop: 4, fontSize: 13, opacity: 0.75 }}>
                {c.start} ~ {c.end}
              </div>
            </div>
            <div style={{ fontWeight: 700, opacity: 0.8 }}>입력 목록 보기 →</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
