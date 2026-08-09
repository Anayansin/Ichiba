import { Response } from "express";
import { Usuario } from "../models/usuario";
import { enviarSMS } from "../services/smsvices";
import { enviarCorreoVerificacion } from "../services/emailService.js";
import { generarCodigo } from "../utils/generarCodigo.js";
import { RequestConUsuario } from "../middleware/auth.js";

const MINUTOS_EXPIRACION = 10;

export async function enviarCodigoTelefono(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const usuario = await Usuario.findById(req.usuarioId);
    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const codigo = generarCodigo();
    usuario.codigoTelefono = codigo;
    usuario.codigoTelefonoExpira = new Date(
      Date.now() + MINUTOS_EXPIRACION * 60 * 1000,
    );
    await usuario.save();

    const telefonoConCodigoPais = usuario.telefono.startsWith("+")
      ? usuario.telefono
      : `+52${usuario.telefono.replace(/\D/g, "")}`;

    await enviarSMS(telefonoConCodigoPais, codigo);

    res.json({ message: "Código enviado por SMS" });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al enviar el código por SMS" });
  }
}

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

export async function verificarCodigoTelefono(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const { codigo } = req.body;
    const usuario = await Usuario.findById(req.usuarioId);

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    if (!usuario.codigoTelefono || !usuario.codigoTelefonoExpira) {
      return res
        .status(400)
        .json({ message: "No hay un código pendiente, solicita uno nuevo" });
    }

    if (usuario.codigoTelefonoExpira < new Date()) {
      return res
        .status(400)
        .json({ message: "El código expiró, solicita uno nuevo" });
    }

    if (usuario.codigoTelefono !== codigo) {
      return res.status(400).json({ message: "Código incorrecto" });
    }

    usuario.telefonoVerificado = true;
    usuario.codigoTelefono = undefined;
    usuario.codigoTelefonoExpira = undefined;
    await usuario.save();

    res.json({ message: "Teléfono verificado correctamente" });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al verificar el código" });
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
