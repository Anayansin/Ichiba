# Inventario de Ichiba

Todo lo que usa el proyecto: herramientas, librerías, APIs externas, dónde vive
cada cosa y cómo funciona el envío de correos. Pensado como referencia rápida
para responder preguntas.

> Los secretos (contraseñas, llaves de API) **no están en este archivo**: viven
> en `backend/.env` (que está fuera de git) y en los scripts de arranque.

---

## 1. Mapa del repositorio

| Carpeta / archivo | Qué es |
|---|---|
| `backend/` | API Express + TypeScript (puerto 5000) |
| `backend/src/` | Código del servidor (rutas, controladores, servicios, jobs) |
| `backend/scripts/` | Scripts de mantenimiento (`seed.ts`, `crear-admin.ts`, `probar-correo.ts`, `inspeccionar-mongo.ts`) y las **9 suites de pruebas** (`probar-escrow.ts`, `probar-puntos-cancelacion.ts`, `probar-informes.ts`, `probar-suscripciones.ts`, `probar-mcp.ts`, `probar-sanciones.ts`, `probar-disputas.ts`, `probar-fila-apertura.ts`, `probar-moderacion-vision.ts`) |
| `backend/src/mcp/` | Servidor MCP del BackOffice (18 herramientas): por stdio (`npm run mcp`) y por HTTP en `/mcp` (solo administradores) |
| `backend/prisma/schema.prisma` | Espejo informativo de PostgreSQL (la fuente de verdad es `backend/src/prisma/contract.prisma`) |
| `backend/src/prisma/` | Contrato Prisma 8 (`contract.prisma`, `contract.json`, `contract.d.ts`) y cliente `db.ts` |
| `backend/uploads/` | Fotos de productos/promocionales (sí se sirven por HTTP) |
| `backend/uploads/ine/` | Fotos de INE del registro (solo disco, **bloqueadas** en HTTP) |
| `backend/.env` | Variables de entorno reales (sin trackear) |
| `backend/.env.example` | Plantilla documentada de esas variables |
| `frontend/Ichiba/` | Aplicación React + Vite (puerto 5173) |
| `front-astro/` | Proyecto Astro aparte (React dentro de Astro). **No** forma parte del flujo principal |
| `.github/workflows/` | CI/CD: `integracion-continua.yml` (8 suites + compilaciones) y `despliegue.yml` (Railway + Vercel) |
| `herramientas/` | Scripts de PowerShell para arrancar sin administrador (`INICIAR-ICHIBA.cmd` en la raíz los ejecuta con doble clic) |
| `DOCUMENTACION.md` | Documentación general (arquitectura, BD, instalación, módulos) |
| `INVENTARIO.md` | Este archivo |

---

## 2. Herramientas de sistema (instaladas en la máquina)

