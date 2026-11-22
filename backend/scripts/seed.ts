import "dotenv/config";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { Producto } from "../src/models/producto.js";
import { Promocional } from "../src/models/Promocional.js";
import {
  CATEGORIAS_PRODUCTO,
  CATEGORIAS_PROMOCIONAL,
} from "../src/configuracion/categorias.js";
import { campoConPalabrasProhibidas } from "../src/utils/filtroPalabras.js";
import { validarPassword } from "../src/utils/validarPassword.js";
import clientePrisma from "../src/configuracion/prisma.js";

export const PASSWORD_DEMO = "Ichiba#Demo2026";
export const CORREO_ADMIN = "admin@ichiba.test";

const COLECCIONES_CONSERVADAS = new Set(["ejecuciontareas"]);
const CARPETA_IMAGENES = path.join(process.cwd(), "public", "uploads");

const HORARIO_AMPLIO = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
].map((dia) => ({ dia, activo: true, horaInicio: "08:00", horaFin: "22:00" }));

type ClaveVendedor = "mariana" | "carlos" | "lucia";

type CuentaSemilla = {
  nombreCompleto: string;
  direccion: string;
  telefono: string;
  correo: string;
  rfc: string;
  curp: string;
  tipo: "vendedor" | "admin";
};

const ADMIN: CuentaSemilla = {
  nombreCompleto: "Administración Ichiba",
  direccion: "Av. Vallarta 1525, Col. Americana, Guadalajara, Jalisco",
  telefono: "3330001000",
  correo: CORREO_ADMIN,
  rfc: "AIC260101AA1",
  curp: "AICX260101HJCDCH00",
  tipo: "admin",
};

const VENDEDORES: Record<ClaveVendedor, CuentaSemilla> = {
  mariana: {
    nombreCompleto: "Mariana Gómez Herrera",
    direccion: "Av. Chapultepec 245, Col. Americana, Guadalajara, Jalisco",
    telefono: "3312457890",
    correo: "mariana.gomez@ichiba.test",
    rfc: "GOHM900514AB1",
    curp: "GOHM900514MJCMRR05",
    tipo: "vendedor",
  },
  carlos: {
    nombreCompleto: "Carlos Ruiz Medina",
    direccion: "Calle Morelos 118, Centro, Zapopan, Jalisco",
    telefono: "3318764520",
    correo: "carlos.ruiz@ichiba.test",
    rfc: "RUMC871102H3A",
    curp: "RUMC871102HJCZDR08",
    tipo: "vendedor",
  },
  lucia: {
    nombreCompleto: "Lucía Fernández Ortega",
    direccion: "Av. Guadalupe 3410, Col. Chapalita, Guadalajara, Jalisco",
    telefono: "3325149873",
    correo: "lucia.fernandez@ichiba.test",
    rfc: "FEOL930321QK7",
    curp: "FEOL930321MJCRRC02",
    tipo: "vendedor",
  },
};

type Condicion = "nuevo" | "usado-como-nuevo" | "usado-buen-estado" | "usado-aceptable";
type Entrega = "domicilio" | "tienda" | "punto-encuentro";

type ProductoSemilla = {
  vendedor: ClaveVendedor;
  categoria: (typeof CATEGORIAS_PRODUCTO)[number];
  nombre: string;
  descripcion: string;
  precio: number;
  condicion: Condicion;
  metodoEntrega: Entrega;
  imagen: string;
};

type PromocionalSemilla = {
  vendedor: ClaveVendedor;
  categoria: (typeof CATEGORIAS_PROMOCIONAL)[number];
  nombre: string;
  descripcion: string;
  precio: number;
  condicion: Condicion;
  coberturaEnvio: string;
  imagen: string;
};

