import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import Database from 'better-sqlite3';

const checks = [
  {
    name: 'bcrypt',
    run: async () => {
      const password = randomBytes(18).toString('base64url');
      const hash = await bcrypt.hash(password, 10);
      const matches = await bcrypt.compare(password, hash);
      const rejectsWrong = await bcrypt.compare(randomBytes(18).toString('base64url'), hash);
      if (hash === password || !matches || rejectsWrong) {
        throw new Error('hash/compare round-trip did not verify');
      }
      return 'hash/compare round-trip passed';
    },
  },
  {
    name: 'better-sqlite3',
    run: () => {
      const db = new Database(':memory:');
      try {
        db.exec('CREATE TABLE smoke (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
        db.prepare('INSERT INTO smoke (value) VALUES (?)').run('ok');
        const row = db.prepare('SELECT value FROM smoke WHERE id = 1').get();
        if (!row || row.value !== 'ok') {
          throw new Error('in-memory insert/select did not return the inserted row');
        }
        return 'in-memory create/insert/select passed';
      } finally {
        db.close();
      }
    },
  },
];

let failures = 0;

for (const check of checks) {
  try {
    const detail = await check.run();
    console.log(`OK   ${check.name}: ${detail}`);
  } catch (error) {
    failures += 1;
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    console.error(`FAIL ${check.name}: ${message}`);
  }
}

if (failures > 0) {
  console.error(`Native module smoke test failed: ${failures} of ${checks.length} check(s) failed.`);
  process.exit(1);
}

console.log(`Native module smoke test passed: ${checks.length} of ${checks.length} checks OK.`);
