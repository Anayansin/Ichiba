const fs = require("fs");
const path = require("path");
// Genera la guía de revisión de requerimientos, la página que inicia la sesión de cada pestaña
// y la lista de direcciones que abre herramientas/abrir-revision.ps1.
// Uso: node herramientas/generar-revision.cjs  (después de herramientas/escenario-revision.mts)
const RAIZ = path.resolve(__dirname, "..");
const R = require(path.join(RAIZ, "revision", "requisitos.json"));
const S = JSON.parse(fs.readFileSync(path.join(RAIZ, "revision", "sesiones.json"), "utf8"));
const SALIDA = path.join(RAIZ, "revision", "guia-revision.html");
const URL_GUIA = "file:///" + SALIDA.split(path.sep).join("/");

const sesion = (origen, rol) => (ruta) => `${origen}/revision-sesion.html?rol=${rol}&ir=${encodeURIComponent(ruta)}`;
const c = sesion("http://comprador.localhost:5173", "comprador");
const v = sesion("http://vendedor.localhost:5173", "vendedor");
const a = sesion("http://admin.localhost:5173", "admin");
const P = S.productos;
const TOSTADOR = "6b035a8cad08e5c2ffe4e9e1";
const ZAPATOS = "6b035a8cad08e5c2ffe4e9da";

const PESTANAS = [
  ["guia", "Esta guía", URL_GUIA, "—"],
  ["cinicio", "Catálogo", c(`/inicio`), "Comprador"],
  ["cmovil", "Catálogo en teléfono (F12 y luego Ctrl+Shift+M)", c(`/inicio?vista=telefono`), "Comprador"],
  ["cfila2", "En fila: posición 2", c(`/producto/${P.tazas}`), "Comprador"],
  ["cturno", "Turno de pago", c(`/producto/${P.canastas}`), "Comprador"],
  ["cdisp", "Producto disponible (3.ª fila)", c(`/producto/${ZAPATOS}`), "Comprador"],
  ["cfuera", "Fuera de horario", c(`/producto/${TOSTADOR}`), "Comprador"],
  ["cperfil", "Perfil del vendedor fuera de horario", c(`/vendedor/317`), "Comprador"],
  ["cpago", "Comprobante pendiente", c(`/pago-exitoso?venta=${S.ventas.s1}`), "Comprador"],
  ["cchat", "Chats del comprador", c(`/chats`), "Comprador"],
  ["cpedidos", "Mis pedidos y disputa", c(`/ayuda?seccion=mis-pedidos`), "Comprador"],
  ["creportar", "Mis reportes", c(`/ayuda?seccion=reportar`), "Comprador"],
  ["cpromos", "Promocionales", c(`/promocionales`), "Comprador"],
  ["cpromo", "Detalle de promocional", c(`/promocional/${S.promocional}`), "Comprador"],
  ["cayuda", "Ayuda y asistente", c(`/ayuda`), "Comprador"],
  ["reg", "Registro de vendedor", c(`/registro`), "Sin sesión"],
  ["recup", "Recuperar contraseña", c(`/recuperar-password`), "Sin sesión"],
  ["vpanel", "Panel del vendedor", v(`/panel-vendedor`), "Vendedora (Mariana)"],
  ["vpub", "Publicar producto", v(`/panel-vendedor/publicar`), "Vendedora (Mariana)"],
  ["vpromo", "Publicar promocional", v(`/panel-vendedor/promocionar`), "Vendedora (Mariana)"],
  ["vedit", "Editar producto con fila", v(`/panel-vendedor/editar/${P.tazas}`), "Vendedora (Mariana)"],
  ["vhor", "Horario de atención", v(`/panel-vendedor/horario`), "Vendedora (Mariana)"],
  ["vest", "Estadísticas", v(`/panel-vendedor/estadisticas`), "Vendedora (Mariana)"],
  ["vrep", "Reportar comprador", v(`/panel-vendedor/reportar-comprador`), "Vendedora (Mariana)"],
  ["vchat", "Chats del vendedor", v(`/chats`), "Vendedora (Mariana)"],
  ["vpromod", "Su promocional (responder comentarios)", v(`/promocional/${S.promocional}`), "Vendedora (Mariana)"],
  ["ainicio", "Admin: tablero", a(`/admin`), "Administración"],
  ["ausuarios", "Admin: usuarios", a(`/admin?seccion=usuarios`), "Administración"],
  ["areportes", "Admin: reportes pendientes", a(`/admin?seccion=reportes`), "Administración"],
  ["adisputas", "Admin: disputas", a(`/admin?seccion=disputas`), "Administración"],
  ["aadeudos", "Admin: adeudos", a(`/admin?seccion=adeudos`), "Administración"],
  ["ainformes", "Admin: informes", a(`/admin?seccion=informes`), "Administración"],
  ["alista", "Admin: lista negra", a(`/admin?seccion=lista-negra`), "Administración"],
  ["asolic", "Admin: solicitudes de registro", a(`/admin?seccion=solicitudes-registro`), "Administración"],
  ["atraza", "Admin: trazabilidad", a(`/admin?seccion=trazabilidad`), "Administración"],
  ["abitacora", "Admin: bitácora", a(`/admin?seccion=bitacora`), "Administración"],
  ["areportes2", "Admin: todos los reportes", a(`/admin/reportes`), "Administración"],
];
const numero = Object.fromEntries(PESTANAS.map(([k], i) => [k, i + 1]));

