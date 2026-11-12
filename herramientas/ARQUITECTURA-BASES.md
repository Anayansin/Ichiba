# Las dos bases de datos de Ichiba: qué guarda cada una

## La respuesta corta

**No son dos copias de lo mismo: cada dato tiene un solo dueño.** Antes de esta
ronda el proyecto tenía espejos (las cuentas y las ventas se guardaban en
PostgreSQL *y* en MongoDB), lo que provocaba que el login, el panel y los chats
pudieran ver datos distintos. **Esos espejos ya no existen.**

```
PostgreSQL  =  cuentas · filas virtuales · ventas y escrow · reportes
MongoDB     =  catálogo · chats · documentos (sanciones, adeudos, disputas,
               lista negra, solicitudes de revisión, informes, comentarios,
               suscripciones y vínculos de PayPal)
```

## Por qué dos motores

| | PostgreSQL (relacional) | MongoDB (no relacional) |
|---|---|---|
| Ventajas | Transacciones (una venta y su saldo se guardan o no se guardan), claves foráneas, integridad referencial, agregaciones SQL | Documentos flexibles: cada chat, cada producto o cada informe puede tener su propia forma sin cambiar el esquema |
| En Ichiba | Cuentas, filas, ventas (con el ciclo del escrow), reportes, puntos y adeudos | Catálogo (productos y promocionales), chats y su índice de conversaciones, y los documentos que cambian de forma |
| Por qué | El dinero, los saldos y los puntos no pueden guardarse "a medias" | El catálogo y los chats son documentos que se leen mucho y cambian de forma |

## Mapa de quién manda

| Dato | Dueño | Quién lo lee |
|---|---|---|
| Cuentas (`usuario`), contraseñas, rol, suspensión, adeudos | **PostgreSQL** | Login, panel, GraphQL, suscripciones y el trabajo de horarios |
| Filas virtuales (`cola`) | **PostgreSQL** | Rutas de fila, pagos, GraphQL y panel |
| Ventas y escrow (`venta`) | **PostgreSQL** | Escrow, reportes, disputas, historial del panel y MCP |
| Reportes (`reporte`) | **PostgreSQL** | Panel de reportes pendientes y trazabilidad |
| Catálogo (`products`, `promocionals`) | **MongoDB** | REST, GraphQL y la portada de `front-astro` |
| Chats (`mensajes`) | **MongoDB** | Chat de comprador y vendedor |
| Conversaciones (`ventas` en Mongo) | **MongoDB** | Índice del chat: es la lista de conversaciones con su estado visible. El estado financiero vive en PostgreSQL |
| Documentos (`sancions`, `adeudos`, `disputas`, `listanegras`, `solicitudregistrobloqueados`, `informeglobals`, `informevendedors`, `comentarios`, `suscripcions`, `vinculopaypals`) | **MongoDB** | BackOffice, GraphQL y la interfaz |

## Si editas a mano

1. Cada dato tiene un dueño: edítalo **solo ahí**.
2. Cuentas → PostgreSQL. Catálogo, chats y documentos → MongoDB.
3. Después de editar una cuenta a mano, comprueba que el panel la vea igual:
   `cd backend && npm run datos -- sql "SELECT id, correo, tipo FROM usuario ORDER BY id"`.
4. En producción, MongoDB Atlas se ve desde `cloud.mongodb.com` y PostgreSQL desde la
   pestaña *Data* de Railway. Haz copia antes de tocar nada.

## Qué cambió en esta ronda

- El login, el panel de usuarios, el dashboard, las sanciones, los adeudos, las
  disputas, el trabajo de horarios, el servidor MCP y las GraphQL de usuarios y
  filas leen **PostgreSQL**.
- Se agregaron a `usuario` las columnas que antes vivían en el espejo:
  `metodoPago`, `suspendido`, `motivoSuspension`, `saldoPendiente`,
  `sancionHasta`, `sancionPermanente` y `revisionAdministrativa`
  (migración `20261112T0023_cuentas_completas_en_postgres`).
- Se borraron las colecciones `usuarios`, `colas` y `reportes` de MongoDB: eran
  espejos o restos del modelo anterior y no las leía nadie (por eso la
  trazabilidad y las filas en vivo del panel se veían vacías).
- El cliente de PostgreSQL (`backend/src/configuracion/prisma.ts`) ahora acepta
  `skip`, `limit`, `contains`, `gte`, `lte`, `gt`, `lt`, `ne` y comparaciones
  sin distinguir mayúsculas, que antes solo existían en MongoDB.

## Verificación

Suites de pruebas del backend (todas en verde tras la migración):

| Suite | Pruebas |
|---|---|
| Fase 0 — comisión y PayPal | 7 |
| Fase 1 — escrow | 64 |
| Fase 2 — puntos y cancelación | 48 |
| Fase 3 — informes | 26 |
| Fase 4 — suscripciones GraphQL | 11 |
| Fase 5 — servidor MCP | 22 |
| Fase 7a — sanciones | 30 |
| Fase 7b — disputas y adeudos | 65 |
| Fase 7c — fila y apertura | 30 |
| Moderación | 48 |
| Bloqueo de alta (RQNF1.9) | 6 |
| Solicitud de revisión (RQNF1.9) | 4 |

Además: `npm run prueba-registro` (bloqueo del alta) y `npm run prueba-revision`
(solicitud de revisión de un alta denegada).
