#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/4cbf2f0eddc04e3a26d7adcfa62ee397ffecbf866919efe8c6aca12842fa9f91/contract';
import endContract from '../../snapshots/4cbf2f0eddc04e3a26d7adcfa62ee397ffecbf866919efe8c6aca12842fa9f91/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/5108b8929e6722be58d52ac16970443767367605d0b92eb24d42fc640d305526/contract';
import startContract from '../../snapshots/5108b8929e6722be58d52ac16970443767367605d0b92eb24d42fc640d305526/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'usuario',
        column: col('metodoPago', 'text', {
          notNull: true,
          default: lit('paypal'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'usuario',
        column: col('motivoSuspension', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'usuario',
        column: col('revisionAdministrativa', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'usuario',
        column: col('saldoPendiente', 'float8', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/float8@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'usuario',
        column: col('sancionHasta', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'usuario',
        column: col('sancionPermanente', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'usuario',
        column: col('suspendido', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
