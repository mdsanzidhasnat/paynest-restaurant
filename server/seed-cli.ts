import dotenv from 'dotenv';
dotenv.config();

import { closeDb, initDb } from './db.ts';

initDb(undefined, { reset: true });
closeDb();
console.log('Restaurant demo data seeded.');