const PRODUCTOS: ProductoSemilla[] = [
  {
    vendedor: "mariana",
    categoria: "Artesanias",
    nombre: "Jarrón de barro negro",
    descripcion: "Jarrón de barro negro pulido a mano, de 30 cm de alto. Pieza única para sala o recibidor.",
    precio: 850,
    condicion: "nuevo",
    metodoEntrega: "tienda",
    imagen: "jarron-barro-negro.jpg",
  },
  {
    vendedor: "mariana",
    categoria: "Artesanias",
    nombre: "Juego de 4 canastas tejidas",
    descripcion: "Cuatro canastas de mimbre tejidas a mano en distintos tamaños, ideales para organizar.",
    precio: 690,
    condicion: "nuevo",
    metodoEntrega: "domicilio",
    imagen: "canasta-tejida.jpg",
  },
  {
    vendedor: "mariana",
    categoria: "Artesanias",
    nombre: "Par de tazas de cerámica artesanal",
    descripcion: "Dos tazas de cerámica esmaltada hechas a mano, de 350 ml. Aptas para microondas.",
    precio: 420,
    condicion: "nuevo",
    metodoEntrega: "domicilio",
    imagen: "tazas-ceramica.jpg",
  },
  {
    vendedor: "carlos",
    categoria: "Ropa",
    nombre: "Zapatos de vestir de piel café",
    descripcion: "Zapatos tipo Oxford de piel genuina color café, talla 27 MX. Usados solo dos veces.",
    precio: 1350,
    condicion: "usado-como-nuevo",
    metodoEntrega: "punto-encuentro",
    imagen: "zapatos-piel.jpg",
  },
  {
    vendedor: "carlos",
    categoria: "Ropa",
    nombre: "Botas de piel con agujetas",
    descripcion: "Botas de piel color chocolate, talla 26 MX, con suela de goma antiderrapante. Poco uso.",
    precio: 1600,
    condicion: "usado-buen-estado",
    metodoEntrega: "punto-encuentro",
    imagen: "botas-piel.jpg",
  },
  {
    vendedor: "carlos",
    categoria: "Ropa",
    nombre: "Chamarra de mezclilla clásica",
    descripcion: "Chamarra de mezclilla azul con cuello de pana, talla M. Lavada y en excelente estado.",
    precio: 780,
    condicion: "usado-como-nuevo",
    metodoEntrega: "domicilio",
    imagen: "chamarra-mezclilla.jpg",
  },
  {
    vendedor: "mariana",
    categoria: "Hogar",
    nombre: "Lámpara de mesa con base cerámica",
    descripcion: "Lámpara de mesa con base de cerámica texturizada y pantalla de lino. Incluye foco E27.",
    precio: 950,
    condicion: "nuevo",
    metodoEntrega: "tienda",
    imagen: "lampara-ceramica.jpg",
  },
  {
    vendedor: "mariana",
    categoria: "Hogar",
    nombre: "Par de cojines decorativos de lino",
    descripcion: "Dos cojines de 45 x 45 cm con funda de lino natural removible y relleno de fibra.",
    precio: 520,
    condicion: "nuevo",
    metodoEntrega: "domicilio",
    imagen: "cojines-decorativos.jpg",
  },
  {
    vendedor: "mariana",
    categoria: "Hogar",
    nombre: "Espejo redondo con marco de madera",
    descripcion: "Espejo redondo de 60 cm de diámetro con marco de madera de pino. Incluye herrajes.",
    precio: 1450,
    condicion: "nuevo",
    metodoEntrega: "tienda",
    imagen: "espejo-redondo.jpg",
  },
  {
    vendedor: "lucia",
    categoria: "Electrodomesticos",
    nombre: "Cafetera de goteo para 10 tazas",
    descripcion: "Cafetera eléctrica de goteo con jarra de vidrio para 10 tazas y placa que mantiene el calor.",
    precio: 890,
    condicion: "usado-como-nuevo",
    metodoEntrega: "domicilio",
    imagen: "cafetera-goteo.jpg",
  },
  {
    vendedor: "lucia",
    categoria: "Electrodomesticos",
    nombre: "Tostador de pan de dos ranuras",
    descripcion: "Tostador de acero inoxidable con dos ranuras, siete niveles de dorado y charola de migajas.",
    precio: 650,
    condicion: "usado-buen-estado",
    metodoEntrega: "domicilio",
    imagen: "tostador-pan.jpg",
  },
  {
    vendedor: "lucia",
    categoria: "Electrodomesticos",
    nombre: "Licuadora de alto rendimiento",
    descripcion: "Licuadora de 1,200 W con vaso de 2 litros libre de BPA, ideal para jugos y licuados.",
    precio: 2400,
    condicion: "usado-como-nuevo",
    metodoEntrega: "punto-encuentro",
    imagen: "licuadora.jpg",
  },
  {
    vendedor: "lucia",
    categoria: "Coleccionables",
    nombre: "Cámara fotográfica de rollo vintage",
    descripcion: "Cámara de 35 mm de los años 60 con correa de piel. Funciona; ideal para coleccionistas.",
    precio: 2800,
    condicion: "usado-buen-estado",
    metodoEntrega: "tienda",
    imagen: "camara-vintage.jpg",
  },
  {
    vendedor: "lucia",
    categoria: "Coleccionables",
    nombre: "Colección de 40 discos de vinil",
    descripcion: "Lote de 40 discos de vinil de rock, jazz y música mexicana de los años 70 y 80.",
    precio: 3500,
    condicion: "usado-buen-estado",
    metodoEntrega: "punto-encuentro",
    imagen: "discos-vinil.jpg",
  },
  {
    vendedor: "lucia",
    categoria: "Coleccionables",
    nombre: "Máquina de escribir antigua",
    descripcion: "Máquina de escribir mecánica de los años 50, teclado completo y cinta nueva instalada.",
    precio: 4200,
    condicion: "usado-aceptable",
    metodoEntrega: "tienda",
    imagen: "maquina-escribir.jpg",
  },
  {
    vendedor: "carlos",
    categoria: "Otros",
    nombre: "Mochila de piel para laptop",
    descripcion: "Mochila de piel color vino con compartimento acolchado para laptop de 15 pulgadas.",
    precio: 1800,
    condicion: "usado-como-nuevo",
    metodoEntrega: "domicilio",
    imagen: "mochila-piel.jpg",
  },
  {
    vendedor: "carlos",
    categoria: "Otros",
    nombre: "Audífonos inalámbricos",
    descripcion: "Audífonos inalámbricos con cancelación de ruido, 30 horas de batería y estuche rígido.",
    precio: 2900,
    condicion: "usado-como-nuevo",
    metodoEntrega: "domicilio",
    imagen: "audifonos-inalambricos.jpg",
  },
  {
    vendedor: "carlos",
    categoria: "Otros",
    nombre: "Guitarra acústica de cedro",
    descripcion: "Guitarra acústica con tapa de cedro, cuerdas nuevas y funda acolchada incluida.",
    precio: 3200,
    condicion: "usado-buen-estado",
    metodoEntrega: "tienda",
    imagen: "guitarra-acustica.jpg",
  },
];

