# Documentación de Ichiba

Este documento explica qué es Ichiba, cómo está construido, cómo instalarlo desde cero y qué hace cada módulo, en el estado actual del repositorio (fases 1 a 7c terminadas). Está pensado para que pueda entenderlo **alguien que no sabe programar**: cada término técnico se explica con palabras sencillas.

> Si solo quieres **usar** la plataforma en tu computadora, ve a la sección 3 (Instalación) y a la sección 8 (Pendientes manuales).

---

## 1. Arquitectura general

### Qué es Ichiba

Ichiba es un marketplace (mercado en línea) en el que los vendedores publican productos con imágenes, horarios de atención y promociones, y los compradores ingresan a una **fila virtual** por producto: quien queda en la posición uno dispone de un tiempo límite para pagar (con PayPal o Mercado Pago, según lo que haya configurado el vendedor). El dinero del pago queda **retenido en garantía (escrow)** hasta que la entrega se confirma; comprador y vendedor conversan en un chat por venta, pueden calificarse, reportarse entre sí y abrir disputas de reembolso, y un **panel de administración (BackOffice)** permite revisar reportes, sancionar cuentas, resolver disputas, cobrar adeudos y auditar la actividad. La plataforma también genera **informes mensuales** de ventas (en PDF) y de la actividad global, y ofrece un **servidor MCP** para que asistentes de inteligencia artificial puedan operar el BackOffice.

### Glosario rápido

| Término | Qué significa aquí |
| --- | --- |
| **Backend** | El programa que vive en el servidor: recibe las peticiones, aplica las reglas del negocio y guarda los datos. Es la carpeta `backend/`. |
| **Frontend** | La parte visual que usa la gente en el navegador. Son las carpetas `frontend/Ichiba/` (la tienda) y `front-astro/` (el portal de contenido). |
| **API REST** | La lista de direcciones (`/api/...`) con las que el frontend pide cosas al backend. |
| **GraphQL** | Otra forma de pedir datos al backend (una sola dirección `/graphql` donde se pide exactamente lo que se necesita). |
| **Base de datos** | Donde se guarda todo. Hay dos: PostgreSQL (relacional, como una hoja de cálculo con tablas) y MongoDB (no relacional, como cajas de documentos). |
| **Fila virtual** | La lista de espera por producto: el primero en la lista tiene el turno para pagar. |
| **Escrow** | Dinero retenido en garantía: el cobro se autoriza, pero no se entrega al vendedor hasta que la entrega se confirma con un código. |
| **MCP** | *Model Context Protocol*: un "enchufe" estándar para que asistentes de IA (Claude, Cursor, VS Code…) usen las herramientas del BackOffice. |
| **CI/CD** | Integración y despliegue continuos: robots que prueban y publican el proyecto automáticamente (GitHub Actions). |
| **Migración** | Un archivo que describe un cambio en las tablas de PostgreSQL para aplicarlo sin perder datos. |
| **Job / trabajo programado** | Una tarea que el backend repite solo, en horarios definidos (por ejemplo, cada minuto). |

### Cómo se conecta todo

El recorrido de una petición, en texto plano:

```
navegador → frontend (React en el puerto 5173 o Astro en el 4321)
          → API Express en el puerto 5000 (REST en /api, GraphQL en /graphql, MCP en /mcp)
          → PostgreSQL (mediante Prisma) o MongoDB (mediante Mongoose), según el dato
          → y, cuando hace falta, servicios externos: PayPal, Mercado Pago,
            StructOCR, Gmail y Cloud Vision.
```

La autenticación se hace con tokens JWT enviados en la cabecera `Authorization`, y los compradores que no tienen cuenta se identifican con un identificador anónimo generado en el navegador y enviado en la cabecera `x-comprador-id`.

### Carpetas del repositorio

#### `backend/`

Servidor en Node.js con TypeScript (módulos ESM) construido sobre Express 5. En `src/server.ts` se configuran el CORS, el cuerpo JSON, un filtro global de palabras prohibidas, la carpeta estática `/uploads` con las imágenes subidas, el montaje de todas las rutas REST, el servidor Apollo con el esquema y resolutores GraphQL **más sus suscripciones en vivo por WebSocket**, el servidor MCP, la conexión a MongoDB y el arranque de **seis trabajos programados** con `node-cron`. El servidor escucha en el puerto `5000` por defecto.

Estructura interna de `backend/src`:

| Carpeta | Contenido |
| --- | --- |
| `routes/` | Definición de endpoints REST: `productoRoutes`, `usuarioRoutes`, `verificacionRoutes`, `pagoRoutes`, `colaRoutes`, `mensajeRoutes`, `promocionalRoutes`, `reporteRoutes`, `adminRoutes`, `notificacionRoutes`, `suscripcionRoutes` e `informeRoutes`. |
| `controllers/` | Lógica de cada endpoint (`adminController`, `colaController`, `comentarioController`, `informeController`, `mensajeController`, `notificacionController`, `pagoController`, `paypalVinculacionController`, `productoController`, `promocionalController`, `reporteController`, `suscripcionController`, `usuarioController`, `verificacionController`). |
| `models/` | Esquemas de Mongoose (colecciones de MongoDB): `usuario`, `producto`, `Promocional`, `Comentario`, `Cola`, `Venta`, `Mensaje`, `Reporte`, `Sancion`, `Suscripcion`, `SuscripcionCategoria`, `ListaNegra`, `VinculoPayPal`, `InformeVendedor`, `InformeGlobal`, `Disputa` y `Adeudo`. |
| `middleware/` | Autenticación y permisos: `auth` (token), `comprador` (identificador anónimo), `verificado` (correo verificado y horario confirmado), `admin`/`esAdmin`, `vendedor` (el administrador no publica ni compra, y las cuentas canceladas solo pueden completar entregas), `sancion` (bloqueo de sancionados), `upload` (imágenes de publicaciones, comprobantes y evidencias de disputa) e `uploadIne` (carga de la INE con Multer). |
| `services/` | Lógica reutilizable: `adeudoService`, `backofficeService` (motor compartido por las rutas de administración y el MCP), `cancelacionCuentaService`, `cifradoService`, `disputaService`, `emailService`, `errorBackoffice`, `escrowService`, `filaService`, `imagenProductoService`, `ineService`, `informesService`, `listaNegraService`, `mercadopagoService`, `paypalService`, `pdfInformes`, `reputacionService`, `resumenAdminService`, `sancionService`, `structOcrService`, `usuarioService`, `ventaService` y `visionService` (moderación de fotos con Cloud Vision). |
| `jobs/` | Tareas programadas: `revisionPagos` (cada minuto), `revisionEntregas` (cada minuto), `revisionSanciones` (cada 5 minutos), `revisionHorarios` (diario a las 08:00 de la zona centro, GMT-6), `notificacionesCategoria` (10:00 y 17:00) e `informesMensuales` (día 1° de cada mes a las 00:05). |
| `graphql/` | Esquema (`esquema.ts`), resolutores (`resolvers.ts`), contexto (`contexto.ts`), catálogo de eventos (`suscripciones.ts`) y servidor de suscripciones WebSocket (`servidorSuscripciones.ts`) para Apollo Server. |
| `mcp/` | Servidor MCP del BackOffice: `servidorMcp.ts` (las 18 herramientas), `rutasMcp.ts` (transporte HTTP en `/mcp`, solo administradores) y `arranqueStdio.ts` (transporte local, `npm run mcp`). |
| `configuracion/` | Conexión a MongoDB (`db.ts`), cliente de PostgreSQL (`prisma.ts`), categorías, palabras prohibidas y categorías de reporte. |
| `utils/` | Validaciones de password, RFC/CURP, horarios de atención (`validarHorario.ts`), códigos de verificación y filtro de palabras. |
| `prisma/` | Contrato de datos de Prisma (`contract.prisma`) con sus archivos generados `contract.json` y `contract.d.ts`. |

Otros archivos relevantes de `backend/`: `prisma/schema.prisma` (espejo del contrato para el generador tradicional), `prisma.config.ts` (configuración de la CLI de Prisma), `migrations/` (migraciones de PostgreSQL), `uploads/` (imágenes subidas, se crea automáticamente), `.env` y `.env.example` (variables de entorno), `tsconfig.json` y `prisma-8.md` (guía de la versión de Prisma en uso).

Cabe señalar que existen archivos terminados en `.mongo.backup.ts` (en `controllers/`): conservan la versión anterior de esos controladores cuando todo vivía en MongoDB. El código que se ejecuta es el archivo sin el sufijo.

#### `frontend/`

Contiene una sola carpeta, `frontend/Ichiba`, con la aplicación de usuario: una SPA en React 18 con Vite y React Router. Su estructura en `src` es:

