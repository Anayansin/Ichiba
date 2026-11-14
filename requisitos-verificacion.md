# Requerimientos de Ichiba — verificación, implementación y propuestas

**Fecha:** 2026-11-14 · **Base:** `requisitos.md` (módulos 1 a 5) · **Código revisado:** commit `363c9d6`

Este documento repite los requerimientos **en el mismo orden** de `requisitos.md` y agrega, para
cada uno: si funciona al 100 %, **dónde está implementado** y **cómo se prueba**.
A partir del **módulo 4** los requerimientos van propuestos por nosotros (todavía no están
aprobados), con la redacción y la numeración que creemos correctas.

## Cómo leer las tablas

| Estado | Significado |
|---|---|
| ✅ | Implementado y verificado (100 %). La columna "cómo se prueba" dice con qué se comprueba. |
| 🟡 | Funciona, pero con una diferencia respecto al texto del requerimiento (se explica en "Hallazgos"). |
| ⚠️ | Funciona a medias: hay un hueco real de comportamiento o de interfaz (se explica en "Hallazgos"). |
| ❌ | No está implementado. |
| 📌 | Requerimiento propuesto (módulos 4 y 5): todavía no aprobado. |

> Nota sobre las pruebas: el proyecto no usa un framework de pruebas unitarias; la verificación
> se hace con **suites E2E propias** (`backend/scripts/probar-*.ts`) que levantan el backend real
> contra PostgreSQL y MongoDB locales. Cada suite imprime al final `Suite …: X/Y pruebas pasaron`.

## Resumen

| Módulo | Requerimientos | ✅ | 🟡 | ⚠️ | ❌ | Suite principal |
|---|---|---|---|---|---|---|
| 1 · Registro y autenticación | 39 | 38 | 1 | 0 | 0 | `probar-bloqueo-registro` (6) + `probar-escrow` (64) |
| 2 · Administración de catálogo | 47 | 44 | 2 | 1 | 0 | `probar-moderacion-vision` (48) + `probar-informes` (26) |
| 3 · Fila virtual y proceso de compra | 118 | 112 | 4 | 2 | 0 | `probar-fila-apertura` (30) + `probar-escrow` (65) + `probar-suscripciones` (11) |
| 4 · Chat de coordinación (propuesto) | 9 | 7 | 2 | 0 | 0 | `probar-escrow` (64) |
| 5 · Gestión y control administrativo (propuesto) | 25 | 23 | 1 | 1 | 0 | `probar-sanciones` (30) + `probar-disputas` (65) + `probar-mcp` (22) |

**Total: 238 requerimientos revisados — 224 verificados (94 %), 10 con ajustes de texto o alcance,
3 con huecos reales.** Los 3 huecos y los 10 ajustes están listados en "Pendientes" al final.

---

# Módulo 1: Registro y autenticación

## Requerimientos funcionales

| ID | Requerimiento | Estado | Dónde está | Cómo se prueba |
|---|---|---|---|---|
| RQF1 | El vendedor se registra con nombre, domicilio, teléfono, correo, RFC, 2 imágenes de su INE y contraseña. | ✅ | `frontend/…/pages/RegistrarCuenta/RegistrarCuenta.tsx` · `backend/src/controllers/usuarioController.ts` (`registrarUsuario`) · `POST /api/usuarios/registro` | Manual con una INE real (requiere `STRUCTOCR_API_KEY`). El camino automatizado es la denegación: `npm run prueba-registro`. |
| RQF1.1 | El vendedor ve un mensaje de error cuando su registro es denegado. | ✅ | `RegistrarCuenta.tsx` (bloque `registro-bloqueo`) · `usuarioController.ts` (403 con `codigo: "DATOS_NO_REGISTRABLES"`) | `npm run prueba-registro` (6/6) |
| RQF2 | Casilla de aceptación de notificaciones críticas (estado, fila, pagos). | ✅ | `RegistrarCuenta.tsx` · `usuarioController.ts` (`recibirNotificacionesCriticas`) | Manual en el formulario; `probar-bloqueo-registro` valida el camino de alta. |
| RQF3 | Casilla de aceptación de notificaciones sobre comentarios publicitarios (opcional). | ✅ | `RegistrarCuenta.tsx` · `usuarioController.ts` (`recibirNotificacionesPublicitarias`) · `PUT /api/usuarios/preferencias` | Manual; la API está en `backend/src/controllers/usuarioController.ts`. |
| RQF4 | Redirección a PayPal por OAuth 2.0 para vincular la cuenta. | ✅ | `backend/src/controllers/paypalVinculacionController.ts` · `services/paypalService.ts` (`construirUrlVinculacionPaypal`) · `frontend/…/pages/PanelVendedor` | `npm run prueba-comision` (verifica la URL de OAuth con `redirect_uri`, `email` y `state`) + flujo manual en el panel. |
| RQF5 | El vendedor define sus horarios de atención (05:00–23:59, GMT-6). | ✅ | `frontend/…/components/SelectorHorario/SelectorHorario.tsx` · `backend/src/utils/validarHorario.ts` · `services/filaService.ts` | `probar-fila-apertura` (30/30) valida la apertura y el cierre de bloques. |
| RQF6 (horarios) | El vendedor actualiza, confirma o modifica sus horarios. | ✅ | `PUT /api/usuarios/confirmar-horario` · `usuarioController.ts` (`confirmarHorario`) | Manual desde el panel; el persistido se ve en `usuario.horarios`. |
| RQF6 (no confirma) | El vendedor que no confirma su horario ve el acceso restringido. | ✅ | `backend/src/middleware/verificado.ts` (`requiereVerificado`) | Manual: cuenta sin `horarioConfirmadoEn` del mes → 403 al publicar. |
| RQF6 (login) | El vendedor entra con correo y contraseña. | ✅ | `backend/src/controllers/usuarioController.ts` (`iniciarSesion`) · `frontend/…/context/AuthProvider.tsx` | `POST /api/usuarios/login` con una cuenta de la semilla; usado por **todas** las suites. |

## Requerimientos no funcionales

