import { Mensaje } from "../models/Mensaje.js";
import { Producto } from "../models/producto.js";
import { Venta } from "../models/Venta.js";
import clientePrisma from "../configuracion/prisma.js";
import {
  expirarTurnoSiVencido,
  iniciarTemporizadorPago,
  limpiarFilasHuerfanas,
  reacomodarFila,
} from "../services/filaService.js";
import {
  campoConPalabrasProhibidas,
  mensajePalabrasProhibidas,
} from "../utils/filtroPalabras.js";
import {
  CANAL_DISPUTAS,
  CANAL_LISTA_NEGRA,
  CANAL_REPORTES_PENDIENTES,
  CANAL_RESUMEN_ADMIN,
  CANAL_SOLICITUDES_REGISTRO,
  CANAL_USUARIOS_ADMIN,
  suscribirseAlCanal,
} from "./suscripciones.js";
import { calcularResumenAdmin } from "../services/resumenAdminService.js";
import type { ContextoGraphQL } from "./contexto.js";

const MENSAJE_CHAT_AJENO =
  "No puedes acceder a este chat porque esta venta no pertenece a tu cuenta";

type ArgumentosProducto = {
  id: string;
};

type ArgumentosMisFilas = {
  compradorId: string;
};

type ArgumentosEstadoFila = {
  productoId: string;
  compradorId: string;
};

type ArgumentosEntrarFila = {
  productoId: string;
  compradorId: string;
};

type ArgumentosSalirFila = {
  id: string;
  compradorId: string;
};

type ArgumentosPerfilPublico = {
  id: string;
};

type ArgumentosMensajesComprador = {
  ventaId: string;
  compradorId: string;
};

type ArgumentosMensajesVendedor = {
  ventaId: string;
};

type ArgumentosEnviarMensajeComprador = {
  ventaId: string;
  compradorId: string;
  contenido: string;
};

type ArgumentosEnviarMensajeVendedor = {
  ventaId: string;
  contenido: string;
};

const limiteFilasActivas = 3;

function obtenerCompradorId(
  contexto: ContextoGraphQL | undefined,
  compradorIdSolicitado: string,
): string {
  const compradorIdCabecera = contexto?.compradorId;
  if (!compradorIdCabecera) {
    throw new Error("Falta identificador de comprador");
  }

  if (compradorIdCabecera !== compradorIdSolicitado) {
    throw new Error("El identificador de comprador no coincide");
  }

  return compradorIdCabecera;
}

function obtenerUsuarioIdAutenticado(
  contexto: ContextoGraphQL | undefined,
): string {
  const usuarioId = contexto?.usuarioId;
  if (!usuarioId) {
    throw new Error("No autorizado, falta el token");
  }

  return usuarioId;
}

async function validarAccesoComprador(
  ventaId: string,
  compradorId: string,
) {
  const venta = await Venta.findById(ventaId);
  if (!venta || venta.compradorId !== compradorId) {
    return null;
  }

  return venta;
}

async function validarAccesoVendedor(ventaId: string, vendedorId: string) {
  const venta = await Venta.findById(ventaId);
  if (!venta || venta.vendedorId.toString() !== vendedorId) {
    return null;
  }

  return venta;
}

function validarContenido(contenido: string): string {
  const contenidoNormalizado = contenido.trim();
  if (!contenidoNormalizado) {
    throw new Error("Escribe un mensaje");
  }

  const campoProhibido = campoConPalabrasProhibidas({
    contenido: contenidoNormalizado,
  });
  if (campoProhibido) {
    throw new Error(mensajePalabrasProhibidas(campoProhibido));
  }

  return contenidoNormalizado;
}

