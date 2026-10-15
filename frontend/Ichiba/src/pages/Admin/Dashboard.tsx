import { useCallback, useEffect, useState } from "react";
import {
  fetchResumenAdmin,
  type ResumenAdmin,
} from "../../services/adminService";
import { suscribirse } from "../../services/suscripcionesService";
import { mensajeDeError } from "../../utils/errores";
import "./Dashboard.css";

/** Los datos se vuelven a leer cada 20 segundos: siempre están en vivo. */
const INTERVALO_MS = 20000;

/** Fase 4: el resumen completo llega al instante por GraphQL Subscription. */
const CONSULTA_RESUMEN = `
  subscription ResumenEnVivo {
    resumenAdmin {
      generadoEn
      periodoMes { desde }
      usuarios {
        total activos suspendidos cancelados administradores nuevos30Dias
      }
      catalogo {
        productos { total activos }
        promocionales { total activos }
      }
      ventas {
        total ingresos
        mes { total ingresos }
        porEstado { estado total ingresos }
        ultimas { id producto vendedor monto estado fecha }
      }
      reportes { pendientes total }
      filas { activas }
      mensajes { total }
      listaNegra { total }
      ultimosUsuarios {
        id nombreCompleto correo tipo suspendido
        puntosReputacion estadoCuenta fechaRegistro
      }
    }
  }
`;

const dinero = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});
const entero = new Intl.NumberFormat("es-MX");
const horaFormato = new Intl.DateTimeFormat("es-MX", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});
const fechaFormato = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function textoEstado(estado: string): string {
  const textos: Record<string, string> = {
    completada: "Completada",
    pendiente: "Pendiente",
    expirada: "Expirada",
    cancelada: "Cancelada",
    activa: "Activa",
    esperando_confirmacion: "Esperando confirmación",
    resuelto: "Resuelto",
    suspendido: "Suspendido",
    admin: "Administrador",
    vendedor: "Vendedor",
  };
  return textos[estado] ?? estado;
}

function Tarjeta({
  etiqueta,
  valor,
  detalle,
}: {
  etiqueta: string;
  valor: string;
  detalle?: string;
}) {
  return (
    <div className="admin-dashboard__tarjeta">
      <p className="admin-dashboard__tarjeta-etiqueta">{etiqueta}</p>
      <p className="admin-dashboard__tarjeta-valor">{valor}</p>
      {detalle && (
        <p className="admin-dashboard__tarjeta-detalle">{detalle}</p>
      )}
    </div>
  );
}