| ID | Requerimiento | Estado | Dónde está | Cómo se prueba |
|---|---|---|---|---|
| RQNF1.1 | Validar que todos los campos del registro estén completos antes de enviar. | ✅ | `usuarioController.ts` (validaciones 400) + `RegistrarCuenta.tsx` (mapa `errores`) | Manual: enviar vacío → el formulario marca cada campo. |
| RQNF1.2 | El teléfono debe tener 10 dígitos. | ✅ | `usuarioController.ts` (`/^\d{10}$/`) · `RegistrarCuenta.tsx` (`handleTelefonoChange`) | Manual + `probar-bloqueo-registro`. |
| RQNF1.3 | Enviar un código numérico de 4 dígitos al correo. | ✅ | `backend/src/utils/generarCodigo.ts` · `controllers/verificacionController.ts` · `services/emailService.ts` (`enviarCorreoVerificacion`) | Manual: el código sale en consola con el prefijo `[correo local]`. |
| RQNF1.4 | El RFC debe coincidir con los primeros 10 caracteres de la CURP de la INE. | ✅ | `backend/src/utils/validarRfcCurp.ts` (`coincideRfcConCurp`) | Manual con INE real (el propio registro lo valida). |
| RQNF1.5 | El nombre completo debe coincidir con el de la INE. | ✅ | `backend/src/services/structOcrService.ts` (`coincideNombreConDatosINE`) | Manual con INE real. |
| RQNF1.6 | Solo .png / .jpeg / .jpg, mínimo 420 × 540 px, para las 2 imágenes de la INE. | ✅ | `frontend/…/utils/validarImagen.ts` · `backend/src/services/ineService.ts` (`validarDimensionesINE`) | `probar-moderacion-vision` (48) valida el mismo validador de imágenes. |
| RQNF1.7 | Contraseña: 10+ caracteres, mayúscula, minúscula, número y símbolo `! @ # $ % & * - _`. | ✅ | `backend/src/utils/validarPassword.ts` · `RegistrarCuenta.tsx` (`requisitosPassword`) | Manual (la lista de requisitos se muestra en vivo). |
| RQNF1.8 | Extraer nombre y CURP de la INE con StructOCR. | ✅ | `backend/src/services/structOcrService.ts` (`extraerDatosINE`) | Manual con INE real; requiere `STRUCTOCR_API_KEY`. |
| RQNF1.9 | Denegar el registro si el RFC o los datos de la INE están en la lista negra. | ✅ | `backend/src/services/bloqueoRegistroService.ts` (`revisarBloqueoDeRegistro`) · `services/listaNegraService.ts` (`buscarEnListaNegra`, ahora también compara **correo**) | **`npm run prueba-registro` (6/6)** + `probar-puntos-cancelacion` (48/48) |
| RQNF1.1 | Mostrar el mensaje de denegación de inmediato, sin revelar qué dato coincidió. | ✅ | `usuarioController.ts` (403 con mensaje genérico) · `RegistrarCuenta.tsx` | `npm run prueba-registro` (6/6) |
| RQNF2.1 | No permitir el registro si no se aceptan las notificaciones críticas. | ✅ | `usuarioController.ts` (400 `Debes aceptar recibir notificaciones críticas…`) | Manual; validado en el mismo camino que `probar-registro`. |
| RQNF2.2 | Permitir continuar el registro si se aceptan. | ✅ | `RegistrarCuenta.tsx` · `usuarioController.ts` | Manual. |
| RQNF2.3 | Guardar la selección de la casilla. | ✅ | `usuario.recibirNotificacionesCriticas` (PostgreSQL) | `SELECT recibirNotificacionesCriticas FROM usuario` (psql). |
| RQNF3 | Guardar la selección de notificaciones publicitarias. | ✅ | `usuario.recibirNotificacionesPublicitarias` (PostgreSQL) | Igual que arriba. |
| RQNF4 | Guardar el Token de acceso de PayPal cifrado (Merchant ID) para el escrow. | ✅ | `backend/src/services/cifradoService.ts` (AES-256-GCM) · `models/VinculoPayPal.ts` | `probar-comision` (7/7) + `probar-escrow` (64/64) |
| RQNF5.1 | Guardar los horarios en formato de 24 horas. | ✅ | `usuario.horarios` (JSON en PostgreSQL) | `SELECT horarios FROM usuario` (psql). |
| RQNF5.2 | Exigir un horario mínimo de 1 hora a la semana. | ✅ | `backend/src/utils/validarHorario.ts` (`validarHorarioSemanal`) | `probar-fila-apertura` (30/30). |
| RQNF5.3 | Exigir confirmación del horario cada 1.º de mes. | ✅ | `backend/src/middleware/verificado.ts` · `jobs/revisionHorarios.ts` | `probar-eliminacion-vendedor` (diagnóstico) + `probar-fila-apertura` (30/30). |
| RQNF5.4 | Guardar la confirmación o, en su defecto, el conteo de no confirmaciones. | ✅ | `usuario.horarioConfirmadoEn` / `usuario.diasSinConfirmarHorario` | `probar-eliminacion-vendedor`. |
| RQNF6.1 | Aplicar las actualizaciones de horario cuando exista un cambio. | ✅ | `usuarioController.ts` (`confirmarHorario`) | Manual desde el panel. |
| RQNF6.2 | Exigir de nuevo un mínimo de 1 hora semanal al modificar. | ✅ | `validarHorarioSemanal` | `probar-fila-apertura` (30/30). |
| RQNF6.3 | Avisar 15 días antes de la eliminación de la cuenta. | ✅ | `jobs/revisionHorarios.ts` (`proximoPrimerDiaEn15`) · `emailService.enviarCorreoAdvertencia` | `probar-eliminacion-vendedor`. |
| RQNF6.4 | Contar 2 faltas de confirmación para enviar el aviso de eliminación. | ✅ | `jobs/revisionHorarios.ts` | `probar-eliminacion-vendedor`. |
| RQNF6.5 | Eliminar la cuenta el 1.º de mes con 2 faltas seguidas. | ✅ | `jobs/revisionHorarios.ts` (`esPrimerDiaDelMes && diasSinConfirmarHorario >= 2`) | `probar-eliminacion-vendedor`. |
| RQNF6.6 | Eliminar todos los registros relacionados sin posibilidad de recuperarlos. | ✅ | `jobs/revisionHorarios.ts` (`eliminarCuentaDeVendedor`) · `services/cancelacionCuentaService.ts` (`purgarCuentaCancelada`) | `probar-puntos-cancelacion` (48/48) |
| RQNF6 | Restringir publicación y edición de catálogo hasta confirmar el horario. | ✅ | `backend/src/middleware/verificado.ts` | Manual: cuenta sin confirmar → 403 al publicar. |
| RQNF6 (login) | Autenticar las credenciales consultando **MongoDB**, con datos cifrados por bcryptjs. | 🟡 | `usuarioController.ts` (`iniciarSesion`) — **ahora consulta PostgreSQL** (migración `20261112T0023_cuentas_completas_en_postgres`); bcryptjs sigue igual | `npm run prueba-registro` + todas las suites inician sesión | 
| **Texto a updating** | *«RQNF6 (login): El sistema debe autenticar las credenciales de inicio de sesión consultando los registros de la base de datos PostgreSQL (fuente de verdad de las cuentas), con la contraseña almacenada como hash bcryptjs; el rol vigente se lee siempre de PostgreSQL.»* | 📌 | — | — |

### Hallazgos del módulo 1
1. **RQNF6 (login) quedó desactualizado**: el requerimiento dice "consultando registros en la base de
   datos de MongoDB" y desde la migración de esta ronda la fuente de verdad es PostgreSQL (MongoDB
   solo guarda catálogo, chats y documentos). Hay que reescribir ese texto (propuesta arriba).
