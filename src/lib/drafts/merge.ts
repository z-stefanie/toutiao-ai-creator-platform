import { diff3, type ParagraphBlock } from '@/lib/drafts/diff3';
import { normalizeFields, splitParagraphs, type DraftFields } from '@/lib/drafts/fields';

export type MergeConflict = { id: string; field: 'title' | 'summary' | 'body'; local: string; remote: string };
export type MergeChoice = 'local' | 'remote' | 'both';
export type MergeSuggestion = { fields: DraftFields; conflicts: MergeConflict[]; body: ParagraphBlock[]; remoteChanges: string[] };

function mergeSet(base: string[], local: string[], remote: string[]) {
  return [...new Set([...local, ...remote])].filter((value) => !base.includes(value) || (local.includes(value) && remote.includes(value))).sort();
}

export function mergeDraft(base: DraftFields, local: DraftFields, remote: DraftFields): MergeSuggestion {
  const fields = normalizeFields(local);
  const conflicts: MergeConflict[] = [];
  for (const field of ['title', 'summary'] as const) {
    if (local[field] === base[field]) fields[field] = remote[field];
    else if (remote[field] !== base[field] && local[field] !== remote[field]) {
      conflicts.push({ id: field, field, local: local[field], remote: remote[field] });
    }
  }
  const body = diff3(splitParagraphs(base.body), splitParagraphs(local.body), splitParagraphs(remote.body));
  body.forEach((block, index) => {
    if (!block.merged) conflicts.push({ id: `body-${index}`, field: 'body', local: block.local.join('\n\n'), remote: block.remote.join('\n\n') });
  });
  fields.body = body.flatMap((block) => block.merged ?? block.local).join('\n\n');
  fields.tags = mergeSet(base.tags, local.tags, remote.tags);
  fields.assetIds = mergeSet(base.assetIds, local.assetIds, remote.assetIds);
  const labels = { title: '标题', summary: '摘要', body: '正文', tags: '标签', assetIds: '素材' };
  const remoteChanges = (Object.keys(labels) as Array<keyof DraftFields>).filter((key) => JSON.stringify(base[key]) !== JSON.stringify(remote[key])).map((key) => labels[key]);
  return { fields, conflicts, body, remoteChanges };
}

export function chooseMerge(suggestion: MergeSuggestion, choices: Record<string, MergeChoice>): DraftFields {
  const fields = { ...suggestion.fields };
  for (const conflict of suggestion.conflicts) {
    const choice = choices[conflict.id];
    if (!choice) throw new Error('请先处理全部冲突项');
    if (conflict.field !== 'body') fields[conflict.field] = choice === 'remote' ? conflict.remote : conflict.local;
  }
  fields.body = suggestion.body.flatMap((block, index) => block.merged ?? (
    choices[`body-${index}`] === 'both' ? [...block.remote, ...block.local] : choices[`body-${index}`] === 'remote' ? block.remote : block.local
  )).join('\n\n');
  return normalizeFields(fields);
}
