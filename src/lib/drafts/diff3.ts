export type ParagraphBlock = { base: string[]; local: string[]; remote: string[]; merged?: string[] };
type Change = { start: number; end: number; values: string[] };

export function lcsPairs(base: string[], changed: string[]) {
  const table = Array.from({ length: base.length + 1 }, () => new Uint32Array(changed.length + 1));
  for (let i = base.length - 1; i >= 0; i -= 1) {
    for (let j = changed.length - 1; j >= 0; j -= 1) {
      table[i][j] = base[i] === changed[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const pairs: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < base.length && j < changed.length) {
    if (base[i] === changed[j]) {
      pairs.push([i++, j++]);
    } else if (table[i + 1][j] >= table[i][j + 1]) i += 1;
    else j += 1;
  }
  return pairs;
}

function changes(base: string[], changed: string[]): Change[] {
  const result: Change[] = [];
  let start = 0;
  let offset = 0;
  for (const [i, j] of [...lcsPairs(base, changed), [base.length, changed.length]]) {
    if (i > start || j > offset) result.push({ start, end: i, values: changed.slice(offset, j) });
    start = i + 1;
    offset = j + 1;
  }
  return result;
}

function apply(base: string[], start: number, end: number, edits: Change[]) {
  const result: string[] = [];
  let cursor = start;
  for (const edit of edits) {
    result.push(...base.slice(cursor, edit.start), ...edit.values);
    cursor = edit.end;
  }
  return [...result, ...base.slice(cursor, end)];
}

const same = (left: string[], right: string[]) => JSON.stringify(left) === JSON.stringify(right);

export function diff3(base: string[], local: string[], remote: string[]): ParagraphBlock[] {
  const edits = [
    ...changes(base, local).map((change) => ({ ...change, side: 'local' })),
    ...changes(base, remote).map((change) => ({ ...change, side: 'remote' }))
  ].sort((a, b) => a.start - b.start || a.end - b.end);
  const blocks: ParagraphBlock[] = [];
  let cursor = 0;
  for (let i = 0; i < edits.length;) {
    const start = edits[i].start;
    if (start > cursor) {
      const stable = base.slice(cursor, start);
      blocks.push({ base: stable, local: stable, remote: stable, merged: stable });
    }
    const group = [edits[i++]];
    let end = group[0].end;
    while (i < edits.length && (edits[i].start < end || edits[i].start === start)) {
      end = Math.max(end, edits[i].end);
      group.push(edits[i++]);
    }
    const original = base.slice(start, end);
    const mine = apply(base, start, end, group.filter((edit) => edit.side === 'local'));
    const theirs = apply(base, start, end, group.filter((edit) => edit.side === 'remote'));
    const merged = same(mine, original) ? theirs : same(theirs, original) || same(mine, theirs) ? mine : undefined;
    blocks.push({ base: original, local: mine, remote: theirs, merged });
    cursor = end;
  }
  if (cursor < base.length) {
    const stable = base.slice(cursor);
    blocks.push({ base: stable, local: stable, remote: stable, merged: stable });
  }
  return blocks;
}
