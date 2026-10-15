import { useCallback, useEffect, useState } from "react";
import {
  fetchAdeudosAdmin,
  liquidarAdeudoAdmin,
  textoCausaAdeudo,
  type AdeudoAdmin,
  type RespuestaAdeudos,
} from "../../services/adminService";
import {
  suscribirse,
  type EventoUsuario,
} from "../../services/suscripcionesService";
import { mensajeDeError } from "../../utils/errores";
import "./Adeudos.css";

/**
 * Fase 7b (RQNF37 / RQNF38): adeudos que los vendedores tienen con la
 * plataforma por reembolsos cubiertos por su culpa. La cuenta del vendedor
 * queda suspendida con saldo pendiente y solo se reactiva cuando la
 * administración registra la liquidación total (el pago se hace por fuera,
 * por transferencia).
 */

const CONSULTA_USUARIOS = `
  subscription AdeudosEnVivo {
    usuariosAdmin {
      tipo mensaje generadoEn
      usuario { id nombreCompleto correo suspendido }
    }
  }
`;

const POR_PAGINA = 10;

const dinero = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

const fechaFormato = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function Adeudos() {
  const [datos, setDatos] = useState<RespuestaAdeudos | null>(null);
  const [pagina, setPagina] = useState(1);
  const [estado, setEstado] = useState("pendiente");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [accionEnCurso, setAccionEnCurso] = useState<string | null>(null);

  const cargar = useCallback(
    async (silencioso = false, paginaPedida = pagina, estadoPedido = estado) => {
      if (!silencioso) setCargando(true);
      setError("");
      try {
        setDatos(
          await fetchAdeudosAdmin(
            paginaPedida,
            POR_PAGINA,
            estadoPedido || undefined,
          ),
        );
      } catch (err) {
        setError(mensajeDeError(err) || "No pudimos cargar los adeudos");
      } finally {
        if (!silencioso) setCargando(false);
      }
    },
    [pagina, estado],
  );

  useEffect(() => {
    cargar(false, pagina, estado);

    // RQNF37/RQNF38: los adeudos se publican por el canal de usuarios del
    // BackOffice; con cada evento se relee el listado.
    return suscribirse<EventoUsuario>(
      CONSULTA_USUARIOS,
      "usuariosAdmin",
      (evento) => {
        setAviso(evento.mensaje);
        cargar(true, pagina, estado);
      },
      (err) => console.warn("Suscripción de usuarios no disponible:", err),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, estado]);

  async function liquidar(adeudo: AdeudoAdmin) {
    const confirmado = window.confirm(
      `¿Registrar la liquidación de ${dinero.format(adeudo.monto)} de ${adeudo.vendedorNombre || `#${adeudo.usuarioId}`}? Si con esta liquidación su saldo llega a cero, la suspensión por saldo se levantará automáticamente (RQNF38).`,
    );
    if (!confirmado) return;

    setError("");
    setAviso("");
    setAccionEnCurso(adeudo.id);

    try {
      const respuesta = await liquidarAdeudoAdmin(adeudo.id, notas[adeudo.id]);
      setAviso(respuesta.message);
      await cargar(true, pagina, estado);
    } catch (err) {
      setError(mensajeDeError(err) || "No pudimos registrar la liquidación");
    } finally {
      setAccionEnCurso(null);
    }
  }

  if (cargando && !datos) {
    return <p className="admin-adeudos__vacio">Cargando adeudos…</p>;
  }

  const adeudos = datos?.adeudos ?? [];

  return (
    <div className="admin-adeudos">
      <div className="admin-adeudos__cabecera">
        <h2>Adeudos de vendedores</h2>
        <span>
          Saldo pendiente total: {dinero.format(datos?.pendienteTotal ?? 0)} ·{" "}
          {datos?.total ?? 0} registro(s)
        </span>
        <select
          className="admin-adeudos__filtro"
          value={estado}
          onChange={(evento) => {
            setPagina(1);
            setEstado(evento.target.value);
          }}
        >
          <option value="pendiente">Solo pendientes</option>
          <option value="">Todos</option>
          <option value="liquidado">Liquidados</option>
        </select>
        <button
          type="button"
          className="admin-adeudos__actualizar"
          onClick={() => cargar(false, pagina, estado)}
          disabled={cargando}
        >
          {cargando ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      <p className="admin-adeudos__nota">
        RQNF37: cada adeudo nace de un reembolso que la plataforma cubrió por
        culpa directa del vendedor. RQNF38: su cuenta queda suspendida con el
        saldo pendiente y solo se reactiva al registrar aquí la liquidación
        total (el cobro se hace por transferencia, fuera de la aplicación).
      </p>

      {error && <p className="admin-adeudos__error">{error}</p>}
      {aviso && <p className="admin-adeudos__aviso">{aviso}</p>}

      {adeudos.length === 0 ? (
        <p className="admin-adeudos__vacio">
          {estado === "pendiente"
            ? "No hay adeudos pendientes de liquidar."
            : "No hay adeudos que coincidan con el filtro."}
        </p>
      ) : (
        <ul className="admin-adeudos__lista">
          {adeudos.map((adeudo) => (
            <li key={adeudo.id} className="admin-adeudos__item">
              <div className="admin-adeudos__titulo">
                <h3>
                  {adeudo.vendedorNombre || `Vendedor #${adeudo.usuarioId}`} ·{" "}
                  {dinero.format(adeudo.monto)}
                </h3>
                <span
                  className={`admin-adeudos__estado admin-adeudos__estado--${adeudo.estado}`}
                >
                  {adeudo.estado === "pendiente" ? "Pendiente" : "Liquidado"}
                </span>
              </div>

              <p className="admin-adeudos__meta">
                Venta #{adeudo.ventaIdPg} ·{" "}
                {adeudo.productoNombre || "Producto"} · Causa:{" "}
                {textoCausaAdeudo(adeudo.causa)} ·{" "}
                {fechaFormato.format(new Date(adeudo.fecha))}
              </p>

              <p className="admin-adeudos__motivo">{adeudo.motivo}</p>

              {adeudo.estado === "liquidado" && (
                <div className="admin-adeudos__resolucion">
                  <p>
                    Liquidado por {adeudo.liquidadoPor ?? "la administración"}
                    {adeudo.liquidadoEn
                      ? ` el ${fechaFormato.format(new Date(adeudo.liquidadoEn))}`
                      : ""}
                  </p>
                  {adeudo.nota && <p>Nota: {adeudo.nota}</p>}
                </div>
              )}

              {adeudo.estado === "pendiente" && (
                <div className="admin-adeudos__acciones">
                  <input
                    type="text"
                    className="admin-adeudos__nota-campo"
                    placeholder="Referencia de la transferencia (opcional)"
                    value={notas[adeudo.id] ?? ""}
                    onChange={(evento) =>
                      setNotas((anteriores) => ({
                        ...anteriores,
                        [adeudo.id]: evento.target.value,
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="admin-adeudos__liquidar"
                    disabled={accionEnCurso === adeudo.id}
                    onClick={() => liquidar(adeudo)}
                  >
                    Registrar liquidación
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {(datos?.totalPaginas ?? 1) > 1 && (
        <div className="admin-adeudos__paginacion">
          <button
            type="button"
            disabled={pagina <= 1}
            onClick={() => setPagina((actual) => Math.max(actual - 1, 1))}
          >
            ← Anterior
          </button>
          <span>
            Página {datos?.pagina ?? 1} de {datos?.totalPaginas ?? 1}
          </span>
          <button
            type="button"
            disabled={pagina >= (datos?.totalPaginas ?? 1)}
            onClick={() => setPagina((actual) => actual + 1)}
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}

export default Adeudos;
