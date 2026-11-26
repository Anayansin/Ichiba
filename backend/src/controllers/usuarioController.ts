import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import fs from "fs";
import { RequestConUsuario } from "../middleware/auth.js";
import { Producto } from "../models/producto.js";
import clientePrisma from "../configuracion/prisma.js";
import { validarPassword } from "../utils/validarPassword.js";
import { coincideRfcConCurp } from "../utils/validarRfcCurp.js";
import {
  validarDimensionesINE,
  validarNitidezINE,
} from "../services/ineService.js";
import { extraerDatosINE, coincideNombreConDatosINE } from "../services/structOcrService.js";
import {
  CODIGO_DATOS_NO_REGISTRABLES,
  crearSolicitudDeRevision,
  mensajeDeBloqueoRegistro,
  revisarBloqueoDeRegistro,
  type MotivoBloqueoRegistro,
} from "../services/bloqueoRegistroService.js";
import { enviarCorreoSolicitudRevisionRegistro } from "../services/emailService.js";
import { publicarSolicitudRevisionRegistrada } from "../graphql/suscripciones.js";
import { FORMATO_CORREO } from "../utils/formatoCorreo.js";
import {
  validarHorarioSemanal,
  estaDentroDeSuHorario,
  obtenerTextoDeProximoBloque,
} from "../utils/validarHorario.js";
import { enviarCorreoRecuperacion } from "../services/emailService.js";
import { calcularReputacionVendedor } from "../services/reputacionService.js";
import { PUNTOS_CANCELACION } from "../services/cancelacionCuentaService.js";
import {
  publicarEventoUsuario,
  publicarResumenAdmin,
} from "../graphql/suscripciones.js";
import {
  campoConPalabrasProhibidas,
  mensajePalabrasProhibidas,
} from "../utils/filtroPalabras.js";
import {
  buscarEnListaNegra,
  type EntradaListaNegra,
} from "../services/listaNegraService.js";

const MINUTOS_EXPIRACION_RECUPERACION = 10;
const MENSAJE_RECUPERACION_ENVIADA =
  "Si existe una cuenta con ese correo, recibirás un código para restablecer tu contraseña";

export const CODIGO_CUENTA_EN_LISTA_NEGRA = "CUENTA_EN_LISTA_NEGRA";

const MENSAJE_CREDENCIALES_INVALIDAS =
  "No pudimos iniciar sesión: el correo no está registrado o la contraseña es incorrecta. Revisa tus datos; si olvidaste tu contraseña, usa “¿Olvidaste tu contraseña?”. Si tu cuenta fue cancelada de forma permanente y sus datos ya fueron eliminados, no podrás volver a ingresar; si tus datos están en la lista negra, tampoco podrás registrar una cuenta nueva. Si crees que se trata de un error, contacta a los administradores.";

function mensajeDeCuentaEnListaNegra(entrada: EntradaListaNegra): string {
  const motivo = entrada.motivo?.trim();
  const detalle = motivo ? ` Motivo: ${motivo}.` : "";
  return `No puedes iniciar sesión porque este correo está en la lista negra de Ichiba.${detalle} Si consideras que se trata de un error, contacta a los administradores para solicitar una revisión.`;
}

function mensajeDeSuspension(motivoSuspension: string | null): string {
  const detalle =
    motivoSuspension && motivoSuspension !== "manual"
      ? ` Motivo: ${motivoSuspension}.`
      : "";
  return `Tu cuenta está suspendida por la administración de Ichiba.${detalle} Contacta al equipo para revisar tu caso y solicitar la reactivación.`;
}

function generarCodigoRecuperacion(): string {
  return crypto.randomInt(100000, 999999).toString();
}

function limpiarArchivos(archivos: Express.Multer.File[]) {
  archivos.forEach((archivo) => {
    fs.unlink(archivo.path, () => {});
  });
}

