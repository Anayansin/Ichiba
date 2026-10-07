/**
 * Semilla de datos de prueba de ICHIBA.
 *
 * Inserta 30 productos (5 por cada categoría del catálogo) y 35 promocionales
 * (5 por cada tipo de promocional), usando las imágenes que ya existen en
 * `backend/uploads` como placeholder.
 *
 * Uso (desde la carpeta `backend`, con MongoDB en marcha):
 *   npm run seed
 *
 * El script es idempotente: todos los documentos que inserta quedan marcados
 * con `semilla: true` y se borran antes de volver a insertar, así que nunca
 * toca datos reales de la plataforma. El vendedor al que se liga la semilla
 * es siempre la misma cuenta demo (`vendedor.demo@ichiba.test`), que se crea
 * automáticamente si no existe, así nunca colisiona con registros reales; si
 * PostgreSQL no responde se usa un vendedor de respaldo.
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { Producto } from "../src/models/producto.js";
import { Usuario } from "../src/models/usuario.js";
import { Promocional, CONDICIONES_USO_PROMOCIONAL } from "../src/models/Promocional.js";
import {
  CATEGORIAS_PRODUCTO,
  CATEGORIAS_PROMOCIONAL,
} from "../src/configuracion/categorias.js";
import { campoConPalabrasProhibidas } from "../src/utils/filtroPalabras.js";
import clientePrisma from "../src/configuracion/prisma.js";

const MARCA_SEMILLA = true;
const ARTICULOS_POR_CATEGORIA = 5;
const RUTA_UPLOADS = path.join(process.cwd(), "uploads");

type Vendedor = { id: string; nombre: string };

type ProductoSemilla = {
  categoria: (typeof CATEGORIAS_PRODUCTO)[number];
  nombre: string;
  descripcion: string;
  precio: number;
};

type PromocionalSemilla = {
  categoria: (typeof CATEGORIAS_PROMOCIONAL)[number];
  nombre: string;
  descripcion: string;
  precio: number;
  coberturaEnvio: string;
};

const PRODUCTOS: ProductoSemilla[] = [
  // Artesanías
  { categoria: "Artesanias", nombre: "Tejido a mano de palma de río", descripcion: "Cesta tejida a mano por artesanos de la región, ideal para llevar frutas o como pieza decorativa.", precio: 480 },
  { categoria: "Artesanias", nombre: "Barro negro de Santa María", descripcion: "Pieza de cerámica pulida a mano con acabado negro tradicional, resistente y apta para alimentos.", precio: 650 },
  { categoria: "Artesanias", nombre: "Máscara de madera tallada", descripcion: "Máscara tallada en madera de copal y pintada a mano, una pieza única para tu sala o estudio.", precio: 920 },
  { categoria: "Artesanias", nombre: "Sombrero de palma tejido", descripcion: "Sombrero ligero tejido en palma natural con ala ancha, perfecto para el sol y los viajes.", precio: 390 },
  { categoria: "Artesanias", nombre: "Cerámica esmaltada artesanal", descripcion: "Juego de tres tazas de cerámica esmaltadas a mano, cada una con un color y una textura distinta.", precio: 540 },
  // Ropa
  { categoria: "Ropa", nombre: "Vestido de algodón bordado", descripcion: "Vestido largo de algodón con bordados florales hechos a mano, cómodo para clima cálido.", precio: 780 },
  { categoria: "Ropa", nombre: "Camisa de lino para hombre", descripcion: "Camisa de lino natural de corte clásico, fresca y elegante para la oficina o el fin de semana.", precio: 620 },
  { categoria: "Ropa", nombre: "Bufanda de lana tejida a mano", descripcion: "Bufanda de lana abrigadora tejida a mano, con flecos terminados a mano y tonos tierra.", precio: 350 },
  { categoria: "Ropa", nombre: "Falda de cuero artesanal", descripcion: "Falda de cuero real con costuras reforzadas, corte recto y cintura alta para uso diario.", precio: 1450 },
  { categoria: "Ropa", nombre: "Chamarra vaquera clásica", descripcion: "Chamarra de mezclilla azul con botones metálicos, abrigadora y con bolsillos amplios.", precio: 990 },
  // Hogar
  { categoria: "Hogar", nombre: "Mantel de tela cuadriculado", descripcion: "Mantel de algodón con cuadros clásicos, mide 1.50 metros y resiste múltiples lavados.", precio: 320 },
  { categoria: "Hogar", nombre: "Juego de cojines decorativos", descripcion: "Cuatro cojines rellenos de algodón con fundas lavables, ideales para sofá o sillón.", precio: 560 },
  { categoria: "Hogar", nombre: "Lámpara de mesa artesanal", descripcion: "Lámpara de mesa con base de cerámica y pantalla de tela, luz cálida para tu escritorio.", precio: 740 },
  { categoria: "Hogar", nombre: "Cortinas de algodón natural", descripcion: "Cortinas de algodón crudo que dejan pasar la luz suave, con ojales para vara o riel.", precio: 480 },
  { categoria: "Hogar", nombre: "Set de toallas de algodón", descripcion: "Cuatro toallas de algodón peinado de alta absorción, disponibles en varios colores.", precio: 430 },
  // Electrodomésticos
  { categoria: "Electrodomesticos", nombre: "Licuadora de vaso 1.5 litros", descripcion: "Licuadora con vaso de vidrio de 1.5 litros, tres velocidades y base antideslizante.", precio: 1180 },
  { categoria: "Electrodomesticos", nombre: "Tostadora de pan doble", descripcion: "Tostadora de dos ranuras con control de dorado y bandeja para migajas extraíble.", precio: 640 },
  { categoria: "Electrodomesticos", nombre: "Cafetera de gota programable", descripcion: "Cafetera con programador horario de 12 horas, jarra térmica y filtro reutilizable.", precio: 1350 },
  { categoria: "Electrodomesticos", nombre: "Ventilador de torre silencioso", descripcion: "Ventilador de torre con temporizador, tres velocidades y giro automático silencioso.", precio: 980 },
  { categoria: "Electrodomesticos", nombre: "Hervidor eléctrico de acero", descripcion: "Hervidor de acero inoxidable de 1.7 litros con corte automático y apagado por seguridad.", precio: 520 },
  // Coleccionables
  { categoria: "Coleccionables", nombre: "Figura de vinilo coleccionable", descripcion: "Figura de vinilo de 20 centímetros con caja original, edición especial y sin abrir.", precio: 850 },
  { categoria: "Coleccionables", nombre: "Tarjetas de béisbol vintage", descripcion: "Lote de diez tarjetas de béisbol de los años ochenta en buen estado de conservación.", precio: 760 },
  { categoria: "Coleccionables", nombre: "Moneda antigua de plata", descripcion: "Moneda de plata acuñada en 1958, conserva sus detalles nítidos y llega en estuche protector.", precio: 1250 },
  { categoria: "Coleccionables", nombre: "Reloj de cuerda de los 70", descripcion: "Reloj mecánico de cuerda de los años setenta, funciona perfecto con su correa original.", precio: 1890 },
  { categoria: "Coleccionables", nombre: "Álbum de estampas antiguas", descripcion: "Álbum completo con más de doscientas estampas antiguas ordenadas por tema y época.", precio: 670 },
  // Otros
  { categoria: "Otros", nombre: "Kit de jardinería para casa", descripcion: "Kit con herramientas de metal, guantes de trabajo y semillas para cultivar plantas en casa.", precio: 590 },
  { categoria: "Otros", nombre: "Bicicleta urbana restaurada", descripcion: "Bicicleta de ciudad restaurada con cambios, frenos nuevos y canasta frontal de mimbre.", precio: 2850 },
  { categoria: "Otros", nombre: "Mochila de viaje impermeable", descripcion: "Mochila de 40 litros impermeable con compartimento para portátil y cierre reforzado.", precio: 720 },
  { categoria: "Otros", nombre: "Rompecabezas de 1000 piezas", descripcion: "Rompecabezas de paisaje con mil piezas, cartón grueso y bolsa intermedia para guardar.", precio: 380 },
  { categoria: "Otros", nombre: "Cámara instantánea usada", descripcion: "Cámara instantánea probada una sola vez, incluye correa y funciona con cartuchos comunes.", precio: 1650 },
];

const PROMOCIONALES: PromocionalSemilla[] = [
  // Autos y vehículos
  { categoria: "autos-y-vehiculos", nombre: "Sedán 2018 con poco uso", descripcion: "Sedán 2018 de un solo dueño, 68,000 kilómetros, mantenimiento al día y papeles en regla.", precio: 268000, coberturaEnvio: "Entrega en persona dentro de la ciudad, papeles en regla." },
  { categoria: "autos-y-vehiculos", nombre: "Camioneta 4x4 versión lujo", descripcion: "Camioneta cuatro por cuatro con interiores en cuero, navegación y doble cabina amplia.", precio: 545000, coberturaEnvio: "Entrega en agencia o domicilio dentro de la ciudad." },
  { categoria: "autos-y-vehiculos", nombre: "Motocicleta deportiva 250cc", descripcion: "Motocicleta de 250 centímetros cúbicos, poco kilometraje y lista para rodar desde hoy.", precio: 89000, coberturaEnvio: "Recogida en punto acordado con el anunciante." },
  { categoria: "autos-y-vehiculos", nombre: "Auto clásico restaurado", descripcion: "Auto clásico de los años setenta restaurado por completo, motor y carrocería impecables.", precio: 420000, coberturaEnvio: "Entrega personalizada en la ciudad y alrededores." },
  { categoria: "autos-y-vehiculos", nombre: "Van familiar diésel 2016", descripcion: "Van familiar con siete asientos, motor diésel ahorrador y aire acondicionado dual.", precio: 315000, coberturaEnvio: "Entrega en domicilio o traslado a taller por acuerdo." },
  // Casas y propiedades
  { categoria: "casas-y-propiedades", nombre: "Casa moderna de 3 recámaras", descripcion: "Casa moderna con tres recámaras, dos baños, jardín, cochera techada y área de servicio.", precio: 2450000, coberturaEnvio: "Visita coordinada con el anunciante en el inmueble." },
  { categoria: "casas-y-propiedades", nombre: "Departamento en zona centro", descripcion: "Departamento de dos cuartos en el centro, séptimo piso, con seguridad y área común.", precio: 1780000, coberturaEnvio: "Entrega en notaría coordinada entre las partes." },
  { categoria: "casas-y-propiedades", nombre: "Casa con jardín y cochera", descripcion: "Casa familiar con jardín trasero, cochera para dos autos y azotea con vista libre.", precio: 3120000, coberturaEnvio: "Recorrido personalizado previo a la escrituración." },
  { categoria: "casas-y-propiedades", nombre: "Penthouse con vista panorámica", descripcion: "Penthouse de dos niveles con terraza privada y vista panorámica a toda la ciudad.", precio: 4850000, coberturaEnvio: "Entrega en inmueble, visita con cita previa." },
  { categoria: "casas-y-propiedades", nombre: "Bungalow frente al lago", descripcion: "Bungalow de madera frente al lago, con muelle compartido y mobiliario incluido.", precio: 1650000, coberturaEnvio: "Entrega en el lugar o traslado coordinado." },
  // Terrenos y lotes
  { categoria: "terrenos-y-lotes", nombre: "Lote esquinero 10x20 metros", descripcion: "Lote esquinero con agua, luz y drenaje en sitio, listo para construir desde el primer mes.", precio: 690000, coberturaEnvio: "Catastro y visita en sitio coordinadas con el anunciante." },
  { categoria: "terrenos-y-lotes", nombre: "Terreno con servicios listos", descripcion: "Terreno aplanado con servicios instalados y acceso pavimentado para vehículo.", precio: 540000, coberturaEnvio: "Visita al terreno con cita previa." },
  { categoria: "terrenos-y-lotes", nombre: "Lote residencial en preventa", descripcion: "Lote dentro de un fraccionamiento cerrado con vigilancia, club y áreas verdes.", precio: 780000, coberturaEnvio: "Coordinación en oficina de ventas del fraccionamiento." },
  { categoria: "terrenos-y-lotes", nombre: "Terreno agrícola de 2 hectáreas", descripcion: "Terreno agrícola de dos hectáreas con pozo de agua, ideal para cultivo o ganado menor.", precio: 1250000, coberturaEnvio: "Recorrido por el terreno acompañado del anunciante." },
  { categoria: "terrenos-y-lotes", nombre: "Lote turístico cerca del mar", descripcion: "Lote turístico a cinco cuadras de la playa, con escrituras en regla y facilidades de pago.", precio: 940000, coberturaEnvio: "Entrega en notaría o en oficina del anunciante." },
  // Joyas y relojes
  { categoria: "joyas-y-relojes", nombre: "Anillo de oro 18 quilates", descripcion: "Anillo de oro de 18 quilates con certificado de autenticidad, disponible en varias tallas.", precio: 34500, coberturaEnvio: "Entrega en mano con cadena de custodia acordada." },
  { categoria: "joyas-y-relojes", nombre: "Reloj suizo automático", descripcion: "Reloj suizo de movimiento automático con correa de acero y resistencia a la humedad.", precio: 68000, coberturaEnvio: "Envío asegurado o entrega en persona en la ciudad." },
  { categoria: "joyas-y-relojes", nombre: "Collar de plata con dije", descripcion: "Collar de plata .925 con dije labrado, cierre de seguridad y caja de regalo incluida.", precio: 12800, coberturaEnvio: "Envío nacional asegurado con guía de rastreo." },
  { categoria: "joyas-y-relojes", nombre: "Aretes de diamante brillante", descripcion: "Aretes con diamantes de talla brillante engarzados en oro blanco, con caja de terciopelo.", precio: 47500, coberturaEnvio: "Entrega en mano dentro de la ciudad." },
  { categoria: "joyas-y-relojes", nombre: "Pulsera de oro rosa macizo", descripcion: "Pulsera de oro rosa de doce milímetros, cierre de seguridad y acabado pulido a espejo.", precio: 52000, coberturaEnvio: "Envío asegurado a todo el país." },
  // Muebles y arte
  { categoria: "muebles-y-arte", nombre: "Sofá de cuero de tres cuerpos", descripcion: "Sofá de cuero genuino de tres cuerpos, estructura firme y cojines extraíbles para lavar.", precio: 28500, coberturaEnvio: "Entrega a domicilio con coordinación de horario." },
  { categoria: "muebles-y-arte", nombre: "Comedor de madera maciza", descripcion: "Comedor de madera maciza para seis personas con acabado en barniz natural y patas reforzadas.", precio: 42000, coberturaEnvio: "Entrega e instalación dentro de la ciudad." },
  { categoria: "muebles-y-arte", nombre: "Pintura al óleo original", descripcion: "Pintura al óleo sobre lienzo de sesenta por noventa centímetros, firmada por su autor.", precio: 18500, coberturaEnvio: "Entrega empacada en encomienda o en mano." },
  { categoria: "muebles-y-arte", nombre: "Escultura de bronce firmada", descripcion: "Escultura de bronce fundida a la cera perdida, firmada y numerada en su base.", precio: 63000, coberturaEnvio: "Entrega con traslado especial acordado con el comprador." },
  { categoria: "muebles-y-arte", nombre: "Escritorio ejecutivo de nogal", descripcion: "Escritorio de nogal con tres cajones, cableado oculto y superficie de cuero integrada.", precio: 35600, coberturaEnvio: "Envío a domicilio con ensamble incluido." },
  // Servicios
  { categoria: "servicios", nombre: "Fotografía para eventos", descripcion: "Servicio de fotografía para bodas, quinceañeros y eventos sociales, con entrega digital.", precio: 12000, coberturaEnvio: "Cobertura en toda la ciudad y alrededores." },
  { categoria: "servicios", nombre: "Clases de cocina personalizadas", descripcion: "Clases prácticas de cocina a domicilio, con temática a tu gusto y para grupos de hasta seis.", precio: 8500, coberturaEnvio: "Servicio a domicilio dentro de la zona metropolitana." },
  { categoria: "servicios", nombre: "Reforma integral de cocina", descripcion: "Reforma integral de cocina con diseño, instalación de gabinetes y acabados de primera.", precio: 45000, coberturaEnvio: "Cobertura en la ciudad y municipios cercanos." },
  { categoria: "servicios", nombre: "Asesoría contable mensual", descripcion: "Asesoría contable mensual para personas físicas, con declaración anual y facturación incluida.", precio: 9600, coberturaEnvio: "Atención presencial o en línea, a elección del cliente." },
  { categoria: "servicios", nombre: "Transporte de muebles y mudanzas", descripcion: "Servicio de mudanzas con personal capacitado, camión cerrado y protección para cada pieza.", precio: 14500, coberturaEnvio: "Cobertura local y traslados entre ciudades." },
  // Otros
  { categoria: "otros", nombre: "Bicicleta de montaña 21 vel.", descripcion: "Bicicleta de montaña con marco de aluminio, veintiún velocidades y frenos de disco.", precio: 16500, coberturaEnvio: "Entrega en domicilio dentro de la ciudad." },
  { categoria: "otros", nombre: "Inventario de herramientas", descripcion: "Lote completo de herramienta de mano: martillos, llaves, destornidores y maletín incluido.", precio: 11200, coberturaEnvio: "Recogida en punto acordado o envío por paquetería." },
  { categoria: "otros", nombre: "Equipo de sonido profesional", descripcion: "Equipo de sonido con amplificador, bocinas activas y micrófono inalámbrico para eventos.", precio: 38500, coberturaEnvio: "Entrega a domicilio con soporte técnico incluido." },
  { categoria: "otros", nombre: "Máquina de café comercial", descripcion: "Máquina de café de dos hornillos para negocios, con vaporizador y mantenimiento reciente.", precio: 27500, coberturaEnvio: "Entrega e instalación en el negocio del cliente." },
  { categoria: "otros", nombre: "Set de camping completo", descripcion: "Set de camping con carpa para cuatro personas, saco térmico, refrigerador y lámpara.", precio: 19800, coberturaEnvio: "Envío a todo el país mediante paquetería." },
];

const CONDICIONES_ROTACION = ["nuevo", "usado-como-nuevo", "usado-buen-estado", "usado-aceptable"] as const;
const METODOS_ENTREGA_ROTACION = ["domicilio", "tienda", "punto-encuentro"] as const;
const HORARIOS_ROTACION: Array<[string, string]> = [
  ["09:00", "18:00"],
  ["10:00", "20:00"],
  ["08:00", "14:00"],
];

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

/**
 * La semilla necesita un vendedor al que ligar sus 30 productos. Antes
 * buscaba "el primer usuario" o caía al id 1: como el primer registro real
 * también recibe el id 1, los productos de prueba terminaban perteneciendo a
 * esa cuenta. Ahora se usa siempre una cuenta demo propia y dedicatoria.
 */
