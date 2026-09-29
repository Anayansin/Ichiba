import clientePrisma from "../configuracion/prisma.js";

export async function buscarUsuarioPorId(usuarioId: unknown) {
  const id = Number(usuarioId);
  if (!Number.isInteger(id)) return null;
  return clientePrisma.usuario.findUnique({ where: { id } });
}
