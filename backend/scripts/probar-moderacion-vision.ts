/**
 * Pruebas E2E de RQNF7.2 (formatos y dimensiones de la foto), RQNF7.3
 * (moderación con Cloud Vision y filtro de palabras), RQNF7.1 (validaciones
 * de campo) y RQNF7.4 (tiempo límite de pago, 30 min–3 h, 1 h por defecto).
 *
 * Levanta:
 *  - un mock local de la API de Cloud Vision (etiquetas configurables), y
 *  - dos servidores backend: uno CON llave de Vision (puerto 5099) y otro
 *    SIN llave (puerto 5098) para comprobar el bloqueo por falta de
 *    moderación (fail-closed).
 *
 * Uso (con MongoDB y PostgreSQL locales corriendo):
 *   node --harmony-temporal --import tsx scripts/probar-moderacion-vision.ts
 */
import { spawn, ChildProcess } from "child_process";
import http from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, "..");
const PUERTO_CON_LLAVE = 5099;
const PUERTO_SIN_LLAVE = 5098;
const PUERTO_MOCK = 59091;

let etiquetasMock: string[] = [];
let falloMock = false;

const servidorMock = http.createServer((req, res) => {
  if (falloMock) {
    res.writeHead(500);
    res.end("{}");
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      responses: [
        {
          labelAnnotations: etiquetasMock.map((description, i) => ({
            description,
            score: 0.95 - i * 0.01,
          })),
        },
      ],
    }),
  );
});
await new Promise<void>((ok) =>
  servidorMock.listen(PUERTO_MOCK, "127.0.0.1", ok),
);

function arrancarBackend(puerto: number, conLlave: boolean): ChildProcess {
  const env: NodeJS.ProcessEnv = { ...process.env, PORT: String(puerto) };
  if (conLlave) {
    env.GOOGLE_VISION_API_KEY = "clave-de-prueba";
    env.GOOGLE_VISION_ENDPOINT = `http://127.0.0.1:${PUERTO_MOCK}/v1/images:annotate`;
  } else {
    env.GOOGLE_VISION_API_KEY = "";
    env.GOOGLE_VISION_ENDPOINT = "";
  }
  const hijo = spawn(
    process.execPath,
    ["--harmony-temporal", "--import", "tsx", "src/server.ts"],
    { cwd: RAIZ, env, stdio: "pipe" },
  );
  hijo.stdout?.on("data", (d) => process.stdout.write(`[backend:${puerto}] ${d}`));
  hijo.stderr?.on("data", (d) => process.stderr.write(`[backend:${puerto}:err] ${d}`));
  return hijo;
}

