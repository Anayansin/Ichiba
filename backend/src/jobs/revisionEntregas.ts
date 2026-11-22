import clientePrisma from "../configuracion/prisma.js";
import {
  cancelarEscrow,
  HORAS_LIMITE_COMPROBANTE,
  limiteDeInactividadDeChat,
  type UsuarioEscrow,
  type VentaEscrow,
} from "../services/escrowService.js";
import { Venta } from "../models/Venta.js";
import { Producto } from "../models/producto.js";
import {
  finDeBloquesDeAtencion,
  type BloqueHorario,
} from "../utils/validarHorario.js";
import { purgarCuentasCanceladasResueltas } from "../services/cancelacionCuentaService.js";

export async function revisarEntregasVencidas(): Promise<string[]> {
  const ahora = new Date();
  const acciones: string[] = [];

  const ventas = (await clientePrisma.venta.findMany({
    where: {},
  })) as VentaEscrow[];

  const pendientes = ventas.filter((venta) =>
    ["pendiente_comprobante", "pendiente_confirmacion", "en_entrega"].includes(
      String(venta.estado),
    ),
  );

  for (const venta of pendientes) {
    if (venta.retenido) continue;

    try {
      if (venta.estado === "pendiente_comprobante") {
        const limite = new Date(
          new Date(venta.createdAt ?? ahora).getTime() +
            HORAS_LIMITE_COMPROBANTE * 60 * 60 * 1000,
        );
        if (venta.comprobanteEnviadoEn || ahora <= limite) continue;

        const resultado = await cancelarEscrow(venta, {
          motivo: `El comprador no registró su comprobante de pago dentro de las ${HORAS_LIMITE_COMPROBANTE} horas posteriores al pago`,
        });
        if (!resultado.error && !resultado.omitida) {
          acciones.push(
            `Venta ${venta.id}: cancelada por comprobante sin registrar`,
          );
        }
        continue;
      }

      if (venta.estado === "pendiente_confirmacion") {
        if (
          !venta.confirmacionLimite ||
          ahora <= new Date(venta.confirmacionLimite)
        ) {
          continue;
        }

        const resultado = await cancelarEscrow(venta, {
          motivo:
            "El vendedor no confirmó el comprobante de pago antes de que finalizara su siguiente bloque de horario de atención",
          culpaVendedor: { causa: "sin_confirmar_comprobante" },
        });
        if (!resultado.error && !resultado.omitida) {
          acciones.push(
            `Venta ${venta.id}: cancelada por comprobante sin confirmar`,
          );
        }
        continue;
      }

      if (venta.estado === "en_entrega") {
        if (venta.entregaLimite && ahora > new Date(venta.entregaLimite)) {
          const resultado = await cancelarEscrow(venta, {
            motivo:
              "El vendedor no registró la entrega del producto dentro del plazo establecido",
            culpaVendedor: { causa: "entrega_vencida" },
          });
          if (!resultado.error && !resultado.omitida) {
            acciones.push(`Venta ${venta.id}: cancelada por entrega no realizada`);
          }
          continue;
        }

        const vendedor = (await clientePrisma.usuario.findUnique({
          where: { id: Number(venta.vendedorId) },
        })) as UsuarioEscrow | null;

        const vencioCoordinacion = await coordinacionVencida(venta, vendedor, ahora);
        if (vencioCoordinacion) {
          const resultado = await cancelarEscrow(venta, {
            motivo: vencioCoordinacion,
            culpaVendedor: { causa: "entrega_vencida" },
          });
          if (!resultado.error && !resultado.omitida) {
            acciones.push(`Venta ${venta.id}: cancelada por falta de coordinación de entrega`);
          }
          continue;
        }

        const limiteInactividad = limiteDeInactividadDeChat(venta, vendedor);
        if (limiteInactividad && ahora > limiteInactividad) {
          const resultado = await cancelarEscrow(venta, {
            motivo:
              "Inactividad prolongada en el chat de coordinación (3 bloques de atención del vendedor sin mensajes)",
            culpaVendedor: { causa: "inactividad_chat" },
          });
          if (!resultado.error && !resultado.omitida) {
            acciones.push(`Venta ${venta.id}: cancelada por inactividad del chat`);
          }
        }
      }
    } catch (error) {
      console.error(
        `[escrow] Error al revisar la venta ${venta.id}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  try {
    const purgadas = await purgarCuentasCanceladasResueltas();
    for (const id of purgadas) {
      acciones.push(
        `Cuenta ${id}: datos personales purgados tras resolverse sus entregas pendientes`,
      );
    }
  } catch (error) {
    console.error(
      "[cancelacion] No se pudieron purgar las cuentas canceladas:",
      error instanceof Error ? error.message : error,
    );
  }

  return acciones;
}

async function coordinacionVencida(
  venta: VentaEscrow,
  vendedor: UsuarioEscrow | null,
  ahora: Date,
): Promise<string | null> {
  const espejo = await Venta.findOne({ paypalOrderId: venta.paypalOrderId });
  if (!espejo) return null;
  const producto = await Producto.findById(espejo.productoId).select(
    "metodoEntrega",
  );
  if (producto?.metodoEntrega !== "tienda" && producto?.metodoEntrega !== "punto-encuentro") {
    return null;
  }

  const horarios = (Array.isArray(vendedor?.horarios)
    ? vendedor?.horarios
    : []) as BloqueHorario[];
  const propuesta = espejo.propuestaEntrega;
  if (propuesta?.estado === "aceptada") return null;

  if (propuesta?.estado === "pendiente" && propuesta.registradaEn) {
    const limite = finDeBloquesDeAtencion(horarios, new Date(propuesta.registradaEn), 3);
    if (limite && ahora > limite) {
      return "El comprador no aceptó ni rechazó la propuesta de entrega durante 3 bloques de atención del vendedor";
    }
    return null;
  }

  const desde = propuesta?.respondidaEn ?? venta.comprobanteConfirmadoEn;
  if (!desde) return null;
  const limite = finDeBloquesDeAtencion(horarios, new Date(desde), 3);
  if (limite && ahora > limite) {
    return "El vendedor no registró la propuesta de entrega durante 3 bloques de atención";
  }
  return null;
}
