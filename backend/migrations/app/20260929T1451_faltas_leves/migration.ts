#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/8c649b006e9462a1791ad51902243b91199196e61f1fb970ba075aad7a07bf71/contract';
import endContract from '../../snapshots/8c649b006e9462a1791ad51902243b91199196e61f1fb970ba075aad7a07bf71/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/f3adc8eb6e62f44fd925a835c904f87510dddae97efc393effc4e2a160fd51f9/contract';
import startContract from '../../snapshots/f3adc8eb6e62f44fd925a835c904f87510dddae97efc393effc4e2a160fd51f9/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'usuario',
        column: col('faltasLeves', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