| Carpeta | Contenido |
| --- | --- |
| `pages/` | Pantallas de la aplicación: `Inicio`, `ProductoCompleto`, `RegistrarCuenta`, `PanelVendedor`, `RegistrarProducto`, `EditarProducto`, `HorarioVendedor`, `Chats`, `PagoExitoso`, `MisPedidos` (se muestra dentro de `/ayuda` como la sección *Mis pedidos*), `Estadisticas`, `Promocionales`, `RegistrarPromocional`, `PromocionalDetalle`, `ReportarVendedor`, `ReportarComprador`, `Admin`, `AdminReportes`, `Ayuda`, `PreguntasFrecuentes`, `ComoFunciona`, `Nosotros`, `PoliticasDePrivacidad`, `RecuperarPassword`, `PerfilDelVendedor`, entre otras. |
| `pages/Admin/` | Secciones del BackOffice: `Admin.tsx` (menú), `Dashboard.tsx` (Inicio), `GestionUsuarios.tsx`, `RevisionReportes.tsx`, `Disputas.tsx`, `Adeudos.tsx`, `InformesGlobales.tsx`, `ListaNegra.tsx`, `Trazabilidad.tsx` y `ModalConversacion.tsx`. |
| `components/` | Piezas reutilizables: `Header`, `CartaProducto`, `Carrusel`, `ColaBubble`, `FilaActivaComprador`, `BurbujaDeTexto`, `AreaChats`, `ChatSoporte`, `ChatBotAyuda`, `TerminosModal`, `VerificacionModal`, `AdvertenciaEncuentroModal`, `SelectorHorario`, `ModalConfirmacionHorario` (modal que bloquea el panel hasta confirmar el horario del mes), `RutaVendedor` (envoltura de las rutas del panel) y el bloque de autenticación en `auth/`. |
| `services/` | Clientes de la API: `api.ts` (instancia base e interceptores), `authService`, `usuarioServices`, `productoService`, `colaService`, `pagoService`, `mensajeService`, `reporteService`, `promocionalService`, `notificacionService`, `verificacionService`, `adminService`, `informeService` y `suscripcionesService` (suscripciones GraphQL del BackOffice por WebSocket). |
| `context/` | `AuthProvider`/`AuthContext` (sesión y token) y `ColasProvider`/`ColasContext` (estado de la fila del comprador). |
| `configuracion/` | Listas de categorías de productos y de reportes. |
| `utils/` | `compradorId` (identificador anónimo), validación de imágenes, mensajes de error y opciones de producto. |

El archivo `src/services/api.ts` toma la URL del backend de la variable `VITE_BACKEND_URL` (`http://localhost:5000` por defecto, definida en `frontend/Ichiba/.env` o en el panel del hosting) y arma la base `.../api` y `URL_BACKEND` a partir de ella; ahí mismo se adjuntan el token y el `x-comprador-id` a cada petición. El backend solo acepta CORS desde `FRONTEND_URL` (más localhost y la red local en desarrollo).

#### `front-astro/`

Sitio de contenido construido con Astro e islas de React. Sus páginas están en `src/pages` (`index.astro`, `inicio.astro` y `ayuda.astro`) y su estructura usa nombres en español: `componentes/`, `contexto/`, `estilos/`, `servicios/` y `utilidades/`. La portada consulta la API al renderizar la página para mostrar cifras públicas (cantidad de productos activos y categoría más popular). El cliente REST vive en `src/servicios/api.ts` y el cliente GraphQL en `src/servicios/clienteGraphql.ts`, ambos apuntando a `http://localhost:5000`. No requiere archivos `.env`.

#### `.github/workflows/`

Los robots de CI/CD del proyecto (sección 6): `integracion-continua.yml` (pruebas y compilaciones en cada push) y `despliegue.yml` (publicación automática en Railway y Vercel cuando la integración termina en verde).

#### `herramientas/`

Dos scripts de PowerShell para arrancar el proyecto en Windows sin permisos de administrador: `arrancar-bases.ps1` (solo las bases de datos) y `arrancar-ichiba.ps1` (bases + backend + frontend).

#### Raíz del proyecto

Además de las carpetas anteriores, la raíz contiene `.gitignore`, el archivo `proyecto.code-workspace` de VS Code (que agrupa `backend`, `front-astro` y `frontend/Ichiba`), `DOCUMENTACION.md` (este archivo), `INVENTARIO.md` (inventario de herramientas y APIs) y `requisitos.md` (requisitos del proyecto con su trazabilidad al final).

---

## 2. Bases de datos

El proyecto usa dos bases de datos simultáneamente y cada una tiene responsabilidades distintas.

### PostgreSQL

Se accede con Prisma ORM siguiendo el flujo de *contrato*: el modelo se define en `backend/src/prisma/contract.prisma`, los archivos `contract.json` y `contract.d.ts` se regeneran con `npm run contract:emit`, la CLI se configura en `backend/prisma.config.ts` (que lee `DATABASE_URL` del `.env`), y la aplicación consulta mediante el cliente propio `backend/src/configuracion/prisma.ts`, que expone el objeto `clientePrisma` con los modelos `usuario`, `venta`, `cola` y `reporte`. Existe además `backend/prisma/schema.prisma` con los mismos modelos para el generador tradicional, y las migraciones están en `backend/migrations`.

Los modelos y para qué sirven:

- **`usuario`**: cuentas completas (nombre, correo, contraseña, INE, RFC/CURP, horarios, preferencias de notificación), su reputación por puntos (`puntosReputacion`, se cancelan a los 8), el estado de la cuenta (`activa`/`cancelada`), las fechas de cancelación y purga, y el control de horario (`horarioConfirmadoEn`, `diasSinConfirmarHorario`).
- **`venta`**: el ciclo completo del escrow. Guarda el monto, la referencia del pago (`paypalOrderId`, que es el id de orden de PayPal o `mp:<payment_id>` de Mercado Pago), el estado (`pendiente_comprobante`, `pendiente_confirmacion`, `en_entrega`, `completada`, `reembolsada`, `cancelada`), la **palabra clave** de 4 dígitos (`codigoPago`), la autorización y la captura de PayPal, el comprobante del comprador (palabra clave, referencia, imagen y fecha), el **código de entrega**, los límites de confirmación y entrega, el último mensaje del chat, los reembolsos y la **retención preventiva** (`retenido`). También congela el nombre y la categoría del producto (`productoNombre`, `productoCategoria`) para que los informes sobrevivan a la eliminación del producto.
- **`cola`**: posiciones de la fila virtual por producto (`posicion`, `estado` — que incluye `activa`, `esperando_apertura`, `en_espera_confirmacion`, etc. —, `pagoExpiraEn`, `motivoCierre` y correo del comprador).
- **`reporte`**: reportes entre usuarios con su categoría, tipo de falta, detalle y estado (`pendiente`, `confirmado`, `rechazado`), más el vendedor al que afectan.

En PostgreSQL se concentran el registro y la autenticación, los pagos y el escrow, la fila virtual, los reportes y la reputación.

### MongoDB

Se accede con Mongoose. La conexión se hace en `backend/src/configuracion/db.ts` a partir de la variable `MONGO_URI`; si la variable no existe o la conexión falla, el servidor termina con un mensaje de error. Las colecciones están en `backend/src/models`:

- **`producto`**: catálogo completo (nombre, precio, imágenes, categoría, descripción, vendedor, horarios y condiciones de entrega).
- **`Mensaje`**: mensajes del chat, uno por venta, con texto y/o imagen adjunta.
- **`Cola`**, **`Venta`** y **`Reporte`**: copias de filas, ventas y reportes que consultan el historial de administración, los resolutores GraphQL y los trabajos de mantenimiento.
- **`Sancion`**: sanciones y bloqueos de usuarios (faltas leves y graves, bloqueos temporales de 7 o 30 días, indefinidos y revisión administrativa). Las faltas solo cuentan 13 meses.
- **`Suscripcion`** y **`SuscripcionCategoria`**: preferencias de notificación por correo (novedades críticas y categorías de interés).
- **`Promocional`**: ofertas destacadas de los vendedores.
- **`Comentario`**: comentarios que los visitantes dejan en una publicación publicitaria; al crearlos se avisa por correo al vendedor si aceptó esas notificaciones.
- **`ListaNegra`**: RFC, CURP y código de INE de cuentas canceladas; el registro la consulta para denegar altas duplicadas (RQNF1.9 y RQNF36) y el panel de administración la administra.
- **`VinculoPayPal`**: la vinculación OAuth del vendedor con PayPal: Merchant ID, correo y el Token de Acceso **cifrado** con AES-256-GCM (RQNF4).
- **`InformeVendedor`** e **`InformeGlobal`**: los informes mensuales ya generados (del vendedor y de la plataforma) con sus indicadores; se conservan 13 meses (RQNF14.1).
- **`Disputa`**: disputas de reembolso abiertas por los compradores, con motivo, evidencias de ambas partes, estado y dictamen (RQF40).
- **`Adeudo`**: adeudos de los vendedores cuando la plataforma cubre un reembolso por su culpa directa, con monto, causa y estado de liquidación (RQNF37 y RQNF38).
- **`usuario`**: cuentas que consulta el panel de administración de usuarios, las suscripciones GraphQL y el trabajo diario de horarios; incluye los campos de suspensión (`suspendido`, `motivoSuspension`, `saldoPendiente`, `sancionHasta`, `sancionPermanente`, `revisionAdministrativa`).