export async function registrarUsuario(req: Request, res: Response) {
  const archivos = req.files as
    | { [fieldname: string]: Express.Multer.File[] }
    | undefined;
  const ineFrente = archivos?.ineFrente?.[0];
  const ineReverso = archivos?.ineReverso?.[0];

  try {
    const {
      nombreCompleto,
      direccion,
      telefono,
      correo,
      rfc,
      password,
      aceptaTerminos,
      recibirNotificacionesCriticas,
      recibirNotificacionesPublicitarias,
      datosMetodoPago,
    } = req.body;

    const campoProhibido = campoConPalabrasProhibidas({
      nombreCompleto,
      direccion,
      telefono,
      correo,
      rfc,
      password,
      datosMetodoPago,
    });
    if (campoProhibido) {
      if (ineFrente || ineReverso) {
        limpiarArchivos(
          [ineFrente, ineReverso].filter(Boolean) as Express.Multer.File[],
        );
      }
      return res
        .status(400)
        .json({ message: mensajePalabrasProhibidas(campoProhibido) });
    }

    const horarios = req.body.horarios ? JSON.parse(req.body.horarios) : [];
    const errorHorario = validarHorarioSemanal(horarios);
    if (errorHorario) {
      if (ineFrente || ineReverso) {
        limpiarArchivos(
          [ineFrente, ineReverso].filter(Boolean) as Express.Multer.File[],
        );
      }
      return res.status(400).json({ message: errorHorario });
    }

    if (
      !nombreCompleto ||
      !direccion ||
      !telefono ||
      !correo ||
      !rfc ||
      !password
    ) {
      if (ineFrente || ineReverso) {
        limpiarArchivos(
          [ineFrente, ineReverso].filter(Boolean) as Express.Multer.File[],
        );
      }
      return res
        .status(400)
        .json({ message: "Todos los campos son obligatorios" });
    }

    if (!/^\d{10}$/.test(telefono)) {
      if (ineFrente || ineReverso) {
        limpiarArchivos(
          [ineFrente, ineReverso].filter(Boolean) as Express.Multer.File[],
        );
      }
      return res.status(400).json({
        message: "El teléfono debe tener exactamente 10 dígitos numéricos",
      });
    }

    if (!datosMetodoPago || !FORMATO_CORREO.test(String(datosMetodoPago).trim())) {
      if (ineFrente || ineReverso) {
        limpiarArchivos(
          [ineFrente, ineReverso].filter(Boolean) as Express.Multer.File[],
        );
      }
      return res
        .status(400)
        .json({ message: "Indica el correo de tu cuenta de PayPal" });
    }

    if (aceptaTerminos !== "true") {
      if (ineFrente || ineReverso) {
        limpiarArchivos(
          [ineFrente, ineReverso].filter(Boolean) as Express.Multer.File[],
        );
      }
      return res
        .status(400)
        .json({ message: "Debes aceptar los términos y condiciones" });
    }

    if (recibirNotificacionesCriticas !== "true") {
      if (ineFrente || ineReverso) {
        limpiarArchivos(
          [ineFrente, ineReverso].filter(Boolean) as Express.Multer.File[],
        );
      }
      return res.status(400).json({
        message:
          "Debes aceptar recibir notificaciones críticas sobre tu cuenta, la fila virtual y tus pagos",
      });
    }

    const errorPassword = validarPassword(password);
    if (errorPassword) {
      if (ineFrente || ineReverso) {
        limpiarArchivos(
          [ineFrente, ineReverso].filter(Boolean) as Express.Multer.File[],
        );
      }
      return res.status(400).json({ message: errorPassword });
    }

    if (!ineFrente || !ineReverso) {
      return res
        .status(400)
        .json({ message: "Debes subir el frente y el reverso de tu INE" });
    }

    const revisionPrevia = await revisarBloqueoDeRegistro({
      rfc,
      correo,
      telefono,
    });
    if (revisionPrevia.bloqueado && revisionPrevia.motivo) {
      limpiarArchivos([ineFrente, ineReverso]);
      return res.status(403).json({
        message: mensajeDeBloqueoRegistro(revisionPrevia.motivo),
        codigo: CODIGO_DATOS_NO_REGISTRABLES,
        motivo: revisionPrevia.motivo,
      });
    }

    const frenteDimensionesOk = await validarDimensionesINE(ineFrente.path);
    const reversoDimensionesOk = await validarDimensionesINE(ineReverso.path);

    if (!frenteDimensionesOk || !reversoDimensionesOk) {
      limpiarArchivos([ineFrente, ineReverso]);
      return res.status(400).json({
        message: "Las imágenes de tu INE deben medir al menos 420x540 píxeles",
      });
    }

    const frenteNitidoOk = await validarNitidezINE(ineFrente.path);
    const reversoNitidoOk = await validarNitidezINE(ineReverso.path);

    if (!frenteNitidoOk || !reversoNitidoOk) {
      limpiarArchivos([ineFrente, ineReverso]);
      return res.status(400).json({
        message:
          "La calidad de tus fotos de INE es muy baja, súbelas con mejor luz y enfoque",
      });
    }

    const datosINE = await extraerDatosINE(ineFrente.path);


    if (!datosINE.given_names || !datosINE.surname) {
      limpiarArchivos([ineFrente, ineReverso]);
      return res.status(400).json({
        message:
          "No pudimos leer los datos de tu identificación, intenta con una foto más clara",
      });
    }

    if (!coincideNombreConDatosINE(datosINE, nombreCompleto)) {
      limpiarArchivos([ineFrente, ineReverso]);
      return res.status(400).json({
        message: "El nombre ingresado no coincide con el de tu identificación",
      });
    }

    const curp = datosINE.personal_number;

    if (!curp) {
      limpiarArchivos([ineFrente, ineReverso]);
      return res.status(400).json({
        message:
          "No pudimos leer la CURP de tu identificación, intenta con una foto más clara",
      });
    }

    if (!coincideRfcConCurp(rfc, curp)) {
      limpiarArchivos([ineFrente, ineReverso]);
      return res.status(400).json({
        message:
          "El RFC ingresado no coincide con la CURP de tu identificación",
      });
    }

    const datosReverso = await extraerDatosINE(ineReverso.path);


    const mrzCompleto = [
      datosReverso.additional_fields?.mrz_line_1,
      datosReverso.additional_fields?.mrz_line_2,
      datosReverso.additional_fields?.mrz_line_3,
    ]
      .filter(Boolean)
      .join("");

    if (!mrzCompleto) {
      limpiarArchivos([ineFrente, ineReverso]);
      return res.status(400).json({
        message:
          "No pudimos validar el formato de tu identificación, sube una foto más clara del reverso",
      });
    }

    const revision = await revisarBloqueoDeRegistro({
      rfc,
      curp,
      ineCodigoReverso: mrzCompleto,
      correo,
      telefono,
    });

    if (revision.bloqueado && revision.motivo) {
      limpiarArchivos([ineFrente, ineReverso]);
      console.warn(
        `[registro] Alta denegada (${revision.motivo}) para ${correo}. Campos: ${revision.campos.join(", ")}`,
      );
      return res.status(403).json({
        message: mensajeDeBloqueoRegistro(revision.motivo),
        codigo: CODIGO_DATOS_NO_REGISTRABLES,
        motivo: revision.motivo,
      });
    }

    const passwordHasheada = await bcrypt.hash(password, 10);

    const usuarioCreado = await clientePrisma.usuario.create({
      data: {
        nombreCompleto,
        direccion,
        telefono,
        correo,
        rfc,
        password: passwordHasheada,
        curp,
        paypalEmail: String(datosMetodoPago).trim(),
        metodoPago: "paypal",
        ineFrente: `/uploads/ine/${ineFrente.filename}`,
        ineReverso: `/uploads/ine/${ineReverso.filename}`,
        ineCodigoReverso: mrzCompleto,
        aceptaTerminos: true,
        recibirNotificacionesCriticas: true,
        recibirNotificacionesPublicitarias:
          recibirNotificacionesPublicitarias === "true",
        horarios,
        horarioConfirmadoEn: new Date(),
        diasSinConfirmarHorario: 0,
      },
    });

    await publicarEventoUsuario(
      "registrado",
      `Nuevo usuario registrado: ${nombreCompleto}`,
      {
        id: String(usuarioCreado.id),
        nombreCompleto,
        correo,
        tipo: usuarioCreado.tipo,
        suspendido: false,
        puntosReputacion: Number(usuarioCreado.puntosReputacion ?? 0),
        estadoCuenta: usuarioCreado.estadoCuenta ?? "activa",
        fechaRegistro: usuarioCreado.createdAt
          ? new Date(usuarioCreado.createdAt)
          : new Date(),
        motivoSuspension: null,
        saldoPendiente: 0,
        sancionHasta: null,
        sancionPermanente: false,
        revisionAdministrativa: false,
      },
    );
    publicarResumenAdmin();

    const token = jwt.sign(
      { id: usuarioCreado.id, tipo: usuarioCreado.tipo },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" },
    );

    res.status(201).json({
      token,
      usuario: {
        id: usuarioCreado.id,
        nombreCompleto: usuarioCreado.nombreCompleto,
        correo: usuarioCreado.correo,
        tipo: usuarioCreado.tipo,
      },
    });
  } catch (error) {
    console.error("Error real:", error);
    if (ineFrente || ineReverso) {
      limpiarArchivos(
        [ineFrente, ineReverso].filter(Boolean) as Express.Multer.File[],
      );
    }
    res.status(500).json({ message: "Error al registrar usuario" });
  }
}

