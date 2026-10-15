#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/1221e10be509fe8eb880c207d9cd1d982d1493bd4fce723f57412136a378ce66/contract';
import startContract from '../../snapshots/1221e10be509fe8eb880c207d9cd1d982d1493bd4fce723f57412136a378ce66/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/5108b8929e6722be58d52ac16970443767367605d0b92eb24d42fc640d305526/contract';
import endContract from '../../snapshots/5108b8929e6722be58d52ac16970443767367605d0b92eb24d42fc640d305526/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'cola',
        column: col('motivoCierre', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'venta',
        column: col('productoCategoria', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'venta',
        column: col('productoNombre', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
