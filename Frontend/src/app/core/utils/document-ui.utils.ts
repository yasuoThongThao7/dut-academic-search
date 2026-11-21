import type { Document } from '../models/api.models';

export function trustClass(doc: Pick<Document, 'trust'>): string {
  return 'trust-badge trust-' + (doc.trust?.code ?? 'INSUFFICIENT').toLowerCase();
}

export function trustLabel(doc: Pick<Document, 'trust'>): string {
  return doc.trust?.label ?? 'Chưa đủ đánh giá';
}

export function helpfulPercent(doc: Pick<Document, 'helpfulRatio'>): string {
  return doc.helpfulRatio == null ? '—' : `${Math.round(doc.helpfulRatio * 100)}%`;
}
