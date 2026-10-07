# Documentación de Ichiba

Este documento describe la arquitectura del proyecto, las bases de datos que utiliza, cómo instalarlo desde cero y qué archivos corresponden a cada módulo funcional. La información se basa en la estructura real de las carpetas del repositorio.

---

## 1. Arquitectura general

Ichiba es un marketplace en el que los vendedores publican productos con imágenes, horarios de entrega y promociones, y los compradores ingresan a una **fila virtual** por producto: quien queda en la posición uno dispone de un tiempo límite para pagar con PayPal antes de que el turno pase al siguiente. Comprador y vendedor conversan en un chat por venta, pueden reportarse entre sí, y un panel de administración permite revisar reportes, suspender cuentas y auditar la actividad de la plataforma.

El sistema sigue un patrón cliente-servidor: los frontends consumen una API REST montada en `http://localhost:5000/api` y un endpoint GraphQL montado en `http://localhost:5000/graphql`. La autenticación se hace con tokens JWT enviados en la cabecera `Authorization`, y los compradores que no tienen cuenta se identifican con un identificador anónimo generado en el navegador y enviado en la cabecera `x-comprador-id`.

### Carpetas del repositorio

#### `backend/`

Servidor en Node.js con TypeScript (módulos ESM) construido sobre Express 5. En `src/server.ts` se configuran el CORS, el cuerpo JSON, un filtro global de palabras prohibidas, la carpeta estática `/uploads` con las imágenes subidas, el montaje de todas las rutas REST, un servidor Apollo con el esquema y resolutores GraphQL, la conexión a MongoDB y el arranque de tres trabajos programados con `node-cron`. El servidor escucha en el puerto `5000` por defecto.

Estructura interna de `backend/src`:

| Carpeta | Contenido |
| --- | --- |
| `routes/` | Definición de endpoints REST (`productoRoutes`, `usuarioRoutes`, `colaRoutes`, `pagoRoutes`, `mensajeRoutes`, `reporteRoutes`, `adminRoutes`, `promocionalRoutes`, `verificacionRoutes`, `notificacionRoutes`, `suscripcionRoutes`). |
| `controllers/` | Lógica de cada endpoint. |
| `models/` | Esquemas de Mongoose (colecciones de MongoDB). |
| `middleware/` | Autenticación y permisos: `auth` (token), `comprador` (identificador anónimo), `verificado`, `admin`, `esAdmin`, `sancion`, `upload` e `uploadIne` (carga de imágenes con Multer). |
| `services/` | Lógica reutilizable: `paypalService`, `filaService`, `emailService`, `sancionService`, `structOcrService`, `ineService`, `imagenProductoService`, `usuarioService`. |
| `jobs/` | Tareas programadas: `revisionPagos` (cada minuto), `revisionHorarios` (diario a las 8:00) y `notificacionesCategoria` (10:00 y 17:00). |
| `graphql/` | Esquema (`esquema.ts`), resolutores (`resolvers.ts`) y contexto (`contexto.ts`) para Apollo Server. |
| `configuracion/` | Conexión a MongoDB (`db.ts`), cliente de PostgreSQL (`prisma.ts`), categorías, palabras prohibidas y categorías de reporte. |
| `utils/` | Validaciones de password, RFC/CURP, horarios, códigos de verificación y filtro de palabras. |
| `prisma/` | Contrato de datos de Prisma (`contract.prisma`) con sus archivos generados `contract.json` y `contract.d.ts`. |

Otros archivos relevantes de `backend/`: `prisma/schema.prisma` (espejo del contrato para el generador tradicional), `prisma.config.ts` (configuración de la CLI de Prisma), `migrations/` (migraciones de PostgreSQL), `uploads/` (imágenes subidas, se crea automáticamente), `.env` y `.env.example` (variables de entorno), `tsconfig.json` y `prisma-8.md` (guía de la versión de Prisma en uso).

Cabe señalar que existen archivos terminados en `.mongo.backup.ts` (en `controllers/`): conservan la versión anterior de esos controladores cuando todo vivía en MongoDB. El código que se ejecuta es el archivo sin el sufijo.

