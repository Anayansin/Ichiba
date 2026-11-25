// Escenario de revisión de requerimientos.
// Crea en la base de datos local filas, ventas en cada etapa, un chat con propuesta de entrega,
// una disputa, un adeudo, reportes, lista negra, solicitud de registro, suscripción, comentario e informes,
// para revisar cada requerimiento sin recorrer el flujo completo de pago.
// Uso, con el backend corriendo en el puerto 5000 y después de "npm run seed":
//   cd backend
//   node --import tsx ../herramientas/escenario-revision.mts
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createRequire } from "module";
const RAIZ_BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../backend");
const B = pathToFileURL(RAIZ_BACKEND).href + "/";
const { coneccionDB } = await import(B + "src/configuracion/db.ts");
const clientePrisma = (await import(B + "src/configuracion/prisma.ts")).default;
const { Venta } = await import(B + "src/models/Venta.ts");
const { Producto } = await import(B + "src/models/producto.ts");
const { registrarVentaExitosa } = await import(B + "src/services/ventaService.ts");
const { cargarVenta, registrarComprobanteDeVenta, confirmarComprobanteDeVenta, actualizarEspejoVenta } = await import(B + "src/services/escrowService.ts");
const { crearDisputa } = await import(B + "src/services/disputaService.ts");
const { registrarAdeudo } = await import(B + "src/services/adeudoService.ts");
const sharp = createRequire(path.join(RAIZ_BACKEND, "package.json"))("sharp");

const API = "http://localhost:5000/api";
const SALIDA = process.argv[2] ?? null;
const DEMO = "comprador-revision-demo";
const OTRO1 = "comprador-revision-2";
const OTRO2 = "comprador-revision-3";

await coneccionDB();
const idDe = async (correo: string) => (await clientePrisma.usuario.findUnique({ where: { correo }, select: { id: true } }))!.id;
const MARIANA = await idDe("mariana.gomez@ichiba.test");
const CARLOS = await idDe("carlos.ruiz@ichiba.test");
const LUCIA = await idDe("lucia.fernandez@ichiba.test");
const producto = async (nombre: string) => String((await Producto.findOne({ nombre }).select("_id").lean())!._id);
const P = {
  tazas: await producto("Par de tazas de cerámica artesanal"),
  canastas: await producto("Juego de 4 canastas tejidas"),
  cojines: await producto("Par de cojines decorativos de lino"),
  lampara: await producto("Lámpara de mesa con base cerámica"),
  espejo: await producto("Espejo redondo con marco de madera"),
  jarron: await producto("Jarrón de barro negro"),
  chamarra: await producto("Chamarra de mezclilla clásica"),
  botas: await producto("Botas de piel con agujetas"),
  cafetera: await producto("Cafetera de goteo para 10 tazas"),
};

const env = fs.readFileSync(path.join(RAIZ_BACKEND, ".env"), "utf8");
const PASS = /^PASSWORD_DEMO="?([^"\r\n]+)"?/m.exec(env)![1];

async function pedir(metodo: string, ruta: string, cuerpo?: unknown, cabeceras: Record<string, string> = {}) {
  const r = await fetch(API + ruta, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...cabeceras },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await r.text();
  let datos: any = texto;
  try { datos = JSON.parse(texto); } catch {}
  if (!r.ok) console.log(`  ! ${metodo} ${ruta} -> ${r.status} ${typeof datos === "object" ? datos.message : String(datos).slice(0, 120)}`);
  return datos;
}
const comoComprador = (id: string) => ({ "x-comprador-id": id });
const conToken = (t: string) => ({ Authorization: `Bearer ${t}` });

const sesion = async (correo: string) => {
  const r = await pedir("POST", "/usuarios/login", { correo, password: PASS });
  return { token: r.token, usuario: r.usuario };
};
const mariana = await sesion("mariana.gomez@ichiba.test");
const admin = await sesion("admin@ichiba.test");

console.log("1. Horario de Lucía fuera de atención (solo domingo 05:00-06:00)");
const dias = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
await clientePrisma.usuario.update({
  where: { id: LUCIA },
  data: {
    horarios: dias.map((dia) => ({ dia, activo: dia === "domingo", horaInicio: "05:00", horaFin: "06:00" })),
    horarioConfirmadoEn: new Date(),
  },
});

console.log("2. Filas: posición 2 en las tazas y turno de pago en las canastas");
await pedir("POST", "/colas/entrar", { productoId: P.tazas }, comoComprador(OTRO1));
await pedir("POST", "/colas/entrar", { productoId: P.tazas }, comoComprador(DEMO));
await pedir("POST", "/colas/entrar", { productoId: P.canastas }, comoComprador(DEMO));

console.log("3. Aviso de fila cerrada para el comprador");
await clientePrisma.cola.create({
  data: { productoId: P.cafetera, compradorId: DEMO, posicion: 2, estado: "finalizada", motivoCierre: "vendido_a_otro" },
});

