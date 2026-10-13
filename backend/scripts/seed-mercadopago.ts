/**
 * Semilla de 30 productos que se cobran con MercadoPago.
 *
 * Crea (o reutiliza) una cuenta de vendedor dedicada cuyo método de pago es
 * MercadoPago y le asigna 30 productos nuevos del catálogo (5 por categoría),
 * para poder probar el flujo de Checkout Pro sin tocar la semilla original
 * (`npm run seed`), que sigue siendo PayPal.
 *
 * Uso (desde la carpeta `backend`, con MongoDB y PostgreSQL en marcha):
 *   npm run seed:mp
 *
 * El script es idempotente: los productos quedan marcados con
 * `semilla: "mercadopago"` —distinto del `true` de la semilla normal, así
 * `npm run seed` no los borra— y se eliminan antes de volver a insertarlos.
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { Producto } from "../src/models/producto.js";
import { Usuario } from "../src/models/usuario.js";
import { CATEGORIAS_PRODUCTO } from "../src/configuracion/categorias.js";
import { campoConPalabrasProhibidas } from "../src/utils/filtroPalabras.js";
import clientePrisma from "../src/configuracion/prisma.js";

const MARCA_SEMILLA = "mercadopago";
const ARTICULOS_POR_CATEGORIA = 5;
const RUTA_UPLOADS = path.join(process.cwd(), "uploads");

const CORREO_VENDEDOR_MP = "vendedor.mp@ichiba.test";
const PASSWORD_VENDEDOR_MP = "IchibaMP123!";
const DATOS_MP = "vendedor.mp@example.com";

type Vendedor = { id: string; nombre: string };

type ProductoSemilla = {
  categoria: (typeof CATEGORIAS_PRODUCTO)[number];
  nombre: string;
  descripcion: string;
  precio: number;
};

const PRODUCTOS: ProductoSemilla[] = [
  // Artesanías
  { categoria: "Artesanias", nombre: "Bolsa de fibra de palma tejida", descripcion: "Bolsa tejida a mano con fibra de palma, asas resistentes y amplio interior para el mandado.", precio: 450 },
  { categoria: "Artesanias", nombre: "Cuenco de barro pulido a mano", descripcion: "Cuenco de barro pulido hasta darle brillo, perfecto para servir frutas o frijoles en la mesa.", precio: 380 },
  { categoria: "Artesanias", nombre: "Hamaca de algodón artesanal", descripcion: "Hamaca de algodón tejida en telar, mide 2.40 metros y soporta hasta 150 kilos de peso.", precio: 990 },
  { categoria: "Artesanias", nombre: "Canasto de mimbre para picnic", descripcion: "Canasto de mimbre con tapa, dos reabridores y tela interior lavable para salidas al campo.", precio: 720 },
  { categoria: "Artesanias", nombre: "Incensario de cerámica artesanal", descripcion: "Incensario de cerámica con grabado a mano, incluye soporte de varilla y base antiderramante.", precio: 310 },
  // Ropa
  { categoria: "Ropa", nombre: "Blusa de lino bordada a mano", descripcion: "Blusa de lino fresco con bordado floral en el cuello, confecciona a mano y ligera para el calor.", precio: 690 },
  { categoria: "Ropa", nombre: "Cinturón de cuero tejido", descripcion: "Cinturón de cuero tejido a mano con hebilla de latón, resistente y de acabado rústico.", precio: 540 },
  { categoria: "Ropa", nombre: "Gorro de punto para invierno", descripcion: "Gorro de punto de lana suave con doblez, abriga bien y queda cómodo todo el día.", precio: 260 },
  { categoria: "Ropa", nombre: "Huaraches de cuero artesanales", descripcion: "Huaraches de cuero curtido a mano con suela de hule, cómodos para caminar todos los días.", precio: 640 },
  { categoria: "Ropa", nombre: "Rebozo de seda con flecos", descripcion: "Rebozo de seda teñido a mano con flecos anudados, ideal para eventos y clima fresco.", precio: 1180 },
  // Hogar
  { categoria: "Hogar", nombre: "Jarrón de vidrio soplado", descripcion: "Jarrón de vidrio soplado a mano con tonos translúcidos, mide 30 centímetros de altura.", precio: 570 },
  { categoria: "Hogar", nombre: "Manta rústica de algodón", descripcion: "Manta rústica tejida en telar de algodón, mide 1.80 por 1.30 metros y abriga sin pesar.", precio: 850 },
  { categoria: "Hogar", nombre: "Organizador de madera para mesa", descripcion: "Organizador de madera con cajones y casilleros, mantiene reglas, cuadernos y notas en orden.", precio: 420 },
  { categoria: "Hogar", nombre: "Funda de cojín bordada a mano", descripcion: "Funda de cojín de 45 por 45 centímetros con bordado geométrico y cierre con cremallera.", precio: 290 },
  { categoria: "Hogar", nombre: "Reloj de pared de madera", descripcion: "Reloj de pared fabricado en madera laminada con agujas silenciosas, ideal para sala u oficina.", precio: 630 },
  // Electrodomésticos
  { categoria: "Electrodomesticos", nombre: "Batidora de mano recargable", descripcion: "Batidora de mano recargable con dos velocidades y varillas de acero, ligera y fácil de guardar.", precio: 780 },
  { categoria: "Electrodomesticos", nombre: "Sandwichera eléctrica compacta", descripcion: "Sandwichera eléctrica de placas antiadherentes, calienta en tres minutos y se limpia sin esfuerzo.", precio: 490 },
  { categoria: "Electrodomesticos", nombre: "Balanza de cocina digital", descripcion: "Balanza de cocina digital de hasta cinco kilos con precisión de un gramo y pantalla clara.", precio: 350 },
  { categoria: "Electrodomesticos", nombre: "Purificador de aire portátil", descripcion: "Purificador de aire portátil con filtro de carbón, silencioso para cuartos de hasta doce metros.", precio: 1450 },
  { categoria: "Electrodomesticos", nombre: "Freidora de aire de 4 litros", descripcion: "Freidora de aire con canasta de cuatro litros, panel táctil y ocho programas de cocción.", precio: 1990 },
  // Coleccionables
  { categoria: "Coleccionables", nombre: "Llaveros de equipo de fútbol", descripcion: "Llaveros de metal con escudos de equipo, lote de cinco piezas en caja original sin abrir.", precio: 320 },
  { categoria: "Coleccionables", nombre: "Ficha de lotería antigua", descripcion: "Ficha de lotería impresa en los años sesenta, conserva los colores vivos y viene en sobre nuevo.", precio: 240 },
  { categoria: "Coleccionables", nombre: "Muñeca de porcelana coleccionable", descripcion: "Muñeca de porcelana con vestido bordado y peinado a mano, en caja de exhibición con vidrio.", precio: 1250 },
  { categoria: "Coleccionables", nombre: "Sello postal de una emisión", descripcion: "Sello postal de la emisión de 1968 con su sobre original, pieza cuidada por un coleccionista.", precio: 480 },
  { categoria: "Coleccionables", nombre: "Autito de colección en metal", descripcion: "Auto de colección a escala 1:24 en metal, pintura impecable y ruedas móviles con su caja.", precio: 560 },
  // Otros
  { categoria: "Otros", nombre: "Set de láminas de acero", descripcion: "Set de doce láminas de acero con maletín de transporte, perfecto para manualidades y trabajos finos.", precio: 750 },
  { categoria: "Otros", nombre: "Silbato de emergencia multifunción", descripcion: "Silbato de emergencia con brújula, señalizador de luz y abridor de botellas, cabe en el bolsillo.", precio: 210 },
  { categoria: "Otros", nombre: "Mochila escolar reforzada", descripcion: "Mochila escolar con espalda reforzada, compartimento para cuadernos y bolsillos laterales.", precio: 470 },
  { categoria: "Otros", nombre: "Termo de acero de un litro", descripcion: "Termo de acero inoxidable de un litro con doble pared, conserva caliente o frío por horas.", precio: 590 },
  { categoria: "Otros", nombre: "Kit de pintura acrílica", descripcion: "Kit de pintura acrílica con doce colores, tres pinceles y lienzos de trapo para empezar.", precio: 380 },
];

const CONDICIONES_ROTACION = ["nuevo", "usado-como-nuevo", "usado-buen-estado", "usado-aceptable"] as const;
const METODOS_ENTREGA_ROTACION = ["domicilio", "tienda", "punto-encuentro"] as const;
const HORARIOS_ROTACION: Array<[string, string]> = [
  ["09:00", "18:00"],
  ["10:00", "20:00"],
  ["08:00", "14:00"],
];

const DIAS = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
] as const;

const HORARIOS_VENDEDOR_MP = DIAS.map((dia) => ({
  dia,
  activo: true,
  horaInicio: "09:00",
  horaFin: "18:00",
}));

/** Imágenes existentes en `uploads/`, en orden, para repartirlas entre los artículos. */
function cargarImagenes(): string[] {
  if (!fs.existsSync(RUTA_UPLOADS)) {
    throw new Error(
      `No existe la carpeta de imágenes ${RUTA_UPLOADS}. Sube al menos una imagen desde la app.`,
    );
  }

  const permitidas = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
  const archivos = fs
    .readdirSync(RUTA_UPLOADS)
    .filter((archivo) => permitidas.has(path.extname(archivo).toLowerCase()))
    .sort();

  if (archivos.length === 0) {
    throw new Error(
      `No hay imágenes en ${RUTA_UPLOADS}. Sube al menos una desde la app para que la semilla pueda usarla.`,
    );
  }

  return archivos.map((archivo) => `/uploads/${archivo}`);
}