const AUTO = "auto", PEND = "pendiente", OK = "ok";
const M = [
  [["reg"], OK, "Intenta enviar el formulario vacío, con teléfono de 5 dígitos, una imagen GIF o menor a 420 × 540 y una contraseña débil: cada regla muestra su mensaje. La lectura de la INE con StructOCR y la comparación del RFC con la CURP ocurren al enviar con fotos reales de una INE."],
  [["reg"], OK, "Regístrate con el RFC PEGJ850101AB1, que está en la lista negra: aparece el aviso de registro denegado sin revelar el dato y el formulario para pedir revisión."],
  [["reg"], OK, "La casilla de notificaciones críticas es obligatoria: sin marcarla el formulario no se envía."],
  [["reg", "vpanel"], OK, "La casilla de notificaciones publicitarias es opcional; en el panel del vendedor se cambia en \"Preferencias de notificaciones\"."],
  [["reg", "vpanel"], OK, "Al terminar un registro el sistema redirige a PayPal (sandbox) para vincular la cuenta; al volver, el panel muestra el resultado de la vinculación."],
  [["reg", "vhor"], OK, "El selector permite días y horas de 05:00 a 23:59 y exige al menos una hora a la semana."],
  [["vhor"], OK, "Modifica el horario y guarda. Los avisos y la eliminación por no confirmar (RQNF6.3 a 6.6) los ejecuta la tarea programada mensual: se explican en la sección 4.7 del reporte."],
  [["vpanel"], AUTO, "La ventana \"Confirma tu horario de este mes\" aparece cuando el vendedor no ha confirmado en el mes en curso; Mariana ya confirmó, por eso no aparece. La restricción la aplica el servidor."],
  [["cinicio"], OK, "Usa \"Iniciar sesión\" con una cuenta de demostración: la contraseña se compara con el hash bcrypt de PostgreSQL."],
  [["vpub"], OK, "Intenta publicar con campos vacíos, precio fuera de $10–$5,000, descripción corta, una palabra prohibida o una imagen fuera de rango. El tiempo de pago solo ofrece de 30 minutos a 3 horas."],
  [["vpub"], OK, "La categoría es obligatoria y solo ofrece las seis predefinidas."],
  [["vpromo"], OK, "El promocional exige precio de $5,001 o más, cobertura de envío y valida palabras prohibidas; las fotos pasan por SafeSearch."],
  [["creportar", "ausuarios", "areportes2"], OK, "El reporte de \"Faltas de respeto\" contra Carlos ya se aplicó: sus puntos aparecen en Admin › usuarios. El de \"Otro motivo\" quedó pendiente de revisión."],
  [[], AUTO, "El correo de cancelación se envía al llegar a 8 puntos (prueba automatizada y sección 4.6 del reporte); requiere acumular 8 puntos en una cuenta."],
  [["vpanel"], AUTO, "Cuando la cuenta está cancelada, el panel muestra el aviso y solo deja las entregas pendientes. Requiere una cuenta cancelada por 8 puntos."],
  [["cinicio"], OK, "Al abrir la pestaña del comprador aparece el aviso emergente de fila cerrada (\"un usuario previo ha concretado la compra\"); el mismo aviso existe para cuenta cancelada."],
  [["vedit"], OK, "Las tazas tienen fila en curso: al guardar cambios o intentar eliminarlas, el sistema lo impide y muestra el aviso."],
  [["vpanel", "vest"], OK, "El panel separa productos activos e inactivos y el historial de vendidos; la tarjeta de calificación promedio muestra la reputación."],
  [["vpanel"], OK, "En \"Informes de ventas\" está el informe 2026-11 con el botón \"Descargar PDF\". La generación automática del día 1.° la hace la tarea programada."],
  [["cinicio"], OK, "Cada tarjeta muestra imagen, nombre y precio; solo aparecen productos activos y al bajar se cargan más (Intersection Observer)."],
  [["cinicio"], OK, "La barra lleva a Inicio, Chats, Categorías, Promocionales, Nosotros, Ayuda e Iniciar sesión."],
  [["cdisp"], OK, "Presiona \"Entrar en la fila\" en los zapatos: la primera vez pide aceptar términos y ofrece la suscripción por categorías."],
  [["cdisp"], OK, "Ya estás en 2 filas: entra a la fila de los zapatos (3.ª) y luego intenta otra de Carlos para ver \"Ya estás en 3 filas. Abandona una para continuar\"."],
  [["cinicio"], OK, "Las tarjetas de Lucía muestran \"Inactivo por horario\" y su próxima apertura; las demás, \"Disponible\"."],
  [["cfuera"], OK, "El botón \"Entrar en la fila\" aparece deshabilitado con la fecha y hora de la próxima apertura."],
  [["cturno"], AUTO, "Las opciones \"Pagar ahora\" o \"Esperar al siguiente bloque\" aparecen cuando el bloque del vendedor termina antes que el tiempo de pago. Para verlo, en la pestaña de horario deja que el bloque de hoy termine en menos de 60 minutos y entra a una fila."],
  [["cturno"], AUTO, "La advertencia acompaña a las dos opciones anteriores; mismo caso."],
  [["cperfil"], OK, "El perfil muestra nombre, calificación, ventas, reportes y productos activos."],
  [["cperfil"], OK, "Con la vendedora fuera de horario, sus productos aparecen en modo de solo consulta con la próxima apertura."],
  [["cfila2"], OK, "Estás en la posición 2 de las tazas; la burbuja flotante con el número de filas muestra cada posición y se actualiza sola."],
  [["cinicio"], OK, "El aviso emergente de \"Producto no disponible\" aparece al abrir el catálogo."],
  [["cdisp"], OK, "La ventana de términos al entrar a una fila pide correo y categorías y valida el formato. Ya hay una suscripción guardada para el comprador de demostración."],
  [[], AUTO, "El correo con productos nuevos lo envía la tarea programada a las 10:00 y 17:00 (sección 4.7 del reporte)."],
  [["cturno"], OK, "Con el turno activo, \"Pagar con PayPal\" muestra el aviso y lleva a la página de PayPal sandbox. Si el turno ya venció, vuelve a entrar a la fila."],
  [["cchat", "cpedidos"], OK, "En las compras en entrega se ve el código de confirmación de entrega."],
  [["cpago"], OK, "Formulario del comprobante: prueba una palabra clave incorrecta, una referencia de 5 dígitos o una imagen fuera de rango. El análisis OCR y SafeSearch ocurre al enviar una imagen real."],
  [["cpago"], OK, "La palabra clave de 4 dígitos aparece en grande en esta página."],
  [["cpedidos"], OK, "La lámpara tiene el comprobante en revisión: Mis pedidos indica que el vendedor lo revisará antes de la fecha límite."],
  [["creportar"], OK, "El formulario de reporte exige al menos 30 caracteres en el detalle antes de enviar."],
  [["cchat", "vchat"], OK, "El chat del espejo está abierto en ambas pestañas porque el comprobante fue confirmado."],
  [["vchat"], OK, "En el espejo (entrega en tienda) Mariana ya envió la propuesta; para enviar otra, el formulario valida lugar, fecha y hora dentro del horario de entrega."],
  [["cchat"], OK, "En el chat del espejo, el comprador ve la propuesta con los botones Aceptar y Rechazar."],
  [["cchat"], OK, "En la chamarra (domicilio) el comprador ya registró su dirección; el formulario valida código postal de 5 dígitos y teléfono de 10."],
  [[], AUTO, "La chamarra es de Carlos y tiene una disputa abierta; para registrar el envío se necesita la sesión de Carlos. Se puede demostrar iniciando sesión como Carlos en otra dirección."],
  [["cchat"], AUTO, "Aparece en el chat del comprador cuando el vendedor registra el envío (requiere el paso anterior)."],
  [["vchat"], OK, "Si en la pestaña del comprador rechazas la propuesta del espejo, la pestaña del vendedor muestra el aviso de rechazo y el formulario para una nueva."],
  [["cturno", "cpago"], OK, "El aviso del horario del vendedor aparece antes de continuar a PayPal y en el formulario del comprobante; el botón se habilita al marcar la casilla."],
  [["vpanel"], OK, "Cada venta del panel lleva una etiqueta de fondos: \"retenidos en garantía\" mientras no se completa, \"en proceso de liberación\" y \"liberados a tu PayPal\" cuando PayPal confirma la captura. El jarrón (completada sin captura real) aparece en proceso."],
  [["creportar", "cfila2"], OK, "El botón \"Reportar\" está en cada producto, perfil, promocional y chat; ofrece las categorías definidas y exige 30 a 500 caracteres."],
  [["creportar"], OK, "\"Mis reportes\" muestra cada reporte con su estado (en revisión, confirmado)."],
  [["vpanel"], OK, "En \"Confirmar entregas\" del espejo, escribe un código incorrecto para ver el rechazo. Con el código correcto se captura el pago en PayPal (requiere una venta real del sandbox)."],
  [["cchat"], OK, "En el chat del jarrón (venta completada) aparecen las estrellas para calificar de 1 a 5."],
  [["cchat"], OK, "El menú de calificación solo aparece en ventas completadas."],
  [["cfila2"], OK, "Presiona \"Salir\" en la burbuja o en el producto: la posición de los demás se conserva."],
  [["cinicio"], OK, "Los avisos de retiro (turno vencido o comprobante rechazado) usan la misma ventana emergente que el de producto vendido."],
  [["cpromo"], OK, "Debajo de los comentarios está el \"Chat de consulta con el vendedor\": ya tiene una conversación de ejemplo. Escribe una pregunta: solo la ven tú y el vendedor."],
  [["vpromod", "vpanel"], OK, "En el promocional, el vendedor ve \"Responder\" en cada comentario sin respuesta. En el panel, \"Consultas de tus promocionales\" lista los chats privados con su campo para responder."],
  [["cpromo"], OK, "Cualquier visitante ve los comentarios del promocional."],
  [["vpanel"], OK, "En \"Comprobantes por revisar\" está la lámpara con referencia, imagen del comprobante y los botones para confirmar o rechazar."],
  [["cpedidos"], AUTO, "Si el vendedor no revisa el comprobante a tiempo, la tarea programada cancela, reembolsa y Mis pedidos muestra el motivo. Las botas de Carlos muestran un caso cancelado con motivo."],
  [["vpanel"], OK, "La sección \"Filas de tus publicaciones\" muestra por producto en qué etapa está el primer lugar y cuántas personas esperan; se actualiza cada 10 segundos."],
  [["cchat", "vchat"], OK, "El chat del espejo permite escribir; los de la lámpara (sin confirmar) y el jarrón (completada) aparecen bloqueados con su motivo."],
  [["cchat"], OK, "Envía un mensaje en el chat del espejo. El recordatorio de que lo acordado solo vale por el formulario aparece arriba del formulario de propuesta."],
  [["cchat", "vchat"], OK, "Los mensajes aparecen en orden, con emisor y hora de la Ciudad de México."],
  [["cchat"], OK, "Escribe una palabra prohibida en el chat: el mensaje no se envía y aparece el aviso."],
  [["ausuarios"], OK, "La tabla muestra nombre, correo, tipo, registro, puntos, saldo y estado. Solo la cuenta de administración puede abrirla."],
  [["ausuarios"], OK, "Presiona \"Suspender\" en un usuario activo: pide el motivo (mínimo 10 caracteres) y se le envía por correo. Con un motivo más corto el sistema lo rechaza."],
  [["ausuarios", "aadeudos"], OK, "Carlos aparece suspendido por saldo: \"Reactivar\" lo rechaza mientras tenga adeudo; al liquidarlo en Admin › adeudos se reactiva."],
  [["areportes"], OK, "El reporte \"Otro motivo\" de las tazas está pendiente con Confirmar y Rechazar."],
  [["atraza"], OK, "El historial muestra filas, ventas y reportes con producto, vendedor, monto y estado."],
  [["atraza"], OK, "En las ventas, \"Ver conversación\" abre el chat completo de la compra (por ejemplo, el espejo)."],
  [["adisputas"], OK, "La disputa de la chamarra está abierta con la versión del comprador; se puede reembolsar o rechazar. Abajo están las ventas retenidas."],
  [["ainformes"], OK, "Están los informes de 2026-10 y 2026-11 con la categoría más vendida, la tasa de abandono y la descarga en PDF."],
];