### Dónde vive cada dato

| Información | Dónde se escribe | Dónde se lee |
| --- | --- | --- |
| Cuentas, contraseñas, INE, horarios y reputación | PostgreSQL `usuario` | PostgreSQL (perfil, reportes y reputación); MongoDB `usuario` (autenticación de login con bcryptjs y espejo para el panel de administración, GraphQL, suscripciones y trabajo de horarios) |
| Productos del catálogo | MongoDB `producto` | MongoDB (REST, GraphQL y portada de `front-astro`) |
| Filas virtuales | PostgreSQL `cola` | PostgreSQL (rutas de fila y pagos); MongoDB `Cola` (historial de administración, GraphQL y limpieza) |
| Pagos, escrow y ventas | PostgreSQL `venta` | PostgreSQL (escrow, reportes e historial de administración); MongoDB `Venta` (chat e historial) |
| Mensajes del chat | MongoDB `Mensaje` | MongoDB |
| Reportes | PostgreSQL `reporte` | PostgreSQL (listado, confirmación y rechazo); MongoDB `Reporte` (historial de administración) |
| Sanciones y bloqueos | MongoDB `Sancion` | MongoDB (y `usuario` de MongoDB para el estado de suspensión) |
| Suscripciones de notificaciones | MongoDB `Suscripcion`, `SuscripcionCategoria` | MongoDB |
| Promocionales y comentarios | MongoDB `Promocional`, `Comentario` | MongoDB |
| Vinculación de PayPal | MongoDB `VinculoPayPal` | MongoDB (al crear la orden de pago) |
| Informes mensuales | MongoDB `InformeVendedor`, `InformeGlobal` | MongoDB (BackOffice y panel del vendedor) |
| Disputas de reembolso | MongoDB `Disputa` + PostgreSQL `venta` (estado y retención) | MongoDB (BackOffice, comprador y vendedor) |
| Adeudos | MongoDB `Adeudo` + MongoDB `usuario.saldoPendiente` | MongoDB (BackOffice y MCP) |

**Nota sobre la convivencia de ambas bases.** El proyecto está en una etapa de migración: los flujos activos de fila, venta y reporte escriben en PostgreSQL, mientras que varias lecturas siguen yendo a las colecciones de MongoDB (el chat valida contra `Venta` de MongoDB, el panel de administración lista los usuarios de la colección `usuario`, y GraphQL, las suscripciones y los trabajos programados leen las copias de MongoDB). Para trabajar de forma coherente conviene tener presente esta división: por ejemplo, un producto publicado existe en MongoDB, una fila creada existe en PostgreSQL, y las imágenes de ambas se sirven desde `backend/uploads`.

---

## 3. Instalación desde cero

### Requisitos previos

- Node.js 20 o superior con npm (el proyecto se probó con Node 24).
- PostgreSQL 15 o superior (versión mínima que admite Prisma en este proyecto).
- MongoDB 6 o superior, local o en la nube (por ejemplo MongoDB Atlas).
- Cuentas externas opcionales: una aplicación en PayPal Developer (para cobrar con PayPal), una cuenta de Mercado Pago con Access Token (para cobrar con Mercado Pago), una cuenta de Gmail con contraseña de aplicación (para enviar correos), una llave de StructOCR (para leer la INE durante el registro) y una llave de Google Cloud Vision (para moderar las fotografías de productos).

### Variables de entorno

El backend se configura en `backend/.env`. El archivo `backend/.env.example` explica cada variable; las que no aparezcan ahí deben agregarse manualmente:

| Variable | Obligatoria | Uso |
| --- | --- | --- |
| `DATABASE_URL` | Sí | Cadena de conexión a PostgreSQL; la leen `prisma.config.ts` y `src/configuracion/prisma.ts`. Ejemplo: `postgresql://usuario:clave@localhost:5432/ichiba`. |
| `MONGO_URI` | Sí | Cadena de conexión a MongoDB; la lee `src/configuracion/db.ts`. El servidor no arranca sin ella. Ejemplo: `mongodb://localhost:27017/ichiba`. |
| `JWT_SECRET` | Sí | Firma de los tokens de sesión; la usan los middleware de autenticación, los controladores y el servidor de suscripciones GraphQL. |
| `PORT` | No | Puerto del servidor. Si falta, se usa el 5000. |
| `FRONTEND_URL` | Para pagos | URL del frontend que PayPal y MercadoPago usan en las direcciones de regreso y cancelación de la compra. Admite varias separadas por coma. |
| `PAYPAL_CLIENT_ID` | Para pagos | Credenciales de la aplicación de PayPal. |
| `PAYPAL_CLIENT_SECRET` | Para pagos | Credenciales de la aplicación de PayPal. |
| `PAYPAL_LLAVE_CIFRADO` | Para vincular cuentas de PayPal | Llave AES-256-GCM (64 dígitos hexadecimales) con la que se cifra el Token de Acceso que PayPal otorga al vendedor al vincular su cuenta. Si falta, la vinculación falla con un mensaje claro. |
| `PAYPAL_API_BASE` | Para pagos | Base de la API de PayPal (modo pruebas o producción). |
| `MERCADOPAGO_ACCESS_TOKEN` | Para pagos con MercadoPago | Access Token de la cuenta de MercadoPago (mercadopago.com/developers → Credenciales). Sin él, el pago de un vendedor con `metodoPago: mercadopago` falla con un mensaje claro. |
| `MERCADOPAGO_PUBLIC_KEY` | Para pagos con MercadoPago | Llave pública de la misma cuenta (mercadopago.com/developers → Credenciales). Es pública por diseño: el navegador la usa para montar el formulario de pago embebido (Payment Brick). Sin ella, el formulario no puede mostrarse y el backend lo avisa con un mensaje claro. |
| `MERCADOPAGO_API_BASE` | No | Base de la API de MercadoPago; por defecto `https://api.mercadopago.com`. |
| `BACKEND_URL` | No | URL pública (https) del backend. Si existe y es https, MercadoPago la usa como `notification_url` (webhook); con `http://localhost` el webhook no se registra y solo confirma el pago quien vuelve del checkout. También se usa como `redirect_uri` de la vinculación de PayPal. |
| `GMAIL_USER` | No | Correo desde el que se envían los mensajes. |
| `GMAIL_APP_PASSWORD` | No | Contraseña de aplicación de Gmail. Si faltan ambas, el backend no falla: imprime los códigos en la consola con el prefijo `[correo local]`. |
| `STRUCTOCR_API_KEY` | Para registro | Llave de la API de StructOCR que lee el frente y el reverso de la INE. Sin ella, el registro no puede validar la identificación. |
| `GOOGLE_VISION_API_KEY` | Para publicar | Llave de la Cloud Vision API (Google Cloud) que analiza las fotografías de productos y bloquea objetos excluidos. Sin ella, la publicación responde *"La moderación de imágenes no está disponible"*. |
| `GOOGLE_VISION_ENDPOINT` | No | Solo para pruebas: apunta Cloud Vision a un servidor simulado. En producción se deja sin definir. |
| `VISION_MODERACION` | No | Solo para desarrollo local: con el valor `omitir` se desactiva la moderación de fotos. Nunca debe usarse en producción. |
| `NODE_ENV` | No | Con el valor `production` el CORS solo acepta `FRONTEND_URL` (en desarrollo también acepta localhost y la red local). |

`frontend/Ichiba` sí lee una variable de entorno: `VITE_BACKEND_URL` (la URL raíz del backend, sin `/api`). Si no existe, `src/services/api.ts` usa `http://localhost:5000`. En desarrollo la define `frontend/Ichiba/.env` (hay un `.env.example` como plantilla) y al publicar se define en el panel del hosting. En cambio `front-astro/src/servicios/api.ts`, `front-astro/src/servicios/clienteGraphql.ts` y `front-astro/src/pages/index.astro` todavía tienen la dirección `http://localhost:5000` escrita en el código: si cambias el puerto o despliegas el backend en otro dominio, edita esos archivos.

### Comandos de instalación y arranque

**Paso 1. Backend**

```bash
cd backend
npm install
```

Luego crea el archivo `.env` con las variables de la tabla anterior y prepara PostgreSQL: crea la base de datos y revisa el estado de las migraciones con `npx prisma migration status`. Si partes de una base vacía, aplica las migraciones que viven en `migrations/app` con `npx prisma db migrate` (también puedes crear las tablas con `npx prisma db init`, como indica `backend/prisma-8.md`). Después llena los datos demo con `npm run seed` y `npm run seed:mp` (ver *Datos de prueba*). Cada vez que modifiques `src/prisma/contract.prisma` vuelve a generar los tipos con:

