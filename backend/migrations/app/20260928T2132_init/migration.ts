#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/e384cd6352cba7f0a80526a0f127a8cc70f8de4863c38e0cc77848d29e70e692/contract';
import endContract from '../../snapshots/e384cd6352cba7f0a80526a0f127a8cc70f8de4863c38e0cc77848d29e70e692/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'cola',
        columns: [
          col('compradorId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('estado', 'text', {
            notNull: true,
            default: lit('activa'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('pagoExpiraEn', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('posicion', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('productoId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'reporte',
        columns: [
          col('categoria', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('categoriaNombre', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('detalle', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('elemento', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('estado', 'text', {
            notNull: true,
            default: lit('pendiente'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('mensajeId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('productoId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reportadoPorId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reportadoPorTipo', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sujetoId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sujetoTipo', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('tipoFalta', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('vendedorId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('ventaId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'usuario',
        columns: [
          col('aceptaTerminos', 'bool', { notNull: true, codecRef: { codecId: 'pg/bool@1' } }),
          col('codigoCorreo', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('codigoCorreoExpira', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('codigoRecuperacion', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('codigoRecuperacionExpira', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('correo', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('correoVerificado', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('curp', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('diasSinConfirmarHorario', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('direccion', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('horarioConfirmadoEn', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('horarios', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('ineCodigoReverso', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('ineFrente', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('ineReverso', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('nombreCompleto', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('password', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('paypalEmail', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('recibirNotificacionesCriticas', 'bool', {
            notNull: true,
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('recibirNotificacionesPublicitarias', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('rfc', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('telefono', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('tipo', 'text', {
            notNull: true,
            default: lit('vendedor'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('totalReportes', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('ventasExitosas', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'venta',
        columns: [
          col('compradorId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('estado', 'text', {
            notNull: true,
            default: lit('completada'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('monto', 'float8', { notNull: true, codecRef: { codecId: 'pg/float8@1' } }),
          col('paypalOrderId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('productoId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('vendedorId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'usuario',
        constraint: 'usuario_correo_key',
        columns: ['correo'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'reporte',
        index: 'reporte_vendedorId_idx_ee765345',
        columns: ['vendedorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'venta',
        index: 'venta_vendedorId_idx_ee765345',
        columns: ['vendedorId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'reporte',
        foreignKey: {
          name: 'reporte_vendedorId_fkey',
          columns: ['vendedorId'],
          references: { schema: 'public', table: 'usuario', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'venta',
        foreignKey: {
          name: 'venta_vendedorId_fkey',
          columns: ['vendedorId'],
          references: { schema: 'public', table: 'usuario', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