const PROMOCIONALES: PromocionalSemilla[] = [
  {
    vendedor: "lucia",
    categoria: "autos-y-vehiculos",
    nombre: "Sedán compacto 2020",
    descripcion: "Sedán blanco modelo 2020, 45,000 km, un solo dueño y servicios de agencia al corriente.",
    precio: 289000,
    condicion: "usado-buen-estado",
    coberturaEnvio: "Se muestra en Guadalajara, Jalisco, con cita previa.",
    imagen: "sedan-blanco.jpg",
  },
  {
    vendedor: "lucia",
    categoria: "casas-y-propiedades",
    nombre: "Casa de dos plantas con cochera",
    descripcion: "Casa de 3 recámaras y 2.5 baños, cochera para dos autos y patio. Escrituras en regla.",
    precio: 3450000,
    condicion: "usado-como-nuevo",
    coberturaEnvio: "Ubicada en Zapopan, Jalisco. Visitas con cita previa.",
    imagen: "casa-dos-plantas.jpg",
  },
  {
    vendedor: "carlos",
    categoria: "terrenos-y-lotes",
    nombre: "Terreno campestre de 2,000 m²",
    descripcion: "Terreno plano con acceso por camino de terracería, con agua y luz a pie de predio.",
    precio: 780000,
    condicion: "nuevo",
    coberturaEnvio: "Tlajomulco, Jalisco. Recorridos en fin de semana.",
    imagen: "terreno-campestre.jpg",
  },
  {
    vendedor: "carlos",
    categoria: "joyas-y-relojes",
    nombre: "Reloj automático de acero",
    descripcion: "Reloj automático con caja de acero de 40 mm, cristal de zafiro y correa de piel café.",
    precio: 18500,
    condicion: "usado-como-nuevo",
    coberturaEnvio: "Entrega en persona en Guadalajara o envío asegurado.",
    imagen: "reloj-acero.jpg",
  },
  {
    vendedor: "mariana",
    categoria: "muebles-y-arte",
    nombre: "Sofá de tres plazas tapizado",
    descripcion: "Sofá de tres plazas tapizado en tela beige, estructura de madera y cojines removibles.",
    precio: 14500,
    condicion: "usado-buen-estado",
    coberturaEnvio: "Entrega a domicilio en la zona metropolitana de Guadalajara.",
    imagen: "sofa-tres-plazas.jpg",
  },
  {
    vendedor: "lucia",
    categoria: "servicios",
    nombre: "Fotografía profesional de eventos",
    descripcion: "Cobertura fotográfica de bodas y eventos sociales: 6 horas y 300 fotos editadas.",
    precio: 9800,
    condicion: "nuevo",
    coberturaEnvio: "Servicio en todo Jalisco; fuera del estado con costo de traslado.",
    imagen: "equipo-fotografia.jpg",
  },
  {
    vendedor: "carlos",
    categoria: "otros",
    nombre: "Bicicleta de montaña rodada 29",
    descripcion: "Bicicleta de montaña con cuadro de aluminio, 21 velocidades y frenos de disco.",
    precio: 8900,
    condicion: "usado-buen-estado",
    coberturaEnvio: "Entrega en Guadalajara o envío por paquetería a todo el país.",
    imagen: "bicicleta-montana.jpg",
  },
];