| Herramienta | Versión | Ubicación | Para qué |
|---|---|---|---|
| Node.js + npm | — | sistema | Ejecutar backend y frontend |
| MongoDB **portable** | 8.0.14 | `%LOCALAPPDATA%\Programs\mongodb\bin\mongod.exe` | Base NoSQL (Mongoose). Datos: `...\mongodb\data`, log: `...\mongodb\log\mongod.log`. Puerto **27017**, base `ichiba` |
| PostgreSQL **portable** | 17.6 | `%LOCALAPPDATA%\Programs\postgresql\bin\` (`pg_ctl`, `initdb`, `psql`, `createdb`) | Base relacional (Prisma). Datos: `...\postgresql\data`, log: `...\postgresql\log\postgres.log`. Puerto **5432**, base `mi_base_datos`, usuario `postgres` / `postgres` |
| PowerShell | — | `herramientas\arrancar-bases.ps1`, `herramientas\arrancar-ichiba.ps1` e `INICIAR-ICHIBA.cmd` | Arrancar bases y todo el proyecto **sin permisos de administrador**; `arrancar-ichiba.ps1` además verifica la API y el acceso de administrador (ambos scripts son idempotentes) |
| nodemon + tsx | — | `backend/package.json` | Recarga automática del backend en TS (`npm run dev`) |

> Ninguno de los dos servicios de base de datos está instalado como servicio de
> Windows: por eso el arranque siempre pasa por `INICIAR-ICHIBA.cmd` o
> `herramientas\arrancar-ichiba.ps1`.

---

## 3. Librerías del backend (`backend/package.json`)

### De ejecución

| Librería | Para qué | Dónde se usa |
|---|---|---|
| `express` 5 | Servidor HTTP y rutas | `src/server.ts`, `src/routes/*` |
| `cors` | Permitir el origen del frontend | `src/server.ts` |
| `dotenv` | Cargar `backend/.env` | primera línea de `src/server.ts` y de cada script |
| `mongoose` 9 | Cliente de MongoDB | `src/configuracion/db.ts`, `src/models/*` |
| `prisma` 8 (RC) + `@prisma/client` 7 + `@prisma/orm-postgres` | Cliente de PostgreSQL (Prisma 8 con *contrato*) | `prisma.config.ts`, `src/configuracion/prisma.ts`, `src/prisma/db.ts` |
| `bcryptjs` | Hash de contraseñas | `src/controllers/usuarioController.ts`, `scripts/*` |
| `jsonwebtoken` | Tokens JWT de sesión | `src/middleware/auth.ts` |
| `multer` 2 | Subida de imágenes | `src/middleware/upload.ts` (fotos de producto y de promocional con filtro propio de solo png/jpeg/jpg, RQNF7.2 y RQNF9.2; comprobantes de pago con `subirComprobante`, RQF22; evidencias de disputa con `subirEvidenciasDisputa`, RQF40; y el filtro general con webp que usa el chat) y `src/middleware/uploadIne.ts` (INE, dos campos) |
| `sharp` | Procesamiento de imágenes: dimensiones/nitidez y redimensionado | `src/services/imagenProductoService.ts`, `src/services/ineService.ts` |
| `tesseract.js` | OCR local del reverso de la INE (lee la MRZ, solo dígitos y `<`) | `src/services/ineService.ts`. Usa `eng.traineddata`/`spa.traineddata` de la raíz de `backend/` |
| `nodemailer` 9 | Envío de correos por Gmail SMTP | `src/services/emailService.ts` |
| `node-cron` | Trabajos programados | `src/jobs/*` |
| `@apollo/server` + `@as-integrations/express5` + `graphql` | Endpoint GraphQL en `/graphql` | `src/server.ts`, `src/graphql/*` |
| `graphql-ws` + `ws` | Suscripciones GraphQL en vivo por WebSocket (Fase 4) | `src/graphql/servidorSuscripciones.ts` |
| `@modelcontextprotocol/sdk` + `zod` | Servidor MCP del BackOffice (Fase 5) | `src/mcp/servidorMcp.ts`, `rutasMcp.ts`, `arranqueStdio.ts` |
| `pdfkit` | Informes de ventas y globales en PDF (Fase 3) | `src/services/pdfInformes.ts` |
| `twilio` | **Instalada pero NO usada** (0 coincidencias en `src/`). Se quitó de `.env` junto con los SMS | — |

### De desarrollo

`nodemon`, `tsx`, `typescript` 5.7 y los `@types/*` correspondientes
(`express`, `cors`, `multer`, `bcryptjs`, `jsonwebtoken`, `nodemailer`,
`node-cron`, `pdfkit`, `ws`, `node`).

### Middlewares propios (`backend/src/middleware/`)

| Archivo | Qué controla |
|---|---|
| `auth.ts` → `verificarToken` | Valida el JWT (`Authorization: Bearer …`) |
| `admin.ts` → `requiereAdmin`, `esAdmin.ts` → `esAdmin` | Solo usuarios `tipo: "admin"` |
| `vendedor.ts` → `requiereVendedor`, `rechazarAdminEnCompra`, `requiereVendedorDeEntregas` | El administrador es solo de supervisión: no publica, no confirma horarios ni vincula PayPal (`requiereVendedor` → 403) y no entra a filas ni paga (`rechazarAdminEnCompra`, revisa el token de las rutas de compra que usan `x-comprador-id`). `requiereVendedorDeEntregas` (RQF12) deja que una cuenta cancelada solo complete entregas con pago confirmado |
| `comprador.ts` → `requiereCompradorId` | Usa el header `x-comprador-id` (compradores no se registran) |
| `sancion.ts` | `requiereCompradorSinSancion`, `requiereUsuarioSinSancion`, `obtenerEstadoDeSancion` |
| `verificado.ts` → `requiereVerificado` | Exige correo verificado y horario confirmado del mes en curso (en GMT-6) para publicar y para editar el catálogo (crear, editar, archivar/activar y eliminar productos, RQNF6) |
| `upload.ts` | Multer de publicaciones con `subirFotosProducto` (≤ 5 MB, ≤ 6 imágenes, **solo .png/.jpeg/.jpg** por RQNF7.2/RQNF9.2), `subirComprobante` (imagen del comprobante de pago, RQF22), `subirEvidenciasDisputa` (evidencias de una disputa, RQF40) y `upload`/`subirImagenUnica` general (acepta webp; lo usa el chat) |
| `uploadIne.ts` | Multer de la INE (frente y reverso) |

---

## 4. Librerías del frontend (`frontend/Ichiba/package.json`)

| Librería | Para qué |
|---|---|
| `react` 18 + `react-dom` | UI |
| `react-router-dom` 7 | Rutas (`src/App.tsx`) |
| `axios` 1.19 | Cliente HTTP: `src/services/api.ts` (base `${VITE_BACKEND_URL}/api`, por defecto `http://localhost:5000/api`), interceptor que agrega el JWT y `x-comprador-id`, y que ante un 401 borra la sesión y manda a `/inicio` |
| `graphql` + `graphql-ws` | Suscripciones GraphQL del BackOffice por WebSocket (Fase 4) | `src/services/suscripcionesService.ts` |
| `vite` 6 + `@vitejs/plugin-react` | Servidor de desarrollo y build (5173) |
| `typescript` 5.2, `eslint` + plugins | Tipos y lint (`npm run lint`) |

> `mongodb` y `node-cron` aparecen en las dependencias del frontend pero **no se
> usan en ningún archivo de `src/`** (sobrantes).
>
> El frontend usa la API REST (`src/services/*.ts`) y, además, **suscripciones
> GraphQL por WebSocket** para el BackOffice (`suscripcionesService.ts`).

### Servicios REST del frontend (`frontend/Ichiba/src/services/`)

`api.ts` (instancia), `authService`, `usuarioServices`, `productoService`,
`promocionalService`, `pagoService`, `colaService`, `mensajeService`,
`reporteService`, `adminService`, `informeService`, `notificacionService`,
`verificacionService` y `suscripcionesService` (GraphQL).

### Contextos y configuración

`src/context/` → `AuthContext/AuthProvider` (sesión, `localStorage`),
`ColasContext/ColasProvider` (posición en filas).
`src/configuracion/` → `categorias.ts`, `categoriasReporte.ts`.
`frontend/Ichiba/src/configuracion/comisiones.ts` → comisión de Ichiba (5% + IVA) y
comisiones aproximadas de PayPal y Mercado Pago por transacción.

---

## 5. APIs externas (las que salen a Internet)

| API | URL | Credential / variable | Cliente propio | Se usa en |
|---|---|---|---|---|
| **PayPal Checkout v2** (sandbox) | `https://api-m.sandbox.paypal.com` (cambiable con `PAYPAL_API_BASE`) | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | `backend/src/services/paypalService.ts` | `backend/src/controllers/pagoController.ts` → rutas `/api/pagos/*` |
| **MercadoPago Checkout API** (Payment Brick embebido) | `https://api.mercadopago.com` (cambiable con `MERCADOPAGO_API_BASE`) | `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY` (esta última es pública: la usa el navegador) | `backend/src/services/mercadopagoService.ts` | `backend/src/controllers/pagoController.ts` → rutas `/api/pagos/*` |
| **StructOCR** (lectura de INE) | `POST https://api.structocr.com/v1/national-id` con header `x-api-key` | `STRUCTOCR_API_KEY` | `backend/src/services/structOcrService.ts` | Registro de vendedor en `usuarioController.ts` (cuesta 4 créditos por uso) |
| **Gmail SMTP** (vía nodemailer `service: "gmail"`) | smtp.gmail.com:465/587 | `GMAIL_USER`, `GMAIL_APP_PASSWORD` (contraseña de aplicación) | `backend/src/services/emailService.ts` | Ver todos los correos en la sección 6 |
| **Google Cloud Vision API** (moderación de fotografías) | `https://vision.googleapis.com` (cambiable con `GOOGLE_VISION_ENDPOINT`, solo para pruebas) | `GOOGLE_VISION_API_KEY` | `backend/src/services/visionService.ts` | Publicación de productos (`productoController.ts`) y comprobantes de pago (`pagoController.ts`) |
| PayPal (panel) | developer.paypal.com → Sandbox → Accounts | — | — | Crear la cuenta compradora de prueba para aprobar pagos |

Son **6 APIs externas** (PayPal, MercadoPago, StructOCR, Gmail, Cloud Vision y el panel de PayPal).

### Flujo de PayPal

1. **Vinculación OAuth 2.0 (RQF4/RQNF4):** al terminar su registro como
   vendedor con método de pago PayPal, el navegador sale de inmediato a la
   pasarela oficial (`POST /api/pagos/paypal/vincular`) → el backend
   genera un `state` aleatorio (10 min de vigencia, un solo uso, en Mongo)
   y devuelve la URL de la pasarela oficial
   (`www.sandbox.paypal.com/webapps/oauth2/authorize` con `response_type=code`,
   `scope=openid profile`, `redirect_uri=${BACKEND_URL}/api/pagos/paypal/vincular/callback`).
   El navegador del vendedor se redirige ahí, PayPal lo autentica y regresa
   al callback con `code` + `state`. El backend intercambia el `code` por el
   Token de Acceso (`POST /v1/oauth2/token`), identifica la cuenta
   (`GET /v1/identity/oauth2/userinfo` → `payer_id` = Merchant ID) y guarda
   en Mongo `VinculoPayPal`: Merchant ID, correo y el **Token de Acceso
   CIFRADO con AES-256-GCM** (`cifradoService.ts`, llave
   `PAYPAL_LLAVE_CIFRADO` de 64 hex en `.env`). El estado del callback se
   devuelve al panel como `?paypal=vinculado|denegado|state-invalido|...`.
2. `POST /api/pagos/crear-orden` → `crearOrdenPaypal()` (`POST /v2/checkout/orders`,
   moneda **MXN**, `payee` = el **Merchant ID** del vendedor si vinculó su
   cuenta, si no su `paypalEmail`, retorno
   `${FRONTEND_URL}/pago-exitoso`, cancelación a `/producto/:id`).
3. El usuario aprueba el `linkAprobacion` de PayPal (requiere cuenta compradora sandbox).
4. `POST /api/pagos/capturar-orden/:orderId` → `POST /v2/checkout/orders/:id/capture`.
   Es idempotente: si PayPal responde `ORDER_ALREADY_CAPTURED` se consulta la orden
   (`GET /v2/checkout/orders/:id`) en vez de fallar. Capturar sin haber aprobado → **400**
   con mensaje amigable.
5. `GET /v1/oauth2/token` (Basic con client:secret) se usa para autenticar cada llamada.

### Flujo de MercadoPago (Checkout API)

1. `POST /api/pagos/crear-orden` → el backend mira en MongoDB el `metodoPago`
   del vendedor. Si es `mercadopago` valida el turno de la fila y devuelve los
   datos para el formulario embebido: la **llave pública** de la cuenta
   (`MERCADOPAGO_PUBLIC_KEY`), el **monto** actual del producto fijado por el
   servidor, el correo del comprador para prellenarlo y el aviso de atención
   (RQNF24.1).
2. El navegador monta el **Payment Brick** de MercadoPago dentro de la página
   del producto (`ProductoCompleto.tsx` + `utils/mercadoPagoSdk.ts`): tarjeta,
   OXXO y SPEI en un formulario propio de Ichiba (colores de la marca vía
   `customization.visual.style.customVariables`). El saldo de MercadoPago no
   se ofrece porque exige una preferencia (Checkout Pro). La tarjeta se
   tokeniza en el navegador: Ichiba nunca ve el número.
3. Al enviar el formulario, `POST /api/pagos/mercadopago/procesar` →
   `crearPagoMercadoPago()` (`POST /v1/payments`, ítem único en **MXN**,
   `external_reference` = `mp:<productoId>`, `metadata` con el comprador,
   `notification_url` si `BACKEND_URL` es https):
   - **Aprobado** (tarjeta): registra la venta con su palabra clave.
   - **Pendiente** (OXXO/SPEI): responde `pendiente` con el enlace del
     comprobante; la venta se registrará por webhook al acreditarse.
   - **Rechazado**: responde **400** con el motivo (`status_detail`) para que
     el comprador corrija.
4. `POST /api/pagos/confirmar-mercadopago` con `paymentId` →
   `obtenerPagoMercadoPago()` (`GET /v1/payments/:id`) sigue siendo la fuente
   de verdad idempotente: sirve para verificar un OXXO/SPEI ya pagado (botón
   "Ya pagué, verificar") y para reconsultar pagos antiguos.
5. `POST /api/pagos/webhook-mercadopago` (IPN): público, responde 200 de
   inmediato y **reconsulta a la API** (nunca confía en el cuerpo), así el
   pago pendiente sigue confirmando aunque el comprador cierre el navegador.
   Solo se registra `notification_url` si `BACKEND_URL` es **https**
   (MercadoPago no alcanza localhost).
6. Ambas pasarelas comparten `registrarVentaExitosa()` con clave de
   idempotencia `referenciaExterna` (`mp:<payment_id>` vs el id de orden de
   PayPal).

**Diferencia con PayPal:** en PayPal el dinero va a la cuenta del vendedor
(`payee` = `paypalEmail`); en MercadoPago el dinero entra a la cuenta dueña
de `MERCADOPAGO_ACCESS_TOKEN`. Pagarle a cada vendedor exigiría el programa
Marketplace de MercadoPago (comentario en `mercadopagoService.ts`).

---

## 6. CORREOS — todo lo que manda mail

**Único archivo que envía correos:** `backend/src/services/emailService.ts`
(librería `nodemailer`, transport `service: "gmail"`, remitente
`"Ichiba" <GMAIL_USER>`, se crea un transporter nuevo en cada envío).

| Función | Asunto | Quién la dispara | Cuándo |
|---|---|---|---|
| `enviarCorreoVerificacion` | "Tu código de verificación de Ichiba" | `controllers/verificacionController.ts` | `POST /api/verificacion/correo/enviar` (código numérico de **4 dígitos**, expira **10 min**, RQNF1.3) |
| `enviarCorreoRecuperacion` | "Recupera tu contraseña de Ichiba" | `controllers/usuarioController.ts` | `POST /api/usuarios/recuperar/solicitar` (código de 6 dígitos, expira **10 min**) |
| `enviarCorreoTurnoDePago` | "Ya es tu turno de pagar en Ichiba" | `services/filaService.ts` | Cuando alguien llega a la posición 1 de la fila y empieza su ventana de pago (RQNF18) |
| `enviarCorreoAdvertencia` | "Advertencia: confirma tu horario en Ichiba" (también "Aviso: tu cuenta se eliminará el próximo 1ro de mes", RQNF6.3, y "Aviso de eliminación de cuenta en Ichiba", RQNF6.4) | `jobs/revisionHorarios.ts` | Job diario `0 14 * * *` (08:00 GMT-6): recordatorio a los 2 días sin confirmar, aviso 15 días antes de la eliminación y, con 2 faltas seguidas, aviso de eliminación + borrado total de la cuenta |
| `enviarCorreoNovedadesCategoria` | "Nuevos productos en {categoría}" | `jobs/notificacionesCategoria.ts` | Job `0 10,17 * * *` (10:00 y 17:00) a los suscritos de cada categoría (máximo 2 veces al día, RQNF18) |
| `enviarCorreoComentarioPublicitario` | "Nuevo comentario en tu anuncio \"{nombre}\"" | `controllers/comentarioController.ts` | Cuando alguien comenta una publicación publicitaria y el vendedor aceptó notificaciones de comentarios (`recibirNotificacionesPublicitarias`) |
| `enviarCorreoPalabraClaveCompra` | "Tu palabra clave de pago en Ichiba" | `controllers/pagoController.ts` | Al registrarse la venta: entrega la palabra clave de 4 dígitos de la sesión de pago (RQNF20) |
| `enviarCorreoComprobanteRecibidoVendedor` | "Revisa el comprobante de pago que recibiste" | `services/escrowService.ts` | Al subir el comprador su comprobante: avisa al vendedor que lo revise y recuerda el horario de atención vigente (RQNF24.1) |
| `enviarCorreoCodigoEntregaComprador` | "Tu comprobante fue confirmado: ya puedes coordinar la entrega" | `services/escrowService.ts` | Al confirmar el vendedor el comprobante: entrega al comprador el código de confirmación de entrega (RQNF24.4) |
| `enviarCorreoComprobanteRechazadoComprador` | "Tu comprobante de pago fue rechazado" | `services/escrowService.ts` | Al rechazar el vendedor el comprobante: la fila se des-pausa y el comprador puede reenviarlo (RQNF23.2 y RQNF24.2) |
| `enviarCorreoEntregaCompletada` | "Entrega confirmada: transacción completada" | `services/escrowService.ts` | Al registrarse el código de entrega: fondos liberados del escrow (RQNF27) |
| `enviarCorreoVentaCancelada` | Cancelación de la venta (texto distinto para comprador y vendedor) | `services/escrowService.ts` | Cancelación automática con reembolso (RQNF23, RQNF24, RQNF28 y RQNF31) |
| `enviarCorreoCuentaCancelada` | "Tu cuenta de Ichiba fue cancelada de forma permanente" | `services/cancelacionCuentaService.ts` | Cancelación por 8 puntos (RQNF10.5) o por 2 faltas de confirmación de horario (RQNF6.4) |
| `enviarCorreoSancionAplicada` | Sanción aplicada (con o sin revisión administrativa) | `services/sancionService.ts` | Bloqueo temporal (7/30 días) o indefinido al confirmarse un reporte (RQNF33, RQNF34 y RQNF35) |
| `enviarCorreoSancionLevantada` | "Tu sanción en Ichiba fue levantada" | `services/sancionService.ts` | Al concluir el bloqueo temporal o al revertirse por rechazo del reporte (RQNF33) |
| `enviarCorreoProductoNoDisponible` | "El producto ya no está disponible" | `services/cancelacionCuentaService.ts` | Al retirar compradores de las filas de un vendedor cancelado (RQNF10.7) |
| `enviarCorreoAdeudoRegistrado` | "Tienes un saldo pendiente en Ichiba" | `services/adeudoService.ts` | Al registrar el adeudo por un reembolso con culpa directa del vendedor (RQNF37) |
| `enviarCorreoAdeudoLiquidado` | Confirmación de liquidación (o aviso si aún queda saldo) | `services/adeudoService.ts` | Al registrar el administrador la liquidación del adeudo (RQNF38) |
| `enviarCorreoDisputaAbiertaVendedor` | "Se abrió una disputa sobre una de tus ventas" | `services/disputaService.ts` | Al abrir el comprador una disputa de reembolso (RQF40) |
| `enviarCorreoDisputaRespondidaComprador` | "El vendedor respondió tu disputa" | `services/disputaService.ts` | Al responder el vendedor con sus evidencias |
| `enviarCorreoDisputaResuelta` | Resultado del dictamen (reembolsada o rechazada) | `services/disputaService.ts` | Al dictaminar el administrador: avisa al comprador y al vendedor |

**Modo local (fallback):** si `backend/.env` no tiene `GMAIL_USER` ni
`GMAIL_APP_PASSWORD`, nada falla: la función imprime en la consola del backend
`[correo local] …` con el código y devuelve `false`. Ese prefijo es la señal de
que "no llegan los correos".

**Cómo probarlo:**

```powershell
cd backend
npm run correo-test                 # envía a yaretzicramos@gmail.com
npm run correo-test -- otro@correo.com
```

(`scripts/probar-correo.ts`; si imprime "MODO LOCAL" es que faltan las variables.)

**Historial:** el commit `ea677ae2` (29 sep) reemplazó `.env` y borró
`GMAIL_USER`/`GMAIL_APP_PASSWORD`; se restauraron desde el historial de git.
Ese mismo `.env` viejo **todavía está en commits anteriores** con credenciales de
Gmail/PayPal/StructOCR/Twilio (pendiente de limpiar con `git filter-repo`).

---

## 7. Bases de datos

### PostgreSQL (la fuente de verdad de usuarios, productos, pagos…)

- Configuración: `backend/prisma.config.ts`, cliente en `src/configuracion/prisma.ts` y `src/prisma/db.ts`.
- Esquema: **`backend/src/prisma/contract.prisma`** (contrato Prisma 8). `backend/prisma/schema.prisma` es solo un espejo documentado.
- `npm run contract:emit` regenera `contract.json` / `contract.d.ts`.
- Migraciones generadas: `backend/migrations/{app,snapshots}`.
- Campo de pago del vendedor: **`paypalEmail`** guarda la cuenta de cobro (fallback) y la **vinculación OAuth** vive en MongoDB (`VinculoPayPal`: Merchant ID + Token de Acceso **cifrado** con AES-256-GCM); el **método** (`paypal` | `mercadopago`) también vive en MongoDB (`usuario.metodoPago`) y lo lee `pagoController.ts` al crear la orden.

### MongoDB (lecturas de UI, chat, filas y espejos)

- Conexión: `backend/src/configuracion/db.ts` (`MONGO_URI`, base `ichiba`).
- Modelos en `backend/src/models/`: `usuario`, `producto`, `Promocional`, `Comentario`, `Cola`, `Venta`, `Mensaje`, `Reporte`, `Sancion`, `Suscripcion`, `SuscripcionCategoria`, `ListaNegra`, `VinculoPayPal` (token de PayPal cifrado, RQNF4), `InformeVendedor` e `InformeGlobal` (informes mensuales, RQNF13/RQNF14), `Disputa` (RQF40) y `Adeudo` (RQNF37/RQNF38).
- **Espejos:** al registrarse se escribe el usuario también en Mongo (`usuarioController.ts`) y la venta se escribe en las dos. Admin, GraphQL y chats leen Mongo.
- Copias de controladores previos a la migración: `src/controllers/*.mongo.backup.ts` (referencia, no se importan).

### Inspección

```powershell
cd backend
npx tsx scripts/inspeccionar-mongo.ts usuario   # lista colecciones y 5 docs
```

---

## 8. Trabajos programados (`node-cron`)

| Archivo | Horario | Qué hace |
|---|---|---|
| `src/jobs/revisionPagos.ts` | `* * * * *` (cada minuto) | Libera los turnos de pago vencidos (`filaService.expirarFilasVencidas`) y reanuda las filas que esperaban la próxima apertura del vendedor (RQF18) |
| `src/jobs/revisionEntregas.ts` | `* * * * *` (cada minuto) | Cancela y reembolsa las ventas del escrow vencidas: comprobante sin subir en 24 h (RQNF23), comprobante sin confirmar antes del siguiente bloque (RQNF24), entrega fuera del plazo de 15 días (RQNF28) e inactividad del chat por 3 bloques (RQNF31); además purga las cuentas canceladas que ya resolvieron sus entregas (RQNF10.6) |
| `src/jobs/revisionSanciones.ts` | `*/5 * * * *` (cada 5 min) | Avisa el fin de los bloqueos temporales vencidos (7/30 días) para que el BackOffice lo refleje en vivo (RQNF33) |
| `src/jobs/revisionHorarios.ts` | `0 14 * * *` (08:00 GMT-6 diario) | Revisa horarios de vendedores en GMT-6; el 1ro de mes cuenta las no confirmaciones, avisa 15 días antes de la eliminación y, con 2 faltas seguidas, envía el aviso de eliminación y borra la cuenta con todos sus registros (PostgreSQL, MongoDB y archivos, sin posibilidad de recuperación) |
| `src/jobs/notificacionesCategoria.ts` | `0 10,17 * * *` | Correo de novedades por categoría (máximo 2 veces al día, RQNF18) |
| `src/jobs/informesMensuales.ts` | `5 0 1 * *` (día 1° a las 00:05) | Genera los informes mensuales de todos los vendedores y el global (RQNF13.2 y RQNF14), purga reportes, informes y faltas de más de 13 meses (RQNF14.1) y, si el servidor estuvo apagado, recupera el informe pendiente al arrancar |

Los seis se arrancan al final de `src/server.ts`.

---

## 9. API REST (todos los endpoints)

Montados en `src/server.ts`; controlador en `src/controllers/<mismo nombre>.ts`.

| Prefijo | Archivo de rutas | Endpoints |
|---|---|---|
| `/api/productos` | `productoRoutes.ts` | `GET /` (buscador con `q`, `categoria`, etc.; paginación con `pagina`/`porPagina` y `vendedorAtendiendo` por horario) · `GET /mios/lista` · `GET /estadisticas/categoria-popular` · `GET /:id` · `POST /` (verificado) · `PUT /:id` (verificado) · `PATCH /:id/estado` (verificado) · `DELETE /:id` (verificado) |
| `/api/usuarios` | `usuarioRoutes.ts` | `POST /registro` (con `ineFrente` e `ineReverso`) · `POST /login` (autentica en MongoDB con bcryptjs) · `POST /recuperar/solicitar` · `POST /recuperar/verificar` · `POST /recuperar/restablecer` · `GET /perfil` · `PUT /preferencias` · `GET /:id/publico` · `PUT /confirmar-horario` |
| `/api/verificacion` | `verificacionRoutes.ts` | `POST /correo/enviar` · `POST /correo/verificar` |
| `/api/pagos` | `pagoRoutes.ts` | `POST /crear-orden` · `POST /capturar-orden/:orderId` · `POST /paypal/vincular` · `GET /paypal/vincular/callback` · `GET /paypal/vinculacion` · `POST /confirmar-mercadopago` · `POST /webhook-mercadopago` · `POST /:ventaId/comprobante` · `GET /comprobante/:ventaId/imagen` · `POST /:ventaId/confirmar-comprobante` · `POST /:ventaId/rechazar-comprobante` · `POST /:ventaId/confirmar-entrega` · `GET /vendedor/ventas` · `GET /mis-compras` · `POST /:ventaId/disputa` · `GET /disputas/mis-disputas` · `GET /vendedor/disputas` · `POST /disputas/:disputaId/responder` · `GET /disputas/:disputaId/evidencia/:lado/:indice` · `GET /:ventaId/detalle` · `POST /:ventaId/calificar` |
| `/api/colas` | `colaRoutes.ts` | `POST /entrar` (bloqueado fuera del horario del vendedor, RQNF15) · `GET /mias` · `GET /producto/:productoId/estado` · `PATCH /:id/salir` · `PATCH /:id/esperar-apertura` (RQF18) · `PATCH /:id/responder-confirmacion` |
| `/api/mensajes` | `mensajeRoutes.ts` | `GET /comprador/mis-ventas` · `GET|POST /comprador/:ventaId` · `GET /vendedor/mis-ventas` · `GET|POST /vendedor/:ventaId` |
| `/api/promocionales` | `promocionalRoutes.ts` | `GET /` · `GET /mios/lista` · `GET /:id` · `GET /:id/comentarios` · `POST /:id/comentarios` (con `x-comprador-id`) · `POST /` (verificado) · `PUT /:id` · `PATCH /:id/estado` · `DELETE /:id` — las fotos de alto y edición usan `subirFotosProducto` (solo .png/.jpeg/.jpg, RQNF9.2) |
| `/api/reportes` | `reporteRoutes.ts` | `POST /` · `POST /comprador` · `GET /` (admin) · `PATCH /:id/confirmar` (admin) |
| `/api/admin` | `adminRoutes.ts` | `GET /resumen` · `GET /usuarios` · `PATCH /usuarios/:id/suspender` · `PATCH /usuarios/:id/reactivar` · `GET /reportes/pendientes` · `PATCH /reportes/:id/resolver` · `GET /historial` · `GET /ventas/:ventaId/mensajes` · `GET /lista-negra` · `POST /lista-negra` · `DELETE /lista-negra/:id` · `GET /disputas` · `POST /disputas/:id/resolver` · `POST /ventas-retenidas/:ventaId/resolver` · `GET /adeudos` · `POST /adeudos/:id/liquidar` · `GET /informes` · `POST /informes/generar` · `GET /informes/:periodo/pdf` |
| `/api/notificaciones` | `notificacionRoutes.ts` | `POST /suscribir` |
| `/api/suscripciones` | `suscripcionRoutes.ts` | `POST /` |
| `/api/informes` | `informeRoutes.ts` | `GET /` (historial de informes del vendedor) · `GET /:periodo/pdf` (descarga del informe mensual, RQF13/RQNF13.3) |
| `/uploads` | estático | Fotos de productos/promocionales. **`/uploads/ine` y `/uploads/comprobantes` devuelven 404 siempre** (bloqueo en `server.ts`): las INE y los comprobantes solo se sirven por endpoints autenticados |
| `/mcp` | `mcp/rutasMcp.ts` | Servidor MCP por HTTP (Streamable HTTP) para asistentes de IA; solo administradores con token JWT (Fase 5) |

Errores de Multer se responden como JSON 400 con mensajes amigables
(manejador al final de `server.ts`). `GET /api/salud` responde
`{"estado":"ok"}` (healthcheck que usa Railway).

### GraphQL

- Endpoint **`/graphql`** (Apollo Server 5), esquema en `src/graphql/esquema.ts`,
  resolvers en `src/graphql/resolvers.ts`, contexto en `src/graphql/contexto.ts`.
- Queries: `estado`, `productos`, `producto(id)`, `misFilas`, `estadoDeMiFila`,
  `miPerfil`, `perfilPublico`, `mensajesComoComprador`, `mensajesComoVendedor`.
- Mutations: `cambiarEstadoProducto`, `entrarEnFila`, `salirDeFila`,
  `enviarMensajeComoComprador`, `enviarMensajeComoVendedor`.
- **Suscripciones en vivo (Fase 4):** `resumenAdmin`, `reportesPendientes`,
  `usuariosAdmin`, `listaNegraActualizada` y `disputasActualizadas`, por
  WebSocket en la misma ruta (`src/graphql/servidorSuscripciones.ts` y
  `src/graphql/suscripciones.ts`), solo para administradores autenticados.
- Se consume desde `front-astro/src/servicios/clienteGraphql.ts` (consultas) y
  desde el BackOffice del frontend (`src/services/suscripcionesService.ts`,
  suscripciones).

### Seguridad transversal

- `filtroPalabrasProhibidas` (`src/utils/filtroPalabras.ts`) se aplica a todo
  request con campos manuales; catálogos en `src/configuracion/palabrasProhibidas.ts`.
- RQNF8: cuando un campo de texto de una publicación (producto o promocional)
  coincide con una palabra no permitida, el backend responde 400 con
  `{ message, campo }`; el formulario muestra la alerta en rojo **debajo del
  campo señalado**, lo enfoca y permite corregir y reenviar, sometiéndose otra
  vez a toda la validación (los tres formularios de publicación usan
  `campoDeError` de `frontend/Ichiba/src/utils/errores.ts`).
- Validaciones propias: `utils/validarPassword.ts`, `utils/validarRfcCurp.ts`,
  `utils/validarHorario.ts`, `utils/generarCodigo.ts` (códigos de correo),
  `utils/filtroPalabras.ts`.
- `frontend/Ichiba/src/utils/validacionEspanol.ts` traduce al español los
  mensajes nativos de validación de todos los formularios (se activa una sola
  vez desde `main.tsx`).

---

## 10. Rutas del frontend (`frontend/Ichiba/src/App.tsx`)

`/` (Nosotros) · `/inicio` · `/chats` · `/ayuda` · `/registro` ·
`/producto/:id` · `/promocionales` · `/promocional/:id` ·
`/panel-vendedor` · `/panel-vendedor/publicar` · `/panel-vendedor/editar/:id` ·
`/panel-vendedor/promocionar` · `/panel-vendedor/horario` ·
`/panel-vendedor/estadisticas` · `/panel-vendedor/reportar-comprador` ·
`/admin` · `/admin/reportes` · `/recuperar-password` · `/vendedor/:id` ·
`/pago-exitoso`

Notas:

- *Mis pedidos* (seguimiento del escrow, comprobante, código de entrega y
  disputas del comprador, RQF40) vive como sección dentro de `/ayuda`
  (`src/pages/MisPedidos/MisPedidos.tsx`).
- El BackOffice (`/admin`) tiene ocho secciones internas: Inicio (dashboard en
  vivo), Gestión de usuarios, Reportes pendientes, Disputas y retenciones,
  Adeudos de vendedores, Informes globales, Lista negra y Trazabilidad
  (`src/pages/Admin/*`).
- El panel del vendedor incluye la vinculación de la cuenta de PayPal (RQF4) y
  la descarga de informes mensuales en PDF (RQF13).

Componentes globales: `Header` (con buscador-lupa), `ColaBubble`,
`ChatBotAyuda`, modal `IniciarSesionModal`.

---

## 11. Comandos y scripts

### npm (desde `backend/`)

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor con recarga (nodemon + tsx + `--harmony-temporal`) |
| `npm run seed` | 30 productos + 35 promocionales de prueba y el vendedor demo (idempotente, marca `semilla: true`) |
| `npm run seed:mp` | Otros 30 productos que se cobran con MercadoPago y el vendedor `vendedor.mp@ichiba.test` (marca `semilla: "mercadopago"`, no lo borra `npm run seed`) |
| `npm run admin -- correo@dominio [clave] [--promover]` | Crea/promueve administradores (`scripts/crear-admin.ts`) |
| `npm run correo-test -- [correo]` | Prueba de envío de correo |
| `npm run mcp` | Arranca el servidor MCP del BackOffice por stdio (Fase 5) |
| `npm run contract:emit` | Regenera el contrato Prisma |
| `npx tsx scripts/inspeccionar-mongo.ts [coleccion]` | Ver contenido de Mongo |
| `npx tsx scripts/probar-moderacion-vision.ts` | E2E de RQNF7, RQNF8, RQF8 y RQF9: formatos/dimensiones/validaciones de publicación (categorías obligatorias, precios, campos vacíos), moderación con Cloud Vision vía mock, alertas de palabras no permitidas con corrección y reenvío, y método de pago del vendedor en el detalle del producto (38 pruebas; levanta dos backends locales, con y sin llave) |

### Suites de pruebas (desde `backend/`)

| Suite | Comando | Pruebas | Puerto |
|---|---|---|---|
| Fase 1 — escrow | `npx tsx scripts/probar-escrow.ts` | 60 | 5097 |
| Fase 2 — puntos y cancelación | `npx tsx scripts/probar-puntos-cancelacion.ts` | 48 | 5098 |
| Fase 3 — informes | `npx tsx scripts/probar-informes.ts` | 26 | 5099 |
| Fase 4 — suscripciones GraphQL | `npx tsx scripts/probar-suscripciones.ts` | 11 | 5100 |
| Fase 5 — servidor MCP | `npx tsx scripts/probar-mcp.ts` | 22 | 5101 |
| Fase 7a — sanciones | `npx tsx scripts/probar-sanciones.ts` | 30 | 5102 |
| Fase 7b — disputas y adeudos | `npx tsx scripts/probar-disputas.ts` | 65 | 5103 |
| Fase 7c — fila y apertura | `npx tsx scripts/probar-fila-apertura.ts` | 30 | 5104 |
| Moderación | `npx tsx scripts/probar-moderacion-vision.ts` | 38 | — |

Total: **293 pruebas en las 8 suites** (+38 de moderación). Los simuladores
(mocks) de PayPal, MercadoPago y Cloud Vision de las suites usan los puertos
59091 a 59100. Cada suite imprime `Suite ...: X/Y pruebas pasaron`; esa línea
es la señal de éxito.

### npm (desde `frontend/Ichiba/`)

`npm run dev` (5173) · `npm run build` (`tsc` + `vite build`) · `npm run lint` ·
`npm run preview`.

### PowerShell (desde la raíz)

```powershell
INICIAR-ICHIBA.cmd                                                        # doble clic o ejecutar desde la raiz
powershell -ExecutionPolicy Bypass -File herramientas\arrancar-bases.ps1   # solo bases
powershell -ExecutionPolicy Bypass -File herramientas\arrancar-ichiba.ps1  # bases + backend + frontend + verificacion
```

### Puertos

| Puerto | Qué |
|---|---|
| 5173 | Frontend Vite (`FRONTEND_URL` apunta aquí) |
| 5000 | Backend Express (+ `/graphql` y `/mcp`) |
| 4321 | Portal Astro (`front-astro`), cuando está levantado |
| 5097–5104 | Suites de pruebas (cada una levanta su propio backend) |
| 59091–59100 | Simuladores (mocks) de PayPal, MercadoPago y Cloud Vision de las suites |
| 27017 | MongoDB |
| 5432 | PostgreSQL |

---

## 12. Cuentas de prueba

| Rol | Correo | Contraseña |
|---|---|---|
| Admin | `admin@ichiba.test` | `IchibaAdmin123!` |
| Admin del dashboard | `admin.dashboard@ichiba.test` | `IchibaDash123!` |
| Vendedor demo | `vendedor.demo@ichiba.test` | `IchibaDemo123!` (cobra con PayPal) |
| Vendedor MercadoPago | `vendedor.mp@ichiba.test` | `IchibaMP123!` (cobra con MercadoPago, crea `npm run seed:mp`) |
| Comprador de prueba (INE de muestra) | `margarita.prueba@correo.test` | `NuevaClave123!` |

Credenciales de APIs (PayPal sandbox, MercadoPago, StructOCR, Gmail, JWT): ver `backend/.env`
y `backend/.env.example` (este último explica cada variable).

---

## 13. Estado conocido / pendientes

- Todo lo funcional de las **fases 1 a 7c** está terminado y probado: registro
  con INE (StructOCR), verificación de correo (código de 4 dígitos), CRUD de
  productos, buscador, recuperación de contraseña, fila virtual con aperturas,
  escrow completo (palabra clave, comprobante, código de entrega, liberación y
  reembolsos), puntos y cancelación, sanciones progresivas, disputas y adeudos,
  informes mensuales en PDF, suscripciones GraphQL en vivo, servidor MCP
  (18 herramientas) y CI/CD.
- Las **8 suites (293 pruebas)** y la de moderación (38) corren también en
  GitHub Actions (`.github/workflows/integracion-continua.yml`).
- **Pendiente manual:** configurar los secretos de CI/CD en GitHub
  (`RAILWAY_TOKEN`, `VERCEL_TOKEN`, `RAILWAY_SERVICE`, `VERCEL_ORG_ID`,
  `VERCEL_PROJECT_ID`; ver `DOCUMENTACION.md`, sección 6) para que el despliegue
  automático publique de verdad.
- **Pago end-to-end** pendiente de probar con una cuenta compradora sandbox
  creada en developer.paypal.com (aprobar el `linkAprobacion`). Las suites usan
  simuladores.
- **Limpieza del historial de git** pendiente: `backend/.env` con credenciales
  y 10 fotos de INE siguen en commits antiguos (se ofreció `git filter-repo`).
- `backend/.env` y `backend/uploads/ine/` están desvinculados de git
  (`git rm --cached`) y en `.gitignore`; **no se commitean**.
- Quedan archivos locales del usuario sin commitear (formularios de publicación
  y `palabrasProhibidas.ts`), intactos y ajenos a esta documentación.