```bash
npm run contract:emit
```

Para levantar el servidor:

```bash
npm run dev
```

Este comando ejecuta `src/server.ts` con nodemon y tsx en modo de desarrollo (reinicia al detectar cambios en `src`). Al estar listo, la consola muestra la conexión exitosa a MongoDB y `Servidor corriendo en http://localhost:5000`. La carpeta `uploads/` se crea sola en la primera subida de una imagen. Los seis trabajos programados y el servidor de suscripciones GraphQL arrancan solos con el servidor.

**Datos de prueba**

Con MongoDB en marcha puedes llenar el catálogo de ejemplo (30 productos, 5 por cada categoría, y 35 promocionales, 5 por cada tipo) desde la carpeta `backend`:

```bash
npm run seed
```

El script `scripts/seed.ts` valida cada dato con las mismas reglas del controlador (longitudes, precios y palabras no permitidas), reutiliza las imágenes que ya existen en `uploads/` y es idempotente: todo lo que inserta queda marcado con `semilla: true`, se borra antes de volver a insertar y nunca toca datos reales. Si PostgreSQL está disponible los artículos se ligan a un usuario existente; si no, usan un vendedor de respaldo.

Además, `npm run seed:mp` (`scripts/seed-mercadopago.ts`) crea otros 30 productos del catálogo ligados a una cuenta dedicada, `vendedor.mp@ichiba.test`, cuyo método de pago es MercadoPago, para poder probar el flujo de MercadoPago (Checkout API, formulario embebido) sin tocar la semilla original (que sigue siendo PayPal). Sus productos llevan `semilla: "mercadopago"`, así que `npm run seed` no los borra.

**Paso 2. Frontend React**

```bash
cd frontend/Ichiba
npm install
npm run dev
```

Vite sirve la aplicación en `http://localhost:5173` (acepta conexiones desde otros equipos de la red por la opción `host: true`). Los scripts disponibles son `npm run build` (compila con TypeScript y Vite), `npm run lint` (analiza el código con ESLint) y `npm run preview` (sirve la compilación).

**Paso 3. Sitio con Astro (opcional)**

```bash
cd front-astro
npm run desarrollo
```

Astro sirve las páginas en `http://localhost:4321`. Para publicar, usa `npm run compilar` (genera `dist/`) y `npm run servir` (previsualiza esa compilación).

### Orden recomendado para levantar el proyecto

1. PostgreSQL y MongoDB en ejecución (o `powershell -ExecutionPolicy Bypass -File herramientas\arrancar-bases.ps1`).
2. Backend (`npm run dev` en `backend`), porque los frontends dependen de la API.
3. Frontend React (`npm run dev` en `frontend/Ichiba`).
4. Sitio de Astro (`npm run desarrollo` en `front-astro`), si se necesita.

### Verificación rápida

La consola del backend debe mostrar `Conectado exitosamente a MongoDB con Mongoose` y el mensaje de servidor corriendo; `http://localhost:5000/api/salud` debe responder `{"estado":"ok"}`; `http://localhost:5000/api/productos` debe responder con el catálogo; y en `http://localhost:5173` debe cargarse la portada con el botón de inicio de sesión. Si el backend falla al arrancar, revisa primero `DATABASE_URL` y `MONGO_URI`; si las funciones de correo no llegan, revisa `GMAIL_USER` y `GMAIL_APP_PASSWORD`; si el pago no inicia, revisa las variables de PayPal, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY` y `FRONTEND_URL`; si la vinculación de PayPal falla, revisa `PAYPAL_LLAVE_CIFRADO` y que el `redirect_uri` (`${BACKEND_URL}/api/pagos/paypal/vincular/callback`) esté dado de alta en la aplicación de developer.paypal.com; si el registro rechaza la identificación, revisa `STRUCTOCR_API_KEY`; y si la publicación de productos responde *"La moderación de imágenes no está disponible"*, revisa `GOOGLE_VISION_API_KEY` (requiere la Cloud Vision API habilitada en Google Cloud).

---

## 4. Resumen de módulos funcionales

### Registro y autenticación

Permite crear una cuenta verificando la identificación oficial, iniciar sesión, recuperar la contraseña y mantener la sesión. El registro exige subir el frente y el reverso de la INE, que se validan por formato (png/jpg/jpeg), peso (máximo 8 MB), dimensiones (mínimo 420x540 px), nitidez y lectura automática de los datos con StructOCR; el nombre capturado debe coincidir con el de la identificación, el teléfono debe tener 10 dígitos, la contraseña debe cumplir sus reglas de fortaleza (solo letras, números y los símbolos `! @ # $ % & * - _`), y el RFC debe coincidir con la CURP leída de la INE. Si el RFC, la CURP o el código de la INE están en la lista negra, el alta se deniega. Para terminar, el sistema envía por correo un **código de confirmación numérico de 4 dígitos** (RQNF1.3) que vence en 10 minutos.

En el backend corresponden `backend/src/routes/usuarioRoutes.ts` (alta, login, recuperación, perfil público, preferencias de notificación y confirmación de horario) con `backend/src/controllers/usuarioController.ts`: el alta escribe en PostgreSQL y refleja la cuenta en MongoDB, y el login autentica las credenciales consultando los registros de MongoDB, comparando la contraseña contra su hash bcryptjs (nunca en texto plano); el restablecimiento de contraseña actualiza ambas bases; `backend/src/routes/verificacionRoutes.ts` y `backend/src/controllers/verificacionController.ts` para el código de verificación del correo; `backend/src/middleware/auth.ts` (verificación del token), `backend/src/middleware/verificado.ts` (correo verificado y horario confirmado del mes en curso, medido en GMT-6), `backend/src/middleware/uploadIne.ts` (carga de la INE); `backend/src/services/structOcrService.ts` y `backend/src/services/ineService.ts` (lectura y validación de la identificación), `backend/src/services/emailService.ts` (envío de códigos), `backend/src/utils/validarPassword.ts`, `backend/src/utils/validarRfcCurp.ts` y `backend/src/utils/generarCodigo.ts` (código de 4 dígitos).

En el frontend: `frontend/Ichiba/src/pages/RegistrarCuenta`, `frontend/Ichiba/src/pages/RecuperarPassword`, `frontend/Ichiba/src/components/auth/IniciarSesionModal`, `frontend/Ichiba/src/components/VerificacionModal`, el contexto de sesión en `frontend/Ichiba/src/context/AuthProvider.tsx` y los servicios `frontend/Ichiba/src/services/authService.ts`, `usuarioServices.ts` y `verificacionService.ts`.

### Catálogo

Agrupa la publicación, búsqueda y detalle de productos, así como las promociones destacadas de cada vendedor. Incluye subida de imágenes con restricciones de tamaño y peso, categorías, condiciones de uso, métodos de entrega, horarios y estadísticas de la categoría más popular.

En el backend: `backend/src/routes/productoRoutes.ts` y `backend/src/controllers/productoController.ts` sobre el modelo `backend/src/models/producto.ts` (MongoDB); `backend/src/middleware/upload.ts` (carga de imágenes de hasta 5 MB; las fotos de producto y de promocional aceptan únicamente `.png`, `.jpeg` y `.jpg`, RQNF7.2 y RQNF9.2) y `backend/src/services/imagenProductoService.ts` (procesamiento con Sharp); `backend/src/routes/promocionalRoutes.ts`, `backend/src/controllers/promocionalController.ts` y `backend/src/models/Promocional.ts`; los comentarios de las publicaciones publicitarias viven en `backend/src/controllers/comentarioController.ts` sobre `backend/src/models/Comentario.ts` (lectura y alta con `x-comprador-id`, respetando la casilla *Zona de comentarios* y enviando el aviso por correo al vendedor cuando aceptó notificaciones de comentarios); las listas de categorías están en `backend/src/configuracion/categorias.ts`.

**Validaciones y moderación de la publicación (RQNF7).** El alta exige todos los campos: nombre de 10 a 35 caracteres, descripción de 30 a 100 (contando espacios), precio entre $10 y $5,000, selección de la condición/estado del artículo, método de entrega de la lista predefinida, horario de coordinación de entrega y tiempo límite de pago de 30 minutos a 3 horas con **1 hora por defecto** si no se envía; las fotos deben medir de 420×540 a 2560×2560 px. Tras las validaciones de campo, `services/visionService.ts` manda cada fotografía a la **Cloud Vision API** (detección de etiquetas) y bloquea la publicación si reconoce artículos excluidos del catálogo: carros, motos, casas, terrenos, mascotas, personas, armas, sustancias controladas o productos perecederos. Si falta `GOOGLE_VISION_API_KEY` o Cloud Vision falla, la publicación también queda bloqueada (nunca se publica sin analizar); `VISION_MODERACION=omitir` desactiva la moderación solo para desarrollo local. Cualquier validación fallida borra del disco las imágenes subidas. Prueba automatizada: `npx tsx scripts/probar-moderacion-vision.ts`.