function Dashboard() {
  const [resumen, setResumen] = useState<ResumenAdmin | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const datos = await fetchResumenAdmin();
      setResumen(datos);
      setError("");
    } catch (err) {
      setError(mensajeDeError(err) || "No se pudieron cargar las cifras");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    const intervalo = setInterval(cargar, INTERVALO_MS);
    return () => clearInterval(intervalo);
  }, [cargar]);

  // Fase 4: con cada cambio del backoffice (reportes, usuarios, ventas,
  // lista negra…) el servidor emite el resumen fresco y la pantalla se
  // actualiza sin recargar. La relectura cada 20 s queda como respaldo.
  useEffect(() => {
    return suscribirse<ResumenAdmin>(
      CONSULTA_RESUMEN,
      "resumenAdmin",
      (resumenNuevo) => {
        setResumen(resumenNuevo);
        setError("");
      },
      (error) =>
        console.warn(
          "Suscripción del resumen no disponible; se mantiene la relectura periódica:",
          error,
        ),
    );
  }, []);

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard__cabecera">
        <div>
          <h2>Resumen general</h2>
          <p className="admin-dashboard__vivo">
            <span className="admin-dashboard__punto" /> Datos en vivo —
            actualización instantánea por GraphQL Subscription (y relectura
            cada 20 segundos)
            {resumen && (
              <>
                {" "}
                · última lectura a las{" "}
                {horaFormato.format(new Date(resumen.generadoEn))}
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          className="admin-dashboard__actualizar"
          onClick={cargar}
          disabled={cargando}
        >
          {cargando ? "Actualizando…" : "Actualizar ahora"}
        </button>
      </div>

      {error && <p className="admin-dashboard__error">{error}</p>}

      {!resumen && !error && (
        <p className="admin-dashboard__cargando">Cargando cifras…</p>
      )}

      {resumen && (
        <>
          <section className="admin-dashboard__grupo">
            <h3>Ventas e ingresos</h3>
            <div className="admin-dashboard__tarjetas">
              <Tarjeta
                etiqueta="Ventas de este mes"
                valor={entero.format(resumen.ventas.mes.total)}
                detalle={dinero.format(resumen.ventas.mes.ingresos)}
              />
              <Tarjeta
                etiqueta="Ventas totales"
                valor={entero.format(resumen.ventas.total)}
                detalle={`${dinero.format(resumen.ventas.ingresos)} históricos`}
              />
              {resumen.ventas.porEstado.map((grupo) => (
                <Tarjeta
                  key={grupo.estado}
                  etiqueta={textoEstado(grupo.estado)}
                  valor={entero.format(grupo.total)}
                  detalle={dinero.format(grupo.ingresos)}
                />
              ))}
            </div>
          </section>

          <section className="admin-dashboard__grupo">
            <h3>Usuarios</h3>
            <div className="admin-dashboard__tarjetas">
              <Tarjeta
                etiqueta="Registrados"
                valor={entero.format(resumen.usuarios.total)}
              />
              <Tarjeta
                etiqueta="Activos"
                valor={entero.format(resumen.usuarios.activos)}
              />
              <Tarjeta
                etiqueta="Suspendidos"
                valor={entero.format(resumen.usuarios.suspendidos)}
              />
              <Tarjeta
                etiqueta="Cancelados (8 puntos)"
                valor={entero.format(resumen.usuarios.cancelados)}
              />
              <Tarjeta
                etiqueta="Nuevos (30 días)"
                valor={entero.format(resumen.usuarios.nuevos30Dias)}
              />
              <Tarjeta
                etiqueta="Administradores"
                valor={entero.format(resumen.usuarios.administradores)}
              />
            </div>
          </section>

          <section className="admin-dashboard__grupo">
            <h3>Catálogo</h3>
            <div className="admin-dashboard__tarjetas">
              <Tarjeta
                etiqueta="Productos activos"
                valor={entero.format(resumen.catalogo.productos.activos)}
                detalle={`${entero.format(resumen.catalogo.productos.total)} en total`}
              />
              <Tarjeta
                etiqueta="Promocionales activos"
                valor={entero.format(resumen.catalogo.promocionales.activos)}
                detalle={`${entero.format(resumen.catalogo.promocionales.total)} en total`}
              />
            </div>
          </section>

          <section className="admin-dashboard__grupo">
            <h3>Operación</h3>
            <div className="admin-dashboard__tarjetas">
              <Tarjeta
                etiqueta="Reportes pendientes"
                valor={entero.format(resumen.reportes.pendientes)}
                detalle={`${entero.format(resumen.reportes.total)} en total`}
              />
              <Tarjeta
                etiqueta="Filas activas"
                valor={entero.format(resumen.filas.activas)}
              />
              <Tarjeta
                etiqueta="Mensajes"
                valor={entero.format(resumen.mensajes.total)}
              />
              <Tarjeta
                etiqueta="Lista negra"
                valor={entero.format(resumen.listaNegra.total)}
              />
            </div>
          </section>

          <section className="admin-dashboard__grupo admin-dashboard__tablas">
            <div>
              <h3>Últimas ventas</h3>
              {resumen.ventas.ultimas.length === 0 ? (
                <p className="admin-dashboard__vacio">
                  Todavía no hay ventas registradas.
                </p>
              ) : (
                <table className="admin-dashboard__tabla">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Vendedor</th>
                      <th>Monto</th>
                      <th>Estado</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumen.ventas.ultimas.map((venta) => (
                      <tr key={venta.id}>
                        <td>{venta.producto}</td>
                        <td>{venta.vendedor}</td>
                        <td>{dinero.format(venta.monto)}</td>
                        <td>{textoEstado(venta.estado)}</td>
                        <td>{fechaFormato.format(new Date(venta.fecha))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div>
              <h3>Últimos usuarios</h3>
              {resumen.ultimosUsuarios.length === 0 ? (
                <p className="admin-dashboard__vacio">
                  Aún no hay usuarios registrados.
                </p>
              ) : (
                <table className="admin-dashboard__tabla">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Correo</th>
                      <th>Tipo</th>
                      <th>Estado</th>
                      <th>Alta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumen.ultimosUsuarios.map((usuario) => (
                      <tr key={usuario.id}>
                        <td>{usuario.nombreCompleto}</td>
                        <td>{usuario.correo}</td>
                        <td>{textoEstado(usuario.tipo)}</td>
                        <td>
                          {usuario.suspendido ? "Suspendido" : "Activo"}
                        </td>
                        <td>
                          {usuario.fechaRegistro
                            ? fechaFormato.format(
                                new Date(usuario.fechaRegistro),
                              )
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default Dashboard;
