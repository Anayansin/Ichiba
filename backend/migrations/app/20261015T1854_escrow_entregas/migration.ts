#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/8c649b006e9462a1791ad51902243b91199196e61f1fb970ba075aad7a07bf71/contract';
import startContract from '../../snapshots/8c649b006e9462a1791ad51902243b91199196e61f1fb970ba075aad7a07bf71/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e5d0998739ac587aef9b0e8128372065adb45b26e3bf5c226f60e868388ef54a/contract';
import endContract from '../../snapshots/e5d0998739ac587aef9b0e8128372065adb45b26e3bf5c226f60e868388ef54a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'cola',
        column: col('correo', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'venta',
        column: col('autorizacionPaypalId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'venta',
        column: col('canceladoMotivo', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'venta',
        column: col('codigoEntrega', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'venta',
        column: col('codigoPago', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'venta',
        column: col('comprobanteEnviadoEn', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'venta',
        column: col('comprobanteImagen', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'venta',
        column: col('comprobantePalabraClave', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'venta',
        column: col('comprobanteReferencia', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'venta',
        column: col('confirmacionLimite', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'venta',
        column: col('entregaLimite', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'venta',
        column: col('entregadoEn', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'venta',
        column: col('reembolsadoEn', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'venta',
        column: col('reembolsoId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'venta',
        column: col('retenido', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'venta',
        column: col('ultimoMensajeEn', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.setDefault({
        schema: 'public',
        table: 'venta',
        column: 'estado',
        defaultSql: "DEFAULT 'pendiente_comprobante'",
        operationClass: 'widening',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