export const resolutoresGraphQL = {
  Producto: {
    id: (producto: { _id: { toString: () => string } }) =>
      producto._id.toString(),
  },
  Query: {
    estado: () => "graphql activo",
    productos: async () => Producto.find({ activo: true }),
    producto: async (
      _objetoPadre: unknown,
      argumentos: ArgumentosProducto,
    ) => Producto.findById(argumentos.id),
    misFilas: async (
      _objetoPadre: unknown,
      argumentos: ArgumentosMisFilas,
      contexto: ContextoGraphQL | undefined,
    ) => {
      const compradorId = obtenerCompradorId(contexto, argumentos.compradorId);
      await limpiarFilasHuerfanas(compradorId);
      return clientePrisma.cola.findMany({
        where: { compradorId, estado: "activa" },
        orderBy: { posicion: "asc" },
      });
    },
    estadoDeMiFila: async (
      _objetoPadre: unknown,
      argumentos: ArgumentosEstadoFila,
      contexto: ContextoGraphQL | undefined,
    ) => {
      const compradorId = obtenerCompradorId(contexto, argumentos.compradorId);
      const fila = await clientePrisma.cola.findFirst({
        where: { productoId: argumentos.productoId, compradorId, estado: "activa" },
      });

      if (!fila) {
        return null;
      }

      if (fila.posicion === 1) {
        if (!fila.pagoExpiraEn) {
          await iniciarTemporizadorPago(fila);
          await clientePrisma.cola.update({
            where: { id: Number(fila.id) },
            data: { pagoExpiraEn: fila.pagoExpiraEn },
          });
        } else if (await expirarTurnoSiVencido(fila)) {
          return null;
        }
      }

      return fila;
    },
    miPerfil: async (
      _objetoPadre: unknown,
      _argumentos: unknown,
      contexto: ContextoGraphQL | undefined,
    ) => {
      const usuarioId = obtenerUsuarioIdAutenticado(contexto);
      const usuario = await clientePrisma.usuario.findUnique({
        where: { id: Number(usuarioId) },
      });
      if (!usuario) return null;
      const { password: _password, ...resto } = usuario;
      return resto;
    },
    perfilPublico: async (
      _objetoPadre: unknown,
      argumentos: ArgumentosPerfilPublico,
    ) => {
      const usuario = await clientePrisma.usuario.findUnique({
        where: { id: Number(argumentos.id) },
      });
      if (!usuario) return null;
      return {
        nombreCompleto: usuario.nombreCompleto,
        ventasExitosas: usuario.ventasExitosas,
        reportes: usuario.totalReportes,
      };
    },
    mensajesComoComprador: async (
      _objetoPadre: unknown,
      argumentos: ArgumentosMensajesComprador,
      contexto: ContextoGraphQL | undefined,
    ) => {
      const compradorId = obtenerCompradorId(contexto, argumentos.compradorId);
      const venta = await validarAccesoComprador(
        argumentos.ventaId,
        compradorId,
      );
      if (!venta) {
        throw new Error(MENSAJE_CHAT_AJENO);
      }

      return Mensaje.find({ ventaId: argumentos.ventaId }).sort({
        createdAt: 1,
      });
    },
    mensajesComoVendedor: async (
      _objetoPadre: unknown,
      argumentos: ArgumentosMensajesVendedor,
      contexto: ContextoGraphQL | undefined,
    ) => {
      const vendedorId = obtenerUsuarioIdAutenticado(contexto);
      const venta = await validarAccesoVendedor(
        argumentos.ventaId,
        vendedorId,
      );
      if (!venta) {
        throw new Error(MENSAJE_CHAT_AJENO);
      }

      return Mensaje.find({ ventaId: argumentos.ventaId }).sort({
        createdAt: 1,
      });
    },
  },
  Mutation: {
    cambiarEstadoProducto: async (
      _objetoPadre: unknown,
      argumentos: ArgumentosProducto,
      contexto: ContextoGraphQL | undefined,
    ) => {
      const usuarioId = obtenerUsuarioIdAutenticado(contexto);
      const productoEncontrado = await Producto.findById(argumentos.id);
      if (!productoEncontrado) {
        throw new Error("Producto no encontrado");
      }

      if (productoEncontrado.vendedorId.toString() !== usuarioId) {
        throw new Error(
          "No puedes modificar este producto porque pertenece a otro vendedor",
        );
      }

      productoEncontrado.activo = !productoEncontrado.activo;
      await productoEncontrado.save();
      return productoEncontrado;
    },
    entrarEnFila: async (
      _objetoPadre: unknown,
      argumentos: ArgumentosEntrarFila,
      contexto: ContextoGraphQL | undefined,
    ) => {
      const compradorId = obtenerCompradorId(contexto, argumentos.compradorId);
      await limpiarFilasHuerfanas(compradorId);

      const yaEstaEnEstaFila = await clientePrisma.cola.findFirst({
        where: {
          productoId: argumentos.productoId,
          compradorId,
          estado: "activa",
        },
      });

      if (yaEstaEnEstaFila) {
        throw new Error("Ya estás en la fila de este producto");
      }

      const filasActivasDelComprador = await clientePrisma.cola.count({
        where: { compradorId, estado: "activa" },
      });

      if (filasActivasDelComprador >= limiteFilasActivas) {
        throw new Error(
          `Solo puedes estar en ${limiteFilasActivas} filas al mismo tiempo`,
        );
      }

      const ultimaOcupada = await clientePrisma.cola.findFirst({
        where: { productoId: argumentos.productoId, estado: "activa" },
        orderBy: { posicion: "desc" },
        select: { posicion: true },
      });

      const posicion = (ultimaOcupada?.posicion ?? 0) + 1;

      const nuevaFila = await clientePrisma.cola.create({
        data: { productoId: argumentos.productoId, compradorId, posicion },
      });

      if (posicion === 1) {
        await iniciarTemporizadorPago(nuevaFila);
        await clientePrisma.cola.update({
          where: { id: Number(nuevaFila.id) },
          data: { pagoExpiraEn: nuevaFila.pagoExpiraEn },
        });
      }

      return { ...nuevaFila, _id: String(nuevaFila.id) };
    },
    salirDeFila: async (
      _objetoPadre: unknown,
      argumentos: ArgumentosSalirFila,
      contexto: ContextoGraphQL | undefined,
    ) => {
      const compradorId = obtenerCompradorId(contexto, argumentos.compradorId);
      const fila = await clientePrisma.cola.findFirst({
        where: { id: Number(argumentos.id), compradorId },
      });

      if (!fila) {
        return null;
      }

      await clientePrisma.cola.update({
        where: { id: fila.id },
        data: { estado: "finalizada", motivoCierre: "salio_voluntariamente" },
      });

      await reacomodarFila(fila.productoId, fila.posicion);
      return { ...fila, _id: String(fila.id) };
    },
    enviarMensajeComoComprador: async (
      _objetoPadre: unknown,
      argumentos: ArgumentosEnviarMensajeComprador,
      contexto: ContextoGraphQL | undefined,
    ) => {
      const compradorId = obtenerCompradorId(contexto, argumentos.compradorId);
      const venta = await validarAccesoComprador(
        argumentos.ventaId,
        compradorId,
      );
      if (!venta) {
        throw new Error(MENSAJE_CHAT_AJENO);
      }

      const contenido = validarContenido(argumentos.contenido);
      const mensaje = new Mensaje({
        ventaId: argumentos.ventaId,
        remitente: "comprador",
        remitenteId: compradorId,
        contenido,
        imagen: null,
      });
      const mensajeGuardado = await mensaje.save();
      return mensajeGuardado;
    },
    enviarMensajeComoVendedor: async (
      _objetoPadre: unknown,
      argumentos: ArgumentosEnviarMensajeVendedor,
      contexto: ContextoGraphQL | undefined,
    ) => {
      const vendedorId = obtenerUsuarioIdAutenticado(contexto);
      const venta = await validarAccesoVendedor(
        argumentos.ventaId,
        vendedorId,
      );
      if (!venta) {
        throw new Error(MENSAJE_CHAT_AJENO);
      }

      const contenido = validarContenido(argumentos.contenido);
      const mensaje = new Mensaje({
        ventaId: argumentos.ventaId,
        remitente: "vendedor",
        remitenteId: vendedorId,
        contenido,
        imagen: null,
      });
      const mensajeGuardado = await mensaje.save();
      return mensajeGuardado;
    },
  },
  Subscription: {
    resumenAdmin: {
      subscribe: () => suscribirseAlCanal(CANAL_RESUMEN_ADMIN),
      resolve: () => calcularResumenAdmin(),
    },
    reportesPendientes: {
      subscribe: () => suscribirseAlCanal(CANAL_REPORTES_PENDIENTES),
      resolve: (evento: unknown) => evento,
    },
    usuariosAdmin: {
      subscribe: () => suscribirseAlCanal(CANAL_USUARIOS_ADMIN),
      resolve: (evento: unknown) => evento,
    },
    listaNegraActualizada: {
      subscribe: () => suscribirseAlCanal(CANAL_LISTA_NEGRA),
      resolve: (evento: unknown) => evento,
    },
    disputasActualizadas: {
      subscribe: () => suscribirseAlCanal(CANAL_DISPUTAS),
      resolve: (evento: unknown) => evento,
    },
    solicitudesRegistro: {
      subscribe: () => suscribirseAlCanal(CANAL_SOLICITUDES_REGISTRO),
      resolve: (evento: unknown) => evento,
    },
  },
};