#### `frontend/`

Contiene una sola carpeta, `frontend/Ichiba`, con la aplicación de usuario: una SPA en React 18 con Vite y React Router. Su estructura en `src` es:

| Carpeta | Contenido |
| --- | --- |
| `pages/` | Pantallas de la aplicación: `Inicio`, `ProductoCompleto`, `RegistrarCuenta`, `PanelVendedor`, `RegistrarProducto`, `EditarProducto`, `HorarioVendedor`, `Chats`, `PagoExitoso`, `MisPedidos`, `Estadisticas`, `Promocionales`, `RegistrarPromocional`, `PromocionalDetalle`, `ReportarVendedor`, `ReportarComprador`, `Admin`, `AdminReportes`, `Ayuda`, `PreguntasFrecuentes`, `ComoFunciona`, `Nosotros`, `PoliticasDePrivacidad`, `RecuperarPassword`, `PerfilDelVendedor`, entre otras. |
| `components/` | Piezas reutilizables: `Header`, `CartaProducto`, `Carrusel`, `ColaBubble`, `FilaActivaComprador`, `BurbujaDeTexto`, `AreaChats`, `ChatSoporte`, `ChatBotAyuda`, `TerminosModal`, `VerificacionModal`, `AdvertenciaEncuentroModal`, `SelectorHorario` y el bloque de autenticación en `auth/`. |
| `services/` | Clientes de la API con Axios: `api.ts` (instancia base e interceptores), `authService`, `usuarioServices`, `productoService`, `colaService`, `pagoService`, `mensajeService`, `reporteService`, `promocionalService`, `notificacionService`, `verificacionService` y `adminService`. |
| `context/` | `AuthProvider`/`AuthContext` (sesión y token) y `ColasProvider`/`ColasContext` (estado de la fila del comprador). |
| `configuracion/` | Listas de categorías de productos y de reportes. |
| `utils/` | `compradorId` (identificador anónimo), validación de imágenes, mensajes de error y opciones de producto. |

El directorio `src/services/api.ts` toma la URL del backend de la variable `VITE_BACKEND_URL` (`http://localhost:5000` por defecto, definida en `frontend/Ichiba/.env` o en el panel del hosting) y arma la base `.../api` y `URL_BACKEND` a partir de ella; ahí mismo se adjuntan el token y el `x-comprador-id` a cada petición. El backend solo acepta CORS desde `FRONTEND_URL` (más localhost y la red local en desarrollo).

#### `front-astro/`

Sitio de contenido construido con Astro 7 e islas de React. Sus páginas están en `src/pages` (`index.astro`, `inicio.astro` y `ayuda.astro`) y su estructura usa nombres en español: `componentes/`, `contexto/`, `estilos/`, `servicios/` y `utilidades/`. La portada consulta la API al renderizar la página para mostrar cifras públicas (cantidad de productos activos y categoría más popular). El cliente REST vive en `src/servicios/api.ts` y el cliente GraphQL en `src/servicios/clienteGraphql.ts`, ambos apuntando a `http://localhost:5000`. No requiere archivos `.env`.

#### `mcp-servidor/`

Esta carpeta **no existe en la versión actual del repositorio**. Se menciona únicamente para que, si se agrega un servidor MCP en el futuro, quede registrado aquí junto con el resto de las carpetas.

#### Raíz del proyecto

Además de las carpetas anteriores, la raíz contiene `.gitignore`, el archivo `proyecto.code-workspace` de VS Code (que agrupa `backend`, `front-astro` y `frontend/Ichiba`) y este `DOCUMENTACION.md`.

### Diagrama de flujo

En texto plano, el recorrido de una petición es: navegador → frontend (React en el puerto 5173 o Astro en el 4321) → API Express en el puerto 5000 (REST en `/api` o GraphQL en `/graphql`) → PostgreSQL mediante Prisma o MongoDB mediante Mongoose, según la entidad consultada; cuando el flujo lo requiere, el backend llama además a servicios externos: la API de PayPal para los pagos, StructOCR para leer la INE en el registro y Gmail para enviar correos.