**Categorías predefinidas de la publicación (RQF8).** Al publicar una venta, el vendedor debe seleccionar obligatoriamente una de las seis categorías del catálogo: **Artesanías, Ropa (segunda mano), Hogar, Electrodomésticos, Coleccionables y Otros**. El formulario arranca sin categoría elegida (el desplegable muestra "Selecciona una categoría") y el sistema valida que exista la selección, tanto en el navegador como en el backend (`categoriaProductoValida` responde "Selecciona una categoría válida" al crear y al editar); la elección se guarda en el producto y se muestra con su nombre de catálogo en el desplegable del menú, la ficha del producto, las estadísticas y la página Nosotros (`textoCategoria` en `frontend/Ichiba/src/configuracion/categorias.ts`, que conserva los valores internos usados por filtros y enlaces). Pruebas 24 a 27 de `probar-moderacion-vision.ts`.

**Publicación de promocionales (RQF9).** El vendedor promociona un artículo ingresando nombre, descripción, condiciones de uso, fotografías, precio, la opción de habilitar o deshabilitar el chat y la zona de comentarios, y la cobertura de envío (`RegistrarPromocional`). El sistema valida que los campos no estén vacíos (RQNF9.1: imágenes obligatorias, nombre de 10 a 35, descripción de 30 a 100, cobertura y condición requeridas), que las fotografías sean únicamente `.png`, `.jpeg` o `.jpg` de 420×540 a 2560×2560 px (RQNF9.2, mismo filtro estricto que las fotos de producto), que el precio sea mínimo **$5,001 sin precio máximo** (RQNF9.5) y que ningún campo de texto contenga palabras no permitidas (RQNF9.4, alerta con el campo señalado). Las fotografías de los **productos** del catálogo pasan además por la moderación de Cloud Vision API (RQNF9.3, misma función y misma lista de objetos excluidos que el RQNF7.3); los promocionales quedan exentos de esa moderación por diseño, porque su catálogo existe precisamente para artículos como autos, casas y terrenos. Pruebas 28 a 33 de `probar-moderacion-vision.ts`.

**Alerta de palabras no permitidas (RQNF8).** Cuando el vendedor escribe una palabra no permitida en un campo de texto de su publicación (nombre, descripción o cobertura de envío, en productos y promocionales), el envío o guardado se bloquea con 400 y la respuesta incluye `campo`, el identificador del campo señalado. El formulario muestra la alerta de contenido no permitido en rojo justo debajo de ese campo, lo enfoca y deja al usuario corregir el texto y volver a enviar, sometiéndolo de nuevo a toda la validación (RQNF8.1 y RQNF8.2); nada queda guardado hasta que todo pase. Las pruebas 17 a 23 de `probar-moderacion-vision.ts` cubren la alerta al crear y al editar, la corrección con reenvío exitoso y el caso en que el reenvío sigue fallando por otra regla.

En el frontend: `frontend/Ichiba/src/pages/Inicio` (buscador y listado), `ProductoCompleto`, `PanelVendedor` (incluye la tarjeta *Preferencias de notificaciones* y la descarga de informes; al abrir cualquier ruta `/panel-vendedor/*` el componente `ModalConfirmacionHorario` exige confirmar el horario del mes, RQNF5.3), `RegistrarProducto`, `EditarProducto`, `PerfilDelVendedor`, `Promocionales`, `RegistrarPromocional` y `PromocionalDetalle` (con su zona de comentarios); los componentes `CartaProducto`, `Carrusel` y `CartaPromocional`; los servicios `productoService.ts` y `promocionalService.ts`; y las categorías en `frontend/Ichiba/src/configuracion/categorias.ts`.

### Fila virtual, horarios y pagos

Es el corazón del marketplace: cada comprador entra a la fila de un producto, la posición uno recibe un tiempo límite para pagar con PayPal o Mercado Pago (elige el vendedor), y si el pago no llega a tiempo el turno se libera para la siguiente persona. Los compradores anónimos se identifican con `x-comprador-id` y las cuentas sancionadas no pueden entrar.

**Horarios de atención y aperturas (RQNF15, RQNF16 y RQF18).** Los vendedores definen su disponibilidad (de 05:00 a 23:59, hora centro GMT-6) y confirman su horario cada 1° de mes; si no lo confirman, el backend les restringe publicar y editar catálogo (`middleware/verificado.ts`) y el trabajo diario `revisionHorarios` avisa a los 2 días, avisa 15 días antes de la eliminación y, con 2 faltas seguidas, elimina la cuenta con todos sus registros (RQNF6.3 a RQNF6.6). La lógica de horarios vive en `backend/src/utils/validarHorario.ts` (`evaluarAtencionDelVendedor`, `estaAtendiendo`, `obtenerTextoDeLaSiguienteApertura`).

- **Fuera del horario de atención no se puede entrar a la fila**: `POST /api/colas/entrar` responde 400 con la fecha y hora del próximo bloque disponible (RQNF15: los productos siguen visibles, lo que se inhabilita es entrar a la fila).
- **Aviso al llegar al turno (RQNF16):** cuando alguien llega a la posición 1 y al vendedor le queda menos tiempo de atención que el tiempo límite de pago, la ficha del producto muestra el aviso con el próximo bloque; el comprador decide entre **"Pagar ahora"** (paga sin atención ni chat hasta el próximo bloque) o **"Esperar a la próxima apertura"**.
- **Guardar el lugar (RQF18 y RQNF18):** al elegir esperar, la fila queda en estado `esperando_apertura` con el reloj pausado y conserva su posición; el trabajo `revisionPagos` la reanuda automáticamente (con correo de aviso) en cuanto el bloque de atención vuelve a abrir. Solo la posición 1 puede elegir, y una fila pausada no puede pagar (`crearOrden` responde 403 hasta que se reactive).

En el backend: `backend/src/middleware/comprador.ts` (identificador anónimo), `backend/src/routes/colaRoutes.ts` con `backend/src/controllers/colaController.ts` (entrar, consultar y salir de la fila, esperar la apertura y responder la confirmación, sobre PostgreSQL) y `backend/src/services/filaService.ts` (expiración de turnos, pausa y reactivación por apertura); `backend/src/routes/pagoRoutes.ts` con `backend/src/controllers/pagoController.ts`, `backend/src/services/paypalService.ts` (creación y captura de la orden de pago, registro de la venta y calificación entre las partes, más el flujo OAuth 2.0 de vinculación de la cuenta del vendedor), `backend/src/controllers/paypalVinculacionController.ts` (redirección a la pasarela oficial, callback e intercambio del `code` por el Token de Acceso), `backend/src/services/cifradoService.ts` (AES-256-GCM para guardar el token cifrado, RQNF4) y `backend/src/services/mercadopagoService.ts` (creación del pago con Checkout API, consulta del pago y webhook); `backend/src/middleware/sancion.ts` (bloqueo de sancionados); y los trabajos `backend/src/jobs/revisionPagos.ts` (cada minuto libera los turnos vencidos y reanuda las filas que esperaban apertura) y `backend/src/jobs/revisionHorarios.ts` (revisión diaria del horario).

En el frontend: `frontend/Ichiba/src/components/ColaBubble` (burbuja flotante con la fila activa, RQNF19), `FilaActivaComprador`, `AdvertenciaEncuentroModal` (aviso de seguridad antes de quedarse en la posición uno) y `SelectorHorario`; las páginas `PagoExitoso` (donde se muestra la palabra clave de 4 dígitos), `ProductoCompleto` (aviso de apertura, botones "Pagar ahora" / "Esperar a la próxima apertura" y elección de pasarela), `MisPedidos` (seguimiento del escrow y disputas) y `HorarioVendedor`; el contexto `ColasProvider`; y los servicios `colaService.ts` y `pagoService.ts`.

### Escrow: del pago a la entrega (Fase 1)

El dinero nunca va directo al vendedor: queda **retenido en garantía** hasta que la entrega se confirma con un código. El ciclo completo vive en `backend/src/services/escrowService.ts` y `backend/src/services/ventaService.ts`, con el campo `estado` de la venta como guía:

