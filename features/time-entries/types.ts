export type TimeEntry = {
    id?: string;
    created_at?: string;
    member_name: string;
    date: string; // YYYY-MM-DD
    category?: string;
    task_name: string;
    md: number;
    overtime_md: number;
  };
  
  export type EntryKey = string;
  
  export type DraftStats = {
    dirty: boolean;
    added: number;
    edited: number;
    deleted: number;
  };
  
  export type ValidationError = {
    member_name: string;
    date: string;
    totalMd: number;
    limit: number;
  };
  
  // ✅ 이 줄은 “이 파일이 모듈이다”를 강제로 보장하는 안전장치
  export {};