import crypto from "crypto";
import { Response } from "express";
import {
  construirUrlVinculacionPaypal,
  intercambiarCodigoPorToken,
  identidadPaypal,
} from "../services/paypalService.js";
import { cifrar } from "../services/cifradoService.js";
import {
  VinculoPayPal,
  EstadoVinculacionPayPal,
} from "../models/VinculoPayPal.js";
import { Usuario } from "../models/usuario.js";
import { RequestConUsuario } from "../middleware/auth.js";

const MINUTOS_STATE = 10;

function frontUrl(): string {
  const frontend = process.env.FRONTEND_URL ?? "http://localhost:5173";
  return frontend.replace(/\/+$/, "");
}

function idNumerico(usuarioId?: string): number | null {
  const numero = Number(usuarioId);
  return Number.isInteger(numero) ? numero : null;
}

/**
 * RQF4 — El vendedor pide vincular su cuenta: el sistema genera un `state`
 * aleatorio y devuelve la URL de la pasarela oficial de PayPal; el navegador
 * del vendedor se redirige ahí para autorizar con su propia cuenta.
 */
export async function iniciarVinculacionPayPal(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const usuarioId = idNumerico(req.usuarioId);
    if (!usuarioId) {
      return res.status(401).json({ message: "No autorizado" });
    }

    const state = crypto.randomBytes(24).toString("hex");

    await EstadoVinculacionPayPal.deleteMany({ usuarioId });
    await EstadoVinculacionPayPal.create({
      state,
      usuarioId,
      expira: new Date(Date.now() + MINUTOS_STATE * 60 * 1000),
    });

    res.json({ url: construirUrlVinculacionPaypal(state) });
  } catch (error) {
    console.error("[paypal] No se pudo iniciar la vinculación:", error);
    res.status(500).json({
      message: "No se pudo iniciar la vinculación con PayPal. Intenta de nuevo.",
    });
  }
}

/**
 * PayPal regresa al vendedor a esta URL con `code` y `state`. El backend
 * intercambia el código por el Token de Acceso, identifica la cuenta
 * (Merchant ID), guarda el token CIFRADO y devuelve al vendedor a su panel.
 *
 * Es una navegación del navegador (sin Authorization), por eso la única
 * pieza de seguridad aquí es el `state` de un solo uso generado arriba.
 */
export async function callbackVinculacionPayPal(
  req: RequestConUsuario,
  res: Response,
) {
  const code = typeof req.query.code === "string" ? req.query.code : null;
  const state = typeof req.query.state === "string" ? req.query.state : null;

  const volver = (resultado: string) =>
    res.redirect(`${frontUrl()}/panel-vendedor?paypal=${resultado}`);

  try {
    if (!state) return volver("sin-state");

    const pendiente = await EstadoVinculacionPayPal.findOneAndDelete({ state });
    if (!pendiente || pendiente.expira < new Date()) {
      return volver("state-invalido");
    }

    if (!code) return volver("denegado"); // el vendedor canceló en PayPal

    const token = await intercambiarCodigoPorToken(code);
    const identidad = await identidadPaypal(token.access_token);

    const merchantId = identidad.payer_id;
    const correoPayPal =
      identidad.email ??
      identidad.emails?.find((e) => e.primary)?.value ??
      identidad.emails?.[0]?.value;

    if (!merchantId || !correoPayPal) {
      console.error("[paypal] Vinculación sin identidad completa:", identidad);
      return volver("sin-identidad");
    }

    const expiraEn = token.expires_in
      ? new Date(Date.now() + token.expires_in * 1000)
      : undefined;

    await VinculoPayPal.findOneAndUpdate(
      { usuarioId: pendiente.usuarioId },
      {
        usuarioId: pendiente.usuarioId,
        correoPayPal,
        merchantId,
        tokenCifrado: cifrar(token.access_token),
        refrescoCifrado: token.refresh_token
          ? cifrar(token.refresh_token)
          : undefined,
        tokenExpiraEn: expiraEn,
        vinculadoEn: new Date(),
      },
      { upsert: true },
    );

    console.log(
      `[paypal] Cuenta vinculada para el usuario ${pendiente.usuarioId} (Merchant ID ${merchantId})`,
    );

    volver("vinculado");
  } catch (error) {
    console.error("[paypal] Error en el callback de vinculación:", error);
    volver("error");
  }
}

/**
 * Estado de la vinculación para el panel del vendedor. Nunca devuelve el
 * token: solo el Merchant ID y el correo con los que se identifica la cuenta.
 */
export async function estadoVinculacionPayPal(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const usuarioId = idNumerico(req.usuarioId);
    if (!usuarioId) {
      return res.status(401).json({ message: "No autorizado" });
    }

    const vinculo = await VinculoPayPal.findOne({ usuarioId })
      .select("correoPayPal merchantId vinculadoEn tokenExpiraEn")
      .lean();

    // El método de pago vive en el espejo de MongoDB: la tarjeta de PayPal
    // solo le interesa a los vendedores que cobran con PayPal.
    const espejo = await Usuario.findOne({ usuarioId })
      .select("metodoPago")
      .lean()
      .catch(() => null);

    res.json({
      vinculado: Boolean(vinculo),
      correoPayPal: vinculo?.correoPayPal ?? null,
      merchantId: vinculo?.merchantId ?? null,
      vinculadoEn: vinculo?.vinculadoEn ?? null,
      metodoPago:
        (espejo as { metodoPago?: string } | null)?.metodoPago ?? "paypal",
    });
  } catch (error) {
    console.error("[paypal] No se pudo leer la vinculación:", error);
    res.status(500).json({ message: "No se pudo consultar la vinculación" });
  }
}
