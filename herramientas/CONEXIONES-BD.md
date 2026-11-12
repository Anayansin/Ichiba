# Conexiones a las bases de datos de Ichiba

Todo lo que necesitas para abrir y editar las bases a mano, con ventana (sin terminal).

| Dato | PostgreSQL (relacional) | MongoDB (no relacional) |
|---|---|---|
| Servidor | `127.0.0.1` | `127.0.0.1` |
| Puerto | `5432` | `27017` |
| Base de datos | `mi_base_datos` | `ichiba` |
| Usuario | `postgres` | (ninguno) |
| Contraseña | `postgres` | (ninguna) |
| Driver / URI | PostgreSQL | `mongodb://127.0.0.1:27017/ichiba` |

En producción: MongoDB Atlas (`cloud.mongodb.com`, con las credenciales de `MONGO_URI_ATLAS`)
y PostgreSQL en Railway (pestaña **Data** del servicio).

## Herramientas instaladas

| Herramienta | Para qué | Dónde quedó |
|---|---|---|
| **MongoDB Compass** | Ver y editar documentos de MongoDB (catálogo, chats, listas negras) | Escritorio → *MongoDB Compass* (`C:\Program Files\MongoDB Compass\MongoDBCompass.exe`) |
| **DBeaver Community** | Ver y editar **las dos** bases (PostgreSQL y MongoDB) en la misma app | Escritorio → *DBeaver* (`%LOCALAPPDATA%\DBeaver\dbeaver.exe`) |
| **pgAdmin 4** | Alternativa gráfica para PostgreSQL | Escritorio → *pgAdmin 4* (`%LOCALAPPDATA%\Programs\pgAdmin 4\runtime\pgAdmin4.exe`) |
| **MongoDB Shell (mongosh)** | Consola de MongoDB | Ya está en el PATH: `mongosh` |
| **psql** | Consola de PostgreSQL | Ya está en el PATH: `psql` |

### En DBeaver las conexiones ya están creadas

Abre DBeaver y entra a la pestaña **Conexiones** (arriba a la izquierda). Ahí aparecen:

- **Ichiba PostgreSQL** — `127.0.0.1:5432` (base `mi_base_datos`, usuario y contraseña `postgres`)
- **Ichiba MongoDB** — `127.0.0.1:27017` (base `ichiba`)

Despliega la flecha ▶ de cada una para ver las tablas o las colecciones. Para modificar un dato:
doble clic en la tabla → pestaña **Datos** → edita la celda → guarda con Ctrl+S.

> La primera vez que abras **Ichiba MongoDB**, DBeaver pide descargar la extensión de
> MongoDB (necesita internet): pulsa *Download* y en un minuto queda lista. Si prefieres
> no depender de eso, usa **MongoDB Compass** para MongoDB (ahí solo pegas
> `mongodb://127.0.0.1:27017/ichiba`) y DBeaver para PostgreSQL.

Si algún día se borra el espacio de trabajo, se recrean en menos de un minuto:
*Database* → **New Database Connection** → *PostgreSQL* (host `127.0.0.1`, puerto `5432`,
base `mi_base_datos`, usuario `postgres`, contraseña `postgres`) y otra para *MongoDB*
(URI `mongodb://127.0.0.1:27017/ichiba`).

## Crear las conexiones en DBeaver (una sola app para ambas)

1. Abre **DBeaver** → *Database* → **New Database Connection**.
2. **PostgreSQL**: escribe `127.0.0.1`, puerto `5432`, base `mi_base_datos`,
   usuario `postgres`, contraseña `postgres` → *Test Connection* → *Finish*.
3. **MongoDB**: elige el driver *MongoDB*, pega la URI
   `mongodb://127.0.0.1:27017/ichiba` → *Test Connection* → *Finish*.
4. Para ver los datos: doble clic en la conexión → *Database* → *Schemas/Tables*.

En **Compass**: *New Connection* → pega `mongodb://127.0.0.1:27017/ichiba` → *Connect*.
En la colección `usuarios` puedes editar documentos con doble clic (guarda con Ctrl+S) y
filtrar con el filtro de la izquierda.

En **pgAdmin**: *Add New Server* → host `127.0.0.1`, puerto `5432`, usuario `postgres`,
contraseña `postgres`; y *Create Database* no hace falta (ya existe `mi_base_datos`).

## Antes de tocar nada: qué hay en cada base

| Datos | Base | Nota |
|---|---|---|
| Cuentas (`usuario`), filas (`cola`), ventas (`venta`), puntos y adeudos | **PostgreSQL** | Fuente de verdad |
| Espejo de cuentas, ventas y filas | **MongoDB** | Lo leen el login, el panel, GraphQL y los chats |
| Catálogo (`products`, `promocionals`), chats (`mensajes`), reportes, disputas, listas negras, solicitudes de revisión, informes | **MongoDB** | Solo viven aquí |

> Si editas una **cuenta** en una base, replica el cambio en la otra. Desde la terminal
> (o desde `INICIAR-ICHIBA.cmd`) puedes repararlo con:
> `cd backend && npm run espejos`
> (reconstruye en MongoDB los espejos que le falten a las cuentas de PostgreSQL).

## Antes de editar en producción

- Haz una copia: en Atlas, *Database > Backup*; en Railway, el snapshot del Postgres.
- `MONGO_URI_ATLAS` apunta a la base de la nube: cualquier cambio ahí es real.
- Si cambias el rol de alguien,remember cambiarlo en **las dos** bases (PostgreSQL manda).
