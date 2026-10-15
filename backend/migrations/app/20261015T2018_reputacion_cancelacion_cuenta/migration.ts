#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/1221e10be509fe8eb880c207d9cd1d982d1493bd4fce723f57412136a378ce66/contract';
import endContract from '../../snapshots/1221e10be509fe8eb880c207d9cd1d982d1493bd4fce723f57412136a378ce66/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/1dbc5f25cc63c9da79c70436ecd83aaf54a7f177036f9ebd61614a4a64021ac5/contract';
import startContract from '../../snapshots/1dbc5f25cc63c9da79c70436ecd83aaf54a7f177036f9ebd61614a4a64021ac5/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'usuario',
        column: col('canceladaEn', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'usuario',
        column: col('datosEliminadosEn', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'usuario',
        column: col('estadoCuenta', 'text', {
          notNull: true,
          default: lit('activa'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'usuario',
        column: col('puntosReputacion', 'float8', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/float8@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
