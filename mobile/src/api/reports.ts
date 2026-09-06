import client from './client';

// Мирror of backend/models/report.model.js REPORT_REASONS: stable keys go to
// the API, labels are a client concern (see ReportSheet).
export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate'
  | 'violence'
  | 'sexual'
  | 'illegal'
  | 'scam'
  | 'misinformation'
  | 'copyright'
  | 'other';

export type ReportTargetType = 'post' | 'loop' | 'comment' | 'user' | 'listing';

export interface SubmitReportInput {
  targetType: ReportTargetType;
  targetId: string;
  /** Для listing — ключ раздела маркета (cars, parts, …). */
  targetKind?: string;
  reason: ReportReason;
  comment?: string;
}

export async function submitReport(input: SubmitReportInput) {
  const { data } = await client.post('/reports', input);
  return data as { _id: string; status: string; createdAt: string };
}
