import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const dbUrl = process.env.DATABASE_URL ?? 'file:./prisma/dev.db';
const dbPath = dbUrl.startsWith('file:') ? dbUrl.slice('file:'.length) : dbUrl;
const resolvedDbPath = resolve(process.cwd(), dbPath);
const schemaSqlPath = resolve(process.cwd(), 'prisma/generated-schema.sql');

mkdirSync(dirname(resolvedDbPath), { recursive: true });

const sql = readFileSync(schemaSqlPath, 'utf8')
  .replaceAll('CREATE TABLE ', 'CREATE TABLE IF NOT EXISTS ')
  .replaceAll('CREATE UNIQUE INDEX ', 'CREATE UNIQUE INDEX IF NOT EXISTS ');

const db = new Database(resolvedDbPath);
db.pragma('foreign_keys = ON');
db.exec(sql);
db.close();