---

## 2. Bases de datos

El proyecto usa dos bases de datos simultáneamente y cada una tiene responsabilidades distintas.

### PostgreSQL

Se accede con Prisma ORM siguiendo el flujo de *contrato*: el modelo se define en `backend/src/prisma/contract.prisma`, los archivos `contract.json` y `contract.d.ts` se regeneran con `npm run contract:emit`, la CLI se configura en `backend/prisma.config.ts` (que lee `DATABASE_URL` del `.env`), y la aplicación consulta mediante el cliente propio `backend/src/configuracion/prisma.ts`, que expone el objeto `clientePrisma` con los modelos `usuario`, `venta`, `cola` y `reporte`. Existe además `backend/prisma/schema.prisma` con los mismos modelos para el generador tradicional, y las migraciones están en `backend/migrations`.

Los modelos y para qué sirven:

- **`usuario`**: cuentas completas (nombre, correo, contraseña, INE, RFC/CURP, horarios, preferencias de notificación) y su reputación (`ventasExitosas`, `totalReportes`, `faltasLeves`).
- **`venta`**: pagos capturados de PayPal (monto, `paypalOrderId`, estado) vinculados al vendedor.
- **`cola`**: posiciones de la fila virtual por producto (`posicion`, `estado`, `pagoExpiraEn`, correo del comprador).
- **`reporte`**: reportes entre usuarios con su categoría, tipo de falta, detalle y estado (`pendiente`, `confirmado`, `rechazado`).

En PostgreSQL se concentran el registro y la autenticación, los pagos, la fila virtual, los reportes y la reputación.

### MongoDB

Se accede con Mongoose. La conexión se hace en `backend/src/configuracion/db.ts` a partir de la variable `MONGO_URI`; si la variable no existe o la conexión falla, el servidor termina con un mensaje de error. Las colecciones están en `backend/src/models`:

- **`producto`**: catálogo completo (nombre, precio, imágenes, categoría, descripción, vendedor, horarios y condiciones de entrega).
- **`Mensaje`**: mensajes del chat, uno por venta, con texto y/o imagen adjunta.
- **`Cola`**, **`Venta`** y **`Reporte`**: copias de filas, ventas y reportes que consultan el historial de administración, los resolutores GraphQL y los trabajos de mantenimiento.
- **`Sancion`**: sanciones y bloqueos de usuarios (faltas leves y graves, bloqueos temporales o permanentes).
- **`Suscripcion`** y **`SuscripcionCategoria`**: preferencias de notificación por correo (novedades críticas y categorías de interés).
- **`Promocional`**: ofertas destacadas de los vendedores.
- **`usuario`**: cuentas que consulta el panel de administración de usuarios y el trabajo diario de horarios.

### Dónde vive cada dato

| Información | Dónde se escribe | Dónde se lee |
| --- | --- | --- |
| Cuentas, contraseñas, INE, horarios y reputación | PostgreSQL `usuario` | PostgreSQL (login, perfil, reportes y reputación); MongoDB `usuario` (gestión de usuarios del panel de administración, GraphQL y trabajo de horarios) |
| Productos del catálogo | MongoDB `producto` | MongoDB (REST, GraphQL y portada de `front-astro`) |
| Filas virtuales | PostgreSQL `cola` | PostgreSQL (rutas de fila y pagos); MongoDB `Cola` (historial de administración, GraphQL y limpieza) |
| Pagos y ventas | PostgreSQL `venta` | PostgreSQL (reportes e historial de administración); MongoDB `Venta` (chat e historial) |
| Mensajes del chat | MongoDB `Mensaje` | MongoDB |
| Reportes | PostgreSQL `reporte` | PostgreSQL (listado, confirmación y rechazo); MongoDB `Reporte` (historial de administración) |
| Sanciones y bloqueos | MongoDB `Sancion` | MongoDB |
| Suscripciones de notificaciones | MongoDB `Suscripcion`, `SuscripcionCategoria` | MongoDB |
| Promocionales | MongoDB `Promocional` | MongoDB |