const carpeta = path.join(RAIZ_BACKEND, "uploads", "comprobantes");
fs.mkdirSync(carpeta, { recursive: true });
async function comprobante(nombre: string, referencia: string, monto: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200">
  <rect width="900" height="1200" fill="#ffffff"/>
  <rect width="900" height="150" fill="#003087"/>
  <text x="60" y="95" font-family="Arial" font-size="48" fill="#ffffff" font-weight="bold">PayPal · Sandbox</text>
  <text x="60" y="250" font-family="Arial" font-size="40" fill="#111">Comprobante de pago</text>
  <text x="60" y="300" font-family="Arial" font-size="26" fill="#d90429">Documento de demostración (sin validez)</text>
  <text x="60" y="420" font-family="Arial" font-size="30" fill="#444">Número de referencia</text>
  <text x="60" y="470" font-family="Arial" font-size="44" fill="#111" font-weight="bold">${referencia}</text>
  <text x="60" y="580" font-family="Arial" font-size="30" fill="#444">Monto</text>
  <text x="60" y="630" font-family="Arial" font-size="44" fill="#111" font-weight="bold">$${monto.toFixed(2)} MXN</text>
  <text x="60" y="740" font-family="Arial" font-size="30" fill="#444">Fecha</text>
  <text x="60" y="790" font-family="Arial" font-size="40" fill="#111">24/11/2026</text>
  <text x="60" y="900" font-family="Arial" font-size="30" fill="#444">Estado: Completado</text>
</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(carpeta, nombre));
  return `/uploads/comprobantes/${nombre}`;
}

const sello = Date.now();
async function venta(productoId: string, compradorId: string, vendedorId: number, monto: number, n: number) {
  const r = await registrarVentaExitosa({ productoId, compradorId, vendedorId, monto, referenciaExterna: `DEMO-REVISION-${sello}-${n}` });
  return r.venta!.id;
}
async function conComprobante(id: number, referencia: string) {
  const v = await cargarVenta(id);
  const imagen = await comprobante(`demo-comprobante-${id}.png`, referencia, Number(v!.monto));
  const r = await registrarComprobanteDeVenta(v!, { palabraClave: String(v!.codigoPago), referencia, imagen });
  if (r.error) console.log("  ! comprobante", id, r.error);
}
async function confirmada(id: number, vendedorId: number) {
  const r = await confirmarComprobanteDeVenta((await cargarVenta(id))!, vendedorId);
  if (r.error) console.log("  ! confirmar", id, r.error);
}
const mongoId = async (id: number) => String((await Venta.findOne({ ventaIdPg: id }).select("_id").lean())?._id);

console.log("4. Ventas en cada etapa");
const s1 = await venta(P.cojines, DEMO, MARIANA, 520, 1);
const s2 = await venta(P.lampara, DEMO, MARIANA, 950, 2);
await conComprobante(s2, "48213377");
const s3 = await venta(P.espejo, DEMO, MARIANA, 1450, 3);
await conComprobante(s3, "50719264");
await confirmada(s3, MARIANA);
const s5 = await venta(P.jarron, DEMO, MARIANA, 850, 5);
await conComprobante(s5, "61930457");
await confirmada(s5, MARIANA);
const s4 = await venta(P.chamarra, DEMO, CARLOS, 780, 4);
await conComprobante(s4, "73306158");
await confirmada(s4, CARLOS);
const s6 = await venta(P.botas, OTRO2, CARLOS, 1600, 6);
await conComprobante(s6, "84402691");
await confirmada(s6, CARLOS);

console.log("5. Chat y propuesta de entrega en el espejo (tienda)");
const m3 = await mongoId(s3);
await pedir("POST", `/mensajes/comprador/${m3}`, { contenido: "Hola, ¿a qué hora puedo pasar por el espejo a la tienda?" }, comoComprador(DEMO));
await pedir("POST", `/mensajes/vendedor/${m3}`, { contenido: "Hola, te propongo el sábado a las 12:00 en la tienda. Te mando la propuesta." }, conToken(mariana.token));
const sabado = new Date(); sabado.setDate(sabado.getDate() + ((6 - sabado.getDay() + 7) % 7 || 7));
const fecha = sabado.toISOString().slice(0, 10);
await pedir("POST", `/entregas/vendedor/${m3}/propuesta`, { lugar: "Av. Chapultepec 245, Col. Americana, Guadalajara", fecha, hora: "12:00" }, conToken(mariana.token));

console.log("6. Venta completada (jarrón) lista para calificar");
const ahora = new Date();
await clientePrisma.venta.update({ where: { id: s5 }, data: { estado: "completada", entregadoEn: ahora } });
const v5 = await cargarVenta(s5);
await actualizarEspejoVenta(v5!.paypalOrderId, { estado: "completada", entregadoEn: ahora });
await clientePrisma.cola.updateMany({ where: { productoId: P.jarron }, data: { estado: "finalizada" } });