const CORREO_VENDEDOR_SEMILLA = "vendedor.demo@ichiba.test";
const PASSWORD_VENDEDOR_SEMILLA = "IchibaDemo123!";
const DIAS_SEMILLA = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
] as const;

const HORARIOS_VENDEDOR_SEMILLA = DIAS_SEMILLA.map((dia) => ({
  dia,
  activo: true,
  horaInicio: "09:00",
  horaFin: "18:00",
}));

function conLimite<T>(promesa: Promise<T>, milisegundos = 5000): Promise<T> {
  return Promise.race([
    promesa,
    new Promise<never>((_, rechazar) =>
      setTimeout(() => rechazar(new Error("timeout")), milisegundos),
    ),
  ]);
}

/** Copia la cuenta demo a MongoDB (panel de administración, GraphQL, chats). */
async function reflejarVendedorDemoEnMongo(
  id: number,
  correo: string,
  creado: boolean,
) {
  const cambios = {
    usuarioId: id,
    nombreCompleto: "Vendedor Demo",
    direccion: "Av. Principal 123, Centro, Ciudad de México",
    telefono: "5500000000",
    correo,
    rfc: "XXXX000101MCO",
    password: "sin-login-en-mongo",
    tipo: "vendedor",
    ineFrente: "/uploads/ine/demo-frente.jpg",
    ineReverso: "/uploads/ine/demo-reverso.jpg",
    aceptaTerminos: true,
    recibirNotificacionesCriticas: true,
    recibirNotificacionesPublicitarias: false,
    metodoPago: "paypal",
    datosMetodoPago: "vendedor.demo@example.com",
    horarios: HORARIOS_VENDEDOR_SEMILLA,
    horarioConfirmadoEn: new Date(),
    diasSinConfirmarHorario: 0,
    correoVerificado: true,
    ...(creado ? { createdAt: new Date() } : {}),
  };

  await Usuario.updateOne(
    { correo },
    { $set: cambios, $setOnInsert: { createdAt: new Date() } },
    { upsert: true },
  ).catch((errorMongo) => {
    console.warn(
      "[mongo] No se pudo crear el espejo del vendedor demo:",
      errorMongo?.message ?? errorMongo,
    );
  });
}