**Nota sobre la convivencia de ambas bases.** El proyecto está en una etapa de migración: los flujos activos de fila, venta y reporte escriben en PostgreSQL, mientras que varias lecturas siguen yendo a las colecciones de MongoDB (el chat valida contra `Venta` de MongoDB, el panel de administración lista los usuarios de la colección `usuario`, y GraphQL y los trabajos programados leen las copias de MongoDB). Para trabajar de forma coherente conviene tener presente esta división: por ejemplo, un producto publicado existe en MongoDB, una fila creada existe en PostgreSQL, y las imágenes de ambas se sirven desde `backend/uploads`.

---

## 3. Instalación desde cero

### Requisitos previos

- Node.js 20 o superior con npm.
- PostgreSQL 15 o superior (versión mínima que admite Prisma en este proyecto).
- MongoDB 6 o superior, local o en la nube (por ejemplo MongoDB Atlas).
- Cuentas externas opcionales: una aplicación en PayPal Developer (para cobrar), una cuenta de Gmail con contraseña de aplicación (para enviar correos) y una llave de StructOCR (para leer la INE durante el registro).

### Variables de entorno

El backend se configura en `backend/.env`. El archivo `backend/.env.example` incluye únicamente `DATABASE_URL`; el resto deben agregarse manualmente:

| Variable | Obligatoria | Uso |
| --- | --- | --- |
| `DATABASE_URL` | Sí | Cadena de conexión a PostgreSQL; la leen `prisma.config.ts` y `src/configuracion/prisma.ts`. Ejemplo: `postgresql://usuario:clave@localhost:5432/ichiba`. |
| `MONGO_URI` | Sí | Cadena de conexión a MongoDB; la lee `src/configuracion/db.ts`. El servidor no arranca sin ella. Ejemplo: `mongodb://localhost:27017/ichiba`. |
| `JWT_SECRET` | Sí | Firma de los tokens de sesión; la usan `middleware/auth.ts`, `usuarioController`, `pagoController` y `reporteController`. |
| `PORT` | No | Puerto del servidor. Si falta, se usa el 5000. |
| `FRONTEND_URL` | Para pagos | URL del frontend que PayPal usa en las direcciones de regreso y cancelación de la compra. |
| `PAYPAL_CLIENT_ID` | Para pagos | Credenciales de la aplicación de PayPal. |
| `PAYPAL_CLIENT_SECRET` | Para pagos | Credenciales de la aplicación de PayPal. |
| `PAYPAL_API_BASE` | Para pagos | Base de la API de PayPal (modo pruebas o producción). |
| `GMAIL_USER` | No | Correo desde el que se envían los mensajes. |
| `GMAIL_APP_PASSWORD` | No | Contraseña de aplicación de Gmail. Si faltan ambas, el backend no falla: imprime los códigos en la consola con el prefijo `[correo local]`. |
| `STRUCTOCR_API_KEY` | Para registro | Llave de la API de StructOCR que lee el frente y el reverso de la INE. Sin ella, el registro no puede validar la identificación. |

`frontend/Ichiba` sí lee una variable de entorno: `VITE_BACKEND_URL` (la URL raíz del backend, sin `/api`). Si no existe, `src/services/api.ts` usa `http://localhost:5000`. En desarrollo la define `frontend/Ichiba/.env` (hay un `.env.example` como plantilla) y al publicar se define en el panel del hosting. En cambio `front-astro/src/servicios/api.ts`, `front-astro/src/servicios/clienteGraphql.ts` y `front-astro/src/pages/index.astro` todavía tienen la dirección `http://localhost:5000` escrita en el código: si cambias el puerto o despliegas el backend en otro dominio, edita esos archivos.

### Comandos de instalación y arranque

**Paso 1. Backend**

```bash
cd backend
npm install
```

