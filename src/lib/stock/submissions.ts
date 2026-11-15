import { kv } from '@/lib/kv';
import type { PlatformId } from './types';

/**
 * Submission planner state: per item × platform status, persisted locally.
 * Powers the per-platform queues, caps (Freepik first batch / monthly limit)
 * and the "what did I send where" memory every multi-agency contributor needs.
 */

export type SubmissionStatus = 'todo' | 'queued' | 'submitted' | 'accepted' | 'rejected';

export interface SubmissionRecord {
  status: SubmissionStatus;
  at: string;
}

export type SubmissionMap = Record<string, Partial<Record<PlatformId, SubmissionRecord>>>;

const KEY = 'msap:submissions';

export const STATUS_ORDER: SubmissionStatus[] = ['todo', 'queued', 'submitted', 'accepted', 'rejected'];

export const STATUS_TONE: Record<SubmissionStatus, 'neutral' | 'brand' | 'warn' | 'ok' | 'danger'> = {
  todo: 'neutral',
  queued: 'brand',
  submitted: 'warn',
  accepted: 'ok',
  rejected: 'danger',
};

export async function loadSubmissions(): Promise<SubmissionMap> {
  return kv.get<SubmissionMap>(KEY, {});
}

export async function saveSubmissions(map: SubmissionMap): Promise<void> {
  await kv.set(KEY, map);
}

export function setStatus(map: SubmissionMap, itemId: string, platform: PlatformId, status: SubmissionStatus): SubmissionMap {
  return { ...map, [itemId]: { ...map[itemId], [platform]: { status, at: new Date().toISOString() } } };
}

export function statusOf(map: SubmissionMap, itemId: string, platform: PlatformId): SubmissionStatus {
  return map[itemId]?.[platform]?.status ?? 'todo';
}

export function countByStatus(map: SubmissionMap, platform: PlatformId): Record<SubmissionStatus, number> {
  const counts: Record<SubmissionStatus, number> = { todo: 0, queued: 0, submitted: 0, accepted: 0, rejected: 0 };
  for (const item of Object.values(map)) {
    const status = item[platform]?.status;
    if (status) counts[status]++;
  }
  return counts;
}

/** Platform publishing caps researched Nov 2026. */
export const PLATFORM_CAPS: Partial<Record<PlatformId, { monthly?: number; firstBatch?: [number, number]; note: string }>> = {
  freepik: {
    monthly: 200,
    firstBatch: [150, 200],
    note: 'First submission must be 150-200 files, all the same format; afterwards 200 files/month across at most 200 in the upload folder.',
  },
};