function imagenesPara(indice: number, total: string[], cantidad: number): string[] {
  return Array.from(
    { length: cantidad },
    (_, paso) => total[(indice + paso) % total.length],
  );
}

function conLimite<T>(promesa: Promise<T>, milisegundos = 5000): Promise<T> {
  return Promise.race([
    promesa,
    new Promise<never>((_, rechazar) =>
      setTimeout(() => rechazar(new Error("timeout")), milisegundos),
    ),
  ]);
}

function validarDatos() {
  const errores: string[] = [];

  const conteo = new Map<string, number>();
  for (const producto of PRODUCTOS) {
    conteo.set(producto.categoria, (conteo.get(producto.categoria) ?? 0) + 1);
  }
  for (const [categoria, total] of conteo) {
    if (total !== ARTICULOS_POR_CATEGORIA) {
      errores.push(`Categoría "${categoria}" tiene ${total} productos, se esperaban ${ARTICULOS_POR_CATEGORIA}`);
    }
  }

  for (const producto of PRODUCTOS) {
    const etiqueta = `Producto "${producto.nombre}"`;
    if (producto.nombre.length < 10 || producto.nombre.length > 35) {
      errores.push(`${etiqueta}: el nombre mide ${producto.nombre.length} caracteres (debe ser 10-35)`);
    }
    if (producto.descripcion.length < 30 || producto.descripcion.length > 100) {
      errores.push(`${etiqueta}: la descripción mide ${producto.descripcion.length} caracteres (debe ser 30-100)`);
    }
    if (!(producto.precio >= 10 && producto.precio <= 5000)) {
      errores.push(`${etiqueta}: el precio ${producto.precio} debe estar entre 10 y 5000`);
    }
    if (
      campoConPalabrasProhibidas(producto.nombre) ||
      campoConPalabrasProhibidas(producto.descripcion)
    ) {
      errores.push(`${etiqueta}: contiene palabras no permitidas`);
    }
  }

  if (errores.length > 0) {
    throw new Error(`La semilla de MercadoPago tiene datos inválidos:\n- ${errores.join("\n- ")}`);
  }
}