Luego crea el archivo `.env` con las variables de la tabla anterior y prepara PostgreSQL: crea la base de datos y verifica el estado de las migraciones con `npx prisma migration status`. Si partes de una base vacía, aplica las migraciones que viven en `migrations/app` con la CLI de Prisma 8 o crea las tablas con `npx prisma db init`, como indica `backend/prisma-8.md`. Cada vez que modifiques `src/prisma/contract.prisma` vuelve a generar los tipos con:

```bash
npm run contract:emit
```

Para levantar el servidor:

```bash
npm run dev
```

Este comando ejecuta `src/server.ts` con nodemon y tsx en modo de desarrollo (reinicia al detectar cambios en `src`). Al estar listo, la consola muestra la conexión exitosa a MongoDB y `Servidor corriendo en http://localhost:5000`. La carpeta `uploads/` se crea sola en la primera subida de una imagen.

**Datos de prueba**

Con MongoDB en marcha puedes llenar el catálogo de ejemplo (30 productos, 5 por cada categoría, y 35 promocionales, 5 por cada tipo) desde la carpeta `backend`:

```bash
npm run seed
```

El script `scripts/seed.ts` valida cada dato con las mismas reglas del controlador (longitudes, precios y palabras no permitidas), reutiliza las imágenes que ya existen en `uploads/` y es idempotente: todo lo que inserta queda marcado con `semilla: true`, se borra antes de volver a insertar y nunca toca datos reales. Si PostgreSQL está disponible los artículos se ligan a un usuario existente; si no, usan un vendedor de respaldo.

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

1. PostgreSQL y MongoDB en ejecución.
2. Backend (`npm run dev` en `backend`), porque los frontends dependen de la API.
3. Frontend React (`npm run dev` en `frontend/Ichiba`).
4. Sitio de Astro (`npm run desarrollo` en `front-astro`), si se necesita.

### Verificación rápida

La consola del backend debe mostrar `Conectado exitosamente a MongoDB con Mongoose` y el mensaje de servidor corriendo; `http://localhost:5000/api/productos` debe responder con el catálogo; y en `http://localhost:5173` debe cargarse la portada con el botón de inicio de sesión. Si el backend falla al arrancar, revisa primero `DATABASE_URL` y `MONGO_URI`; si las funciones de correo no llegan, revisa `GMAIL_USER` y `GMAIL_APP_PASSWORD`; si el pago no inicia, revisa las tres variables de PayPal junto con `FRONTEND_URL`; y si el registro rechaza la identificación, revisa `STRUCTOCR_API_KEY`.

---

## 4. Resumen de módulos funcionales

### Registro y autenticación

Permite crear una cuenta verificando la identificación oficial, iniciar sesión, recuperar la contraseña y mantener la sesión. El registro exige subir el frente y el reverso de la INE, que se validan por dimensiones, nitidez y lectura automática de los datos, y el nombre capturado debe coincidir con el de la identificación.

En el backend corresponden `backend/src/routes/usuarioRoutes.ts` (alta, login, recuperación, perfil público y confirmación de horario) con `backend/src/controllers/usuarioController.ts`, que escribe en PostgreSQL; `backend/src/routes/verificacionRoutes.ts` y `backend/src/controllers/verificacionController.ts` para el código de verificación del correo; `backend/src/middleware/auth.ts` (verificación del token), `backend/src/middleware/verificado.ts` (solo usuarios verificados), `backend/src/middleware/uploadIne.ts` (carga de la INE); `backend/src/services/structOcrService.ts` y `backend/src/services/ineService.ts` (lectura y validación de la identificación), `backend/src/services/emailService.ts` (envío de códigos), `backend/src/utils/validarPassword.ts` y `backend/src/utils/validarRfcCurp.ts`.

En el frontend: `frontend/Ichiba/src/pages/RegistrarCuenta`, `frontend/Ichiba/src/pages/RecuperarPassword`, `frontend/Ichiba/src/components/auth/IniciarSesionModal`, `frontend/Ichiba/src/components/VerificacionModal`, el contexto de sesión en `frontend/Ichiba/src/context/AuthProvider.tsx` y los servicios `frontend/Ichiba/src/services/authService.ts`, `usuarioServices.ts` y `verificacionService.ts`.

