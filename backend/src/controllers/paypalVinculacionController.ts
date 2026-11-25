import crypto from "crypto";
import { Response } from "express";
import {
  construirUrlVinculacionPaypal,
  intercambiarCodigoPorToken,
  identidadPaypal,
  paypalEnSandbox,
  frontUrl,
  afirmacionesIdToken,
} from "../services/paypalService.js";
import { cifrar } from "../services/cifradoService.js";
import { VinculoPayPal, EstadoVinculacionPayPal } from "../models/VinculoPayPal.js";
import clientePrisma from "../configuracion/prisma.js";
import { RequestConUsuario } from "../middleware/auth.js";

const MINUTOS_STATE = 10;

function idNumerico(usuarioId?: string): number | null {
  const numero = Number(usuarioId);
  return Number.isInteger(numero) ? numero : null;
}

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

    if (!code) return volver("denegado");

    const token = await intercambiarCodigoPorToken(code);
    console.log("[paypal] Permisos concedidos:", token.scope ?? "(sin detalle)");
    const afirmaciones = afirmacionesIdToken(token.id_token);
    console.log(
      "[paypal] id_token con:",
      Object.keys(afirmaciones).join(", ") || "(no llegó)",
    );

    let identidad: Awaited<ReturnType<typeof identidadPaypal>> = {};
    try {
      identidad = await identidadPaypal(token.access_token);
    } catch (errorIdentidad) {
      // El vendedor ya inició sesión y autorizó en PayPal (hay token), pero
      // PayPal no entregó sus datos: se vincula con el correo de PayPal que
      // registró en Ichiba.
      console.warn(
        "[paypal] Sin datos de identidad, se usa el correo registrado:",
        errorIdentidad instanceof Error ? errorIdentidad.message : errorIdentidad,
      );
    }

    const texto = (valor: unknown) =>
      typeof valor === "string" && valor.trim() ? valor.trim() : undefined;

    const merchantId =
      identidad.payer_id ?? texto(afirmaciones.payer_id) ?? null;
    let correoPayPal =
      identidad.email ??
      identidad.emails?.find((e) => e.primary)?.value ??
      identidad.emails?.[0]?.value ??
      texto(afirmaciones.email);

    if (!correoPayPal) {
      const usuario = await clientePrisma.usuario.findUnique({
        where: { id: pendiente.usuarioId },
        select: { paypalEmail: true },
      });
      correoPayPal = usuario?.paypalEmail ?? undefined;
    }

    if (!correoPayPal) {
      console.error("[paypal] Vinculación sin correo de PayPal");
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
        merchantId: merchantId ?? undefined,
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
      `[paypal] Cuenta vinculada para el usuario ${pendiente.usuarioId} (${merchantId ? `Merchant ID ${merchantId}` : "sin Merchant ID, se cobra por correo"})`,
    );

    volver("vinculado");
  } catch (error) {
    console.error("[paypal] Error en el callback de vinculación:", error);
    volver("error");
  }
}

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

    res.json({
      vinculado: Boolean(vinculo),
      correoPayPal: vinculo?.correoPayPal ?? null,
      merchantId: vinculo?.merchantId ?? null,
      vinculadoEn: vinculo?.vinculadoEn ?? null,
      sandbox: paypalEnSandbox(),
    });
  } catch (error) {
    console.error("[paypal] No se pudo leer la vinculación:", error);
    res.status(500).json({ message: "No se pudo consultar la vinculación" });
  }
}