async function obtenerVendedorSemilla(): Promise<Vendedor> {
  try {
    const existente = await conLimite(
      clientePrisma.usuario.findUnique({
        where: { correo: CORREO_VENDEDOR_SEMILLA },
        select: { id: true, nombreCompleto: true },
      }),
    );

    if (existente) {
      await reflejarVendedorDemoEnMongo(existente.id, CORREO_VENDEDOR_SEMILLA, false);
      return { id: String(existente.id), nombre: existente.nombreCompleto };
    }

    const passwordHasheada = await bcrypt.hash(PASSWORD_VENDEDOR_SEMILLA, 10);

    const creado = await conLimite(
      clientePrisma.usuario.create({
        data: {
          nombreCompleto: "Vendedor Demo",
          direccion: "Av. Principal 123, Centro, Ciudad de México",
          telefono: "5500000000",
          correo: CORREO_VENDEDOR_SEMILLA,
          rfc: "XXXX000101MCO",
          password: passwordHasheada,
          tipo: "vendedor",
          ineFrente: "/uploads/ine/demo-frente.jpg",
          ineReverso: "/uploads/ine/demo-reverso.jpg",
          aceptaTerminos: true,
          recibirNotificacionesCriticas: true,
          recibirNotificacionesPublicitarias: false,
          correoVerificado: true,
          paypalEmail: "vendedor.demo@example.com",
          horarios: HORARIOS_VENDEDOR_SEMILLA,
          horarioConfirmadoEn: new Date(),
          diasSinConfirmarHorario: 0,
        },
        select: { id: true, nombreCompleto: true },
      }),
    );

    await reflejarVendedorDemoEnMongo(creado.id, CORREO_VENDEDOR_SEMILLA, true);
    console.log(
      `Cuenta demo creada: ${CORREO_VENDEDOR_SEMILLA} (contraseña ${PASSWORD_VENDEDOR_SEMILLA})`,
    );

    return { id: String(creado.id), nombre: creado.nombreCompleto };
  } catch (error) {
    console.warn(
      "No se pudo consultar PostgreSQL, se usará un vendedor de respaldo:",
      (error as Error).message,
    );
  }

  return { id: "1", nombre: "Vendedor Demo" };
}