1. **Pago autorizado** (`pendiente_comprobante`): el comprador paga en PayPal (captura diferida: se autoriza, no se cobra) o en Mercado Pago. El sistema registra la venta, le asigna una **palabra clave numérica de 4 dígitos única por sesión de pago** (RQNF20, `generarCodigoPagoUnico`), se la envía por correo y la muestra en pantalla.
2. **Comprobante** (RQF22): desde `PagoExitoso`, el comprador registra su comprobante con la palabra clave, el número de referencia de la transferencia y una fotografía o captura, que pasa por la moderación de imágenes antes de mostrarse al vendedor. Mientras tanto, el chat queda **bloqueado** (RQNF24.2) y la fila pasa a reposo.
3. **Confirmación del vendedor** (RQF31): el vendedor revisa la referencia y la imagen en el chat y confirma o rechaza. Al confirmar se abre el chat de coordinación (RQNF29), se genera el **código de confirmación de entrega** que recibe el comprador (RQNF24.4) y corre el plazo de entrega de 15 días. Si rechaza, la fila se des-pausa y el comprador puede volver a registrar su comprobante (RQNF24.2 y RQNF23.2).
4. **Entrega y liberación** (RQF26, RQF33 y RQNF27): el día de la entrega el comprador le da su código al vendedor; el vendedor lo registra y en ese momento se **capturan los fondos retenidos** y se liberan a la cuenta de PayPal del vendedor. El chat se deshabilita y la venta queda `completada`.
5. **Cancelaciones y reembolsos automáticos**: el trabajo `backend/src/jobs/revisionEntregas.ts` (cada minuto) cancela y reembolsa al comprador cuando el comprador no sube su comprobante en 24 h (RQNF23), cuando el vendedor no confirma el comprobante antes de que termine su siguiente bloque de atención (RQNF24), cuando no registra la entrega en el plazo (RQNF28) o cuando hay inactividad prolongada en el chat por cualquiera de las partes (RQNF31: 3 bloques de atención sin mensajes).
6. **Retención preventiva** (RQNF32): si la venta tiene reportes vivos o una disputa abierta, el dinero no se libera ni se reembolsa automáticamente: queda `retenido` y lo resuelve un administrador desde el BackOffice.

Cada paso envía sus correos (palabra clave, comprobante recibido, código de entrega, comprobante rechazado, entrega completada y venta cancelada; ver el inventario de correos en `INVENTARIO.md`). Suite de pruebas: `backend/scripts/probar-escrow.ts` (61 pruebas).

### Puntos, cancelación de cuentas y lista negra (Fase 2)

La reputación por infracciones funciona por **puntos** (RQNF10.1): 3 puntos por faltas graves (suplantación, acoso, discriminación, producto engañoso, comprobante falso, estafa), 1.5 por faltas leves de trato directo (insultos, lenguaje grosero) y 1 por otras faltas leves. Al confirmarse reportes que suman **8 puntos acumulados**, la cuenta se **cancela de forma permanente** (RQNF10.3): se envía el correo de cancelación con el motivo y los reportes que la originaron (RQNF10.5), se cancela toda transacción en curso, se retira al vendedor de las filas activas avisando a los compradores (RQNF10.7), se agrega su RFC, CURP y código de INE a la **lista negra** (RQNF10.6) y se impide cualquier registro futuro con esos datos (RQNF1.9 y RQNF36). El vendedor cancelado solo conserva acceso para **completar entregas con pago ya confirmado** (RQF12); si no registra el código de entrega en el plazo, el escrow reembolsa al comprador (RQNF10.2). Cuando ya no le quedan entregas pendientes, sus datos personales se purgan sin posibilidad de recuperación (RQNF10.6).

Corresponde a `backend/src/services/reputacionService.ts` (suma de puntos), `backend/src/services/cancelacionCuentaService.ts` (cancelación, lista negra, purga y retiro de filas), `backend/src/services/listaNegraService.ts`, los modelos `Sancion` y `ListaNegra`, y el trabajo `revisionEntregas` (que purga las cuentas canceladas ya resueltas). Suite: `backend/scripts/probar-puntos-cancelacion.ts` (48 pruebas).

### Sanciones progresivas (Fase 7a)

Además de la cancelación por 8 puntos, el sistema aplica **bloqueos automáticos** (RQNF33, RQNF34 y RQNF35) al confirmarse reportes: **3 faltas leves → 7 días de bloqueo; 1 falta grave → 30 días; 2 faltas graves → bloqueo indefinido con revisión administrativa** (y siempre indefinido para estafa, suplantación de identidad, acoso o comprobante falso). La progresión es acumulativa (7 días → 30 días → indefinido) y las faltas solo cuentan **13 meses**, después prescriben (RQNF14.1). Los bloqueos temporales se levantan solos al cumplirse el plazo (el trabajo `revisionSanciones`, cada 5 minutos, envía el aviso) y **al rechazar un reporte se revierte la falta y el bloqueo que hubiera causado**. El sancionado no puede entrar a filas, publicar, editar ni enviar mensajes (reportar sí puede).

Vive en `backend/src/services/sancionService.ts`, `backend/src/middleware/sancion.ts`, `backend/src/models/Sancion.ts` y `backend/src/jobs/revisionSanciones.ts`; el estado se refleja en el espejo de `usuario` de MongoDB (campos `suspendido`, `sancionHasta`, `sancionPermanente` y `revisionAdministrativa`) y se ve en el BackOffice (suscripción `usuariosAdmin`). Suite: `backend/scripts/probar-sanciones.ts` (30 pruebas).

### Disputas de reembolso y adeudos (Fase 7b)

**Disputas (RQF40).** El comprador abre una disputa desde *Mis pedidos* (solo en ventas `en_entrega` o `completada`) explicando el motivo y adjuntando evidencias (fotografías del producto, capturas de la conversación, etc.); el vendedor responde con sus propias evidencias y **mientras la disputa esté abierta el dinero queda retenido** (RQNF32). El administrador dictamina desde la sección **Disputas y retenciones** del BackOffice: si **reembolsa**, el dinero vuelve al comprador aunque la venta esté completada; si **rechaza**, se retira la retención preventiva (si no quedan otras irregularidades vivas sobre la venta). La misma bandeja resuelve las **ventas retenidas sin disputa** (retenidas por reportes o porque el reembolso automático falló): el administrador decide entre reembolsar o liberar.

**Adeudos (RQNF37 y RQNF38).** Si la plataforma cubre económicamente un reembolso por **culpa directa del vendedor** (incumplimiento de entrega, descripción errónea, inactividad, etc.), se registra un **adeudo**: el vendedor queda **suspendido con saldo pendiente** (`motivoSuspension: "saldo_pendiente"`) y solo se reactiva cuando un administrador registra la **liquidación total** del adeudo (pago por transferencia fuera de la aplicación). Al liquidar el último adeudo pendiente, la suspensión se levanta automáticamente.

Vive en `backend/src/services/disputaService.ts`, `backend/src/services/adeudoService.ts`, los modelos `Disputa` y `Adeudo`, las rutas de pagos (comprador y vendedor) y las secciones `Disputas.tsx` y `Adeudos.tsx` del BackOffice. Suite: `backend/scripts/probar-disputas.ts` (65 pruebas).

### Informes de ventas y globales (Fase 3)

Cada **día 1° de mes a las 00:05** (trabajo `backend/src/jobs/informesMensuales.ts`) el sistema genera, con las transacciones concluidas del mes recién terminado:

- **Informes por vendedor** (RQF13 y RQNF13): total de ventas, productos vendidos, tiempo promedio por fila y **tasa de concertación** (ventas concluidas entre filas iniciadas, en porcentaje). El vendedor los consulta y descarga en PDF desde su panel en cualquier momento (RQNF13.3); el PDF se arma con `backend/src/services/pdfInformes.ts` (librería pdfkit).
- **Informe global** (RQF14): la **categoría más vendida** (con desempate por las ventas del mes anterior; si vuelve a empatar, no se muestra resultado) y la **tasa de abandono de fila por categoría** (usuarios que salieron de la fila o dejaron vencer su turno, RQNF14.2). El administrador los ve y descarga desde la sección **Informes globales** del BackOffice.
- Ese mismo día se **purgan** los reportes e informes que cumplen **13 meses** de antigüedad (RQNF14.1), junto con las faltas que originaron. Si el servidor estuvo apagado el día 1°, al arrancar recupera el informe pendiente y aplica la purga (ambas operaciones son idempotentes, es decir, pueden repetirse sin daño).

Vive en `backend/src/services/informesService.ts`, `backend/src/controllers/informeController.ts`, `backend/src/routes/informeRoutes.ts`, los modelos `InformeVendedor` e `InformeGlobal` y la sección `InformesGlobales.tsx` del BackOffice. Suite: `backend/scripts/probar-informes.ts` (26 pruebas).

### BackOffice en vivo con suscripciones GraphQL (Fase 4)

El dashboard y las bandejas del administrador se actualizan **en tiempo real** sin recargar la página: el backend expone suscripciones GraphQL por WebSocket en la misma ruta `/graphql` (`backend/src/graphql/servidorSuscripciones.ts`, con `graphql-ws` y `ws`; el catálogo de eventos está en `backend/src/graphql/suscripciones.ts`). Hay cinco eventos: `resumenAdmin` (cualquier cambio de cifras del dashboard), `reportesPendientes`, `usuariosAdmin` (registros, suspensiones, puntos y cancelaciones), `listaNegraActualizada` y `disputasActualizadas` (RQF40). Solo los administradores autenticados pueden suscribirse (el token viaja en la conexión) y el frontend los consume con `frontend/Ichiba/src/services/suscripcionesService.ts` (usado por las secciones Dashboard, GestionUsuarios, RevisionReportes, Disputas, Adeudos y ListaNegra). Suite: `backend/scripts/probar-suscripciones.ts` (11 pruebas).

