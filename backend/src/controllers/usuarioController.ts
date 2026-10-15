import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import fs from "fs";
import { RequestConUsuario } from "../middleware/auth.js";
import { Producto } from "../models/producto.js";
import { Usuario } from "../models/usuario.js";
import clientePrisma from "../configuracion/prisma.js";
import { validarPassword } from "../utils/validarPassword.js";
import { coincideRfcConCurp } from "../utils/validarRfcCurp.js";
import {
  validarDimensionesINE,
  validarNitidezINE,
} from "../services/ineService.js";
import { extraerDatosINE, coincideNombreConDatosINE } from "../services/structOcrService.js";
import { buscarEnListaNegra } from "../services/listaNegraService.js";
import {
  validarHorarioSemanal,
  estaDentroDeSuHorario,
  obtenerTextoDeProximoBloque,
} from "../utils/validarHorario.js";
import { enviarCorreoRecuperacion } from "../services/emailService.js";
import { calcularReputacionVendedor } from "../services/reputacionService.js";
import { PUNTOS_CANCELACION } from "../services/cancelacionCuentaService.js";
import {
  campoConPalabrasProhibidas,
  mensajePalabrasProhibidas,
} from "../utils/filtroPalabras.js";

const MINUTOS_EXPIRACION_RECUPERACION = 10;
const MENSAJE_RECUPERACION_ENVIADA =
  "Si existe una cuenta con ese correo, recibirás un código para restablecer tu contraseña";

function generarCodigoRecuperacion(): string {
  // RQNF1.3: el código de verificación tiene 6 dígitos.
  return crypto.randomInt(100000, 999999).toString();
}

function limpiarArchivos(archivos: Express.Multer.File[]) {
  archivos.forEach((archivo) => {
    fs.unlink(archivo.path, () => {});
  });
}

/**
 * Copia los cambios de la cuenta a la colección `usuario` de MongoDB, que es
 * la que leen el panel de administración, GraphQL y el trabajo diario de
 * horarios. Si MongoDB no está disponible solo se avisa en consola: nunca
 * rompe la operación que el vendedor estaba haciendo.
 */