export async function solicitarRevisionDeRegistro(req: Request, res: Response) {
  try {
    const { nombreCompleto, correo, telefono, rfc, mensaje, motivo } =
      req.body ?? {};

    if (!nombreCompleto || typeof nombreCompleto !== "string" || !nombreCompleto.trim()) {
      return res
        .status(400)
        .json({ message: "Escribe tu nombre completo" });
    }

    if (!correo || typeof correo !== "string" || !FORMATO_CORREO.test(correo.trim())) {
      return res
        .status(400)
        .json({ message: "Escribe un correo electrónico válido" });
    }

    const motivoValido: MotivoBloqueoRegistro[] = [
      "lista-negra",
      "datos-en-uso",
      "correo-en-uso",
    ];
    const motivoElegido = motivoValido.includes(motivo)
      ? (motivo as MotivoBloqueoRegistro)
      : "lista-negra";

    const solicitud = await crearSolicitudDeRevision({
      nombreCompleto,
      correo,
      telefono: typeof telefono === "string" ? telefono : "",
      rfc: typeof rfc === "string" ? rfc : "",
      motivoBloqueo: motivoElegido,
      camposCoincidentes:
        Array.isArray(req.body?.campos) && typeof req.body.campos[0] === "string"
          ? req.body.campos.slice(0, 8)
          : [],
      mensaje: typeof mensaje === "string" ? mensaje.slice(0, 1000) : "",
    });

    void enviarCorreoSolicitudRevisionRegistro(solicitud).catch((errorCorreo) => {
      console.error(
        "[registro] No se pudo avisar por correo la solicitud de revisión:",
        errorCorreo instanceof Error ? errorCorreo.message : errorCorreo,
      );
    });

    await publicarSolicitudRevisionRegistrada(solicitud);

    res.status(201).json({
      message:
        "Solicitud enviada. Los administradores revisarán tus datos y te responderán al correo que registraste.",
      solicitud: {
        id: solicitud.id,
        estado: solicitud.estado,
        fecha: solicitud.fecha,
      },
    });
  } catch (error) {
    console.error("[registro] Error al registrar la solicitud de revisión:", error);
    res
      .status(500)
      .json({ message: "No pudimos enviar tu solicitud, inténtalo más tarde" });
  }
}