### Catálogo

Agrupa la publicación, búsqueda y detalle de productos, así como las promociones destacadas de cada vendedor. Incluye subida de imágenes con restricciones de tamaño y peso, categorías, condiciones de uso, métodos de entrega, horarios y estadísticas de la categoría más popular.

En el backend: `backend/src/routes/productoRoutes.ts` y `backend/src/controllers/productoController.ts` sobre el modelo `backend/src/models/producto.ts` (MongoDB); `backend/src/middleware/upload.ts` (carga de imágenes de hasta 5 MB) y `backend/src/services/imagenProductoService.ts` (procesamiento con Sharp); `backend/src/routes/promocionalRoutes.ts`, `backend/src/controllers/promocionalController.ts` y `backend/src/models/Promocional.ts`; las listas de categorías están en `backend/src/configuracion/categorias.ts`.

En el frontend: `frontend/Ichiba/src/pages/Inicio` (buscador y listado), `ProductoCompleto`, `PanelVendedor`, `RegistrarProducto`, `EditarProducto`, `PerfilDelVendedor`, `Promocionales`, `RegistrarPromocional` y `PromocionalDetalle`; los componentes `CartaProducto`, `Carrusel` y `CartaPromocional`; los servicios `productoService.ts` y `promocionalService.ts`; y las categorías en `frontend/Ichiba/src/configuracion/categorias.ts`.

### Fila virtual y pagos

Es el corazón del marketplace: cada comprador entra a la fila de un producto, la posición uno recibe un tiempo límite para pagar con PayPal, y si el pago no llega a tiempo el turno se libera para la siguiente persona. Los compradores anónimos se identifican con `x-comprador-id` y las cuentas sancionadas no pueden entrar.

En el backend: `backend/src/middleware/comprador.ts` (identificador anónimo), `backend/src/routes/colaRoutes.ts` con `backend/src/controllers/colaController.ts` (entrar, consultar y salir de la fila, sobre PostgreSQL) y `backend/src/services/filaService.ts` (expiración de turnos); `backend/src/routes/pagoRoutes.ts` con `backend/src/controllers/pagoController.ts` y `backend/src/services/paypalService.ts` (creación y captura de la orden de pago, registro de la venta y calificación entre las partes); `backend/src/middleware/sancion.ts` (bloqueo de sancionados); y los trabajos `backend/src/jobs/revisionPagos.ts` (cada minuto libera los turnos vencidos) y `backend/src/jobs/revisionHorarios.ts` (a diario revisa que los vendedores mantengan su horario confirmado, avisa por correo y aplica consecuencias).

En el frontend: `frontend/Ichiba/src/components/ColaBubble` (burbuja flotante con la fila activa), `FilaActivaComprador`, `AdvertenciaEncuentroModal` (aviso de seguridad antes de quedarse en la posición uno) y `SelectorHorario`; las páginas `PagoExitoso` y `HorarioVendedor`; el contexto `ColasProvider`; los servicios `colaService.ts` y `pagoService.ts`; y `frontend/Ichiba/src/utils/compradorId.ts`.

### Chat

Permite a comprador y vendedor conversar sobre una venta concreta, incluyendo imágenes adjuntas. El comprador anónimo y el vendedor autenticado usan rutas distintas, y ambos validan que realmente participen en la venta antes de leer o escribir.

En el backend: `backend/src/routes/mensajeRoutes.ts`, `backend/src/controllers/mensajeController.ts` y el modelo `backend/src/models/Mensaje.ts` (MongoDB), con las validaciones de acceso a la venta y la carga de adjuntos en `/uploads`.

En el frontend: `frontend/Ichiba/src/pages/Chats` (lista de conversaciones, historial, calificación y botón de reporte), los componentes `frontend/Ichiba/src/components/BurbujaDeTexto` y `AreaChats`, y el servicio `frontend/Ichiba/src/services/mensajeService.ts`.

