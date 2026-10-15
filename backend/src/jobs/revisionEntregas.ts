import cron from "node-cron";
import clientePrisma from "../configuracion/prisma.js";
import {
  cancelarEscrow,
  HORAS_LIMITE_COMPROBANTE,
  limiteDeInactividadDeChat,
  type UsuarioEscrow,
  type VentaEscrow,
} from "../services/escrowService.js";
import { purgarCuentasCanceladasResueltas } from "../services/cancelacionCuentaService.js";

/**
 * RQNF23 / RQNF24 / RQNF28 / RQNF31: revisión automática del escrow.
 *
 * Cada minuto busca transacciones vencidas y las cancela con reembolso al
 * comprador (y reanudación de la fila):
 *
 *   1. `pendiente_comprobante`: pasaron más de 24 h y el comprador nunca
 *      subió su comprobante (RQNF23: se libera el turno al siguiente).
 *   2. `pendiente_confirmacion`: el vendedor no confirmó antes de que
 *      finalizara su siguiente bloque de atención (RQNF24).
 *   3. `en_entrega`: pasaron los 15 días del plazo de entrega sin registrar
 *      el código (RQNF28; también cubre al vendedor con cuenta cancelada,
 *      RQNF10.2).
 *   4. `en_entrega` sin mensajes en el chat durante 3 bloques de atención del
 *      vendedor (RQNF31).
 *
 * Las ventas con `retenido = true` (RQNF32) no se tocan: las resuelve un
 * administrador.
 */
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

        // RQNF31: inactividad prolongada en el chat (3 bloques del vendedor).
        const vendedor = (await clientePrisma.usuario.findUnique({
          where: { id: Number(venta.vendedorId) },
        })) as UsuarioEscrow | null;

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

  // RQNF10.6 / RQF12: las cuentas canceladas por 8 puntos que ya resolvieron
  // todas sus entregas se purgan aquí (nombre, correo, contraseña,
  // publicaciones, chats y token de PayPal).
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

export function iniciarJobRevisionEntregas() {
  cron.schedule("* * * * *", async () => {
    try {
      const acciones = await revisarEntregasVencidas();
      for (const accion of acciones) {
        console.log(`[escrow] ${accion}`);
      }
    } catch (error) {
      console.error("Error al revisar las entregas del escrow:", error);
    }
  });
}