export async function iniciarSesion(req: Request, res: Response) {
  try {
    const { correo, password } = req.body;
    const correoIngresado = String(correo ?? "").trim();

    if (!correoIngresado || typeof password !== "string" || !password) {
      return res.status(400).json({
        message: "Escribe tu correo y contraseña para iniciar sesión.",
      });
    }

    const cuenta = await clientePrisma.usuario.findFirst({
      where: {
        correo: {
          equals: correoIngresado,
          mode: "insensitive",
        },
      },
    });

    if (!cuenta || typeof cuenta.password !== "string") {
      let entradaListaNegra: EntradaListaNegra | null = null;
      try {
        entradaListaNegra = await buscarEnListaNegra({
          correo: correoIngresado,
        });
      } catch (errorLista) {
        console.error(
          "[login] No se pudo consultar la lista negra:",
          errorLista instanceof Error ? errorLista.message : errorLista,
        );
      }
      if (entradaListaNegra) {
        return res.status(403).json({
          message: mensajeDeCuentaEnListaNegra(entradaListaNegra),
          codigo: CODIGO_CUENTA_EN_LISTA_NEGRA,
          motivo: entradaListaNegra.motivo,
          origen: entradaListaNegra.origen,
        });
      }

      return res.status(401).json({ message: MENSAJE_CREDENCIALES_INVALIDAS });
    }

    const passwordCorrecta = await bcrypt.compare(password, cuenta.password);
    if (!passwordCorrecta) {
      return res.status(401).json({ message: MENSAJE_CREDENCIALES_INVALIDAS });
    }

    const motivoSuspension = cuenta.motivoSuspension
      ? String(cuenta.motivoSuspension)
      : null;
    if (cuenta.suspendido && motivoSuspension !== "saldo_pendiente") {
      return res.status(403).json({
        message: mensajeDeSuspension(motivoSuspension),
        codigo: "CUENTA_SUSPENDIDA",
        suspendido: true,
        motivoSuspension,
      });
    }

    const idCuenta = Number(cuenta.id);
    const tipoCuenta = cuenta.tipo;

    const token = jwt.sign(
      { id: idCuenta, tipo: tipoCuenta },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" },
    );

    res.json({
      token,
      usuario: {
        id: idCuenta,
        nombreCompleto: cuenta.nombreCompleto,
        correo: cuenta.correo,
        tipo: tipoCuenta,
        estadoCuenta: cuenta.estadoCuenta ?? "activa",
        suspendido: cuenta.suspendido === true,
        motivoSuspension,
      },
    });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al iniciar sesión" });
  }
}