### Administración

Concentra el control de la plataforma por parte de cuentas con tipo `admin`: gestión de usuarios con suspensión y reactivación, revisión de reportes con confirmación o rechazo (la confirmación acumula faltas leves y cada múltiplo de tres se convierte en falta grave), auditoría del historial combinado de filas, ventas y reportes, y lectura del chat de cualquier venta sin restricción de participación.

En el backend: `backend/src/middleware/esAdmin.ts` (verifica el tipo de administrador contra PostgreSQL) y `backend/src/middleware/admin.ts` (usado por las rutas de reportes); `backend/src/routes/adminRoutes.ts`, montado en `/api/admin`, con `backend/src/controllers/adminController.ts`; el campo `suspendido` vive en `backend/src/models/usuario.ts`.

En el frontend: `frontend/Ichiba/src/pages/Admin/Admin.tsx`, pantalla protegida con menú interno, y sus secciones `GestionUsuarios.tsx`, `RevisionReportes.tsx` y `Trazabilidad.tsx` con `ModalConversacion.tsx`; también `frontend/Ichiba/src/pages/AdminReportes` (historial de reportes) y el servicio `frontend/Ichiba/src/services/adminService.ts`.

### Otros módulos

**Reportes y reputación.** Los usuarios reportan mensajes, productos o conductas con una categoría que define si la falta es leve o grave. Corresponde a `backend/src/routes/reporteRoutes.ts`, `backend/src/controllers/reporteController.ts`, `backend/src/configuracion/categoriasReporte.ts`, `backend/src/services/sancionService.ts` y `backend/src/models/Sancion.ts`; en el frontend, las páginas `ReportarVendedor`, `ReportarComprador` y `AdminReportes`, más `frontend/Ichiba/src/configuracion/categoriasReporte.ts`.

**Notificaciones y suscripciones.** Suscripción a categorías de interés y envío de avisos por correo. Corresponde a `backend/src/routes/notificacionRoutes.ts`, `backend/src/routes/suscripcionRoutes.ts`, sus controladores, los modelos `Suscripcion` y `SuscripcionCategoria`, `backend/src/services/emailService.ts` y el trabajo `backend/src/jobs/notificacionesCategoria.ts`; en el frontend, `frontend/Ichiba/src/services/notificacionService.ts`.

**GraphQL.** Endpoint `/graphql` con Apollo Server, útil para consultas combinadas desde `front-astro`. Se define en `backend/src/graphql/esquema.ts` (productos, filas, perfil público y mensajes), `backend/src/graphql/resolvers.ts` y `backend/src/graphql/contexto.ts`, y se consume desde `front-astro/src/servicios/clienteGraphql.ts`.

**Ayuda y contenido institucional.** En el frontend: `Ayuda`, `PreguntasFrecuentes`, `ComoFunciona`, `Nosotros` y `PoliticasDePrivacidad`, más el chatbot flotante `components/ChatBotAyuda` que responde con la base de conocimiento compartida en `components/ChatSoporte/baseConocimiento.ts`.

---

## 5. Comandos rápidos

| Tarea | Carpeta | Comando |
| --- | --- | --- |
| Instalar dependencias del servidor | `backend` | `npm install` |
| Regenerar el contrato de Prisma | `backend` | `npm run contract:emit` |
| Levantar el servidor | `backend` | `npm run dev` |
| Instalar dependencias del frontend | `frontend/Ichiba` | `npm install` |
| Levantar el frontend React | `frontend/Ichiba` | `npm run dev` |
| Compilar el frontend | `frontend/Ichiba` | `npm run build` |
| Revisar el código del frontend | `frontend/Ichiba` | `npm run lint` |
| Instalar dependencias del sitio de Astro | `front-astro` | `npm install` |
| Levantar el sitio de Astro | `front-astro` | `npm run desarrollo` |
| Compilar el sitio de Astro | `front-astro` | `npm run compilar` |
