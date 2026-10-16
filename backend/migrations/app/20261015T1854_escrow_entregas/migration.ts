#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/8c649b006e9462a1791ad51902243b91199196e61f1fb970ba075aad7a07bf71/contract';
import startContract from '../../snapshots/8c649b006e9462a1791ad51902243b91199196e61f1fb970ba075aad7a07bf71/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e5d0998739ac587aef9b0e8128372065adb45b26e3bf5c226f60e868388ef54a/contract';
import endContract from '../../snapshots/e5d0998739ac587aef9b0e8128372065adb45b26e3bf5c226f60e868388ef54a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit, rawSql } from '@prisma/orm-postgres/migration';

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
      // Nota: el op se escribe a mano con rawSql en lugar de this.setDefault
      // porque el postcheck que genera la fábrica (Prisma 8.0.0-rc.13) solo
      // comprueba que la columna "tenga algún default", no que sea el valor
      // correcto. Como el runner salta todo op cuyo postcheck ya esté
      // satisfecho (probe de idempotencia), en una base recién creada el
      // ALTER se saltaba (la columna ya tenía 'completada') y la verificación
      // final fallaba. El postcheck de rawSql compara el valor real.
      rawSql({
        id: 'setDefault.venta.estado',
        label: 'Set default on "venta"."estado"',
        operationClass: 'widening',
        target: {
          id: 'postgres',
          details: {
            schema: 'public',
            objectType: 'column',
            name: 'estado',
            table: 'venta',
          },
        },
        precheck: [
          {
            description: 'ensure column "estado" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "information_schema"."columns" WHERE ("table_schema" = $1 AND "table_name" = $2 AND "column_name" = $3)) AS "result"',
            params: ['public', 'venta', 'estado'],
          },
        ],
        execute: [
          {
            description: 'set default on "estado"',
            sql: 'ALTER TABLE "public"."venta" ALTER COLUMN "estado" SET DEFAULT \'pendiente_comprobante\'',
          },
        ],
        postcheck: [
          {
            description: 'verify the default of "estado" is \'pendiente_comprobante\'',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "information_schema"."columns" WHERE ("table_schema" = $1 AND "table_name" = $2 AND "column_name" = $3 AND "column_default" = quote_literal($4::text) || \'::text\')) AS "result"',
            params: ['public', 'venta', 'estado', 'pendiente_comprobante'],
          },
        ],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