### Servidor MCP del BackOffice (Fase 5)

El mismo motor de administración (`backend/src/services/backofficeService.ts`) está expuesto como **servidor MCP** para asistentes de inteligencia artificial (Claude Desktop, Cursor, VS Code, etc.) con **18 herramientas**: resumen del dashboard; listar, suspender y reactivar usuarios; listar y resolver reportes; listar, agregar y quitar entradas de la lista negra; historial de transacciones; auditar el chat de una venta; listar y resolver disputas; resolver ventas retenidas; listar y liquidar adeudos; y listar y generar informes globales. Todo lo que un administrador puede hacer en el BackOffice, el asistente también, respetando las mismas reglas de negocio.

Tiene dos transportes (formas de conectarse):

- **stdio** (clientes locales que lanzan el proceso): `npm run mcp` desde `backend` (`backend/src/mcp/arranqueStdio.ts`).
- **HTTP (Streamable HTTP)**: montado en `/mcp` del backend (`backend/src/mcp/rutasMcp.ts`), protegido con token JWT de administrador.

La definición de las herramientas está en `backend/src/mcp/servidorMcp.ts`. Suite: `backend/scripts/probar-mcp.ts` (22 pruebas).

### Chat

Permite a comprador y vendedor conversar sobre una venta concreta, incluyendo imágenes adjuntas. El comprador anónimo y el vendedor autenticado usan rutas distintas, y ambos validan que realmente participen en la venta antes de leer o escribir. El chat se **habilita cuando el vendedor confirma el comprobante de pago** (RQNF29) y se **bloquea** antes de esa confirmación (RQNF24.2) y después de registrar el código de entrega o la cancelación (RQNF26). Todos los mensajes quedan guardados como evidencia auditable (RQNF30).

En el backend: `backend/src/routes/mensajeRoutes.ts`, `backend/src/controllers/mensajeController.ts` y el modelo `backend/src/models/Mensaje.ts` (MongoDB), con las validaciones de acceso a la venta y la carga de adjuntos en `/uploads`.

En el frontend: `frontend/Ichiba/src/pages/Chats` (lista de conversaciones, historial, calificación y botón de reporte), los componentes `frontend/Ichiba/src/components/BurbujaDeTexto` y `AreaChats`, y el servicio `frontend/Ichiba/src/services/mensajeService.ts`.

### Administración (BackOffice)

Concentra el control de la plataforma por parte de cuentas con tipo `admin`. El menú tiene ocho secciones:

| Sección | Qué hace |
| --- | --- |
| **Inicio** | Dashboard con todas las cifras en vivo (usuarios, ventas e ingresos del mes, catálogo, reportes, filas, mensajes y lista negra, más las últimas ventas y altas). Se actualiza solo por la suscripción `resumenAdmin`. |
| **Gestión de usuarios** | Consulta de usuarios registrados, suspensión, reactivación y estado de reputación/sanciones (RQF36). |
| **Reportes pendientes** | Revisión de denuncias con confirmación o rechazo (RQF37). Al confirmar se suman puntos y se aplican sanciones; al rechazar se revierte. |
| **Disputas y retenciones** | Dictamen de disputas de reembolso (RQF40) y de las ventas con retención preventiva (RQNF32). |
| **Adeudos de vendedores** | Consulta de adeudos y registro de su liquidación total (RQNF37 y RQNF38). |
| **Informes globales** | Historial de informes mensuales de la plataforma, descarga en PDF y generación manual de un período (RQF14). |
| **Lista negra** | Altas y bajas manuales de registros vetados que impiden volver a crear cuentas con ese RFC, CURP o INE (RQNF36). |
| **Trazabilidad** | Auditoría del historial combinado de filas, ventas y reportes, y lectura del chat de cualquier venta sin restricción de participación (RQF38 y RQF39). |

**La cuenta administrativa es de supervisión pura:** no confirma horarios, no publica productos ni promocionales, no se une a filas ni paga — el backend lo impide con `requiereVendedor` y `rechazarAdminEnCompra` (403), y en el frontend `/panel-vendedor` redirige a `/admin`, el menú oculta los enlaces de vendedor y la ficha del producto oculta los botones de compra.

En el backend: `backend/src/middleware/esAdmin.ts` (verifica el tipo de administrador contra PostgreSQL) y `backend/src/middleware/admin.ts` (usado por las rutas de reportes); `backend/src/middleware/vendedor.ts` (el administrador no publica ni compra; las cuentas canceladas solo completan entregas con `requiereVendedorDeEntregas`); `backend/src/routes/adminRoutes.ts`, montado en `/api/admin`, con `backend/src/controllers/adminController.ts` y el motor compartido `backend/src/services/backofficeService.ts` (el mismo que usa el MCP); `backend/src/services/listaNegraService.ts` sobre el modelo `backend/src/models/ListaNegra.ts`.

En el frontend: `frontend/Ichiba/src/pages/Admin/Admin.tsx` (pantalla protegida con menú interno) y sus secciones `Dashboard.tsx`, `GestionUsuarios.tsx`, `RevisionReportes.tsx`, `Disputas.tsx`, `Adeudos.tsx`, `InformesGlobales.tsx`, `ListaNegra.tsx` y `Trazabilidad.tsx` con `ModalConversacion.tsx`; también `frontend/Ichiba/src/pages/AdminReportes` (historial de reportes) y el servicio `frontend/Ichiba/src/services/adminService.ts`.

### Otros módulos

**Reportes y reputación.** Los usuarios reportan mensajes, productos o conductas con una categoría que define si la falta es leve o grave. Corresponde a `backend/src/routes/reporteRoutes.ts`, `backend/src/controllers/reporteController.ts`, `backend/src/configuracion/categoriasReporte.ts`, `backend/src/services/reputacionService.ts`, `backend/src/services/sancionService.ts` y `backend/src/models/Sancion.ts`; en el frontend, las páginas `ReportarVendedor`, `ReportarComprador` y `AdminReportes`, más `frontend/Ichiba/src/configuracion/categoriasReporte.ts`.

**Notificaciones y suscripciones.** Suscripción a categorías de interés y envío de avisos por correo (máximo dos veces al día, 10:00 y 17:00). Corresponde a `backend/src/routes/notificacionRoutes.ts`, `backend/src/routes/suscripcionRoutes.ts`, sus controladores, los modelos `Suscripcion` y `SuscripcionCategoria`, `backend/src/services/emailService.ts` y el trabajo `backend/src/jobs/notificacionesCategoria.ts`; en el frontend, `frontend/Ichiba/src/services/notificacionService.ts`.

**GraphQL.** Endpoint `/graphql` con Apollo Server: consultas de productos, filas, perfil público y mensajes, mutaciones equivalentes y las suscripciones del BackOffice descritas arriba. Se define en `backend/src/graphql/` y se consume desde `front-astro/src/servicios/clienteGraphql.ts` y desde el BackOffice (`suscripcionesService.ts`).

**Ayuda y contenido institucional.** En el frontend: `Ayuda` (incluye las secciones *Mis pedidos* y *Preguntas frecuentes*), `ComoFunciona`, `Nosotros` y `PoliticasDePrivacidad`, más el chatbot flotante `components/ChatBotAyuda` que responde con la base de conocimiento compartida en `components/ChatSoporte/baseConocimiento.ts`.

---

## 5. Pruebas automatizadas

El proyecto incluye **8 suites de pruebas de extremo a extremo** (levantan el backend real contra PostgreSQL y MongoDB locales, con simuladores de PayPal, Mercado Pago y Cloud Vision donde hace falta) y una prueba de moderación. Todas se ejecutan desde `backend/` con `node --harmony-temporal --import tsx scripts/<archivo>.ts` (el flag `--harmony-temporal` es obligatorio: Prisma lo necesita para leer las fechas `timestamptz` de PostgreSQL):

| Suite | Archivo | Pruebas | Qué cubre |
| --- | --- | --- | --- |
| Fase 1 | `scripts/probar-escrow.ts` | 61 | Palabra clave, comprobante, confirmación/rechazo, código de entrega, liberación y reembolsos del escrow |
| Fase 2 | `scripts/probar-puntos-cancelacion.ts` | 48 | Puntos de reputación, cancelación a los 8 puntos, lista negra, purga y retiro de filas |
| Fase 3 | `scripts/probar-informes.ts` | 26 | Informes mensuales por vendedor y globales, PDF y purga a los 13 meses |
| Fase 4 | `scripts/probar-suscripciones.ts` | 11 | Suscripciones GraphQL del BackOffice por WebSocket |
| Fase 5 | `scripts/probar-mcp.ts` | 22 | Las 18 herramientas del servidor MCP |
| Fase 7a | `scripts/probar-sanciones.ts` | 30 | Sanciones progresivas (7/30 días/indefinida), reversión y prescripción |
| Fase 7b | `scripts/probar-disputas.ts` | 65 | Disputas, retención preventiva, adeudos y liquidación |
| Fase 7c | `scripts/probar-fila-apertura.ts` | 30 | Fila fuera de horario, aviso, "pagar ahora", esperar apertura y reactivación |
| Moderación | `scripts/probar-moderacion-vision.ts` | 38 | RQNF7, RQNF8, RQF8 y RQF9: validaciones de publicación y Cloud Vision simulada |