function validarDatos() {
  const errores: string[] = [];

  const contar = <T extends { categoria: string }>(items: T[]) => {
    const mapa = new Map<string, number>();
    for (const item of items) {
      mapa.set(item.categoria, (mapa.get(item.categoria) ?? 0) + 1);
    }
    return mapa;
  };

  for (const [categoria, total] of contar(PRODUCTOS)) {
    if (total !== ARTICULOS_POR_CATEGORIA) {
      errores.push(`Categoría "${categoria}" tiene ${total} productos, se esperaban ${ARTICULOS_POR_CATEGORIA}`);
    }
  }

  for (const [categoria, total] of contar(PROMOCIONALES)) {
    if (total !== ARTICULOS_POR_CATEGORIA) {
      errores.push(`Tipo "${categoria}" tiene ${total} promocionales, se esperaban ${ARTICULOS_POR_CATEGORIA}`);
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
    if (campoConPalabrasProhibidas(producto.nombre) || campoConPalabrasProhibidas(producto.descripcion)) {
      errores.push(`${etiqueta}: contiene palabras no permitidas`);
    }
  }

  for (const promocional of PROMOCIONALES) {
    const etiqueta = `Promocional "${promocional.nombre}"`;
    if (promocional.nombre.length < 10 || promocional.nombre.length > 35) {
      errores.push(`${etiqueta}: el nombre mide ${promocional.nombre.length} caracteres (debe ser 10-35)`);
    }
    if (promocional.descripcion.length < 30 || promocional.descripcion.length > 100) {
      errores.push(`${etiqueta}: la descripción mide ${promocional.descripcion.length} caracteres (debe ser 30-100)`);
    }
    if (!(promocional.precio > 5000)) {
      errores.push(`${etiqueta}: el precio ${promocional.precio} debe ser mayor a 5000`);
    }
    if (!promocional.coberturaEnvio.trim()) {
      errores.push(`${etiqueta}: falta la cobertura de envío`);
    }
    if (campoConPalabrasProhibidas(promocional.nombre) || campoConPalabrasProhibidas(promocional.descripcion)) {
      errores.push(`${etiqueta}: contiene palabras no permitidas`);
    }
  }

  if (errores.length > 0) {
    throw new Error(`La semilla tiene datos inválidos:\n- ${errores.join("\n- ")}`);
  }
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

function documentosPromocional(vendedor: Vendedor, imagenes: string[]) {
  const ahora = Date.now();
  return PROMOCIONALES.map((promocional, indice) => ({
    ...promocional,
    condicionUso: CONDICIONES_USO_PROMOCIONAL[indice % CONDICIONES_USO_PROMOCIONAL.length],
    chatHabilitado: true,
    zonaComentariosHabilitada: true,
    imagenes: imagenesPara(indice + 3, imagenes, 2),
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
    const vendedor = await obtenerVendedorSemilla();
    const imagenes = cargarImagenes();

    const borradosProducto = await Producto.collection.deleteMany({ semilla: MARCA_SEMILLA });
    const borradosPromocional = await Promocional.collection.deleteMany({ semilla: MARCA_SEMILLA });
    console.log(
      `Semilla anterior eliminada: ${borradosProducto.deletedCount} productos y ${borradosPromocional.deletedCount} promocionales`,
    );

    const productos = documentosProducto(vendedor, imagenes);
    const promocionales = documentosPromocional(vendedor, imagenes);

    await Producto.collection.insertMany(productos);
    await Promocional.collection.insertMany(promocionales);

    console.log(`\nVendedor de la semilla: ${vendedor.nombre} (id ${vendedor.id})`);
    console.log(`Productos insertados: ${productos.length}`);
    for (const categoria of CATEGORIAS_PRODUCTO) {
      const total = productos.filter((p) => p.categoria === categoria).length;
      console.log(`  - ${categoria}: ${total}`);
    }
    console.log(`Promocionales insertados: ${promocionales.length}`);
    for (const categoria of CATEGORIAS_PROMOCIONAL) {
      const total = promocionales.filter((p) => p.categoria === categoria).length;
      console.log(`  - ${categoria}: ${total}`);
    }
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
  .then(() => console.log("\nSemilla finalizada"))
  .catch(async (error) => {
    console.error("\nFalló la semilla:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
    await cerrarPostgres();
    await mongoose.disconnect().catch(() => {});
  });