export async function obtenerPerfil(req: RequestConUsuario, res: Response) {
  try {
    const usuario = await clientePrisma.usuario.findUnique({
      where: { id: req.usuarioId },
      select: {
        id: true,
        nombreCompleto: true,
        correo: true,
        tipo: true,
        ventasExitosas: true,
        totalReportes: true,
        correoVerificado: true,
        aceptaTerminos: true,
        recibirNotificacionesCriticas: true,
        recibirNotificacionesPublicitarias: true,
        horarios: true,
        horarioConfirmadoEn: true,
        diasSinConfirmarHorario: true,
        estadoCuenta: true,
        puntosReputacion: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const reputacion = await calcularReputacionVendedor(usuario.id);

    res.json({
      ...usuario,
      reputacion,
      puntosCancelacion: PUNTOS_CANCELACION,
    });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al obtener perfil" });
  }
}

// Intentos fallidos de contraseña al consultar datos sensibles, por usuario.
const intentosDatosSensibles = new Map<number, { fallos: number; desde: number }>();
const MAX_INTENTOS_DATOS_SENSIBLES = 5;
const VENTANA_INTENTOS_MS = 15 * 60 * 1000;

// Devuelve los datos sensibles del propio usuario solo tras confirmar su
// contraseña; el perfil normal ya no los incluye.
export async function obtenerDatosSensibles(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const usuarioId = Number(req.usuarioId);
    const ahora = Date.now();
    const registro = intentosDatosSensibles.get(usuarioId);
    if (registro && ahora - registro.desde > VENTANA_INTENTOS_MS) {
      intentosDatosSensibles.delete(usuarioId);
    }
    const vigente = intentosDatosSensibles.get(usuarioId);
    if (vigente && vigente.fallos >= MAX_INTENTOS_DATOS_SENSIBLES) {
      return res.status(429).json({
        message:
          "Demasiados intentos. Espera unos minutos o recupera tu contraseña.",
      });
    }

    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!password) {
      return res.status(400).json({ message: "Escribe tu contraseña" });
    }

    const usuario = await clientePrisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        password: true,
        telefono: true,
        direccion: true,
        rfc: true,
        curp: true,
        ineCodigoReverso: true,
        paypalEmail: true,
      },
    });
    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const correcta = await bcrypt.compare(password, usuario.password);
    if (!correcta) {
      intentosDatosSensibles.set(usuarioId, {
        fallos: (vigente?.fallos ?? 0) + 1,
        desde: vigente?.desde ?? ahora,
      });
      return res.status(400).json({ message: "La contraseña no es correcta" });
    }

    intentosDatosSensibles.delete(usuarioId);
    const { password: _omitida, ...datos } = usuario;
    res.json(datos);
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al obtener tus datos" });
  }
}