**Total: 293 pruebas de las suites + 38 de moderación.** Cada suite imprime al final una línea `Suite ...: X/Y pruebas pasaron`; esa es la señal de éxito (no el código de salida de PowerShell, que puede reportar error por la salida de diagnóstico de Node). Las suites usan puertos propios para no chocar con el servidor de desarrollo (el backend normal usa el 5000): escrow 5097, puntos 5098, informes 5099, suscripciones 5100, MCP 5101, sanciones 5102, disputas 5103 y fila/apertura 5104; los simuladores (mocks) usan los puertos 59091 a 59100.

---

## 6. Integración y despliegue continuos (CI/CD)

Los robots viven en `.github/workflows/` y se ejecutan en GitHub Actions:

### Integración continua (`integracion-continua.yml`)

Se dispara en **cada push a `main`** y en cada pull request. Hace dos trabajos:

1. **Backend**: levanta PostgreSQL 16 y MongoDB 7 de prueba, aplica las migraciones, siembra los datos demo (`npm run seed` y `npm run seed:mp`, que crean los vendedores de prueba que necesitan las suites), revisa los tipos con TypeScript (`npx tsc --noEmit`) y corre las **8 suites** (293 pruebas). Si alguna falla, el pipeline queda en rojo.
2. **Frontend**: compila la tienda React (`npm run build`) y el portal Astro (`npm run compilar`).

### Despliegue automático por integración con GitHub (lo que usa hoy el proyecto)

Las dos plataformas están **conectadas directamente al repositorio** `Anayansin/Ichiba` (rama `main`), así que se publican solas con cada push, sin secretos en GitHub:

- **Backend (Railway)**: el servicio `backend` está conectado al repositorio con **auto-despliegue activado**. Cada push a `main` crea un despliegue nuevo automáticamente: compila la carpeta `backend/`, aplica las migraciones pendientes y reinicia el servidor. El avance se ve en railway.com → proyecto *ichiba* → servicio *backend* (pestaña *Deployments*).
- **Tienda (Vercel)**: el proyecto `ichiba` está conectado al repositorio; cada push a `main` publica la tienda automáticamente en **https://ichiba-three.vercel.app**.

Antes de arrancar el backend, Railway aplica solo las migraciones pendientes de PostgreSQL: `backend/railway.json` define el paso previo `npx prisma db migrate` (`preDeployCommand`), así que la base de datos queda al día en cada despliegue sin correr nada a mano. Si ese paso falla, el despliegue se detiene y la versión anterior sigue funcionando.

> **Nota de mantenimiento:** si actualizas dependencias del backend, ejecuta `npm install` dentro de `backend/` y commitea también `package-lock.json`: Railway compila con `npm ci` y exige que ambos archivos estén sincronizados.

### Despliegue continuo alternativo (`despliegue.yml`)

El workflow de GitHub Actions queda como **vía alternativa** (por ejemplo, para relanzar un despliegue a mano desde *Actions → Despliegue continuo → Run workflow*). Solo arranca cuando la integración continua **terminó en verde sobre `main`** y publica:

- El **backend** en **Railway** (Node + PostgreSQL + MongoDB).
- La **tienda** (React + Vite) en **Vercel**.
- El **portal Astro** en Vercel, solo si se configura su proyecto.

Mientras falten credenciales, cada paso se salta solo con un aviso (`::warning::`) y el pipeline queda en verde: nada se rompe por no haber configurado los secretos.

### Cómo configurar los secretos del workflow alternativo (paso a paso)

Estos secretos solo hacen falta si quieres usar el workflow `despliegue.yml`; con la integración de GitHub descrita arriba el proyecto ya se publica solo.

En GitHub, entra al repositorio → **Settings → Secrets and variables → Actions** y crea:

**En la pestaña *Secrets*:**

1. `RAILWAY_TOKEN`: token de proyecto de Railway (railway.app → tu proyecto → Settings → Tokens, o `railway login` + `railway token`). Sirve para desplegar el backend.
2. `VERCEL_TOKEN`: token personal de Vercel (vercel.com → Account Settings → Tokens). Sirve para desplegar los frontends.

**En la pestaña *Variables*:**

3. `RAILWAY_SERVICE`: nombre del servicio de Railway (por defecto `backend`; solo cámbialo si tu servicio se llama distinto).
4. `VERCEL_ORG_ID`: id de tu equipo o persona en Vercel (te lo indica `vercel link` en la carpeta `frontend/Ichiba`, o el panel del proyecto).
5. `VERCEL_PROJECT_ID`: id del proyecto de Vercel de la tienda.
6. `VERCEL_PROJECT_ID_ASTRO` *(opcional)*: id del proyecto del portal Astro, si también quieres publicarlo.

Cuando quieras relanzar un despliegue, entra a **Actions → Despliegue continuo → Run workflow**. La referencia exacta de cada variable está comentada al inicio de `.github/workflows/despliegue.yml`.

---

## 7. Comandos rápidos

| Tarea | Carpeta | Comando |
| --- | --- | --- |
| Instalar dependencias del servidor | `backend` | `npm install` |
| Regenerar el contrato de Prisma | `backend` | `npm run contract:emit` |
| Levantar el servidor | `backend` | `npm run dev` |
| Llenar el catálogo de prueba | `backend` | `npm run seed` (y `npm run seed:mp`) |
| Crear/promover administradores | `backend` | `npm run admin -- correo@dominio [clave] [--promover]` |
| Probar el envío de correo | `backend` | `npm run correo-test -- [correo]` |
| Arrancar el servidor MCP (stdio) | `backend` | `npm run mcp` |
| Ver contenido de MongoDB | `backend` | `npx tsx scripts/inspeccionar-mongo.ts [coleccion]` |
| Correr una suite de pruebas | `backend` | `node --harmony-temporal --import tsx scripts/probar-escrow.ts` (y las demás de la sección 5) |
| Instalar dependencias del frontend | `frontend/Ichiba` | `npm install` |
| Levantar el frontend React | `frontend/Ichiba` | `npm run dev` |
| Compilar el frontend | `frontend/Ichiba` | `npm run build` |
| Revisar el código del frontend | `frontend/Ichiba` | `npm run lint` |
| Instalar dependencias del sitio de Astro | `front-astro` | `npm install` |
| Levantar el sitio de Astro | `front-astro` | `npm run desarrollo` |
| Compilar el sitio de Astro | `front-astro` | `npm run compilar` |
| Arrancar bases y todo el proyecto (Windows) | raíz | `powershell -ExecutionPolicy Bypass -File herramientas\arrancar-ichiba.ps1` |

---

## 8. Pendientes manuales

Todo el código de las fases 1 a 7c está terminado y probado. Para completar el 100% de la puesta en marcha en producción, lo único que depende de una persona es:

1. **Secretos del workflow de despliegue (opcional)**: Railway y Vercel ya publican solos con cada push gracias a su integración con GitHub (sección 6). Solo si además quieres poder relanzar despliegues desde GitHub Actions, configura `RAILWAY_TOKEN`, `VERCEL_TOKEN`, `RAILWAY_SERVICE`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` y, si aplica, `VERCEL_PROJECT_ID_ASTRO`.
2. **Probar un pago real de extremo a extremo** con una cuenta compradora *sandbox* creada en developer.paypal.com (aprobando el enlace de pago), y repetir con Mercado Pago si se desea. Las suites usan simuladores; esta es la única verificación que exige una cuenta externa real.
3. **Credenciales externas en producción** (si aún no están): `GMAIL_USER`/`GMAIL_APP_PASSWORD` (correos reales), `STRUCTOCR_API_KEY` (INE), `GOOGLE_VISION_API_KEY` (moderación) y `PAYPAL_LLAVE_CIFRADO` (vinculación de PayPal).
4. **Limpiar el historial de git** (opcional pero recomendado): en commits antiguos quedaron `backend/.env` con credenciales y fotografías de INE. El archivo actual está desvinculado y en `.gitignore`, pero el historial todavía las contiene; se ofreció limpiarlo con `git filter-repo`.
5. **Mantener activa la suscripción de Railway**: la cuenta está en plan de prueba con límite de tiempo/crédito; si se agota, los servicios en línea se pausan. Revisa railway.com → *Account* → *Plans* y actualiza antes de que termine.