const HORARIOS_ENTREGA: Record<Entrega, [string, string]> = {
  domicilio: ["09:00", "19:00"],
  tienda: ["10:00", "20:00"],
  "punto-encuentro": ["12:00", "20:00"],
};

function validarDatos() {
  const errores: string[] = [];
  if (validarPassword(PASSWORD_DEMO)) errores.push("La contraseña demo no cumple RQNF1.7");

  const revisar = (etiqueta: string, nombre: string, descripcion: string, imagen: string) => {
    if (nombre.length < 10 || nombre.length > 35) {
      errores.push(`${etiqueta}: el nombre mide ${nombre.length} caracteres (10-35)`);
    }
    if (descripcion.length < 30 || descripcion.length > 100) {
      errores.push(`${etiqueta}: la descripción mide ${descripcion.length} caracteres (30-100)`);
    }
    if (campoConPalabrasProhibidas({ nombre, descripcion })) {
      errores.push(`${etiqueta}: contiene palabras no permitidas`);
    }
    if (!fs.existsSync(path.join(CARPETA_IMAGENES, imagen))) {
      errores.push(`${etiqueta}: no existe la imagen ${imagen}`);
    }
  };

  for (const producto of PRODUCTOS) {
    revisar(`Producto "${producto.nombre}"`, producto.nombre, producto.descripcion, producto.imagen);
    if (producto.precio < 10 || producto.precio > 5000) {
      errores.push(`Producto "${producto.nombre}": el precio debe estar entre $10 y $5,000`);
    }
  }
  for (const promocional of PROMOCIONALES) {
    revisar(`Promocional "${promocional.nombre}"`, promocional.nombre, promocional.descripcion, promocional.imagen);
    if (promocional.precio < 5001) {
      errores.push(`Promocional "${promocional.nombre}": el precio debe ser de $5,001 o más`);
    }
  }

  if (errores.length > 0) {
    throw new Error(`La semilla tiene datos inválidos:\n- ${errores.join("\n- ")}`);
  }
}

async function vaciarPostgres() {
  const todas = { id: { gte: 0 } };
  for (const tabla of ["reporte", "venta", "cola", "usuario"] as const) {
    const { count } = await clientePrisma[tabla].deleteMany({ where: todas });
    console.log(`PostgreSQL: ${count} registro(s) eliminados de ${tabla}`);
  }
}

async function vaciarMongo() {
  const colecciones = await mongoose.connection.db!.collections();
  for (const coleccion of colecciones) {
    if (COLECCIONES_CONSERVADAS.has(coleccion.collectionName)) continue;
    const { deletedCount } = await coleccion.deleteMany({});
    if (deletedCount > 0) {
      console.log(`MongoDB: ${deletedCount} documento(s) eliminados de ${coleccion.collectionName}`);
    }
  }
}

