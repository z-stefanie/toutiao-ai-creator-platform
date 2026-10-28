import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { Draft } from '@/lib/types';
import type { DraftAck, DraftFields, DraftOperation } from '@/lib/drafts/fields';
import { prisma } from '@/server/db/prisma';
import { mapDraft } from '@/server/repositories/draft-record';

export type SaveDraftResult =
  | { status: 'applied' | 'replayed'; ack: DraftAck }
  | { status: 'conflict'; current: Draft }
  | { status: 'key_reused' | 'not_found' };

export function hashDraftOperation(input: Omit<DraftOperation, 'operationId'>) {
  const { expectedVersion, localRevision, kind, fields } = input;
  return createHash('sha256').update(JSON.stringify({ expectedVersion, localRevision, kind, fields: {
    title: fields.title, summary: fields.summary, body: fields.body, tags: fields.tags, assetIds: fields.assetIds
  } })).digest('hex');
}

export async function writeDraftSnapshot(tx: Prisma.TransactionClient, ownerId: string, draftId: string, version: number, reason: string, fields: DraftFields, now: Date) {
  await tx.draftSnapshot.create({ data: {
    id: randomUUID(), ownerId, draftId, version, reason,
    title: fields.title, summary: fields.summary, body: fields.body,
    tagsJson: JSON.stringify(fields.tags), assetIdsJson: JSON.stringify(fields.assetIds), createdAt: now
  } });
}

export async function trimDraftSnapshots(tx: Prisma.TransactionClient, draftId: string) {
  const expired = await tx.draftSnapshot.findMany({ where: { draftId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: 50, select: { id: true } });
  if (expired.length) await tx.draftSnapshot.deleteMany({ where: { id: { in: expired.map((row) => row.id) } } });
}

export async function saveDraftOperation(userId: string, draftId: string, input: DraftOperation & { requestHash: string }, now = new Date()): Promise<SaveDraftResult> {
  const where = { ownerId_draftId_operationId: { ownerId: userId, draftId, operationId: input.operationId } };
  const receipt = async (): Promise<SaveDraftResult | null> => {
    const saved = await prisma.draftMutation.findUnique({ where });
    if (!saved) return null;
    return saved.requestHash === input.requestHash ? { status: 'replayed', ack: JSON.parse(saved.ackJson) as DraftAck } : { status: 'key_reused' };
  };
  const existing = await receipt();
  if (existing) return existing;
  for (let attempt = 0; ; attempt += 1) {
    try {
      const applied = await prisma.$transaction(async (tx): Promise<SaveDraftResult | null> => {
        const before = input.kind !== 'edit' ? await tx.draft.findFirst({ where: { id: draftId, ownerId: userId } }) : null;
        const { fields } = input;
        const updated = await tx.draft.updateMany({
          where: { id: draftId, ownerId: userId, version: input.expectedVersion },
          data: { title: fields.title, summary: fields.summary, body: fields.body,
            tagsJson: JSON.stringify(fields.tags), assetIdsJson: JSON.stringify(fields.assetIds),
            version: { increment: 1 }, lastSavedAt: now, syncStatus: 'synced' }
        });
        if (updated.count !== 1) return null;
        const ack: DraftAck = { operationId: input.operationId, localRevision: input.localRevision, serverVersion: input.expectedVersion + 1, savedAt: now.toISOString() };
        await tx.draftMutation.create({ data: { ownerId: userId, draftId, operationId: input.operationId,
          requestHash: input.requestHash, ackJson: JSON.stringify(ack), createdAt: now } });
        if (before) {
          await writeDraftSnapshot(tx, userId, draftId, before.version, `${input.kind}_before`, mapDraft(before), now);
          await writeDraftSnapshot(tx, userId, draftId, ack.serverVersion, `${input.kind}_after`, fields, new Date(now.getTime() + 1));
        } else {
          const recent = await tx.draftSnapshot.findFirst({ where: { draftId, createdAt: { gte: new Date(now.getTime() - 10 * 60_000) } } });
          if (!recent) await writeDraftSnapshot(tx, userId, draftId, ack.serverVersion, 'autosave', fields, now);
        }
        await tx.draftMutation.deleteMany({ where: { ownerId: userId, draftId, createdAt: { lt: new Date(now.getTime() - 7 * 86400_000) } } });
        await trimDraftSnapshots(tx, draftId);
        return { status: 'applied', ack };
      }, { maxWait: 10_000, timeout: 10_000 });
      if (applied) return applied;
      break;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') break;
      const busy = error instanceof Error && /SQLITE_BUSY|database is locked|P1008|P2028|timed out|Transaction already closed/i.test(error.message);
      if (!busy || attempt >= 3) throw error;
      const replay = await receipt();
      if (replay) return replay;
      await new Promise((resolve) => setTimeout(resolve, 20 * 2 ** attempt));
    }
  }
  const replay = await receipt();
  if (replay) return replay;
  const current = await prisma.draft.findFirst({ where: { id: draftId, ownerId: userId } });
  return current ? { status: 'conflict', current: mapDraft(current) } : { status: 'not_found' };
}

export async function ownsDraft(ownerId: string, draftId: string) {
  return !!await prisma.draft.findFirst({ where: { id: draftId, ownerId }, select: { id: true } });
}

export async function listDraftSnapshots(ownerId: string, draftId: string) {
  if (!await ownsDraft(ownerId, draftId)) return null;
  return prisma.draftSnapshot.findMany({ where: { ownerId, draftId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, version: true, reason: true, title: true, createdAt: true } });
}

export async function getDraftSnapshot(ownerId: string, draftId: string, id: string) {
  if (!await ownsDraft(ownerId, draftId)) return null;
  const row = await prisma.draftSnapshot.findFirst({ where: { ownerId, draftId, id } });
  if (!row) return null;
  return { id: row.id, version: row.version, reason: row.reason, createdAt: row.createdAt,
    title: row.title, summary: row.summary, body: row.body, tags: JSON.parse(row.tagsJson) as string[], assetIds: JSON.parse(row.assetIdsJson) as string[] };
}