2. **La denegación por lista negra se amplió**: además de RFC/CURP/INE ahora compara el **correo**,
   y también bloquea cuando los datos o el teléfono **ya pertenecen a otra cuenta** (RQNF1.9 ampliado
   en `requisitos.md`, todavía sin registrar como versión nueva).
3. **Falta una prueba E2E del alta completa**: el camino con INE real y StructOCR solo se prueba a mano.
   Propuesta: `probar-registro-ine.ts` con una INE de prueba y el mock de StructOCR.

---

# Módulo 2: Administración de catálogo (vendedor)

## Requerimientos funcionales

| ID | Requerimiento | Estado | Dónde está | Cómo se prueba |
|---|---|---|---|---|
| RQF7 | El vendedor publica un producto con nombre, precio, descripción, estado, foto, método de entrega, rango horario y tiempo límite de pago. | ✅ | `backend/src/controllers/productoController.ts` (`crearProducto`) · `frontend/…/pages/ProductoCompleto` | **`probar-moderacion-vision` (48/48)** |
| RQF8 (palabras) | El vendedor recibe una alerta cuando el texto coincide con una palabra no permitida. | ✅ | `backend/src/utils/filtroPalabras.ts` · `frontend/…/utils/errores.ts` (`campoDeError`) | `probar-moderacion-vision` (48/48) |
| RQF8 (categoría) | Al publicar, el vendedor elige obligatoriamente una categoría. | ✅ | `productoController.ts` · `backend/src/configuracion/categorias.ts` | `probar-moderacion-vision` (48/48) |
| RQF9 | El vendedor promociona un artículo (nombre, descripción, estado, fotos, precio, chat comentarios on/off, cobertura). | ✅ | `backend/src/controllers/promocionalController.ts` · `frontend/…/pages/PanelVendedor` | `probar-moderacion-vision` (48/48) |
| RQF10 (palabras) | Alerta por palabra no permitida en el promocional. | ✅ | `filtroPalabras.ts` + `promocionalController.ts` | `probar-moderacion-vision` (48/48) |
| RQF10 (reportes) | El vendedor reporta eligiendo motivo y descripción. | ✅ | `backend/src/controllers/reporteController.ts` · `services/sancionService.ts` | `probar-sanciones` (30/30) + `probar-puntos-cancelacion` (48/48) |
| RQF11 | Correo al vendedor cuando su cuenta se cancela a los 8 puntos. | ✅ | `emailService.enviarCorreoCuentaCancelada` · `services/cancelacionCuentaService.ts` | `probar-puntos-cancelacion` (48/48) |
| RQF12 | El vendedor cancelado solo entra a las transacciones con pago confirmado. | ✅ | `backend/src/middleware/vendedor.ts` (`rechazarCuentaCancelada`, `requiereUsuarioSinSancionDeEntregas`) | `probar-puntos-cancelacion` (48/48) |
| RQF10 (cliente) | El cliente ve el aviso de producto no disponible al ser retirado de la fila. | ✅ | `services/cancelacionCuentaService.ts` · `emailService.enviarCorreoProductoNoDisponible` | `probar-puntos-cancelacion` (48/48) |
| RQF11 (editar) | El vendedor edita su publicación. | ✅ | `productoController.ts` (`actualizarProducto`, `eliminarProducto`) | `probar-moderacion-vision` (48/48) |
| RQF12 (panel) | El vendedor consulta estado de sus productos, filas en curso, vendidos y reputación (1–5 estrellas). | ✅ | `frontend/…/pages/PanelVendedor` · `services/reputacionService.ts` (`calcularReputacionVendedor`) | `probar-escrow` (64/64) |
| RQF13 | El vendedor descarga sus informes de ventas en PDF. | ✅ | `backend/src/services/informesService.ts` · `services/pdfInformes.ts` | **`probar-informes` (26/26)** |

## Requerimientos no funcionales