async function esperarSalud(puerto: number): Promise<void> {
  for (let intento = 0; intento < 60; intento++) {
    try {
      const r = await fetch(`http://127.0.0.1:${puerto}/api/salud`);
      if (r.ok) return;
    } catch {
      /* aún no levanta */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`El backend en el puerto ${puerto} no arrancó`);
}

// ---------------------------------------------------------------------------
// Imágenes de prueba
// ---------------------------------------------------------------------------
const carpetaPruebas = path.join(RAIZ, "uploads", "pruebas-vision");
fs.mkdirSync(carpetaPruebas, { recursive: true });

const rutaJpg = path.join(carpetaPruebas, "valida.jpg");
const rutaJpeg = path.join(carpetaPruebas, "valida.jpeg");
const rutaPng = path.join(carpetaPruebas, "valida.png");
const rutaWebp = path.join(carpetaPruebas, "no-permitida.webp");
const rutaPequena = path.join(carpetaPruebas, "pequena.jpg");

const fondo = { create: { width: 600, height: 700, channels: 3, background: { r: 90, g: 140, b: 200 } } } as const;
await sharp(fondo).jpeg().toFile(rutaJpg);
await sharp(fondo).jpeg().toFile(rutaJpeg);
await sharp(fondo).png().toFile(rutaPng);
await sharp(fondo).webp().toFile(rutaWebp);
await sharp({ create: { width: 100, height: 100, channels: 3, background: { r: 90, g: 140, b: 200 } } }).jpeg().toFile(rutaPequena);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
type Resultado = { nombre: string; ok: boolean; detalle: string };
const resultados: Resultado[] = [];

function verificar(nombre: string, ok: boolean, detalle = "") {
  resultados.push({ nombre, ok, detalle });
  console.log(`${ok ? "PASA " : "FALLA"} ${nombre}${ok ? "" : ` — ${detalle}`}`);
}

let token = "";

function cuerpoProducto(cambios: Record<string, string> = {}): FormData {
  const base: Record<string, string> = {
    nombre: "Lámpara de mesa ámbar",
    precio: "450",
    descripcion: "Lámpara de mesa en buen estado, se entrega con foco incluido.",
    categoria: "Hogar",
    condicion: "usado-buen-estado",
    condicionUso: "usado-buen-estado",
    metodoEntrega: "punto-encuentro",
    horarioEntregaInicio: "09:00",
    horarioEntregaFin: "17:00",
    tiempoLimitePago: "60",
    ...cambios,
  };
  const fd = new FormData();
  for (const [campo, valor] of Object.entries(base)) {
    if (valor !== "__omitir__") fd.append(campo, valor);
  }
  return fd;
}

async function subirProducto(
  puerto: number,
  cambios: Record<string, string> = {},
  imagen?: { ruta: string; nombre: string; tipo: string },
) {
  const fd = cuerpoProducto(cambios);
  if (imagen) {
    fd.append(
      "imagenes",
      new Blob([fs.readFileSync(imagen.ruta)], { type: imagen.tipo }),
      imagen.nombre,
    );
  }
  return fetch(`http://127.0.0.1:${puerto}/api/productos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
}

async function mensajeDe(r: Response): Promise<string> {
  try {
    const j = (await r.json()) as { message?: string };
    return j.message ?? JSON.stringify(j);
  } catch {
    return "(sin JSON)";
  }
}

async function borrarProducto(id: string) {
  const r = await fetch(`http://127.0.0.1:${PUERTO_CON_LLAVE}/api/productos/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return r.ok;
}

const productosCreados: { id: string; imagenes: string[] }[] = [];
const promocionalesCreados: { id: string; imagenes: string[] }[] = [];

async function crear(
  nombre: string,
  cambios: Record<string, string> = {},
  imagen?: { ruta: string; nombre: string; tipo: string },
): Promise<{ status: number; body: string; id: string | null }> {
  const r = await subirProducto(PUERTO_CON_LLAVE, cambios, imagen);
  const texto = await r.text();
  let id: string | null = null;
  if (r.ok) {
    try {
      const j = JSON.parse(texto) as { _id: string; imagenes: string[] };
      id = j._id;
      productosCreados.push({ id, imagenes: j.imagenes });
    } catch {
      /* ignorar */
    }
  }
  return { status: r.status, body: texto, id };
}

// ---------------------------------------------------------------------------
// Pruebas
// ---------------------------------------------------------------------------
const hijos: ChildProcess[] = [];
try {
  console.log("Arrancando servidores de prueba…");
  const conLlave = arrancarBackend(PUERTO_CON_LLAVE, true);
  const sinLlave = arrancarBackend(PUERTO_SIN_LLAVE, false);
  hijos.push(conLlave, sinLlave);
  await Promise.all([esperarSalud(PUERTO_CON_LLAVE), esperarSalud(PUERTO_SIN_LLAVE)]);

  // Login del vendedor demo
  const login = await fetch(
    `http://127.0.0.1:${PUERTO_CON_LLAVE}/api/usuarios/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        correo: "vendedor.demo@ichiba.test",
        password: "IchibaDemo123!",
      }),
    },
  );
  const datosLogin = (await login.json()) as { token?: string };
  if (!login.ok || !datosLogin.token) {
    throw new Error(`No se pudo iniciar sesión: ${JSON.stringify(datosLogin)}`);
  }
  token = datosLogin.token;
  console.log("Sesión iniciada como vendedor.demo\n");

  // 1) Foto benigna, formato .jpg → se publica
  etiquetasMock = ["Chair"];
  let r = await crear("publicación benigna jpg", {}, { ruta: rutaJpg, nombre: "foto.jpg", tipo: "image/jpeg" });
  verificar("RQNF7.3 foto permitida (.jpg) se publica", r.status === 201, `status ${r.status}: ${r.body}`);

  // 2) Etiqueta "Dog" → bloqueo por mascotas
  etiquetasMock = ["Dog"];
  r = await crear("mascota en la foto", {}, { ruta: rutaJpg, nombre: "foto.jpg", tipo: "image/jpeg" });
  verificar(
    "RQNF7.3 Cloud Vision bloquea mascotas",
    r.status === 400 && r.body.includes("mascotas"),
    `status ${r.status}: ${r.body}`,
  );

  // 3) "Carpet" NO debe coincidir con "car" (palabra completa) → .jpeg
  etiquetasMock = ["Carpet", "Flooring"];
  r = await crear("alfombra no es carro", {}, { ruta: rutaJpeg, nombre: "foto.jpeg", tipo: "image/jpeg" });
  verificar(
    "RQNF7.3 sin falso positivo: Carpet ≠ car (.jpeg)",
    r.status === 201,
    `status ${r.status}: ${r.body}`,
  );

  // 4) "Sports car" → bloqueo por carros
  etiquetasMock = ["Sports car"];
  r = await crear("carro en la foto", {}, { ruta: rutaJpg, nombre: "foto.jpg", tipo: "image/jpeg" });
  verificar(
    "RQNF7.3 Cloud Vision bloquea carros",
    r.status === 400 && r.body.includes("carros"),
    `status ${r.status}: ${r.body}`,
  );

  // 5) Formato .webp → rechazado (RQNF7.2)
  etiquetasMock = ["Chair"];
  r = await crear("formato webp", {}, { ruta: rutaWebp, nombre: "foto.webp", tipo: "image/webp" });
  verificar(
    "RQNF7.2 formato .webp rechazado con 400",
    r.status === 400 && r.body.includes(".png"),
    `status ${r.status}: ${r.body}`,
  );

  // 6) Dimensión 100×100 → rechazada
  r = await crear("dimensión pequeña", {}, { ruta: rutaPequena, nombre: "pequena.jpg", tipo: "image/jpeg" });
  verificar(
    "RQNF7.2 dimensiones 420x540–2560x2560",
    r.status === 400 && r.body.includes("420x540"),
    `status ${r.status}: ${r.body}`,
  );

  // 7) Precio $5 → fuera del rango $10–$5,000
  r = await crear("precio mínimo", { precio: "5" }, { ruta: rutaJpg, nombre: "foto.jpg", tipo: "image/jpeg" });
  verificar(
    "RQNF7.3 precio mínimo $10",
    r.status === 400 && r.body.includes("$10 y $5,000"),
    `status ${r.status}: ${r.body}`,
  );

  // 8) Precio $6,000 → fuera del rango
  r = await crear("precio máximo", { precio: "6000" }, { ruta: rutaJpg, nombre: "foto.jpg", tipo: "image/jpeg" });
  verificar(
    "RQNF7.3 precio máximo $5,000",
    r.status === 400 && r.body.includes("$10 y $5,000"),
    `status ${r.status}: ${r.body}`,
  );

  // 9) Descripción de 10 caracteres → mínimo 30
  r = await crear("descripción corta", { descripcion: "Muy corta." }, { ruta: rutaJpg, nombre: "foto.jpg", tipo: "image/jpeg" });
  verificar(
    "RQNF7.4 descripción mínimo 30 caracteres",
    r.status === 400 && r.body.includes("entre 30 y 100"),
    `status ${r.status}: ${r.body}`,
  );

  // 10) Sin tiempoLimitePago → valor por defecto 1 hora (60 min), formato .png
  r = await crear("tiempo por defecto", { tiempoLimitePago: "__omitir__" }, { ruta: rutaPng, nombre: "foto.png", tipo: "image/png" });
  let tiempoOk = r.status === 201 && r.id !== null;
  if (tiempoOk && r.id) {
    const consulta = await fetch(`http://127.0.0.1:${PUERTO_CON_LLAVE}/api/productos/${r.id}`);
    const producto = (await consulta.json()) as { tiempoLimitePago?: number };
    tiempoOk = producto.tiempoLimitePago === 60;
    if (!tiempoOk) {
      r.body = `tiempoLimitePago = ${producto.tiempoLimitePago}`;
    }
  }
  verificar(
    "RQNF7.4 tiempo límite por defecto 1 hora (.png aceptado)",
    tiempoOk,
    `status ${r.status}: ${r.body}`,
  );

  // 11) Tiempo fuera de rango (20 min)
  r = await crear("tiempo fuera de rango", { tiempoLimitePago: "20" }, { ruta: rutaJpg, nombre: "foto.jpg", tipo: "image/jpeg" });
  verificar(
    "RQNF7.4 tiempo mínimo 30 minutos",
    r.status === 400 && r.body.includes("30 minutos"),
    `status ${r.status}: ${r.body}`,
  );

  // 12) Palabras prohibidas en la descripción
  r = await crear("palabras prohibidas", { descripcion: "Lámpara en estado regular, no es una mierda." }, { ruta: rutaJpg, nombre: "foto.jpg", tipo: "image/jpeg" });
  verificar(
    "RQNF7.3 filtro de palabras prohibidas",
    r.status === 400 && r.body.length > 0,
    `status ${r.status}: ${r.body}`,
  );

  // 13) Fallo del servicio de Vision → no se publica
  falloMock = true;
  r = await crear("fallo del servicio", {}, { ruta: rutaJpg, nombre: "foto.jpg", tipo: "image/jpeg" });
  verificar(
    "RQNF7.3 fallo de Cloud Vision bloquea (no publica sin analizar)",
    r.status === 400 && r.body.includes("No fue posible analizar"),
    `status ${r.status}: ${r.body}`,
  );
  falloMock = false;

  // 14) Edición: foto nueva con mascota → bloqueada; producto intacto
  const creada = productosCreados[0];
  if (!creada) {
    verificar("RQNF7.3 edición con foto excluida se bloquea", false, "no se creó el producto base en la prueba 1");
  } else {
    etiquetasMock = ["Cat"];
  const fdEdit = cuerpoProducto({ imagenesExistentes: JSON.stringify(creada.imagenes) });
  fdEdit.append("imagenes", new Blob([fs.readFileSync(rutaJpg)], { type: "image/jpeg" }), "nueva.jpg");
  const rEdit = await fetch(
    `http://127.0.0.1:${PUERTO_CON_LLAVE}/api/productos/${creada.id}`,
    { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: fdEdit },
  );
  const msgEdit = await mensajeDe(rEdit);
  const consultaEdit = await fetch(`http://127.0.0.1:${PUERTO_CON_LLAVE}/api/productos/${creada.id}`);
  const productoEdit = (await consultaEdit.json()) as { imagenes?: string[] };
  verificar(
    "RQNF7.3 edición con foto excluida se bloquea y no modifica el producto",
    rEdit.status === 400 &&
      msgEdit.includes("mascotas") &&
      JSON.stringify(productoEdit.imagenes) === JSON.stringify(creada.imagenes),
    `status ${rEdit.status}: ${msgEdit}`,
  );

  // 15) Edición con foto permitida → sí se actualiza
  etiquetasMock = ["Chair"];
  const fdEdit2 = cuerpoProducto({
    nombre: "Lámpara de mesa ámbar",
    imagenesExistentes: JSON.stringify(creada.imagenes),
  });
  fdEdit2.append("imagenes", new Blob([fs.readFileSync(rutaPng)], { type: "image/png" }), "nueva.png");
  const rEdit2 = await fetch(
    `http://127.0.0.1:${PUERTO_CON_LLAVE}/api/productos/${creada.id}`,
    { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: fdEdit2 },
  );
  verificar(
    "RQNF7.3 edición con foto permitida sí actualiza",
    rEdit2.status === 200,
    `status ${rEdit2.status}: ${await mensajeDe(rEdit2)}`,
  );
  }

  // 16) Servidor SIN llave de Vision → fail-closed con mensaje claro
  const rSinLlave = await subirProducto(PUERTO_SIN_LLAVE, {}, { ruta: rutaJpg, nombre: "foto.jpg", tipo: "image/jpeg" });
  const msgSinLlave = await mensajeDe(rSinLlave);
  verificar(
    "RQNF7.3 sin GOOGLE_VISION_API_KEY se bloquea la publicación",
    rSinLlave.status === 400 && msgSinLlave.includes("moderación de imágenes no está disponible"),
    `status ${rSinLlave.status}: ${msgSinLlave}`,
  );

  // -------------------------------------------------------------------------
  // RQNF8 / RQNF8.1 / RQNF8.2: alerta de palabras no permitidas, campo
  // señalado, corrección y reenvío con revalidación completa.
  // -------------------------------------------------------------------------
  etiquetasMock = ["Chair"];

  // 17) Crear con palabra prohibida en el nombre → 400 + campo señalado
  r = await crear(
    "palabras en el nombre",
    { nombre: "Lámpara de mierda bonita" },
    { ruta: rutaJpg, nombre: "foto.jpg", tipo: "image/jpeg" },
  );
  verificar(
    "RQNF8.1 alerta al crear con palabra prohibida (campo nombre)",
    r.status === 400 &&
      r.body.includes("palabras no permitidas") &&
      r.body.includes('"campo":"nombre"'),
    `status ${r.status}: ${r.body}`,
  );

  // 18) RQNF8.2: corregir el contenido y reenviar → pasa y se crea
  r = await crear(
    "nombre corregido reenviado",
    {},
    { ruta: rutaJpg, nombre: "foto.jpg", tipo: "image/jpeg" },
  );
  verificar(
    "RQNF8.2 corrección y reenvío crea el producto",
    r.status === 201,
    `status ${r.status}: ${r.body}`,
  );
  const productoCorregido = r.id;

  // 19) RQNF8.2 también revalida todo: reenvío con la palabra corregida pero
  // con un precio inválido → sigue fallando por otra regla de RQNF7
  r = await crear(
    "reenvío con precio inválido",
    { precio: "5" },
    { ruta: rutaJpg, nombre: "foto.jpg", tipo: "image/jpeg" },
  );
  verificar(
    "RQNF8.2 el reenvío se somete de nuevo a toda la validación",
    r.status === 400 && r.body.includes("$10 y $5,000"),
    `status ${r.status}: ${r.body}`,
  );

  // 20) Editar con palabra prohibida en la descripción → 400 + campo + intacto
  if (!productoCorregido) {
    verificar("RQNF8.1 alerta al editar con palabra prohibida", false, "no se creó el producto para editar");
  } else {
    const consultaBase = await fetch(
      `http://127.0.0.1:${PUERTO_CON_LLAVE}/api/productos/${productoCorregido}`,
    );
    const base = (await consultaBase.json()) as { imagenes: string[]; descripcion: string };

    const fdMala = cuerpoProducto({
      descripcion: "Descripción con una mierda dentro para probar",
      imagenesExistentes: JSON.stringify(base.imagenes),
    });
    const rMala = await fetch(
      `http://127.0.0.1:${PUERTO_CON_LLAVE}/api/productos/${productoCorregido}`,
      { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: fdMala },
    );
    const msgMala = await rMala.text();
    const consultaTras = await fetch(
      `http://127.0.0.1:${PUERTO_CON_LLAVE}/api/productos/${productoCorregido}`,
    );
    const tras = (await consultaTras.json()) as { descripcion: string };
    verificar(
      "RQNF8.1 alerta al editar con palabra prohibida (campo descripcion)",
      rMala.status === 400 &&
        msgMala.includes("palabras no permitidas") &&
        msgMala.includes('"campo":"descripcion"') &&
        tras.descripcion === base.descripcion,
      `status ${rMala.status}: ${msgMala}`,
    );

    // 21) Corregir la descripción y reenviar → sí se guarda
    const fdBuena = cuerpoProducto({
      imagenesExistentes: JSON.stringify(base.imagenes),
    });
    const rBuena = await fetch(
      `http://127.0.0.1:${PUERTO_CON_LLAVE}/api/productos/${productoCorregido}`,
      { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: fdBuena },
    );
    verificar(
      "RQNF8.2 corrección en la edición sí guarda",
      rBuena.status === 200,
      `status ${rBuena.status}: ${await mensajeDe(rBuena)}`,
    );
  }

  // 22) Promocional: palabra prohibida en el nombre → 400 + campo señalado
  const subirPromo = (cambios: Record<string, string> = {}) => {
    const base: Record<string, string> = {
      nombre: "Terreno de mierda con vista",
      precio: "7000",
      categoria: "terrenos-y-lotes",
      descripcion: "Terreno amplio con vista al valle, listo para construir.",
      condicionUso: "nuevo",
      coberturaEnvio: "Todo el país",
      chatHabilitado: "true",
      zonaComentariosHabilitada: "true",
      ...cambios,
    };
    const fd = new FormData();
    for (const [campo, valor] of Object.entries(base)) fd.append(campo, valor);
    fd.append("imagenes", new Blob([fs.readFileSync(rutaJpg)], { type: "image/jpeg" }), "foto.jpg");
    return fetch(`http://127.0.0.1:${PUERTO_CON_LLAVE}/api/promocionales`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
  };

  const rPromoMala = await subirPromo();
  const msgPromoMala = await rPromoMala.text();
  verificar(
    "RQNF8.1 alerta en promocional (campo nombre)",
    rPromoMala.status === 400 &&
      msgPromoMala.includes("palabras no permitidas") &&
      msgPromoMala.includes('"campo":"nombre"'),
    `status ${rPromoMala.status}: ${msgPromoMala}`,
  );

  // 23) Promocional corregido y reenviado → se crea (y se limpia al final)
  const rPromoBuena = await subirPromo({ nombre: "Terreno con vista al valle" });
  const textoPromoBuena = await rPromoBuena.text();
  if (rPromoBuena.ok) {
    try {
      const promoCreada = JSON.parse(textoPromoBuena) as { _id: string; imagenes: string[] };
      promocionalesCreados.push({ id: promoCreada._id, imagenes: promoCreada.imagenes });
    } catch {
      /* ignorar */
    }
  }
  verificar(
    "RQNF8.2 corrección y reenvío crea el promocional",
    rPromoBuena.status === 201,
    `status ${rPromoBuena.status}: ${textoPromoBuena}`,
  );
} finally {
  // Limpieza: borrar productos y promocionales creados (y sus archivos) y
  // apagar todo
  for (const promo of promocionalesCreados) {
    try {
      const consulta = await fetch(
        `http://127.0.0.1:${PUERTO_CON_LLAVE}/api/promocionales/${promo.id}`,
      ).catch(() => null);
      let imagenes = promo.imagenes;
      if (consulta?.ok) {
        const actual = (await consulta.json()) as { imagenes?: string[] };
        if (Array.isArray(actual.imagenes)) imagenes = actual.imagenes;
      }
      await fetch(
        `http://127.0.0.1:${PUERTO_CON_LLAVE}/api/promocionales/${promo.id}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
      );
      for (const imagen of imagenes) {
        const ruta = path.join(RAIZ, imagen.replace(/^\//, ""));
        if (fs.existsSync(ruta)) fs.unlinkSync(ruta);
      }
    } catch {
      /* ignorar */
    }
  }
  for (const producto of productosCreados) {
    try {
      // Recupera las imágenes finales (la edición pudo agregar una más).
      const consulta = await fetch(
        `http://127.0.0.1:${PUERTO_CON_LLAVE}/api/productos/${producto.id}`,
      ).catch(() => null);
      let imagenes = producto.imagenes;
      if (consulta?.ok) {
        const actual = (await consulta.json()) as { imagenes?: string[] };
        if (Array.isArray(actual.imagenes)) imagenes = actual.imagenes;
      }
      await borrarProducto(producto.id);
      for (const imagen of imagenes) {
        const ruta = path.join(RAIZ, imagen.replace(/^\//, ""));
        if (fs.existsSync(ruta)) fs.unlinkSync(ruta);
      }
    } catch {
      /* ignorar */
    }
  }
  for (const hijo of hijos) {
    try {
      hijo.kill();
    } catch {
      /* ignorar */
    }
  }
  try {
    servidorMock.close();
  } catch {
    /* ignorar */
  }
  try {
    fs.rmSync(carpetaPruebas, { recursive: true, force: true });
  } catch {
    /* ignorar */
  }
}

// ---------------------------------------------------------------------------
const fallas = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallas.length}/${resultados.length} pruebas pasaron`);
if (fallas.length > 0) {
  console.log("Fallas:");
  for (const f of fallas) console.log(` - ${f.nombre}: ${f.detalle}`);
  process.exit(1);
}
process.exit(0);
