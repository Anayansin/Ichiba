import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Usuario } from "../models/usuario.js";

export async function registrarUsuario(req: Request, res: Response) {
  try {
    const { nombreCompleto, direccion, telefono, correo, rfc, password } =
      req.body;

    const usuarioExistente = await Usuario.findOne({ correo });
    if (usuarioExistente) {
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