function reflejarEnMongo(
  correo: string,
  cambios: Record<string, unknown>,
  upsert = false,
) {
  return Usuario.updateOne({ correo }, { $set: cambios }, { upsert }).catch(
    (errorMongo) => {
      console.error(
        "[mongo] No se pudo actualizar el espejo del usuario:",
        errorMongo?.message ?? errorMongo,
      );
    },
  );
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
      metodoPago,
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

    // RQNF1.2: el teléfono debe tener exactamente 10 dígitos numéricos.
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

    if (
      !datosMetodoPago ||
      (metodoPago !== "paypal" && metodoPago !== "mercadopago")
    ) {
      if (ineFrente || ineReverso) {
        limpiarArchivos(
          [ineFrente, ineReverso].filter(Boolean) as Express.Multer.File[],
        );
      }
      return res
        .status(400)
        .json({ message: "Indica tu método de pago y el dato para recibirlo" });
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

    console.log("=== DATOS COMPLETOS DE STRUCTOCR (FRENTE) ===");
    console.log(JSON.stringify(datosINE, null, 2));

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

    console.log("=== DATOS DEL REVERSO (STRUCTOCR) ===");
    console.log(JSON.stringify(datosReverso, null, 2));

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

    // RQNF1.9: si el RFC, la CURP o el código de la INE ya están en la
    // lista negra, el registro se deniega.
    const entradaListaNegra = await buscarEnListaNegra({
      rfc,
      curp,
      ineCodigoReverso: mrzCompleto,
    });

    if (entradaListaNegra) {
      limpiarArchivos([ineFrente, ineReverso]);
      return res.status(403).json({
        message: "El registro no pudo completarse",
      });
    }

    const usuarioExistente = await clientePrisma.usuario.findFirst({
      where: { correo },
    });
    if (usuarioExistente) {
      limpiarArchivos([ineFrente, ineReverso]);
      return res
        .status(400)
        .json({ message: "Ya existe una cuenta con ese correo" });
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
        paypalEmail: datosMetodoPago,
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

    // Espejo en MongoDB para el panel de administración, GraphQL y el
    // trabajo de horarios (ambas bases conviven durante la migración).
    await reflejarEnMongo(
      correo,
      {
        usuarioId: usuarioCreado.id,
        nombreCompleto,
        direccion,
        telefono,
        rfc,
        password: passwordHasheada,
        tipo: usuarioCreado.tipo,
        ventasExitosas: usuarioCreado.ventasExitosas,
        reportes: usuarioCreado.totalReportes,
        correoVerificado: usuarioCreado.correoVerificado,
        ineFrente: usuarioCreado.ineFrente,
        ineReverso: usuarioCreado.ineReverso,
        ineCodigoReverso: mrzCompleto,
        curp,
        aceptaTerminos: true,
        recibirNotificacionesCriticas: true,
        recibirNotificacionesPublicitarias:
          recibirNotificacionesPublicitarias === "true",
        metodoPago,
        datosMetodoPago,
        horarios,
        horarioConfirmadoEn: new Date(),
        diasSinConfirmarHorario: 0,
      },
      true,
    );

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

export async function iniciarSesion(req: Request, res: Response) {
  try {
    const { correo, password } = req.body;

    // RQNF6: la autenticación consulta los registros de MongoDB y la
    // contraseña se compara contra su hash bcryptjs, nunca en texto plano.
    const usuario = await Usuario.findOne({ correo });

    if (!usuario || typeof usuario.password !== "string") {
      return res
        .status(401)
        .json({ message: "Correo o contraseña incorrectos" });
    }

    const passwordCorrecta = await bcrypt.compare(password, usuario.password);
    if (!passwordCorrecta) {
      return res
        .status(401)
        .json({ message: "Correo o contraseña incorrectos" });
    }

    // El token conserva el id numérico de PostgreSQL, que es el que usan el
    // middleware y el resto de los módulos de la plataforma.
    const idCuenta = Number(usuario.usuarioId);
    if (!Number.isInteger(idCuenta) || idCuenta <= 0) {
      console.error(`[login] El usuario ${correo} no tiene id en PostgreSQL`);
      return res.status(500).json({ message: "Error al iniciar sesión" });
    }

    const token = jwt.sign(
      { id: idCuenta, tipo: usuario.tipo },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" },
    );

    res.json({
      token,
      usuario: {
        id: idCuenta,
        nombreCompleto: usuario.nombreCompleto,
        correo: usuario.correo,
        tipo: usuario.tipo,
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
        direccion: true,
        telefono: true,
        correo: true,
        rfc: true,
        tipo: true,
        ventasExitosas: true,
        totalReportes: true,
        correoVerificado: true,
        ineFrente: true,
        ineReverso: true,
        ineCodigoReverso: true,
        aceptaTerminos: true,
        recibirNotificacionesCriticas: true,
        curp: true,
        recibirNotificacionesPublicitarias: true,
        paypalEmail: true,
        horarios: true,
        horarioConfirmadoEn: true,
        diasSinConfirmarHorario: true,
        // RQNF10.1 / RQNF10.3 / RQF12: estado de la cuenta y puntos acumulados.
        estadoCuenta: true,
        puntosReputacion: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // RQNF10.1: promedio de calificaciones recibidas en ventas completadas.
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

    // RQNF10.1: reputación pública del vendedor (promedio de calificaciones).
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

    const cuenta = await clientePrisma.usuario.findUnique({
      where: { id: req.usuarioId },
      select: { correo: true },
    });

    const horarioConfirmadoEn = new Date();
    await clientePrisma.usuario.update({
      where: { id: req.usuarioId },
      data: {
        horarios,
        horarioConfirmadoEn,
        diasSinConfirmarHorario: 0,
      },
    });

    if (cuenta) {
      await reflejarEnMongo(cuenta.correo, {
        horarios,
        horarioConfirmadoEn,
        diasSinConfirmarHorario: 0,
      });
    }

    res.json({ message: "Horario confirmado" });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al confirmar horario" });
  }
}

/**
 * Actualiza las preferencias de notificaciones del vendedor desde su panel:
 * acepta solo booleanos y guarda en PostgreSQL y en el espejo de MongoDB.
 */
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
      cambios.recibirNotificacionesCriticas = recibirNotificacionesCriticas;
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

    const usuario = await clientePrisma.usuario.findUnique({
      where: { id: req.usuarioId },
      select: { correo: true },
    });

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    await clientePrisma.usuario.update({
      where: { id: req.usuarioId },
      data: cambios,
    });

    await reflejarEnMongo(usuario.correo, cambios);

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

    // RQNF6: la autenticación consulta MongoDB, así que la nueva contraseña
    // (hash bcryptjs) debe quedar también en el espejo, o el usuario no
    // podría iniciar sesión con ella.
    await reflejarEnMongo(correo, { password: passwordHasheada });

    res.json({ message: "Contraseña actualizada correctamente" });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al restablecer la contraseña" });
  }
}
