import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';

const archivePath = path.join('dist', 'toutiao-ai-creator-platform-submission-2026-06-11.zip');

const blockedPatterns = [
  /^\.env(?:\.|$)/,
  /^node_modules\//,
  /^\.next\//,
  /^dist\//,
  /^out\//,
  /^coverage\//,
  /^artifacts\//,
  /^test-results\//,
  /^playwright-report\//,
  /^\.git\//,
  /^prisma\/dev\.db$/,
  /^prisma\/generated-schema\.sql$/,
  /(^|\/)\.DS_Store$/,
  /\.log$/,
  /\.tsbuildinfo$/
];

const secretPatterns = [
  { name: 'ark token', regex: /ark-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[A-Za-z0-9]{4,}/gi },
  { name: 'openai sk', regex: /sk-[A-Za-z0-9]{32,}/g },
  { name: 'openai project sk', regex: /sk-proj-[A-Za-z0-9_-]{20,}/g },
  {
    name: 'non-placeholder API key assignment',
    regex: /(?:AI_API_KEY|OPENAI_API_KEY)\s*=\s*(?![<"']?(?:api-key|your-api-key|$))[A-Za-z0-9_ .:/@-]{12,}/g
  }
];

function isBlocked(file) {
  return blockedPatterns.some((pattern) => pattern.test(file));
}

function listCandidateFiles() {
  const output = execFileSync(
    'git',
    ['-c', 'core.quotePath=false', 'ls-files', '--cached', '--others', '--exclude-standard'],
    { encoding: 'utf8' }
  );
  return output
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean)
    .filter((file) => !isBlocked(file))
    .sort();
}

function scanForSecrets(files) {
  const hits = [];
  for (const file of files) {
    let content;
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    for (const { name, regex } of secretPatterns) {
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(content))) {
        const line = content.slice(0, match.index).split(/\r?\n/).length;
        hits.push({ file, line, kind: name });
      }
    }
  }
  return hits;
}

const files = listCandidateFiles();
if (files.length === 0) {
  console.error('No files found for submission archive.');
  process.exit(1);
}

const blocked = files.filter(isBlocked);
if (blocked.length > 0) {
  console.error(JSON.stringify({ ok: false, reason: 'blocked files selected', blocked }, null, 2));
  process.exit(1);
}

const secretHits = scanForSecrets(files);
if (secretHits.length > 0) {
  console.error(JSON.stringify({ ok: false, reason: 'possible secrets found', hits: secretHits }, null, 2));
  process.exit(1);
}

mkdirSync(path.dirname(archivePath), { recursive: true });
if (existsSync(archivePath)) unlinkSync(archivePath);

const zip = spawnSync('zip', ['-q', '-@', archivePath], {
  input: `${files.join('\n')}\n`,
  encoding: 'utf8',
  stdio: ['pipe', 'inherit', 'inherit']
});

if (zip.status !== 0) {
  process.exit(zip.status ?? 1);
}

const entries = execFileSync('zipinfo', ['-1', archivePath], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);
if (entries.length !== files.length) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        reason: 'archive entry count mismatch',
        selectedFileCount: files.length,
        archiveEntryCount: entries.length
      },
      null,
      2
    )
  );
  process.exit(1);
}
const unsafeEntries = entries.filter(isBlocked);
if (unsafeEntries.length > 0) {
  console.error(JSON.stringify({ ok: false, reason: 'unsafe archive entries found', unsafeEntries }, null, 2));
  process.exit(1);
}

const size = statSync(archivePath).size;
console.log(
  JSON.stringify(
    {
      ok: true,
      archive: archivePath,
      fileCount: files.length,
      size
    },
    null,
    2
  )
);
