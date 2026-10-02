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
  validarHorarioSemanal,
  estaDentroDeSuHorario,
  obtenerTextoDeProximoBloque,
} from "../utils/validarHorario.js";
import { enviarCorreoRecuperacion } from "../services/emailService.js";
import {
  campoConPalabrasProhibidas,
  mensajePalabrasProhibidas,
} from "../utils/filtroPalabras.js";

const MINUTOS_EXPIRACION_RECUPERACION = 10;
const MENSAJE_RECUPERACION_ENVIADA =
  "Si existe una cuenta con ese correo, recibirás un código para restablecer tu contraseña";

function generarCodigoRecuperacion(): string {
  return crypto.randomInt(1000, 9999).toString();
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
        horarios,
        horarioConfirmadoEn: new Date(),
        diasSinConfirmarHorario: 0,
      },
    });

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

    const usuario = await clientePrisma.usuario.findFirst({
      where: { correo },
    });
    if (!usuario) {
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

    const token = jwt.sign(
      { id: usuario.id, tipo: usuario.tipo },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" },
    );

    res.json({
      token,
      usuario: {
        id: usuario.id,
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
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    res.json(usuario);
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

    res.json({
      usuario: usuarioPublico,
      productos,
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

    await clientePrisma.usuario.update({
      where: { id: req.usuarioId },
      data: {
        horarios,
        horarioConfirmadoEn: new Date(),
        diasSinConfirmarHorario: 0,
      },
    });

    res.json({ message: "Horario confirmado" });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al confirmar horario" });
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

    await clientePrisma.usuario.update({
      where: { id: usuario.id },
      data: {
        password: await bcrypt.hash(password, 10),
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
