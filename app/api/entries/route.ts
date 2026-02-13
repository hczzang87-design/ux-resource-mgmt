import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  try {
    const supabase = supabaseServer();

    const { data, error } = await supabase
      .from("time_entries")
      .select("*")
      .limit(10);

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          hint: error.hint,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("API route error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    
    // 환경 변수 누락 에러인 경우 더 명확한 메시지
    if (errorMessage.includes("Missing SUPABASE_URL") || errorMessage.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return NextResponse.json(
        {
          error: "환경 변수가 설정되지 않았습니다.",
          message: "SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 .env.local 파일에 설정해주세요.",
          example: {
            SUPABASE_URL: "https://your-project.supabase.co",
            SUPABASE_SERVICE_ROLE_KEY: "your-service-role-key"
          }
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}