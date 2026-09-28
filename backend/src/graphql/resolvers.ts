import { Cola } from "../models/Cola.js";
import { Mensaje } from "../models/Mensaje.js";
import { Producto } from "../models/producto.js";
import { Usuario } from "../models/usuario.js";
import { Venta } from "../models/Venta.js";
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
import type { ContextoGraphQL } from "./contexto.js";

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
      return Cola.find({ compradorId, estado: "activa" }).sort({
        posicion: 1,
      });
    },
    estadoDeMiFila: async (
      _objetoPadre: unknown,
      argumentos: ArgumentosEstadoFila,
      contexto: ContextoGraphQL | undefined,
    ) => {
      const compradorId = obtenerCompradorId(contexto, argumentos.compradorId);
      const fila = await Cola.findOne({
        productoId: argumentos.productoId,
        compradorId,
        estado: "activa",
      });

      if (!fila) {
        return null;
      }

      if (fila.posicion === 1) {
        if (!fila.pagoExpiraEn) {
          await iniciarTemporizadorPago(fila);
          await fila.save();
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
      const usuario = await Usuario.findById(usuarioId).select("-password");
      return usuario;
    },
    perfilPublico: async (
      _objetoPadre: unknown,
      argumentos: ArgumentosPerfilPublico,
    ) => {
      const usuario = await Usuario.findById(argumentos.id).select(
        "nombreCompleto ventasExitosas reportes",
      );
      return usuario;
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
        throw new Error("No tienes acceso a este chat");
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
        throw new Error("No tienes acceso a este chat");
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
    ) => {
      const productoEncontrado = await Producto.findById(argumentos.id);
      if (!productoEncontrado) {
        return null;
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

      const yaEstaEnEstaFila = await Cola.findOne({
        productoId: argumentos.productoId,
        compradorId,
        estado: "activa",
      });

      if (yaEstaEnEstaFila) {
        throw new Error("Ya estás en la fila de este producto");
      }

      const filasActivasDelComprador = await Cola.countDocuments({
        compradorId,
        estado: "activa",
      });

      if (filasActivasDelComprador >= limiteFilasActivas) {
        throw new Error(
          `Solo puedes estar en ${limiteFilasActivas} filas al mismo tiempo`,
        );
      }

      const ultimaOcupada = await Cola.findOne({
        productoId: argumentos.productoId,
        estado: "activa",
      })
        .sort({ posicion: -1 })
        .select("posicion");

      const posicion = (ultimaOcupada?.posicion ?? 0) + 1;
      const nuevaFila = new Cola({
        productoId: argumentos.productoId,
        compradorId,
        posicion,
      });

      if (posicion === 1) {
        await iniciarTemporizadorPago(nuevaFila);
      }

      const filaGuardada = await nuevaFila.save();
      return filaGuardada;
    },
    salirDeFila: async (
      _objetoPadre: unknown,
      argumentos: ArgumentosSalirFila,
      contexto: ContextoGraphQL | undefined,
    ) => {
      const compradorId = obtenerCompradorId(contexto, argumentos.compradorId);
      const fila = await Cola.findOne({ _id: argumentos.id, compradorId });

      if (!fila) {
        return null;
      }

      fila.estado = "finalizada";
      await fila.save();
      await reacomodarFila(fila.productoId.toString(), fila.posicion);
      return fila;
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
        throw new Error("No tienes acceso a este chat");
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
        throw new Error("No tienes acceso a este chat");
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
};