/**
 * Cuenta del vendedor que cobra con MercadoPago. El método de pago vive en
 * MongoDB (así lo lee `metodoDePagoDelVendedor` al crear la orden), y en
 * PostgreSQL solo va la cuenta de cobro dentro de `paypalEmail`.
 */
async function obtenerVendedorMercadoPago(): Promise<Vendedor> {
  try {
    const existente = await conLimite(
      clientePrisma.usuario.findUnique({
        where: { correo: CORREO_VENDEDOR_MP },
        select: { id: true, nombreCompleto: true },
      }),
    );

    if (existente) {
      await reflejarEnMongo(existente.id, false);
      return { id: String(existente.id), nombre: existente.nombreCompleto };
    }

    const passwordHasheada = await bcrypt.hash(PASSWORD_VENDEDOR_MP, 10);

    const creado = await conLimite(
      clientePrisma.usuario.create({
        data: {
          nombreCompleto: "Vendedor Mercado Pago",
          direccion: "Av. Ejemplo 456, Colonia Centro, Ciudad de México",
          telefono: "5500000001",
          correo: CORREO_VENDEDOR_MP,
          rfc: "XXXX000101MPO",
          password: passwordHasheada,
          tipo: "vendedor",
          ineFrente: "/uploads/ine/demo-frente.jpg",
          ineReverso: "/uploads/ine/demo-reverso.jpg",
          aceptaTerminos: true,
          recibirNotificacionesCriticas: true,
          recibirNotificacionesPublicitarias: false,
          correoVerificado: true,
          paypalEmail: DATOS_MP,
          horarios: HORARIOS_VENDEDOR_MP,
          horarioConfirmadoEn: new Date(),
          diasSinConfirmarHorario: 0,
        },
        select: { id: true, nombreCompleto: true },
      }),
    );

    await reflejarEnMongo(creado.id, true);
    console.log(
      `Cuenta creada: ${CORREO_VENDEDOR_MP} (contraseña ${PASSWORD_VENDEDOR_MP})`,
    );

    return { id: String(creado.id), nombre: creado.nombreCompleto };
  } catch (error) {
    console.warn(
      "No se pudo consultar PostgreSQL, se usará un vendedor de respaldo:",
      (error as Error).message,
    );
  }

  return { id: "1", nombre: "Vendedor Mercado Pago" };
}