console.log("7. Entrega a domicilio con dirección y disputa (chamarra de Carlos)");
const m4 = await mongoId(s4);
await pedir("POST", `/entregas/comprador/${m4}/direccion`, {
  nombreRecibe: "Comprador de demostración", calleNumero: "Av. Vallarta 1525", colonia: "Americana",
  codigoPostal: "44160", ciudad: "Guadalajara", estado: "Jalisco", telefono: "3312345678", referencias: "Portón negro",
}, comoComprador(DEMO));
await crearDisputa({ compradorId: DEMO, ventaId: s4, motivo: "El producto no coincide con la descripción", descripcion: "La chamarra llegó con una talla distinta a la publicada y con una mancha en la manga." });

console.log("8. Venta reembolsada con adeudo del vendedor (botas de Carlos)");
await clientePrisma.venta.update({ where: { id: s6 }, data: { estado: "reembolsada", canceladoMotivo: "El vendedor no registró la entrega dentro del plazo", reembolsadoEn: ahora } });
const v6 = await cargarVenta(s6);
await actualizarEspejoVenta(v6!.paypalOrderId, { estado: "reembolsada", canceladoMotivo: "El vendedor no registró la entrega dentro del plazo" });
await registrarAdeudo({ usuarioId: CARLOS, venta: { id: s6, productoId: P.botas, paypalOrderId: v6!.paypalOrderId, monto: 1600 }, motivo: "Reembolso cubierto por la plataforma: entrega fuera del plazo", causa: "entrega_vencida" as any });

console.log("9. Reportes del comprador");
await pedir("POST", "/reportes", { elemento: "publicacion", categoria: "otro", productoId: P.tazas, detalle: "La descripción dice que son de cerámica artesanal pero en las fotos parecen industriales." }, comoComprador(DEMO));
await pedir("POST", "/reportes", { elemento: "vendedor", categoria: "falta_respeto", vendedorId: String(CARLOS), detalle: "El vendedor respondió de forma grosera cuando pregunté por la talla de la chamarra." }, comoComprador(DEMO));

console.log("10. Lista negra, solicitud de registro, suscripción, comentario e informes");
await pedir("POST", "/admin/lista-negra", { rfc: "PEGJ850101AB1", curp: "PEGJ850101HJCRRN09", nombreCompleto: "Juan Pérez García", motivo: "Estafa confirmada en una compra anterior" }, conToken(admin.token));
await pedir("POST", "/usuarios/registro/solicitar-revision", { nombreCompleto: "Ana López Ruiz", correo: "ana.lopez@ichiba.test", telefono: "3398765432", rfc: "LORA900215XY1", mensaje: "Creo que ya tenía una cuenta con estos datos y perdí el acceso.", motivo: "datos-en-uso" });
await pedir("POST", "/notificaciones/suscribir", { correo: "comprador.demo@ichiba.test", categorias: ["hogar", "artesanias"] }, comoComprador(DEMO));
const promos = await pedir("GET", "/promocionales");
// Un promocional de Mariana (la sesión de vendedor) para poder responder comentarios y consultas.
const promo = Array.isArray(promos)
  ? promos.find((p: any) => String(p.vendedorId) === String(mariana.usuario.id)) ?? promos[0]
  : null;
if (promo) {
  await pedir("POST", `/promocionales/${promo._id}/comentarios`, { texto: "¿El precio incluye la entrega en Zapopan?", autorNombre: "Comprador de demostración" }, comoComprador(DEMO));
  await pedir("POST", `/promocionales/${promo._id}/consulta`, { contenido: "Hola, ¿tiene alguna mancha o desgaste?" }, comoComprador(DEMO));
  await pedir("POST", `/promocionales/${promo._id}/consulta/${encodeURIComponent(DEMO)}`, { contenido: "Hola, está en muy buen estado, solo un leve desgaste en un brazo." }, conToken(mariana.token));
  await pedir("POST", `/promocionales/${promo._id}/consulta`, { contenido: "¿Podría verlo el sábado?" }, comoComprador(DEMO));
}
await pedir("POST", "/admin/informes/generar", { periodo: "2026-10" }, conToken(admin.token));
const informeNov = await pedir("POST", "/admin/informes/generar", { periodo: "2026-11" }, conToken(admin.token));
console.log("  informe 2026-11:", informeNov?.message ?? informeNov);

const sesiones = {
  vendedor: mariana,
  admin,
  comprador: DEMO,
  ventas: { s1, s2, s3, s4, s5, s6, m3, m4 },
  productos: P,
  promocional: promo?._id ?? null,
};
if (SALIDA) fs.writeFileSync(SALIDA, JSON.stringify(sesiones, null, 2));
console.log("Listo:", JSON.stringify(sesiones.ventas));
process.exit(0);
