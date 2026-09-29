#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/e384cd6352cba7f0a80526a0f127a8cc70f8de4863c38e0cc77848d29e70e692/contract';
import startContract from '../../snapshots/e384cd6352cba7f0a80526a0f127a8cc70f8de4863c38e0cc77848d29e70e692/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/f3adc8eb6e62f44fd925a835c904f87510dddae97efc393effc4e2a160fd51f9/contract';
import endContract from '../../snapshots/f3adc8eb6e62f44fd925a835c904f87510dddae97efc393effc4e2a160fd51f9/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'reporte',
        column: col('tipoReportado', 'text', {
          notNull: true,
          default: lit('vendedor'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
