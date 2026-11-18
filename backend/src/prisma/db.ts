// Node 24 (usado por Vercel) no incluye Temporal, y las columnas de fecha
// timestamptz de Prisma ORM 8 lo necesitan para leerse.
import 'temporal-polyfill/full/global';
import 'dotenv/config';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './contract.d';
import contractJson from './contract.json' with { type: 'json' };

export const db = postgres<Contract>({
  contractJson,
  url: process.env['DATABASE_URL']!,
});