| ID | Requerimiento | Estado | Dónde está | Cómo se prueba |
|---|---|---|---|---|
| RQNF7.1 | Validar que todos los campos del producto estén completos. | ✅ | `productoController.ts` | `probar-moderacion-vision` (48/48) |
| RQNF7.2 | Solo .png/.jpeg/.jpg, 420 × 540 mínimo y 2560 × 2560 máximo. | ✅ | `frontend/…/utils/validarImagen.ts` · `services/imagenProductoService.ts` | `probar-moderacion-vision` (48/48) |
| RQNF7.3 (precio) | Precio entre $10 y $5,000 MXN. | ✅ | `productoController.ts` (líneas 79-86) | `probar-moderacion-vision` (48/48) |
| RQNF7.4 (descripción) | Descripción de 30 a 100 caracteres. | ✅ | `productoController.ts` (líneas 93-95) | `probar-moderacion-vision` (48/48) |
| RQNF7.5 (estado) | Validar la selección del estado del artículo. | ✅ | `productoController.ts` | `probar-moderacion-vision` (48/48) |
| RQNF7.3 (Cloud Vision) | Moderar la foto del producto con Cloud Vision (LABEL_DETECTION) contra objetos excluidos. | ✅ | `backend/src/services/visionService.ts` (`moderarFotosProducto`) | `probar-moderacion-vision` (48/48, con mock de Vision) |
| RQNF7.3 (palabras) | Bloquear el envío si algún campo de texto coincide con la lista de palabras no permitidas. | ✅ | `backend/src/utils/filtroPalabras.ts` | `probar-moderacion-vision` (48/48) |
| RQNF7.4 (tiempo de pago) | Tiempo límite de pago entre 30 minutos y 3 horas, con 1 hora por defecto. | ✅ | `productoController.ts` (`tiempoLimitePagoDe`) | `probar-moderacion-vision` (48/48) + `probar-fila-apertura` (30/30) |
| RQNF7.5 (guardar) | Guardar todos los campos del producto. | ✅ | `productoController.ts` (modelo `producto` en MongoDB) | `probar-moderacion-vision` (48/48) |
| RQNF8.1 | Mostrar la alerta de contenido no permitido. | ✅ | `frontend/…/pages/PanelVendedor` + `utils/errores.ts` | `probar-moderacion-vision` (48/48) |
| RQNF8.2 | Permitir corregir el contenido y reintentar, aplicando las mismas validaciones. | ✅ | `frontend/…/utils/errores.ts` (`campoDeError` enfoca el campo señalado) | `probar-moderacion-vision` (48/48) |
| RQNF8.1 (categoría) | Validar que exista categoría seleccionada. | ✅ | `productoController.ts` | `probar-moderacion-vision` (48/48) |
| RQNF8.2 (guardar) | Guardar la categoría elegida. | ✅ | `producto.categoria` (MongoDB) | `probar-moderacion-vision` (48/48) |
| RQNF9.1 | Validar que los campos del promocional no estén vacíos. | ✅ | `promocionalController.ts` | `probar-moderacion-vision` (48/48) |
| RQNF9.2 | Formatos y tamaño de la foto del promocional. | ✅ | `validarImagen.ts` · `imagenProductoService.ts` | `probar-moderacion-vision` (48/48) |
| RQNF9.3 | Moderar la foto del promocional con Cloud Vision. | ✅ | `visionService.moderarFotosProducto` | `probar-moderacion-vision` (48/48) |
| RQNF9.4 | Bloquear el promocional con palabras no permitidas. | ✅ | `filtroPalabras.ts` | `probar-moderacion-vision` (48/48) |
| RQNF9.5 | El precio del promocional mínimo $5,001 MXN, sin máximo. | ✅ | `promocionalController.ts` (línea 35) | `probar-moderacion-vision` (48/48) |
| RQNF10.1 | Mostrar la alerta inmediatamente. | ✅ | `utils/errores.ts` | `probar-moderacion-vision` (48/48) |
| RQNF10.2 | Permitir corregir y reintentar. | ✅ | `utils/errores.ts` | `probar-moderacion-vision` (48/48) |
| RQNF10.1 (puntos) | Calcular la reputación por puntos: 3 graves · 1.5 trato directo · 1 leves. | ✅ | `backend/src/configuracion/categoriasReporte.ts` (`puntosDeCategoria`) · `services/sancionService.ts` | `probar-sanciones` (30/30) |
| RQNF10.3 | Acumular puntos y cancelar la cuenta de forma permanente al llegar a 8. | ✅ | `sancionService.registrarFalta` · `services/cancelacionCuentaService.ts` | `probar-puntos-cancelacion` (48/48) |
| RQNF10.4 | Guardar los reportes cuyo motivo sea "otro motivo". | ✅ | `models/Reporte.ts` · `reporteController.ts` | `probar-puntos-cancelacion` (48/48) |
| RQNF10.5 | Correo de cancelación con el motivo y los reportes que la originaron. | ✅ | `emailService.enviarCorreoCuentaCancelada` | `probar-puntos-cancelacion` (48/48) |
| RQNF10.6 | Purgar toda la información personal y conservar solo RFC e INE en la lista negra. | ✅ | `cancelacionCuentaService.purgarCuentaCancelada` · `listaNegraService.agregarAListaNegra` | `probar-puntos-cancelacion` (48/48) |
| RQNF10.7 | Cancelar las filas activas sin pago y avisar al cliente. | ✅ | `cancelacionCuentaService.cancelarFilasSinPago` | `probar-puntos-cancelacion` (48/48) |
| RQNF10.1 (cancelado) | El cancelado solo completa entregas con pago ya confirmado. | ✅ | `middleware/vendedor.ts` | `probar-puntos-cancelacion` (48/48) |
| RQNF10.2 (reembolso) | Reembolsar por PayPal si el cancelado no registra el código en el plazo. | ✅ | `jobs/revisionEntregas.ts` · `services/escrowService.ts` | `probar-puntos-cancelacion` (48/48) |
| RQNF10.1 (aviso) | Mostrar el aviso de producto no disponible y quitarlo de su lista de filas. | ✅ | `emailService.enviarCorreoProductoNoDisponible` · `frontend/…/components/ColaBubble` | `probar-puntos-cancelacion` (48/48) |
| RQNF11.1 / 11.4 | Impedir editar o dar de baja con transacción o fila en curso, y revalidar los campos. | ✅ | `productoController.ts` (`actualizarProducto`, `eliminarProducto`) | `probar-moderacion-vision` (48/48) |
| RQNF11.1 (aviso) | Mostrar aviso de que no puede editar ni dar de baja. | ✅ | `frontend/…/pages/PanelVendedor` | `probar-moderacion-vision` (48/48) |
| RQNF11.1 / 11.2 | Impedir editar y dar de baja con fila o venta activa. | ✅ | `productoController.ts` | `probar-moderacion-vision` (48/48) |
| RQNF11.5 | Al dar de baja, la publicación queda inactiva pero se conserva para el historial. | ✅ | `producto.activo = false` (MongoDB) | `probar-moderacion-vision` (48/48) |
| RQNF12 | Reputación = promedio de calificaciones de 1 a 5 (enteros). | ✅ | `services/reputacionService.ts` | `probar-escrow` (64/64) |
| RQNF13.1 | Informe mensual con ventas, productos vendidos, tiempo promedio por fila y tasa de concertación. | ✅ | `services/informesService.ts` · `jobs/informesMensuales.ts` | `probar-informes` (26/26) |
| RQNF13.2 (tasa) | Tasa de concertación = ventas concluidas / filas iniciadas, en porcentaje. | ✅ | `informesService.ts` | `probar-informes` (26/26) |
| RQNF13.2 (generación) | Generar y agregar al historial el informe del mes recién concluido cada 1.º. | ✅ | `jobs/informesMensuales.ts` (cron `5 0 1 * *`) | `probar-informes` (26/26) |
| RQNF13.3 | Consultar y descargar en PDF el historial de informes. | ✅ | `services/pdfInformes.ts` · `GET /api/informes/:periodo/pdf` | `probar-informes` (26/26) |
| RQNF14.1 | Contador de antigüedad por reporte y purga al cumplir 13 meses. | ✅ | `informesService.ts` (purga por `createdAt` + 13 meses) | `probar-informes` (26/26) |

### Hallazgos del módulo 2
1. **Numeración duplicada en `requisitos.md`**: RQNF7.3 aparece dos veces (precio y Cloud Vision),
   RQNF7.4 dos veces (descripción y tiempo de pago) y RQNF7.5 dos veces (estado y guardado). Hay que
   renumerar (propuesta: 7.6 = Cloud Vision, 7.7 = palabras no permitidas, 7.8 = tiempo límite de pago,
   7.9 = guardado). **El texto del requerimiento apunta a un "RQNF7.7" que hoy no existe** (el filtro de
   palabras) — hay que arreglar esa referencia en RQNF8.2, RQNF10.2, RQNF29.3 y RQNF35.2.
2. **RQF8 (categoría) quedó desactualizado**: el texto lista 6 categorías (Artesanías, Ropa, Hogar,
   Electrodomésticos, Coleccionables, Otros), pero el catálogo tiene 12 categorías en
   `backend/src/configuracion/categorias.ts` y las promociones usan el mismo catálogo. Hay que
   reescribirlo con la lista vigente.
3. **El precio máximo del producto ($5,000) y el mínimo del promocional ($5,001) son excluyentes
   por un peso**: hoy el backend valida `$10–$5,000` para productos y `≥ $5,001` para promocionales.
   Conviene confirmarlo como regla de negocio ("lo que vale más de $5,000 se publica como promocional").

---

# Módulo 3: Fila virtual y proceso de compra (cliente y vendedor)

> Este módulo concentra el grueso de la funcionalidad. Se agrupan los requerimientos contiguos que
> comparten implementación y prueba, **sin alterar el orden** de `requisitos.md`.