/** Copia la cuenta a MongoDB con `metodoPago: "mercadopago"`. */
async function reflejarEnMongo(id: number, creado: boolean) {
  const cambios = {
    usuarioId: id,
    nombreCompleto: "Vendedor Mercado Pago",
    direccion: "Av. Ejemplo 456, Colonia Centro, Ciudad de México",
    telefono: "5500000001",
    correo: CORREO_VENDEDOR_MP,
    rfc: "XXXX000101MPO",
    password: "sin-login-en-mongo",
    tipo: "vendedor",
    ineFrente: "/uploads/ine/demo-frente.jpg",
    ineReverso: "/uploads/ine/demo-reverso.jpg",
    aceptaTerminos: true,
    recibirNotificacionesCriticas: true,
    recibirNotificacionesPublicitarias: false,
    metodoPago: "mercadopago",
    datosMetodoPago: DATOS_MP,
    horarios: HORARIOS_VENDEDOR_MP,
    horarioConfirmadoEn: new Date(),
    diasSinConfirmarHorario: 0,
    correoVerificado: true,
    ...(creado ? { createdAt: new Date() } : {}),
  };

  await Usuario.updateOne(
    { correo: CORREO_VENDEDOR_MP },
    { $set: cambios, $setOnInsert: { createdAt: new Date() } },
    { upsert: true },
  ).catch((errorMongo) => {
    console.warn(
      "[mongo] No se pudo crear el espejo del vendedor MercadoPago:",
      errorMongo?.message ?? errorMongo,
    );
  });
}

function documentosProducto(vendedor: Vendedor, imagenes: string[]) {
  const ahora = Date.now();
  return PRODUCTOS.map((producto, indice) => ({
    ...producto,
    condicion: CONDICIONES_ROTACION[indice % CONDICIONES_ROTACION.length],
    condicionUso: CONDICIONES_ROTACION[(indice + 2) % CONDICIONES_ROTACION.length],
    metodoEntrega: METODOS_ENTREGA_ROTACION[indice % METODOS_ENTREGA_ROTACION.length],
    horarioEntregaInicio: HORARIOS_ROTACION[indice % HORARIOS_ROTACION.length][0],
    horarioEntregaFin: HORARIOS_ROTACION[indice % HORARIOS_ROTACION.length][1],
    tiempoLimitePago: [30, 60, 90][indice % 3],
    imagenes: imagenesPara(indice, imagenes, 2),
    vendedor: vendedor.nombre,
    vendedorId: vendedor.id,
    activo: true,
    semilla: MARCA_SEMILLA,
    createdAt: new Date(ahora - indice * 60_000),
    updatedAt: new Date(ahora - indice * 60_000),
  }));
}

async function main() {
  validarDatos();

  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("La variable MONGO_URI no está definida en backend/.env");
  }

  await mongoose.connect(uri);
  console.log("Conectado a MongoDB");

  try {
    const vendedor = await obtenerVendedorMercadoPago();
    const imagenes = cargarImagenes();

    const borrados = await Producto.collection.deleteMany({ semilla: MARCA_SEMILLA });
    console.log(`Semilla anterior eliminada: ${borrados.deletedCount} productos`);

    const productos = documentosProducto(vendedor, imagenes);
    await Producto.collection.insertMany(productos);

    console.log(`\nVendedor MercadoPago: ${vendedor.nombre} (id ${vendedor.id})`);
    console.log(`Productos insertados: ${productos.length}`);
    for (const categoria of CATEGORIAS_PRODUCTO) {
      const total = productos.filter((p) => p.categoria === categoria).length;
      console.log(`  - ${categoria}: ${total}`);
    }
    console.log(
      "\nEstos productos se cobran con MercadoPago (Checkout Pro) porque el\n" +
        `método de pago de ${CORREO_VENDEDOR_MP} es "mercadopago".`,
    );
  } finally {
    await cerrarPostgres();
    await mongoose.disconnect();
  }
}

async function cerrarPostgres() {
  const cerrar = (clientePrisma as { close?: () => Promise<void> }).close;
  if (typeof cerrar === "function") {
    await cerrar().catch(() => {});
  }
}

main()
  .then(() => console.log("\nSemilla de MercadoPago finalizada"))
  .catch(async (error) => {
    console.error("\nFalló la semilla:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
    await cerrarPostgres();
    await mongoose.disconnect().catch(() => {});
  });