const grupos = [];
let actual = null;
let modulo = "";
for (const r of R) {
  if (!r.id) { modulo = r.modulo; continue; }
  if (/^RQF/.test(r.id)) { actual = { modulo, rqf: r, rqnf: [] }; grupos.push(actual); }
  else if (actual) actual.rqnf.push(r);
}
if (grupos.length !== M.length) throw new Error(`grupos ${grupos.length} vs mapa ${M.length}`);

const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\[KO1\.1\]/g, "");
const etiqueta = { ok: ["Se ve en pantalla", "ok"], auto: ["Proceso automático o caso especial", "auto"], pendiente: ["No encontrado en la interfaz", "pend"] };
let html = "";
let modActual = "";
let n = 0;
grupos.forEach((g, i) => {
  const [tabs, tipo, como] = M[i];
  if (g.modulo !== modActual) {
    if (modActual) html += "</section>";
    modActual = g.modulo;
    html += `<section><h2>${esc(g.modulo)}</h2>`;
  }
  const enlaces = tabs.map((k) => {
    const t = PESTANAS.find((p) => p[0] === k);
    return `<a href="${t[2]}" target="_blank">Pestaña ${numero[k]} · ${esc(t[1])}</a>`;
  }).join(" ");
  const items = [g.rqf, ...g.rqnf].map((r) => {
    n++;
    return `<label class="req"><input type="checkbox" data-k="${n}"><span><b>${esc(r.id)}</b> ${esc(r.texto)}</span></label>`;
  }).join("");
  html += `<article class="${etiqueta[tipo][1]}"><div class="cab"><span class="chip ${etiqueta[tipo][1]}">${etiqueta[tipo][0]}</span>${enlaces}</div><p class="como">${esc(como)}</p>${items}</article>`;
});
html += "</section>";