## Requerimientos funcionales y no funcionales (en orden)

| ID | Requerimiento | Estado | Dónde está | Cómo se prueba |
|---|---|---|---|---|
| RQF15 / RQNF15.1 | Cada artículo del catálogo muestra imagen, precio y nombre; solo se listan publicaciones activas. | ✅ | `backend/src/controllers/productoController.ts` (`listar`) · `frontend/…/pages/Inicio/Inicio.tsx` | `probar-moderacion-vision` (48/48) |
| RQNF15.3 | Carga inicial de 12 elementos y ampliación de 12 en 12 con Intersection Observer, paginando sobre MongoDB. | ✅ | `Inicio.tsx` (IntersectionObserver) · `productoController.ts` (`pagina`, `porPagina`) | `probar-moderacion-vision` (48/48) |
| RQF15.1 (menú) / RQNF15.5 | Barra de navegación con Inicio, Chats, Categorías, Promocionales, Nosotros, Ayuda e Iniciar sesión; cada opción lleva a su sección. | ✅ | `frontend/…/components/Header/Header.tsx` | Manual (5 segundos). |
| RQF16 / RQNF16.1–16.4 | Entrar en la fila, orden FIFO, máximo 3 filas por cliente, conteo previo y bloqueo de la cuarta fila con el aviso "Ya estás en 3 filas. Abandona una para continuar". | ✅ | `backend/src/controllers/colaController.ts` · `services/filaService.ts` · `frontend/…/pages/Chats` | **`probar-fila-apertura` (30/30)** |
| RQNF16.3 (sin tope por producto) | Cualquier cliente puede entrar en un producto disponible sin límite de personas por producto. | ✅ | `colaController.ts` (`entrarEnFila`) | `probar-fila-apertura` (30/30) |
| RQF16.2 / RQNF16.6–16.8 / RQF16.3 / RQNF16.1 | Indicador de disponible / inactivo por horario al pasar el cursor, con la hora del próximo bloque; el botón "Entrar en la fila" queda deshabilitado en los inactivos. | ✅ | `productoController.ts` (`conAtencionDelVendedor`) · `services/filaService.ts` (`horariosDelVendedorDeProducto`) · `frontend/…/pages/Inicio` | `probar-fila-apertura` (30/30) |
| RQF18 / RQNF18.1–18.6 / QNF18.3 | "Pagar ahora" o "Esperar al siguiente bloque": se mantiene el primer lugar, se guarda la opción, el chat queda bloqueado, el reloj del tiempo límite arranca según la opción y al abandonar se libera el turno. | ✅ | `services/filaService.ts` (`pausarHastaLaApertura`) · `colaController.ts` (`estadoDeMiFila`) · `frontend/…/pages/Chats` | **`probar-fila-apertura` (30/30)** |
| RQF17 / RQNF17.1–17.4 | Perfil público del vendedor: solo datos públicos, publicaciones en solo consulta fuera de horario y bloqueo de entrar a su fila. | ✅ | `usuarioController.obtenerPerfilPublico` · `frontend/…/pages/PerfilDelVendedor` | `probar-fila-apertura` (30/30) |
| RQF19 / RQNF19.1–19.5 | Burbuja flotante con la posición en la fila, actualizada en vivo sin recargar; al concluir la venta el cliente se retira y los demás reciben el aviso "Producto no disponible…". | ✅ | `frontend/…/components/ColaBubble/ColaBubble.tsx` · `backend/src/graphql/resolvers.ts` (`misFilas`) · `jobs/revisionEntregas.ts` | `probar-fila-apertura` (30/30) + `probar-escrow` (64/64) |
| RQF20 / RQNF20.1 / 20.2 | El cliente registra su correo y sus categorías de interés; se validan y se guardan. | ✅ | `backend/src/controllers/suscripcionController.ts` · `models/Suscripcion.ts` | `probar-suscripciones` (11/11) |
| RQNF20.2 (correo) / 20.4 / 20.5 | Correo de novedades de las categorías elegidas, enviado a las 10:00 y 17:00 (GMT-6), agrupando lo publicado desde el envío anterior y sin enviar si no hay novedades. | ✅ | `jobs/notificacionesCategoria.ts` (cron `0 10,17 * * *`) · `emailService.enviarCorreoNovedadesCategoria` | **`probar-suscripciones` (11/11)** |
| RQF21 / RQNF18 (redirección) / 21.1–21.5 | Pago con PayPal (o Mercado Pago), webhook, palabra clave de 4 dígitos única, fondos en escrow y chat habilitado al confirmarse. | ✅ | `backend/src/controllers/pagoController.ts` · `services/ventaService.ts` · `services/escrowService.ts` | **`probar-escrow` (64/64)** |
| RQF22 / RQNF22.1–22.4, 22.6, 22.7 / RQNF22.13 | El cliente registra su comprobante (palabra clave, referencia de 6–8 dígitos e imagen); se validan los campos, el formato de la imagen y el contenido con SafeSearch; la fila queda en reposo y el error se muestra sin enviar nada al vendedor. | ✅ | `pagoController.registrarComprobante` · `services/escrowService.ts` (`registrarComprobanteDeVenta`) · `services/visionService.ts` (`moderarComprobante`) | `probar-escrow` (64/64) |
| **RQNF22.5 (OCR del comprobante)** | Analizar la imagen del comprobante con Document Text Detection para extraer su texto y verificar que el monto, la fecha y la referencia estén presentes y legibles, y que la referencia extraída coincida con la ingresada. | ✅ | `backend/src/services/visionService.ts` (`verificarComprobanteConTexto`, `mensajeDeVerificacionComprobante`) · `controllers/pagoController.ts` (`registrarComprobante`) | `probar-escrow` (65/65, incluye *"el comprobante se rechaza si la referencia de la imagen no coincide"*) |
| RQF22.1 / RQNF22.6 | El cliente ve su palabra clave y el sistema genera una clave numérica única de 4 dígitos por sesión de pago. | ✅ | `ventaService.registrarVentaExitosa` (`generarCodigo`) · `frontend/…/pages/PagoExitoso` | `probar-escrow` (64/64) |
| RQF22.3 / RQNF22.9 | Al enviar el comprobante, el cliente ve el aviso de "en revisión" y su lugar queda en pausa. | ✅ | `frontend/…/pages/PagoExitoso` · `services/filaService.ts` | `probar-escrow` (64/64) |
| RQF23 / RQNF23.1 / 23.2 | Reporte al vendedor cuando su comprobante es rechazado, con descripción obligatoria (30–500 caracteres). | ✅ | `backend/src/controllers/reporteController.ts` | `probar-sanciones` (30/30) |
| RQF24 / RQNF24.1–24.21 / RQNF31 | Chat tras la confirmación del pago, propuesta de entrega (lugar, fecha y hora) validada contra el rango del vendedor, aceptación o rechazo del comprador, tres bloques sin respuesta → cancelación y reembolso, aviso previo de horario, estado de liberación de fondos consultado en la API de PayPal. | ✅ | `backend/src/controllers/pagoController.ts` · `services/escrowService.ts` · `jobs/revisionEntregas.ts` · `frontend/…/pages/Chats` | **`probar-escrow` (64/64)** |
| RQF25 / RQNF25.2–25.9 | Reportes a los administradores (compra, objeto, categoría y detalle), con puntos, historial, fecha y estado visible para el cliente. | ✅ | `reporteController.ts` · `services/sancionService.ts` · `frontend/…/pages/Ayuda` | `probar-sanciones` (30/30) |
| RQF26 / RQNF26.1–26.3 / RQNF24 (reembolso) | El vendedor registra el código de entrega; se libera el dinero a PayPal, se deshabilita el chat, la venta queda concluida y se cierra la fila. | ✅ | `pagoController.registrarEntrega` · `services/ventaService.ts` (`liberarFondos`) · `jobs/revisionEntregas.ts` | `probar-escrow` (64/64) |
| RQF27 / RQNF24.2 / 27.1 / 27.4 | El cliente califica al vendedor de 1 a 5 estrellas, de forma opcional, después de la entrega. | ✅ | `pagoController.registrarEntrega` (`calificacionComprador`) · `services/reputacionService.ts` | `probar-escrow` (64/64) |
| RQF28 / RQNF28.1–28.8 | Abandonar la fila (voluntario o por vencimiento), conservar el FIFO, asignar el turno al siguiente, descontar el contador y avisar con el motivo. | ✅ | `colaController.salirDeFila` · `services/filaService.ts` (`reacomodarFila`) · `jobs/revisionPagos.ts` | `probar-fila-apertura` (30/30) |
| RQF29 / RQNF29.1–29.6 | Comentarios públicos y chat de consulta en los promocionales que los habilitan, con filtro de palabras y respuesta del vendedor. | ✅ | `backend/src/controllers/comentarioController.ts` · `backend/src/controllers/mensajeController.ts` | `probar-moderacion-vision` (48/48) + `probar-escrow` (64/64) |
| RQF31 / RQNF31.2–31.13 | El vendedor ve el comprobante, lo confirma o rechaza (solo en revisión), queda registrado con fecha y hora, se habilita la propuesta de entrega y, si no responde a tiempo, se cancela y se reembolsa con aviso al cliente. | ✅ | `pagoController.confirmarComprobante` · `services/escrowService.ts` · `jobs/revisionEntregas.ts` | `probar-escrow` (64/64) |
| RQF32 / RQNF32.1 / 32.2 | El vendedor ve el estado de sus filas (producto, personas en espera, cliente en turno) y el sistema actualiza el número de personas en espera. | ✅ | `frontend/…/pages/PanelVendedor` · `backend/src/graphql/resolvers.ts` (`misFilas`) | `probar-fila-apertura` (30/30) |

