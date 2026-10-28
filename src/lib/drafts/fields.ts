import type { Draft } from '@/lib/types';

export type DraftFields = Pick<Draft, 'title' | 'summary' | 'body' | 'tags' | 'assetIds'>;
export type DraftKind = 'edit' | 'merge' | 'restore';
export type DraftOperation = {
  operationId: string;
  expectedVersion: number;
  localRevision: number;
  kind: DraftKind;
  fields: DraftFields;
};
export type DraftAck = {
  operationId: string;
  localRevision: number;
  serverVersion: number;
  savedAt: string;
};

export function normalizeFields(fields: DraftFields): DraftFields {
  return {
    title: fields.title,
    summary: fields.summary,
    body: fields.body.replace(/\r\n/g, '\n'),
    tags: [...new Set(fields.tags.map((tag) => tag.trim()).filter(Boolean))].sort(),
    assetIds: [...new Set(fields.assetIds)].sort()
  };
}

export function sameFields(left: DraftFields, right: DraftFields) {
  return JSON.stringify(normalizeFields(left)) === JSON.stringify(normalizeFields(right));
}

export function splitParagraphs(body: string) {
  return body.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
}

export function parseTags(text: string) {
  return [...new Set(text.split(/[，,]/).map((tag) => tag.trim()).filter(Boolean))].sort();
}
