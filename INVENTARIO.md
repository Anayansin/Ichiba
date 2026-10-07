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
| `backend/scripts/` | Scripts de mantenimiento: `seed.ts`, `crear-admin.ts`, `probar-correo.ts`, `inspeccionar-mongo.ts` |
| `backend/prisma/schema.prisma` | Espejo informativo de PostgreSQL (la fuente de verdad es `backend/src/prisma/contract.prisma`) |
| `backend/src/prisma/` | Contrato Prisma 8 (`contract.prisma`, `contract.json`, `contract.d.ts`) y cliente `db.ts` |
| `backend/uploads/` | Fotos de productos/promocionales (sí se sirven por HTTP) |
| `backend/uploads/ine/` | Fotos de INE del registro (solo disco, **bloqueadas** en HTTP) |
| `backend/.env` | Variables de entorno reales (sin trackear) |
| `backend/.env.example` | Plantilla documentada de esas variables |
| `frontend/Ichiba/` | Aplicación React + Vite (puerto 5173) |
| `front-astro/` | Proyecto Astro aparte (React dentro de Astro). **No** forma parte del flujo principal |
| `herramientas/` | Scripts de PowerShell para arrancar sin administrador |
| `DOCUMENTACION.md` | Documentación general (arquitectura, BD, instalación, módulos) |
| `INVENTARIO.md` | Este archivo |

---

## 2. Herramientas de sistema (instaladas en la máquina)

