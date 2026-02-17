import { supabaseServer } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";


function clampNumber(v: FormDataEntryValue | null) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return 0;
  return n;
}

export default async function DayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const supabase = supabaseServer();

  // ✅ 필요한 컬럼만
  const { data: existing, error } = await supabase
    .from("time_entries")
    .select("md, man_days, mandays, value")
    .eq("date", date)
    .limit(1)
    .maybeSingle();

  const readError = error?.message;

  const currentMd =
    Number(existing?.md ?? existing?.man_days ?? existing?.mandays ?? existing?.value ?? 0) || 0;

    async function save(formData: FormData) {
        "use server";
      
        const md = clampNumber(formData.get("md"));
        const supabase = supabaseServer();
      
        const { error: delError } = await supabase
          .from("time_entries")
          .delete()
          .eq("date", date)
          .eq("member_name", "me");
      
        if (delError) throw new Error(`DELETE 실패: ${delError.message}`);
      
        const { error: insError } = await supabase
          .from("time_entries")
          .insert({
            date,
            md,
            member_name: "me",
            category: "default",
            task_name: "default",
          });
      
        if (insError) throw new Error(`INSERT 실패: ${insError.message}`);
      
        redirect("/week"); // 👈 여기
      }
      

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>{date} 입력</h1>

      {readError ? (
        <p style={{ marginTop: 12 }}>
          Supabase 조회 에러: <b>{readError}</b>
        </p>
      ) : null}

      <form action={save} style={{ marginTop: 16, display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 700 }}>md</span>
          <input
            name="md"
            type="number"
            step="1"
            defaultValue={currentMd}
            style={{
              padding: 12,
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              fontSize: 16,
            }}
          />
        </label>

        <button
          type="submit"
          style={{
            padding: 12,
            borderRadius: 10,
            border: "1px solid #111827",
            fontWeight: 800,
          }}
        >
          저장
        </button>
      </form>
    </main>
  );
}