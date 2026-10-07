import { Response } from "express";
import { enviarCorreoVerificacion } from "../services/emailService.js";
import { generarCodigo } from "../utils/generarCodigo.js";
import { RequestConUsuario } from "../middleware/auth.js";
import clientePrisma from "../configuracion/prisma.js";
import { buscarUsuarioPorId } from "../services/usuarioService.js";
import { Usuario } from "../models/usuario.js";

const MINUTOS_EXPIRACION = 10;

export async function enviarCodigoCorreo(
  req: RequestConUsuario,
  res: Response,
) {
  try {
    const usuario = await buscarUsuarioPorId(req.usuarioId);
    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const codigo = generarCodigo();
    await clientePrisma.usuario.update({
      where: { id: usuario.id },
      data: {
        codigoCorreo: codigo,
        codigoCorreoExpira: new Date(
          Date.now() + MINUTOS_EXPIRACION * 60 * 1000,
        ),
      },
    });

    const enviado = await enviarCorreoVerificacion(usuario.correo, codigo);

    res.json({
      message: enviado
        ? "Código enviado por correo"
        : `Modo local: tu código de verificación es ${codigo}`,
    });
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
    const usuario = await buscarUsuarioPorId(req.usuarioId);

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

    await clientePrisma.usuario.update({
      where: { id: usuario.id },
      data: {
        correoVerificado: true,
        codigoCorreo: null,
        codigoCorreoExpira: null,
      },
    });

    // La copia de MongoDB (panel de administración, GraphQL y trabajos)
    // también debe quedar marcada como verificada.
    await Usuario.updateOne(
      { correo: usuario.correo },
      {
        $set: {
          correoVerificado: true,
          codigoCorreo: null,
          codigoCorreoExpira: null,
        },
      },
    ).catch((errorMongo) => {
      console.error(
        "[mongo] No se pudo actualizar el espejo del usuario:",
        errorMongo?.message ?? errorMongo,
      );
    });

    res.json({ message: "Correo verificado correctamente" });
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al verificar el código" });
  }
}