| Herramienta | Versión | Ubicación | Para qué |
|---|---|---|---|
| Node.js + npm | — | sistema | Ejecutar backend y frontend |
| MongoDB **portable** | 8.0.14 | `%LOCALAPPDATA%\Programs\mongodb\bin\mongod.exe` | Base NoSQL (Mongoose). Datos: `...\mongodb\data`, log: `...\mongodb\log\mongod.log`. Puerto **27017**, base `ichiba` |
| PostgreSQL **portable** | 17.6 | `%LOCALAPPDATA%\Programs\postgresql\bin\` (`pg_ctl`, `initdb`, `psql`, `createdb`) | Base relacional (Prisma). Datos: `...\postgresql\data`, log: `...\postgresql\log\postgres.log`. Puerto **5432**, base `mi_base_datos`, usuario `postgres` / `postgres` |
| PowerShell | — | `herramientas\arrancar-bases.ps1`, `herramientas\arrancar-ichiba.ps1` | Arrancar bases y todo el proyecto **sin permisos de administrador** (ambos scripts son idempotentes) |
| nodemon + tsx | — | `backend/package.json` | Recarga automática del backend en TS (`npm run dev`) |

> Ninguno de los dos servicios de base de datos está instalado como servicio de
> Windows: por eso el arranque siempre pasa por `herramientas\arrancar-ichiba.ps1`.

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
| `multer` 2 | Subida de imágenes | `src/middleware/upload.ts` (productos) y `src/middleware/uploadIne.ts` (INE, dos campos) |
| `sharp` | Procesamiento de imágenes: dimensiones/nitidez y redimensionado | `src/services/imagenProductoService.ts`, `src/services/ineService.ts` |
| `tesseract.js` | OCR local del reverso de la INE (lee la MRZ, solo dígitos y `<`) | `src/services/ineService.ts`. Usa `eng.traineddata`/`spa.traineddata` de la raíz de `backend/` |
| `nodemailer` 9 | Envío de correos por Gmail SMTP | `src/services/emailService.ts` |
| `node-cron` | Trabajos programados | `src/jobs/*` |
| `@apollo/server` + `@as-integrations/express5` + `graphql` | Endpoint GraphQL en `/graphql` | `src/server.ts`, `src/graphql/*` |
| `twilio` | **Instalada pero NO usada** (0 coincidencias en `src/`). Se quitó de `.env` junto con los SMS | — |

### De desarrollo

`nodemon`, `tsx`, `typescript` 5.7 y los `@types/*` correspondientes
(`express`, `cors`, `multer`, `bcryptjs`, `jsonwebtoken`, `nodemailer`,
`node-cron`, `node`).

### Middlewares propios (`backend/src/middleware/`)

| Archivo | Qué controla |
|---|---|
| `auth.ts` → `verificarToken` | Valida el JWT (`Authorization: Bearer …`) |
| `admin.ts` → `requiereAdmin`, `esAdmin.ts` → `esAdmin` | Solo usuarios `tipo: "admin"` |
| `comprador.ts` → `requiereCompradorId` | Usa el header `x-comprador-id` (compradores no se registran) |
| `sancion.ts` | `requiereCompradorSinSancion`, `requiereUsuarioSinSancion`, `obtenerEstadoDeSancion` |
| `verificado.ts` → `requiereVerificado` | Exige correo verificado para publicar |
| `upload.ts` | Multer de productos (≤ 5 MB, ≤ 6 imágenes, tipos permitidos) |
| `uploadIne.ts` | Multer de la INE (frente y reverso) |

---

## 4. Librerías del frontend (`frontend/Ichiba/package.json`)

| Librería | Para qué |
|---|---|
| `react` 18 + `react-dom` | UI |
| `react-router-dom` 7 | Rutas (`src/App.tsx`) |
| `axios` 1.19 | Cliente HTTP: `src/services/api.ts` (base `http://localhost:5000/api`), interceptor que agrega el JWT y `x-comprador-id`, y que ante un 401 borra la sesión y manda a `/inicio` |
| `vite` 6 + `@vitejs/plugin-react` | Servidor de desarrollo y build (5173) |
| `typescript` 5.2, `eslint` + plugins | Tipos y lint (`npm run lint`) |

> `mongodb` y `node-cron` aparecen en las dependencias del frontend pero **no se
> usan en ningún archivo de `src/`** (sobrantes).
>
> El frontend **no** consume GraphQL: solo usa la API REST (`src/services/*.ts`).

### Servicios REST del frontend (`frontend/Ichiba/src/services/`)

`api.ts` (instancia), `authService`, `usuarioServices`, `productoService`,
`promocionalService`, `pagoService`, `colaService`, `mensajeService`,
`reporteService`, `adminService`, `notificacionService`, `verificacionService`.

### Contextos y configuración

`src/context/` → `AuthContext/AuthProvider` (sesión, `localStorage`),
`ColasContext/ColasProvider` (posición en filas).
`src/configuracion/` → `categorias.ts`, `categoriasReporte.ts`.

---

## 5. APIs externas (las que salen a Internet)

| API | URL | Credential / variable | Cliente propio | Se usa en |
|---|---|---|---|---|
| **PayPal Checkout v2** (sandbox) | `https://api-m.sandbox.paypal.com` (cambiable con `PAYPAL_API_BASE`) | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | `backend/src/services/paypalService.ts` | `backend/src/controllers/pagoController.ts` → rutas `/api/pagos/*` |
| **StructOCR** (lectura de INE) | `POST https://api.structocr.com/v1/national-id` con header `x-api-key` | `STRUCTOCR_API_KEY` | `backend/src/services/structOcrService.ts` | Registro de vendedor en `usuarioController.ts` (cuesta 4 créditos por uso) |
| **Gmail SMTP** (vía nodemailer `service: "gmail"`) | smtp.gmail.com:465/587 | `GMAIL_USER`, `GMAIL_APP_PASSWORD` (contraseña de aplicación) | `backend/src/services/emailService.ts` | Ver todos los correos en la sección 6 |
| PayPal (panel) | developer.paypal.com → Sandbox → Accounts | — | — | Crear la cuenta compradora de prueba para aprobar pagos |

### Flujo de PayPal

1. `POST /api/pagos/crear-orden` → `crearOrdenPaypal()` (`POST /v2/checkout/orders`,
   moneda **MXN**, `payee` = el `paypalEmail` del vendedor, retorno
   `${FRONTEND_URL}/pago-exitoso`, cancelación a `/producto/:id`).
2. El usuario aprueba el `linkAprobacion` de PayPal (requiere cuenta compradora sandbox).
3. `POST /api/pagos/capturar-orden/:orderId` → `POST /v2/checkout/orders/:id/capture`.
   Es idempotente: si PayPal responde `ORDER_ALREADY_CAPTURED` se consulta la orden
   (`GET /v2/checkout/orders/:id`) en vez de fallar. Capturar sin haber aprobado → **400**
   con mensaje amigable.
4. `GET /v2/oauth2/token` (Basic con client:secret) se usa para autenticar cada llamada.

---

## 6. CORREOS — todo lo que manda mail

**Único archivo que envía correos:** `backend/src/services/emailService.ts`
(librería `nodemailer`, transport `service: "gmail"`, remitente
`"Ichiba" <GMAIL_USER>`, se crea un transporter nuevo en cada envío).

| Función | Asunto | Quién la dispara | Cuándo |
|---|---|---|---|
| `enviarCorreoVerificacion` | "Tu código de verificación de Ichiba" | `controllers/verificacionController.ts` | `POST /api/verificacion/correo/enviar` (código de 6 dígitos, expira **10 min**) |
| `enviarCorreoRecuperacion` | "Recupera tu contraseña de Ichiba" | `controllers/usuarioController.ts` | `POST /api/usuarios/recuperar/solicitar` (expira **15 min**) |
| `enviarCorreoTurnoDePago` | "Ya es tu turno de pagar en Ichiba" | `services/filaService.ts` | Cuando alguien llega a la posición 1 de la fila y empieza su ventana de pago |
| `enviarCorreoAdvertencia` | "Advertencia: confirma tu horario en Ichiba" | `jobs/revisionHorarios.ts` | Job diario `0 8 * * *` (8:00) a vendedores sin horario confirmado |
| `enviarCorreoNovedadesCategoria` | "Nuevos productos en {categoría}" | `jobs/notificacionesCategoria.ts` | Job `0 10,17 * * *` (10:00 y 17:00) a los suscritos de cada categoría |

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
- Campo de pago del vendedor: **`paypalEmail`** (no `metodoPago`).

### MongoDB (lecturas de UI, chat, filas y espejos)

- Conexión: `backend/src/configuracion/db.ts` (`MONGO_URI`, base `ichiba`).
- Modelos en `backend/src/models/`: `usuario`, `producto`, `Promocional`, `Cola`, `Venta`, `Mensaje`, `Reporte`, `Sancion`, `Suscripcion`, `SuscripcionCategoria`.
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
| `src/jobs/revisionPagos.ts` | `* * * * *` (cada minuto) | Libera los turnos de pago vencidos (`filaService.expirarFilasVencidas`) |
| `src/jobs/revisionHorarios.ts` | `0 8 * * *` (8:00 diario) | Revisa horarios de vendedores; avisa por correo y, si no confirman, elimina |
| `src/jobs/notificacionesCategoria.ts` | `0 10,17 * * *` | Correo de novedades por categoría |

Los tres se arrancan al final de `src/server.ts`.

---

## 9. API REST (todos los endpoints)

Montados en `src/server.ts`; controlador en `src/controllers/<mismo nombre>.ts`.

| Prefijo | Archivo de rutas | Endpoints |
|---|---|---|
| `/api/productos` | `productoRoutes.ts` | `GET /` (buscador con `q`, `categoria`, etc.) · `GET /mios/lista` · `GET /estadisticas/categoria-popular` · `GET /:id` · `POST /` (verificado) · `PUT /:id` · `PATCH /:id/estado` · `DELETE /:id` |
| `/api/usuarios` | `usuarioRoutes.ts` | `POST /registro` (con `ineFrente` e `ineReverso`) · `POST /login` · `POST /recuperar/solicitar` · `POST /recuperar/verificar` · `POST /recuperar/restablecer` · `GET /perfil` · `GET /:id/publico` · `PUT /confirmar-horario` |
| `/api/verificacion` | `verificacionRoutes.ts` | `POST /correo/enviar` · `POST /correo/verificar` |
| `/api/pagos` | `pagoRoutes.ts` | `POST /crear-orden` · `POST /capturar-orden/:orderId` · `POST /:ventaId/calificar` |
| `/api/colas` | `colaRoutes.ts` | `POST /entrar` · `GET /mias` · `GET /producto/:productoId/estado` · `PATCH /:id/salir` · `PATCH /:id/responder-confirmacion` |
| `/api/mensajes` | `mensajeRoutes.ts` | `GET /comprador/mis-ventas` · `GET|POST /comprador/:ventaId` · `GET /vendedor/mis-ventas` · `GET|POST /vendedor/:ventaId` |
| `/api/promocionales` | `promocionalRoutes.ts` | `GET /` · `GET /mios/lista` · `GET /:id` · `POST /` (verificado) · `PUT /:id` · `PATCH /:id/estado` · `DELETE /:id` |
| `/api/reportes` | `reporteRoutes.ts` | `POST /` · `POST /comprador` · `GET /` (admin) · `PATCH /:id/confirmar` (admin) |
| `/api/admin` | `adminRoutes.ts` | `GET /usuarios` · `PATCH /usuarios/:id/suspender` · `PATCH /usuarios/:id/reactivar` · `GET /reportes/pendientes` · `PATCH /reportes/:id/resolver` · `GET /historial` · `GET /ventas/:ventaId/mensajes` |
| `/api/notificaciones` | `notificacionRoutes.ts` | `POST /suscribir` |
| `/api/suscripciones` | `suscripcionRoutes.ts` | `POST /` |
| `/uploads` | estático | Fotos de productos/promocionales. **`/uploads/ine` devuelve 404 siempre** (bloqueo en `server.ts`) |

Errores de Multer se responden como JSON 400 con mensajes amigables
(manejador al final de `server.ts`).

### GraphQL

- Endpoint **`/graphql`** (Apollo Server 5), esquema en `src/graphql/esquema.ts`,
  resolvers en `src/graphql/resolvers.ts`, contexto en `src/graphql/contexto.ts`.
- Queries: `estado`, `productos`, `producto(id)`, `misFilas`, `estadoDeMiFila`,
  `miPerfil`, `perfilPublico`, `mensajesComoComprador`, `mensajesComoVendedor`.
- Mutations: `cambiarEstadoProducto`, `entrarEnFila`, `salirDeFila`,
  `enviarMensajeComoComprador`, `enviarMensajeComoVendedor`.
- **Nadie lo consume desde el frontend** (existe para lecturas/consulta directa).

### Seguridad transversal

- `filtroPalabrasProhibidas` (`src/utils/filtroPalabras.ts`) se aplica a todo
  request con campos manuales; catálogos en `src/configuracion/palabrasProhibidas.ts`.
- Validaciones propias: `utils/validarPassword.ts`, `utils/validarRfcCurp.ts`,
  `utils/validarHorario.ts`, `utils/generarCodigo.ts` (códigos de correo),
  `utils/filtroPalabras.ts`.

---

## 10. Rutas del frontend (`frontend/Ichiba/src/App.tsx`)

`/` (Nosotros) · `/inicio` · `/chats` · `/ayuda` · `/registro` ·
`/producto/:id` · `/promocionales` · `/promocional/:id` ·
`/panel-vendedor` · `/panel-vendedor/publicar` · `/panel-vendedor/editar/:id` ·
`/panel-vendedor/promocionar` · `/panel-vendedor/horario` ·
`/panel-vendedor/estadisticas` · `/panel-vendedor/reportar-comprador` ·
`/admin` · `/admin/reportes` · `/recuperar-password` · `/vendedor/:id` ·
`/pago-exitoso`

Componentes globales: `Header` (con buscador-lupa), `ColaBubble`,
`ChatBotAyuda`, modal `IniciarSesionModal`.

---

## 11. Comandos y scripts

### npm (desde `backend/`)

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor con recarga (nodemon + tsx + `--harmony-temporal`) |
| `npm run seed` | 30 productos + 35 promocionales de prueba y el vendedor demo (idempotente, marca `semilla: true`) |
| `npm run admin -- correo@dominio [clave] [--promover]` | Crea/promueve administradores (`scripts/crear-admin.ts`) |
| `npm run correo-test -- [correo]` | Prueba de envío de correo |
| `npm run contract:emit` | Regenera el contrato Prisma |
| `npx tsx scripts/inspeccionar-mongo.ts [coleccion]` | Ver contenido de Mongo |

### npm (desde `frontend/Ichiba/`)

`npm run dev` (5173) · `npm run build` (`tsc` + `vite build`) · `npm run lint` ·
`npm run preview`.

### PowerShell (desde la raíz)

```powershell
powershell -ExecutionPolicy Bypass -File herramientas\arrancar-bases.ps1   # solo bases
powershell -ExecutionPolicy Bypass -File herramientas\arrancar-ichiba.ps1  # bases + backend + frontend
```

### Puertos

| Puerto | Qué |
|---|---|
| 5173 | Frontend Vite (`FRONTEND_URL` apunta aquí) |
| 5000 | Backend Express (+ `/graphql`) |
| 27017 | MongoDB |
| 5432 | PostgreSQL |

---

## 12. Cuentas de prueba

| Rol | Correo | Contraseña |
|---|---|---|
| Admin | `admin@ichiba.test` | `IchibaAdmin123!` |
| Vendedor demo | `vendedor.demo@ichiba.test` | `IchibaDemo123!` |
| Comprador de prueba (INE de muestra) | `margarita.prueba@correo.test` | `NuevaClave123!` |

Credenciales de APIs (PayPal sandbox, StructOCR, Gmail, JWT): ver `backend/.env`
y `backend/.env.example` (este último explica cada variable).

---

## 13. Estado conocido / pendientes

- Todo lo funcional está probado: registro de vendedor con INE (StructOCR),
  verificación de correo, CRUD de productos, buscador, recuperación de
  contraseña, cola, reportes, panel admin y creación/captura de órdenes PayPal.
- **Pago end-to-end** pendiente de probar con una cuenta compradora sandbox
  creada en developer.paypal.com (aprobar el `linkAprobacion`).
- **Limpieza del historial de git** pendiente: `backend/.env` con credenciales
  y 10 fotos de INE siguen en commits antiguos (se ofreció `git filter-repo`).
- `backend/.env` y `backend/uploads/ine/` están desvinculados de git
  (`git rm --cached`) y en `.gitignore`; **no se commitean**.
- Trabajo sin commitear pendiente de revisión (`git status`).