async function crearCuenta(cuenta: CuentaSemilla, passwordHasheada: string) {
  const creada = await clientePrisma.usuario.create({
    data: {
      nombreCompleto: cuenta.nombreCompleto,
      direccion: cuenta.direccion,
      telefono: cuenta.telefono,
      correo: cuenta.correo,
      rfc: cuenta.rfc,
      curp: cuenta.curp,
      password: passwordHasheada,
      tipo: cuenta.tipo,
      ineFrente: "/uploads/ine/semilla-frente.jpg",
      ineReverso: "/uploads/ine/semilla-reverso.jpg",
      aceptaTerminos: true,
      recibirNotificacionesCriticas: true,
      recibirNotificacionesPublicitarias: true,
      correoVerificado: true,
      paypalEmail: cuenta.correo,
      metodoPago: "paypal",
      horarios: HORARIO_AMPLIO,
      horarioConfirmadoEn: new Date(),
      diasSinConfirmarHorario: 0,
    },
  });
  return { id: String(creada.id), nombre: cuenta.nombreCompleto };
}

async function main() {
  validarDatos();

  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("La variable MONGO_URI no está definida en backend/.env");

  await mongoose.connect(uri);
  try {
    await vaciarPostgres();
    await vaciarMongo();

    const passwordHasheada = await bcrypt.hash(PASSWORD_DEMO, 10);
    await crearCuenta(ADMIN, passwordHasheada);

    const vendedores = {} as Record<ClaveVendedor, { id: string; nombre: string }>;
    for (const clave of Object.keys(VENDEDORES) as ClaveVendedor[]) {
      vendedores[clave] = await crearCuenta(VENDEDORES[clave], passwordHasheada);
    }

    const ahora = Date.now();
    await Producto.insertMany(
      PRODUCTOS.map((producto, indice) => ({
        nombre: producto.nombre,
        descripcion: producto.descripcion,
        precio: producto.precio,
        categoria: producto.categoria,
        condicion: producto.condicion,
        condicionUso: producto.condicion,
        metodoEntrega: producto.metodoEntrega,
        horarioEntregaInicio: HORARIOS_ENTREGA[producto.metodoEntrega][0],
        horarioEntregaFin: HORARIOS_ENTREGA[producto.metodoEntrega][1],
        tiempoLimitePago: 60,
        imagenes: [`/uploads/${producto.imagen}`],
        vendedor: vendedores[producto.vendedor].nombre,
        vendedorId: vendedores[producto.vendedor].id,
        activo: true,
        createdAt: new Date(ahora - indice * 60_000),
      })),
    );

    await Promocional.insertMany(
      PROMOCIONALES.map((promocional, indice) => ({
        nombre: promocional.nombre,
        descripcion: promocional.descripcion,
        precio: promocional.precio,
        categoria: promocional.categoria,
        condicionUso: promocional.condicion,
        coberturaEnvio: promocional.coberturaEnvio,
        chatHabilitado: true,
        zonaComentariosHabilitada: true,
        imagenes: [`/uploads/${promocional.imagen}`],
        vendedor: vendedores[promocional.vendedor].nombre,
        vendedorId: vendedores[promocional.vendedor].id,
        activo: true,
        createdAt: new Date(ahora - indice * 60_000),
      })),
    );

    console.log(`\nCuentas creadas (contraseña: ${PASSWORD_DEMO}):`);
    console.log(`  - ${ADMIN.correo} (administrador)`);
    for (const clave of Object.keys(VENDEDORES) as ClaveVendedor[]) {
      console.log(`  - ${VENDEDORES[clave].correo} (vendedor)`);
    }
    console.log(`Productos: ${PRODUCTOS.length} · Promocionales: ${PROMOCIONALES.length}`);
  } finally {
    await clientePrisma.close().catch(() => {});
    await mongoose.disconnect();
  }
}

main()
  .then(() => console.log("\nSemilla finalizada"))
  .catch(async (error) => {
    console.error("\nFalló la semilla:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
    await mongoose.disconnect().catch(() => {});
  });
