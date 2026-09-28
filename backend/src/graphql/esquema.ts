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