const filasPestanas = PESTANAS.map(([k, t, url, s], i) => `<tr><td>${i + 1}</td><td>${esc(t)}</td><td>${esc(s)}</td><td><a href="${url}" target="_blank">${esc(decodeURIComponent((url.split("ir=")[1] || "revision/guia-revision.html")))}</a></td></tr>`).join("");
const pendientes = M.map((m, i) => (m[1] === PEND ? grupos[i].rqf.id : null)).filter(Boolean);

const pagina = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Ichiba · Guía de revisión de requerimientos</title>
<style>
body{font-family:"Segoe UI",Arial,sans-serif;margin:0;background:#f4ead8;color:#1a1a1a}
header{background:#161616;color:#f2e6d0;padding:24px 32px}
header h1{margin:0 0 6px;font-size:26px}header p{margin:4px 0;color:#d9cdb6}
main{max-width:1100px;margin:0 auto;padding:16px 24px 60px}
h2{border-bottom:3px solid #d90429;padding-bottom:6px;margin-top:36px}
article{background:#fff;border-radius:10px;padding:14px 18px;margin:12px 0;border-left:6px solid #2e7d32}
article.auto{border-left-color:#c9962b}article.pend{border-left-color:#d90429}
.cab{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.cab a{background:#161616;color:#f2e6d0;text-decoration:none;padding:4px 10px;border-radius:999px;font-size:13px}
.chip{font-size:12px;padding:3px 9px;border-radius:999px;font-weight:600}
.chip.ok{background:#e9f7ef;color:#14683a}.chip.auto{background:#fdf3de;color:#8a5a00}.chip.pend{background:#fdecec;color:#b3001b}
.como{margin:10px 0;color:#333}
.req{display:flex;gap:10px;padding:5px 0;border-top:1px solid #eee;font-size:14px;cursor:pointer}
.req input{margin-top:3px}.req:has(input:checked) span{color:#888;text-decoration:line-through}
table{border-collapse:collapse;width:100%;background:#fff;font-size:14px}td{padding:6px 8px;border-top:1px solid #eee}
.progreso{font-weight:700;color:#d90429}
.aviso{background:#fff;border-radius:10px;padding:12px 18px;border-left:6px solid #d90429}
</style></head><body>
<header><h1>Ichiba 市場 · Guía de revisión de requerimientos</h1>
<p>Cada tarjeta indica en qué pestaña revisar un requerimiento funcional y sus no funcionales. Marca las casillas conforme avances: se guardan en este navegador.</p>
<p>Progreso: <span class="progreso" id="progreso">0</span> de ${n} requerimientos revisados.</p></header>
<main>
<h2>Cómo están preparadas las pestañas</h2>
<p>Todas usan la plataforma corriendo en esta computadora, con tres sesiones separadas: <b>comprador.localhost</b> (comprador de demostración, sin cuenta), <b>vendedor.localhost</b> (Mariana Gómez Herrera) y <b>admin.localhost</b> (Administración Ichiba). Los datos de demostración incluyen filas, ventas en cada etapa, un chat con propuesta de entrega, una disputa, un adeudo, reportes, lista negra, solicitudes, una suscripción, un comentario, un chat de consulta en un promocional e informes.</p>
<p class="aviso">Algunos estados dependen de la hora: el turno de pago de las canastas vence una hora después de crearse y los plazos de revisión avanzan con las tareas programadas. Si un estado ya cambió, vuelve a entrar a la fila o regenera los datos con <code>npm run seed</code> y <code>node --import tsx ../herramientas/escenario-revision.mts</code> desde la carpeta <code>backend</code>.</p>
${pendientes.length ? `<p class="aviso">Requerimientos que no encontré en la interfaz: <b>${pendientes.join(", ")}</b>. Están marcados en rojo.</p>` : ""}
<table><tr><td><b>#</b></td><td><b>Pestaña</b></td><td><b>Sesión</b></td><td><b>Dirección</b></td></tr>${filasPestanas}</table>
${html}
</main>
<script>
const clave="ichiba-revision";const guardadas=JSON.parse(localStorage.getItem(clave)||"{}");
const cajas=[...document.querySelectorAll("input[data-k]")];
const actualizar=()=>{document.getElementById("progreso").textContent=cajas.filter(c=>c.checked).length};
cajas.forEach(c=>{c.checked=!!guardadas[c.dataset.k];c.addEventListener("change",()=>{guardadas[c.dataset.k]=c.checked;localStorage.setItem(clave,JSON.stringify(guardadas));actualizar()})});
actualizar();
</script></body></html>`;
fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
fs.writeFileSync(SALIDA, pagina);
fs.writeFileSync(path.join(RAIZ, "revision", "pestanas.txt"), PESTANAS.map((p) => p[2]).join("\n") + "\n");
const ayudante = `<!doctype html><meta charset="utf-8"><title>Iniciando sesión de revisión…</title>
<script>
const q = new URLSearchParams(location.search);
const sesiones = ${JSON.stringify({ vendedor: S.vendedor, admin: S.admin, comprador: S.comprador })};
const rol = q.get("rol");
if (rol === "comprador") { localStorage.removeItem("token"); localStorage.removeItem("usuario"); sessionStorage.removeItem("token"); sessionStorage.removeItem("usuario"); sessionStorage.setItem("sesionSembrada", "1"); localStorage.setItem("compradorId", sesiones.comprador); }
else if (sesiones[rol]) { localStorage.setItem("token", sesiones[rol].token); localStorage.setItem("usuario", JSON.stringify(sesiones[rol].usuario)); sessionStorage.setItem("token", sesiones[rol].token); sessionStorage.setItem("usuario", JSON.stringify(sesiones[rol].usuario)); sessionStorage.setItem("sesionSembrada", "1"); localStorage.setItem("advertenciaEncuentroVista", "true"); }
location.replace(q.get("ir") || "/inicio");
</script>`;
fs.writeFileSync(path.join(RAIZ, "frontend", "Ichiba", "revision-sesion.html"), ayudante);
console.log("requerimientos", n, "pestañas", PESTANAS.length, "pendientes", pendientes.join(","));
