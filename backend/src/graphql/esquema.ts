export const definicionesEsquema = `
  type Producto {
    id: ID!
    nombre: String!
    precio: Float!
    imagenes: [String!]!
    categoria: String!
    descripcion: String!
    vendedor: String!
    vendedorId: ID!
    datosDeEnvio: String
    activo: Boolean!
  }

  type Cola {
    productoId: ID!
    compradorId: String!
    posicion: Int!
    estado: String!
  }

  type Usuario {
    nombreCompleto: String!
    correo: String
    ventasExitosas: Int!
    reportes: Int!
  }

  type Mensaje {
    ventaId: ID!
    remitente: String!
    contenido: String!
    createdAt: String!
  }

  type Query {
    estado: String!
    productos: [Producto!]!
    producto(id: ID!): Producto
    misFilas(compradorId: String!): [Cola!]!
    estadoDeMiFila(productoId: ID!, compradorId: String!): Cola
    miPerfil: Usuario
    perfilPublico(id: ID!): Usuario
    mensajesComoComprador(ventaId: ID!, compradorId: String!): [Mensaje!]!
    mensajesComoVendedor(ventaId: ID!): [Mensaje!]!
  }

  # ------------------------------------------------------------------
  # Fase 4 — BackOffice en vivo (GraphQL Subscriptions)
  # ------------------------------------------------------------------

  type UsuarioAdmin {
    id: ID!
    nombreCompleto: String!
    correo: String!
    tipo: String!
    suspendido: Boolean!
    puntosReputacion: Float!
    estadoCuenta: String!
    fechaRegistro: String
  }

  type PeriodoMes {
    desde: String!
  }

  type UsuariosResumen {
    total: Int!
    activos: Int!
    suspendidos: Int!
    cancelados: Int!
    administradores: Int!
    nuevos30Dias: Int!
  }

  type ProductosResumen {
    total: Int!
    activos: Int!
  }

  type PromocionalesResumen {
    total: Int!
    activos: Int!
  }

  type CatalogoResumen {
    productos: ProductosResumen!
    promocionales: PromocionalesResumen!
  }

  type VentasPorEstado {
    estado: String!
    total: Int!
    ingresos: Float!
  }

  type VentaResumen {
    id: ID!
    producto: String!
    vendedor: String!
    monto: Float!
    estado: String!
    fecha: String!
  }

  type VentasDelMes {
    total: Int!
    ingresos: Float!
  }

  type VentasResumen {
    total: Int!
    ingresos: Float!
    mes: VentasDelMes!
    porEstado: [VentasPorEstado!]!
    ultimas: [VentaResumen!]!
  }

  type ReportesResumen {
    pendientes: Int!
    total: Int!
  }

  type FilasResumen {
    activas: Int!
  }

  type MensajesResumen {
    total: Int!
  }

  type ListaNegraResumen {
    total: Int!
  }

  type ResumenAdmin {
    generadoEn: String!
    periodoMes: PeriodoMes!
    usuarios: UsuariosResumen!
    catalogo: CatalogoResumen!
    ventas: VentasResumen!
    reportes: ReportesResumen!
    filas: FilasResumen!
    mensajes: MensajesResumen!
    listaNegra: ListaNegraResumen!
    ultimosUsuarios: [UsuarioAdmin!]!
  }

  type EventoReporte {
    tipo: String!
    mensaje: String!
    pendientes: Int!
    generadoEn: String!
  }

  type EventoUsuario {
    tipo: String!
    mensaje: String!
    usuario: UsuarioAdmin
    generadoEn: String!
  }

  type EventoListaNegra {
    tipo: String!
    mensaje: String!
    entradas: Int!
    generadoEn: String!
  }

  type Subscription {
    "Resumen completo y fresco del dashboard, emitido al cambiar cualquier cifra."
    resumenAdmin: ResumenAdmin!
    "Reporte creado, confirmado o rechazado; incluye cuántos siguen pendientes."
    reportesPendientes: EventoReporte!
    "Usuarios: registro, suspensión, reactivación, puntos o cancelación."
    usuariosAdmin: EventoUsuario!
    "Entrada agregada o quitada de la lista negra."
    listaNegraActualizada: EventoListaNegra!
  }

  type Mutation {
    cambiarEstadoProducto(id: ID!): Producto
    entrarEnFila(productoId: ID!, compradorId: String!): Cola
    salirDeFila(id: ID!, compradorId: String!): Cola
    enviarMensajeComoComprador(
      ventaId: ID!
      compradorId: String!
      contenido: String!
    ): Mensaje
    enviarMensajeComoVendedor(ventaId: ID!, contenido: String!): Mensaje
  }
`;
