export type JobStatus = 'open' | 'assigned' | 'review' | 'completed';

export interface Report {
  id: number;
  job_id: number;
  photo_url_1: string | null;
  photo_url_2: string | null;
  report_text: string | null;
  worker_name?: string | null;
  created_at?: string;
}

export interface Job {
  id: number;
  title: string;
  company: string;
  reward: string; // データベースではtext型
  location: string;
  status: JobStatus;
  description: string; // データベースのカラム名
  reference_image?: string | null; // 見本画像のURL
  feedback?: string | null; // 差し戻し理由
  created_at?: string;
}

// 表示用のヘルパー関数
export function formatReward(reward: string): string {
  // 数値として扱える場合は数値としてフォーマット
  const num = parseInt(reward);
  if (!isNaN(num)) {
    return `¥${num.toLocaleString()}`;
  }
  return reward;
}

export function parseReward(reward: string): number {
  // 数値に変換（表示用）
  const num = parseInt(reward);
  return isNaN(num) ? 0 : num;
}

