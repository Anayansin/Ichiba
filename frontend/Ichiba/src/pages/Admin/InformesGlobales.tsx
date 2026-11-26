import { useEffect, useState } from "react";
import axios from "axios";
import {
  fetchInformesGlobales,
  descargarInformeGlobalPdf,
  generarInformesDelPeriodo,
  type InformeGlobal,
} from "../../services/informeService";
import "./InformesGlobales.css";

function InformesGlobales() {
  const [informes, setInformes] = useState<InformeGlobal[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [periodoManual, setPeriodoManual] = useState("");
  const [generando, setGenerando] = useState(false);
  const [descargando, setDescargando] = useState<string | null>(null);

  function cargarInformes() {
    setCargando(true);
    setError("");
    fetchInformesGlobales()
      .then(setInformes)
      .catch((err) =>
        setError(
          (axios.isAxiosError(err) && err.response?.data?.message) ||
            "No pudimos cargar los informes globales",
        ),
      )
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargarInformes();
  }, []);

  async function generarDelPeriodo() {
    const periodo = periodoManual.trim();
    if (!/^\d{4}-\d{2}$/.test(periodo)) {
      setError("Escribe el período con el formato AAAA-MM (por ejemplo 2026-09).");
      return;
    }

    setGenerando(true);
    setError("");
    setAviso("");
    try {
      const resultado = await generarInformesDelPeriodo(periodo);
      let mensaje = `${resultado.message}: ${resultado.vendedores} informe(s) de vendedor con ${resultado.ventasConsideradas} venta(s) y ${resultado.filasConsideradas} fila(s) consideradas.`;
      if (resultado.global.empate) {
        mensaje +=
          " Hubo empate en la categoría más vendida; el informe no declara un ganador.";
      } else if (resultado.global.categoriaMasVendida) {
        mensaje += ` Categoría más vendida: ${resultado.global.categoriaMasVendida}.`;
      }
      setAviso(mensaje);
      cargarInformes();
    } catch (err) {
      setError(
        (axios.isAxiosError(err) && err.response?.data?.message) ||
          "No pudimos generar los informes de ese período",
      );
    } finally {
      setGenerando(false);
    }
  }

  async function descargar(periodo: string) {
    setDescargando(periodo);
    setError("");
    try {
      await descargarInformeGlobalPdf(periodo);
    } catch (err) {
      setError(
        (axios.isAxiosError(err) && err.response?.data?.message) ||
          "No pudimos descargar el PDF del informe",
      );
    } finally {
      setDescargando(null);
    }
  }

  if (cargando) {
    return (
      <p className="informes-globales__vacio">Cargando informes globales...</p>
    );
  }

  return (
    <div className="informes-globales">
      <div className="informes-globales__cabecera">
        <h2>Informes globales mensuales</h2>
        <span>{informes.length} período(s)</span>
      </div>

      <p className="informes-globales__nota">
        Se generan solos el día 1° de cada mes.
      </p>

      <div className="informes-globales__generador">
        <input
          type="text"
          className="informes-globales__periodo-input"
          placeholder="AAAA-MM (ej. 2026-09)"
          maxLength={7}
          value={periodoManual}
          onChange={(e) => setPeriodoManual(e.target.value)}
        />
        <button
          type="button"
          className="informes-globales__generar"
          onClick={generarDelPeriodo}
          disabled={generando}
        >
          {generando ? "Generando..." : "Generar informes del período"}
        </button>
      </div>

      {error && <p className="informes-globales__error">{error}</p>}
      {aviso && <p className="informes-globales__aviso">{aviso}</p>}

      {informes.length === 0 ? (
        <p className="informes-globales__vacio">
          Todavía no hay informes globales generados. El primero se crea
          automáticamente el día 1° del próximo mes.
        </p>
      ) : (
        <ul className="informes-globales__lista">
          {informes.map((informe) => (
            <li key={informe.periodo} className="informes-globales__item">
              <div className="informes-globales__titulo">
                <h3>Período {informe.periodo}</h3>
                <button
                  type="button"
                  className="informes-globales__descargar"
                  onClick={() => descargar(informe.periodo)}
                  disabled={descargando === informe.periodo}
                >
                  {descargando === informe.periodo
                    ? "Descargando..."
                    : "Descargar PDF"}
                </button>
              </div>

              <p className="informes-globales__destacado">
                {informe.empate ? (
                  <>
                    Categoría más vendida: <strong>empate</strong> — ninguna
                    categoría superó a las demás.
                  </>
                ) : informe.categoriaMasVendida ? (
                  <>
                    Categoría más vendida:{" "}
                    <strong>{informe.categoriaMasVendida.categoria}</strong> con{" "}
                    {informe.categoriaMasVendida.ventas} venta(s).
                  </>
                ) : (
                  "Sin ventas registradas en el período."
                )}
              </p>

              <table className="informes-globales__tabla">
                <thead>
                  <tr>
                    <th>Categoría</th>
                    <th>Ventas</th>
                    <th>Filas iniciadas</th>
                    <th>Filas abandonadas</th>
                    <th>Tasa de abandono</th>
                  </tr>
                </thead>
                <tbody>
                  {informe.porCategoria.map((categoria) => (
                    <tr key={categoria.categoria}>
                      <td>{categoria.categoria}</td>
                      <td>{categoria.ventas}</td>
                      <td>{categoria.filasIniciadas}</td>
                      <td>{categoria.filasAbandonadas}</td>
                      <td>{categoria.tasaAbandono.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default InformesGlobales;
