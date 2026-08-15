import { Response } from "express";
import { Usuario } from "../models/usuario";
import { enviarCorreoVerificacion } from "../services/emailService.js";
import { generarCodigo } from "../utils/generarCodigo.js";
import { RequestConUsuario } from "../middleware/auth.js";

const MINUTOS_EXPIRACION = 10;

export async function enviarCodigoCorreo(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const usuario = await Usuario.findById(req.usuarioId);
    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const codigo = generarCodigo();
    usuario.codigoCorreo = codigo;
    usuario.codigoCorreoExpira = new Date(
      Date.now() + MINUTOS_EXPIRACION * 60 * 1000,
    );
    await usuario.save();

    await enviarCorreoVerificacion(usuario.correo, codigo);

    res.json({ message: "Código enviado por correo" });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al enviar el código por correo" });
  }
}

export async function verificarCodigoCorreo(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const { codigo } = req.body;
    const usuario = await Usuario.findById(req.usuarioId);

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    if (!usuario.codigoCorreo || !usuario.codigoCorreoExpira) {
      return res
        .status(400)
        .json({ message: "No hay un código pendiente, solicita uno nuevo" });
    }

    if (usuario.codigoCorreoExpira < new Date()) {
      return res
        .status(400)
        .json({ message: "El código expiró, solicita uno nuevo" });
    }

    if (usuario.codigoCorreo !== codigo) {
      return res.status(400).json({ message: "Código incorrecto" });
    }

    usuario.correoVerificado = true;
    usuario.codigoCorreo = undefined;
    usuario.codigoCorreoExpira = undefined;
    await usuario.save();

    res.json({ message: "Correo verificado correctamente" });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al verificar el código" });
  }
}