export async function obtenerPerfilPublico(req: Request, res: Response) {
  try {
    const usuario = await clientePrisma.usuario.findUnique({
      where: { id: Number(req.params.id) },
      select: {
        nombreCompleto: true,
        ventasExitosas: true,
        totalReportes: true,
        createdAt: true,
        horarios: true,
        estadoCuenta: true,
      },
    });
    if (!usuario) {
      return res.status(404).json({ message: "Vendedor no encontrado" });
    }

    const { horarios, ...usuarioPublico } = usuario;

    const productos = await Producto.find({
      vendedorId: req.params.id,
      activo: true,
    });

    const ahora = new Date();
    const vendedorDisponibleAhora = estaDentroDeSuHorario(horarios, ahora);
    const proximoBloque = vendedorDisponibleAhora
      ? null
      : obtenerTextoDeProximoBloque(horarios, ahora);

    const reputacion = await calcularReputacionVendedor(Number(req.params.id));

    res.json({
      usuario: usuarioPublico,
      productos,
      reputacion,
      vendedorDisponibleAhora,
      proximoBloque,
    });
  } catch (error) {
    console.error("Error real:", error);
    res
      .status(500)
      .json({ message: "Error al obtener el perfil del vendedor" });
  }
}

export async function confirmarHorario(req: RequestConUsuario, res: Response) {
  try {
    const { horarios } = req.body;

    const errorHorario = validarHorarioSemanal(horarios);
    if (errorHorario) return res.status(400).json({ message: errorHorario });

    const horarioConfirmadoEn = new Date();
    await clientePrisma.usuario.update({
      where: { id: req.usuarioId },
      data: {
        horarios,
        horarioConfirmadoEn,
        diasSinConfirmarHorario: 0,
      },
    });

    res.json({ message: "Horario confirmado" });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al confirmar horario" });
  }
}

export async function actualizarPreferencias(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const { recibirNotificacionesCriticas, recibirNotificacionesPublicitarias } =
      req.body;

    const cambios: {
      recibirNotificacionesCriticas?: boolean;
      recibirNotificacionesPublicitarias?: boolean;
    } = {};

    if (recibirNotificacionesCriticas !== undefined) {
      if (typeof recibirNotificacionesCriticas !== "boolean") {
        return res.status(400).json({
          message: "La preferencia de notificaciones críticas no es válida",
        });
      }
      if (recibirNotificacionesCriticas !== true) {
        return res.status(400).json({
          message:
            "Las notificaciones críticas son obligatorias y no se pueden desactivar",
        });
      }
      cambios.recibirNotificacionesCriticas = true;
    }

    if (recibirNotificacionesPublicitarias !== undefined) {
      if (typeof recibirNotificacionesPublicitarias !== "boolean") {
        return res.status(400).json({
          message: "La preferencia de notificaciones publicitarias no es válida",
        });
      }
      cambios.recibirNotificacionesPublicitarias =
        recibirNotificacionesPublicitarias;
    }

    if (Object.keys(cambios).length === 0) {
      return res.status(400).json({
        message: "Indica qué preferencia de notificaciones quieres guardar",
      });
    }

    await clientePrisma.usuario.update({
      where: { id: req.usuarioId },
      data: cambios,
    });

    res.json({
      message: "Preferencias guardadas",
      ...cambios,
    });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al guardar las preferencias" });
  }
}