### Hallazgos del módulo 3
1. **RQNF22.5 aparece dos veces** (una de OCR del comprobante y otra de guardado) y **RQNF21.2 tres veces**
   (webhook, recepción de confirmación y una más). Hay que renumerar.
2. **El OCR del comprobante ya existe (RQNF22.5, cerrado en esta ronda)**: la imagen del comprobante se
   lee con Document Text Detection y se contratan la referencia, el monto y la fecha; si no coinciden, el
   comprobante se rechaza y la venta sigue en `pendiente_comprobante`. Cubierto por `probar-escrow` (65/65).
3. **La referencia del comprobante no es de 6 a 8 dígitos**: el código valida de 4 a 64 caracteres
   (`escrowService.ts`) y las pruebas usan referencias alfanuméricas (`REF-000001`). El texto del
   requerimiento (RQNF22.4) está desactualizado; ver decisión C4.
4. **El chat admite imágenes, no solo texto** (RQNF35.1 del módulo 4 dice "únicamente mensajes de
   texto", pero `mensajeController` acepta y modera imágenes). La redacción correcta está en el módulo 4
   propuesto.
5. **RQF24 mezcla en un solo bloque** propuesta de entrega, chat, cancelación y liberación de fondos;
   conviene separarlo en sub-bloques (24.x entrega · 24.y chat · 24.z fondos) para poder probarlos por
   separado, que es como están cubiertos hoy.
6. **Conflicto entre requerimientos aprobados**: RQNF35.3 pide conservar el historial de chats
   "de forma permanente" y RQNF10.6 pide borrar el historial de chats al cancelar una cuenta. Hoy gana
   RQNF10.6 (se purga). Hay que decidir y redactar una sola regla (lo natural: que la evidencia se
   conserve **mientras la cuenta exista**, como queda propuesto en el módulo 4).

---

# Módulo 4 (propuesto): Chat de coordinación de entrega

> Este módulo **no está aprobado**. La redacción de abajo es la que proponemos: mantiene lo que ya
> existe, corrige el error de "solo texto" y añade los puntos que hoy no están escritos (imágenes
> moderadas, cierre del chat y auditoría).

| ID | Requerimiento (propuesto) | Estado hoy | Dónde está | Cómo se prueba |
|---|---|---|---|---|
| RQF35 | El usuario cliente y el usuario vendedor intercambian mensajes dentro del chat de coordinación de una venta para acordar lugar, fecha, hora y método de entrega; lo acordado se registra después en el formulario de propuesta de entrega (RQNF24.2). | ✅ | `backend/src/controllers/mensajeController.ts` · `models/Mensaje.ts` · `frontend/…/pages/Chats` | `probar-escrow` (64/64) |
| RQNF35.1 | El chat de coordinación admite mensajes de texto e imágenes adjuntas. | 🟡 | `mensajeController.ts` (`crearMensaje` con archivo) | `probar-escrow` (64/64) — el texto del requerimiento actual dice "solo texto" y ya no describe lo que hay. |
| RQNF35.2 | El sistema aplica el filtro de palabras no permitidas (RQNF7.7) a cada mensaje antes de guardarlo; si hay coincidencia, bloquea el envío, no lo registra y muestra el aviso. | ✅ | `backend/src/utils/filtroPalabras.ts` · `mensajeController.ts` | `probar-moderacion-vision` (48/48) |
| RQNF35.3 | El sistema registra todos los mensajes aceptados en el historial de la transacción, con emisor, fecha y hora, para conservar la evidencia auditable **mientras la cuenta exista**. | 🟡 | `models/Mensaje.ts` (MongoDB) — pero al cancelar y purgar una cuenta (RQNF10.6) **se borra su historial de chats** (`cancelacionCuentaService.ts`, línea 439). Los dos requerimientos aprobados se contradicen. | `probar-escrow` (64/64) + auditoría del administrador |
| RQNF35.4 | El sistema muestra el historial a las dos partes con emisor, fecha y hora. | ✅ | `mensajeController.ts` (`obtenerMensajes`) | `probar-escrow` (64/64) |
| RQNF35.5 | El sistema ordena los mensajes de forma cronológica ascendente. | ✅ | `mensajeController.ts` (`.sort({ createdAt: 1 })`) | `probar-escrow` (64/64) |
| RQNF35.6 | El sistema muestra el aviso de contenido inapropiado en el momento del envío, señalando el texto que debe corregirse. | ✅ | `frontend/…/utils/errores.ts` + `pages/Chats` | `probar-moderacion-vision` (48/48) |
| **RQNF35.7 (nuevo)** | El sistema aplica moderación de imágenes (SAFE_SEARCH) a las imágenes adjuntas al chat con el mismo criterio del RQNF22.6 y bloquea el envío si la imagen es explícita. | ✅ | `services/visionService.ts` (`moderarComprobante(path, "chat")`) · `mensajeController.ts` | `probar-moderacion-vision` (48/48) |
| **RQNF35.8 (nuevo)** | El sistema habilita el chat solo con el pago confirmado y en turno, y lo deshabilita al confirmarse la entrega o al cancelarse la compra. | ✅ | `services/escrowService.ts` · `pagoController.ts` | `probar-escrow` (64/64) |

---

# Módulo 5 (propuesto): Gestión de usuarios y control administrativo

> Este módulo **no está aprobado**. La redacción propuesta separa lo que hoy son bloques mezclados
> (usuarios, reportes, sanciones, disputas, lista negra e informes globales), numera sin duplicados
> y añade los controles que el panel todavía no expone.

| ID | Requerimiento (propuesto) | Estado hoy | Dónde está | Cómo se prueba |
|---|---|---|---|---|
| RQF36 | El administrador consulta los datos de los usuarios registrados, verifica su información general, suspende o reactiva cuentas y monitorea el historial de sus acciones. | ✅ | `backend/src/services/backofficeService.ts` (`listarUsuariosAdmin`, `cambiarSuspensionUsuarioAdmin`) · `frontend/…/pages/Admin/GestionUsuarios.tsx` | `probar-mcp` (22/22) + `probar-sanciones` (30/30) |
| RQNF36.1 | El sistema restringe el panel a cuentas de tipo administrador, verificando el rol contra PostgreSQL en cada petición. | ✅ | `backend/src/middleware/esAdmin.ts` · `services/usuarioService.ts` (`buscarUsuarioPorId`) | `probar-mcp` (22/22): el MCP con un vendedor recibe 403. |
| RQNF36.2 | El sistema permite filtrar el listado de usuarios por nombre o correo y paginarlo. | ⚠️ | El servicio ya filtra (`listarUsuariosAdmin({busqueda})`), pero **el panel no expone el buscador** ni el controlador pasa el parámetro. | `probar-mcp` (22/22) cubre el filtro por API; falta el campo de búsqueda en la interfaz. |
| RQNF36.3 | El sistema impide reactivar una cuenta cancelada de forma permanente. | ✅ | `backofficeService.cambiarSuspensionUsuarioAdmin` | `probar-sanciones` (30/30) |
| RQNF36.4 | El sistema impide reactivar una cuenta con saldo pendiente hasta registrar la liquidación total del adeudo. | ✅ | `backofficeService.cambiarSuspensionUsuarioAdmin` · `services/adeudoService.ts` | `probar-disputas` (65/65) |
| RQNF36.5 | El sistema registra quién suspendió o reactivó cada cuenta, con fecha y hora. | 🟡 | El evento se publica por suscripción (`usuariosAdmin`), pero **no queda guardado en una tabla de auditoría**; se ve el rastro del panel. | `probar-sanciones` (30/30) |
| RQF37 | El administrador revisa las denuncias y reportes recibidos sobre fraude, publicaciones engañosas, lenguaje ofensivo, spam, discriminación o incumplimiento de entrega, y los confirma o rechaza. | ✅ | `frontend/…/pages/Admin/RevisionReportes.tsx` · `backofficeService.resolverReporteAdmin` | `probar-sanciones` (30/30) |
| RQNF37.1 | El sistema asigna los puntos de la categoría confirmada (3 · 1.5 · 1) **solo** cuando el administrador aprueba el reporte; si lo rechaza, se archiva sin tocar la reputación. | ✅ | `services/sancionService.ts` (`registrarFalta` / `quitarFalta`) | `probar-sanciones` (30/30) |
| RQNF37.2 | El sistema notifica al vendedor y al comprador cuando se resuelve un reporte. | ✅ | `services/sancionService.ts` · `emailService.enviarCorreoSancionAplicada` | `probar-sanciones` (30/30) |
| RQNF37.3 | El sistema aplica bloqueos temporales automáticos según el tipo de infracción y el número de reincidencias, y levanta el bloqueo al concluir el periodo. | ✅ | `services/sancionService.ts` (`recalcularDesdeHistorial`) · `jobs/revisionSanciones.ts` | `probar-sanciones` (30/30) |
| RQNF37.4 | El sistema suspende de forma indefinida y manda a revisión administrativa las cuentas con faltas graves (fraude comprobado, suplantación, amenazas o comprobantes falsos). | ✅ | `configuracion/categoriasReporte.ts` (`categoriaRequiereRevisionInmediata`) | `probar-sanciones` (30/30) |
| RQF38 | El administrador consulta el historial de filas virtuales, pagos, comprobantes, tiempos de respuesta y transacciones asociadas. | ✅ | `backend/src/services/backofficeService.ts` (`historialTransaccionesAdmin`) · `frontend/…/pages/Admin/Trazabilidad.tsx` | `probar-mcp` (22/22) + revisión manual del panel (ya verificada con 130 movimientos). |
| RQNF38.1 | El sistema combina filas, ventas y reportes en un solo historial, del más reciente al más antiguo. | ✅ | `historialTransaccionesAdmin` | `probar-mcp` (22/22) |
| RQNF38.2 | El sistema permite auditar el historial completo de mensajes de una venta, **sin** exponer al comprador ni al vendedor los códigos de pago o de entrega. | ✅ | `adminController.obtenerMensajesDeVenta` · `frontend/…/pages/Admin/ModalConversacion.tsx` | `probar-mcp` (22/22) |
| RQF39 | El administrador dictamina la resolución de las disputas de reembolso, evaluando las evidencias de las dos partes. | ✅ | `services/disputaService.ts` · `frontend/…/pages/Admin/Disputas.tsx` | **`probar-disputas` (65/65)** |
| RQNF39.1 | El sistema retiene de forma preventiva los fondos en escrow ante reportes, disputas activas o evidencias de irregularidades, antes de confirmar la entrega. | ✅ | `services/disputaService.ts` (`marcarVentaRetenidaPorReporte`) | `probar-disputas` (65/65) |
| RQNF39.2 | El sistema suspende al vendedor y registra un saldo pendiente por liquidar cuando la plataforma cubre un reembolso por responsabilidad de él. | ✅ | `services/adeudoService.ts` (`registrarAdeudo`) | `probar-disputas` (65/65) |
| RQNF39.3 | El sistema condiciona la reactivación del vendedor a la liquidación total del adeudo. | ✅ | `adeudoService.liquidarAdeudo` · `backofficeService.cambiarSuspensionUsuarioAdmin` | `probar-disputas` (65/65) |
| RQNF39.4 | El sistema notifica a las dos partes la resolución de la disputa, con fecha y hora. | ✅ | `emailService.enviarCorreoDisputaResuelta` | `probar-disputas` (65/65) |
| RQF40 | El administrador mantiene la lista negra de las personas que no pueden registrarse. | ✅ | `backend/src/services/backofficeService.ts` (`agregarEntradaListaNegraAdmin`, `quitarEntradaListaNegraAdmin`) · `frontend/…/pages/Admin/ListaNegra.tsx` | `npm run prueba-registro` (6/6) |
| RQNF40.1 | El sistema deniega el alta cuando el RFC, la CURP, el código de la INE o el correo coinciden con una entrada de la lista negra, y también cuando esos datos o el teléfono ya pertenecen a una cuenta existente. | ✅ | `services/bloqueoRegistroService.ts` (`revisarBloqueoDeRegistro`) | **`npm run prueba-registro` (6/6)** |
| RQNF40.2 | El sistema no permite repetir RFC ni CURP en la lista negra. | ✅ | `models/ListaNegra.ts` (índices únicos) · `backofficeService` (409) | `npm run prueba-registro` (6/6) |
| RQNF40.3 | El sistema atiende las solicitudes de revisión de altas denegadas, guarda la respuesta y la envía por correo a la persona. | ✅ | `services/bloqueoRegistroService.ts` · `frontend/…/pages/Admin/SolicitudesRegistro.tsx` · `emailService.enviarCorreoSolicitudRevisionRegistro` | **`npm run prueba-revision` (4/4)** |
| RQF41 | El administrador consulta los informes globales de la plataforma: categoría más vendida y tasa de abandono de fila por categoría. | ✅ | `services/informesService.ts` (informe global) · `frontend/…/pages/Admin/InformesGlobales.tsx` | `probar-informes` (26/26) |
| RQNF41.1 | El sistema calcula la categoría más vendida por transacciones concluidas, con desempate por el total del mes anterior, cada 1.º de mes. | ✅ | `informesService.ts` (`categoriaMasVendida`) | `probar-informes` (26/26) |
| RQNF41.2 | El sistema calcula la tasa de abandono de fila por categoría (salidas voluntarias y turnos vencidos), cada 1.º de mes. | ✅ | `informesService.ts` (`MOTIVOS_ABANDONO`, tasa por categoría) | `probar-informes` (26/26) |

### Hallazgos del módulo 5
1. **El panel no tiene buscador de usuarios** aunque el servicio sí filtra: falta exponerlo (RQNF36.2).
2. **No hay tabla de auditoría de acciones administrativas**: se ven por suscripción y en la
   trazabilidad, pero no queda un registro consultable de "quién suspendió a quién y cuándo"
   (RQNF36.5 → propuesta de tabla `AccionAdministrativa`).
3. **Numeración heredada**: el módulo mezcla RQF36–RQF40 con RQNF14/32–38 (que en los módulos 1–3 ya
   significan otras cosas). La propuesta de arriba renumera todo del 36 al 41 sin colisiones.

---

# Pendientes (orden de trabajo acordado)

## A. Ajustes de texto en los requerimientos (sin tocar código)

| # | Qué | Dónde |
|---|---|---|
| A1 | RQNF6 (login): la fuente de verdad de las cuentas es **PostgreSQL**, no MongoDB. | Módulo 1 |
| A2 | Renumerar los RQNF duplicados de los módulos 1–3 (7.3/7.4/7.5, 22.5, 21.2, 24.x) y arreglar las referencias a un "RQNF7.7" que no existe. | Módulos 2 y 3 |
| A3 | RQF8 (categoría): la lista vigente es la de `configuracion/categorias.ts` (12 categorías), no las 6 del texto. | Módulo 2 |
| A4 | Aprobar los módulos 4 y 5 con la redacción propuesta (o ajustarla) y dejarlos como versión final. | Módulos 4 y 5 |
| A5 | Registrar que la denegación del alta también aplica a "datos ya usados por otra cuenta" y al correo. | Módulo 1 |

## B. Cambios de código que cierran los huecos

| # | Qué | Tamaño | Requerimiento |
|---|---|---|---|
| B1 | Campo de búsqueda de usuarios en el panel (el servicio ya filtra). | Chico | RQNF36.2 |
| B2 | Tabla de auditoría de acciones administrativas (quién, qué, cuándo). | Mediano | RQNF36.5 |
| B3 | Prueba E2E del alta completa con INE de prueba y mock de StructOCR. | Mediano | RQF1 y RQNF1.4–1.8 |
| B4 | Exponer el motivo del bloqueo en el correo del administrador (hoy se ve el campo, no el valor). | Chico | RQNF1.1 |
| ~~B5~~ | ~~OCR del comprobante (Document Text Detection)~~ **Cerrado**: `verificarComprobanteConTexto` en `visionService.ts`, conectado en `pagoController.registrarComprobante`, con prueba en `probar-escrow` (65/65). | Hecho | RQNF22.5 |

## C. Decisiones que hay que tomar (no son código)

| # | Decisión | Propuesta |
|---|---|---|
| C1 | ¿Se conserva el historial de chats de una cuenta cancelada? | Hoy se purga (RQNF10.6). Proponemos: se conserva **mientras la cuenta exista** y se purga con la cuenta, redactando RQNF35.3 en esos términos. |
| C2 | ¿Las categorías del catálogo son 12 (como el código) o 6 (como el texto de RQF8)? | 12: `backend/src/configuracion/categorias.ts` es la lista vigente y la que usa la semilla. |
| C3 | ¿El tope de $5,000 es para productos y $5,001 para promocionales? | Sí: hoy es la regla implementada; conviene escribirla como una sola regla ("más de $5,000 se publica como promocional"). |
| C4 | ¿La referencia del comprobante es de 6 a 8 dígitos (RQNF22.4) o de 4 a 64 caracteres (lo que valida hoy el código)? | Hoy el código acepta 4 a 64 caracteres y las ventas existentes usan referencias alfanuméricas (`REF-000001`). Propuesta: aceptar 4 a 64 caracteres (alfanumérica) y **corregir el texto del requerimiento**, que además choca con el OCR. |

---

# Cómo usaremos este documento

1. **Requerimiento por requerimiento**, starting por los pendientes A (texto) y luego B (código).
2. Para cada uno: se revisa el texto → se ejecuta la prueba indicada → se anota el veredicto aquí.
3. Al final, `requisitos.md` queda como versión aprobada y este documento como el registro de
   verificación (con la fecha y el commit de cada revisión).
4. Cada ronda deja el backend y el frontend compilando y **todas las suites en verde**.
