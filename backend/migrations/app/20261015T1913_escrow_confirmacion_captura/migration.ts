#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/1dbc5f25cc63c9da79c70436ecd83aaf54a7f177036f9ebd61614a4a64021ac5/contract';
import endContract from '../../snapshots/1dbc5f25cc63c9da79c70436ecd83aaf54a7f177036f9ebd61614a4a64021ac5/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e5d0998739ac587aef9b0e8128372065adb45b26e3bf5c226f60e868388ef54a/contract';
import startContract from '../../snapshots/e5d0998739ac587aef9b0e8128372065adb45b26e3bf5c226f60e868388ef54a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'venta',
        column: col('capturaPaypalId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'venta',
        column: col('comprobanteConfirmadoEn', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
