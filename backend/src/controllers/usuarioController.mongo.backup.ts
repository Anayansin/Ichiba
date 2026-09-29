import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import fs from "fs";
import { Usuario } from "../models/usuario.js";
import { RequestConUsuario } from "../middleware/auth.js";
import { Producto } from "../models/producto.js";
import { validarPassword } from "../utils/validarPassword.js";
import { coincideRfcConCurp } from "../utils/validarRfcCurp.js";
import {
  validarDimensionesINE,
  validarNitidezINE,
} from "../services/ineService.js";
import { extraerDatosINE } from "../services/structOcrService.js";
import { validarHorarioSemanal } from "../utils/validarHorario.js";
import { enviarCorreoRecuperacion } from "../services/emailService.js";
import {
  campoConPalabrasProhibidas,
  mensajePalabrasProhibidas,
} from "../utils/filtroPalabras.js";

const MINUTOS_EXPIRACION_RECUPERACION = 15;
const MENSAJE_RECUPERACION_ENVIADA =
  "Si existe una cuenta con ese correo, recibirás un código para restablecer tu contraseña";

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
      paypalEmail,
    } = req.body;

    const campoProhibido = campoConPalabrasProhibidas({
      nombreCompleto,
      direccion,
      telefono,
      correo,
      rfc,
      password,
      paypalEmail,
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

    const usuarioExistente = await Usuario.findOne({ correo });
    if (usuarioExistente) {
      limpiarArchivos([ineFrente, ineReverso]);
      return res
        .status(400)
        .json({ message: "Ya existe una cuenta con ese correo" });
    }

    const passwordHasheada = await bcrypt.hash(password, 10);

    const nuevoUsuario = new Usuario({
      nombreCompleto,
      direccion,
      telefono,
      correo,
      rfc,
      password: passwordHasheada,
      curp,
      paypalEmail,
      ineFrente: `/uploads/ine/${ineFrente.filename}`,
      ineReverso: `/uploads/ine/${ineReverso.filename}`,
      ineCodigoReverso: mrzCompleto,
      aceptaTerminos: true,
      recibirNotificacionesCriticas: true,
      horarios,
      horarioConfirmadoEn: new Date(),
      diasSinConfirmarHorario: 0,
    });

    const guardado = await nuevoUsuario.save();

    const token = jwt.sign(
      { id: guardado._id, tipo: guardado.tipo },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" },
    );

    res.status(201).json({
      token,
      usuario: {
        id: guardado._id,
        nombreCompleto: guardado.nombreCompleto,
        correo: guardado.correo,
        tipo: guardado.tipo,
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

    const usuario = await Usuario.findOne({ correo });
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
      { id: usuario._id, tipo: usuario.tipo },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" },
    );

    res.json({
      token,
      usuario: {
        id: usuario._id,
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
    const usuario = await Usuario.findById(req.usuarioId).select("-password");
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
    const usuario = await Usuario.findById(req.params.id).select(
      "nombreCompleto ventasExitosas reportes createdAt",
    );
    if (!usuario) {
      return res.status(404).json({ message: "Vendedor no encontrado" });
    }

    const productos = await Producto.find({
      vendedorId: req.params.id,
      activo: true,
    });

    res.json({ usuario, productos });
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

    await Usuario.findByIdAndUpdate(req.usuarioId, {
      horarios,
      horarioConfirmadoEn: new Date(),
      diasSinConfirmarHorario: 0,
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

    const usuario = await Usuario.findOne({ correo });

    if (!usuario) {
      return res.status(200).json({ message: MENSAJE_RECUPERACION_ENVIADA });
    }

    const codigo = generarCodigoRecuperacion();
    usuario.codigoRecuperacion = codigo;
    usuario.codigoRecuperacionExpira = new Date(
      Date.now() + MINUTOS_EXPIRACION_RECUPERACION * 60 * 1000,
    );
    await usuario.save();

    await enviarCorreoRecuperacion(usuario.correo, codigo);

    res.status(200).json({ message: MENSAJE_RECUPERACION_ENVIADA });
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

    const usuario = await Usuario.findOne({ correo });

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

    const usuario = await Usuario.findOne({ correo });

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

    usuario.password = await bcrypt.hash(password, 10);
    usuario.codigoRecuperacion = undefined;
    usuario.codigoRecuperacionExpira = undefined;
    await usuario.save();

    res.json({ message: "Contraseña actualizada correctamente" });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al restablecer la contraseña" });
  }
}