export async function solicitarRecuperacion(req: Request, res: Response) {
  try {
    const { correo } = req.body;

    if (!correo) {
      return res.status(400).json({ message: "El correo es obligatorio" });
    }

    const usuario = await clientePrisma.usuario.findFirst({
      where: { correo },
    });

    if (!usuario) {
      return res.status(200).json({ message: MENSAJE_RECUPERACION_ENVIADA });
    }

    const codigo = generarCodigoRecuperacion();
    await clientePrisma.usuario.update({
      where: { id: usuario.id },
      data: {
        codigoRecuperacion: codigo,
        codigoRecuperacionExpira: new Date(
          Date.now() + MINUTOS_EXPIRACION_RECUPERACION * 60 * 1000,
        ),
      },
    });

    const enviado = await enviarCorreoRecuperacion(usuario.correo, codigo);

    res.status(200).json({
      message: enviado
        ? MENSAJE_RECUPERACION_ENVIADA
        : `Modo local: tu código de recuperación es ${codigo}`,
    });
  } catch (error) {
    console.error("Error real:", error);
    res
      .status(500)
      .json({ message: "No se pudo enviar el correo de recuperación" });
  }
}

export async function verificarCodigoRecuperacion(
  req: Request,
  res: Response,
) {
  try {
    const { correo, codigo } = req.body;

    if (!correo || !codigo) {
      return res
        .status(400)
        .json({ message: "El correo y el código son obligatorios" });
    }

    const usuario = await clientePrisma.usuario.findFirst({
      where: { correo },
    });

    if (
      !usuario ||
      !usuario.codigoRecuperacion ||
      !usuario.codigoRecuperacionExpira
    ) {
      return res
        .status(400)
        .json({ message: "No hay un código pendiente, solicita uno nuevo" });
    }

    if (usuario.codigoRecuperacionExpira < new Date()) {
      return res
        .status(400)
        .json({ message: "El código expiró, solicita uno nuevo" });
    }

    if (usuario.codigoRecuperacion !== codigo) {
      return res.status(400).json({ message: "Código incorrecto" });
    }

    res.json({ message: "Código verificado correctamente" });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al verificar el código" });
  }
}

export async function restablecerPassword(req: Request, res: Response) {
  try {
    const { correo, codigo, password } = req.body;

    if (!correo || !codigo || !password) {
      return res.status(400).json({
        message: "El correo, el código y la nueva contraseña son obligatorios",
      });
    }

    const errorPassword = validarPassword(password);
    if (errorPassword) {
      return res.status(400).json({ message: errorPassword });
    }

    const usuario = await clientePrisma.usuario.findFirst({
      where: { correo },
    });

    if (
      !usuario ||
      !usuario.codigoRecuperacion ||
      !usuario.codigoRecuperacionExpira
    ) {
      return res
        .status(400)
        .json({ message: "No hay un código pendiente, solicita uno nuevo" });
    }

    if (usuario.codigoRecuperacionExpira < new Date()) {
      return res
        .status(400)
        .json({ message: "El código expiró, solicita uno nuevo" });
    }

    if (usuario.codigoRecuperacion !== codigo) {
      return res.status(400).json({ message: "Código incorrecto" });
    }

    const passwordHasheada = await bcrypt.hash(password, 10);

    await clientePrisma.usuario.update({
      where: { id: usuario.id },
      data: {
        password: passwordHasheada,
        codigoRecuperacion: null,
        codigoRecuperacionExpira: null,
      },
    });

    res.json({ message: "Contraseña actualizada correctamente" });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al restablecer la contraseña" });
  }
}
