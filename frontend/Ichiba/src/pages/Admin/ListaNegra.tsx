import { useEffect, useState } from "react";
import axios from "axios";
import {
  agregarEntradaListaNegra,
  fetchListaNegra,
  quitarEntradaListaNegra,
  type EntradaListaNegra,
} from "../../services/adminService";
import "./ListaNegra.css";

const ENTRADAS_POR_PAGINA = 20;

const FORM_INICIAL = {
  rfc: "",
  curp: "",
  ineCodigoReverso: "",
  correo: "",
  nombreCompleto: "",
  motivo: "",
};

function ListaNegra() {
  const [entradas, setEntradas] = useState<EntradaListaNegra[]>([]);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [entrandoEnAccion, setEntrandoEnAccion] = useState<string | null>(null);

  const [formulario, setFormulario] = useState(FORM_INICIAL);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setCargando(true);
    setError("");
    fetchListaNegra(pagina, ENTRADAS_POR_PAGINA)
      .then((respuesta) => {
        setEntradas(respuesta.entradas);
        setTotal(respuesta.total);
        setTotalPaginas(respuesta.totalPaginas);
      })
      .catch((err) =>
        setError(
          (axios.isAxiosError(err) && err.response?.data?.message) ||
            "No pudimos cargar la lista negra",
        ),
      )
      .finally(() => setCargando(false));
  }, [pagina]);

  function cambiarCampo(
    campo: keyof typeof FORM_INICIAL,
    valor: string,
  ) {
    setFormulario((anterior) => ({ ...anterior, [campo]: valor }));
  }

  async function manejarAlta(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setAviso("");

    if (!formulario.rfc.trim() && !formulario.curp.trim()) {
      setError("Indica al menos el RFC o la CURP");
      return;
    }
    if (!formulario.motivo.trim()) {
      setError("Indica el motivo de la inclusión en la lista negra");
      return;
    }

    setEnviando(true);
    try {
      await agregarEntradaListaNegra({
        rfc: formulario.rfc.trim() || undefined,
        curp: formulario.curp.trim() || undefined,
        ineCodigoReverso: formulario.ineCodigoReverso.trim() || undefined,
        correo: formulario.correo.trim() || undefined,
        nombreCompleto: formulario.nombreCompleto.trim() || undefined,
        motivo: formulario.motivo.trim(),
      });

      setFormulario(FORM_INICIAL);
      setAviso("Registro agregado a la lista negra");
      setPagina(1);
      const respuesta = await fetchListaNegra(1, ENTRADAS_POR_PAGINA);
      setEntradas(respuesta.entradas);
      setTotal(respuesta.total);
      setTotalPaginas(respuesta.totalPaginas);
    } catch (err) {
      setError(
        (axios.isAxiosError(err) && err.response?.data?.message) ||
          "No se pudo agregar el registro",
      );
    } finally {
      setEnviando(false);
    }
  }

  async function manejarBaja(entrada: EntradaListaNegra) {
    setError("");
    setAviso("");
    setEntrandoEnAccion(entrada.id);

    try {
      await quitarEntradaListaNegra(entrada.id);
      setEntradas((anteriores) =>
        anteriores.filter((item) => item.id !== entrada.id),
      );
      setTotal((valor) => Math.max(valor - 1, 0));
      setAviso(`Registro quitado: ${entrada.rfc || entrada.curp}`);
    } catch (err) {
      setError(
        (axios.isAxiosError(err) && err.response?.data?.message) ||
          "No se pudo quitar el registro",
      );
    } finally {
      setEntrandoEnAccion(null);
    }
  }

  return (
    <div className="lista-negra">
      <div className="lista-negra__cabecera">
        <h2>Lista negra</h2>
        <span>{total} registro(s)</span>
      </div>

      <p className="lista-negra__nota">
        Quien aparezca aquí no podrá crear una cuenta: el sistema compara el
        RFC, la CURP y el código de la INE contra esta lista en cada registro.
      </p>

      {error && <p className="lista-negra__error">{error}</p>}
      {aviso && <p className="lista-negra__aviso">{aviso}</p>}

      <form className="lista-negra__alta" onSubmit={manejarAlta}>
        <div className="lista-negra__campos">
          <label>
            RFC
            <input
              type="text"
              value={formulario.rfc}
              onChange={(e) => cambiarCampo("rfc", e.target.value.toUpperCase())}
              placeholder="XAXX010101000"
            />
          </label>
          <label>
            CURP
            <input
              type="text"
              value={formulario.curp}
              onChange={(e) => cambiarCampo("curp", e.target.value.toUpperCase())}
              placeholder="XAXX010101HDFXXX00"
            />
          </label>
          <label>
            Código de la INE (reverso)
            <input
              type="text"
              value={formulario.ineCodigoReverso}
              onChange={(e) =>
                cambiarCampo("ineCodigoReverso", e.target.value.toUpperCase())
              }
              placeholder="13 dígitos"
            />
          </label>
          <label>
            Nombre completo
            <input
              type="text"
              value={formulario.nombreCompleto}
              onChange={(e) => cambiarCampo("nombreCompleto", e.target.value)}
            />
          </label>
          <label>
            Correo
            <input
              type="email"
              value={formulario.correo}
              onChange={(e) => cambiarCampo("correo", e.target.value)}
            />
          </label>
          <label className="lista-negra__campo-motivo">
            Motivo
            <input
              type="text"
              value={formulario.motivo}
              onChange={(e) => cambiarCampo("motivo", e.target.value)}
              placeholder="Estafa confirmada, suplantación, etc."
            />
          </label>
        </div>
        <button
          type="submit"
          className="lista-negra__agregar"
          disabled={enviando}
        >
          {enviando ? "Agregando..." : "Agregar a la lista negra"}
        </button>
      </form>

      {cargando ? (
        <p className="lista-negra__vacio">Cargando registros...</p>
      ) : entradas.length === 0 ? (
        <p className="lista-negra__vacio">La lista negra está vacía.</p>
      ) : (
        <table className="lista-negra__tabla">
          <thead>
            <tr>
              <th>RFC</th>
              <th>CURP</th>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Motivo</th>
              <th>Origen</th>
              <th>Fecha</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {entradas.map((entrada) => (
              <tr key={entrada.id}>
                <td>{entrada.rfc || "—"}</td>
                <td>{entrada.curp || "—"}</td>
                <td>{entrada.nombreCompleto || "—"}</td>
                <td>{entrada.correo || "—"}</td>
                <td>{entrada.motivo}</td>
                <td>
                  <span
                    className={`lista-negra__origen ${
                      entrada.origen === "manual"
                        ? "lista-negra__origen--manual"
                        : "lista-negra__origen--sistema"
                    }`}
                  >
                    {entrada.origen === "manual" ? "Manual" : "Cuenta eliminada"}
                  </span>
                </td>
                <td>
                  {entrada.fecha
                    ? new Date(entrada.fecha).toLocaleDateString("es-MX")
                    : "Sin fecha"}
                </td>
                <td>
                  <button
                    type="button"
                    className="lista-negra__quitar"
                    disabled={entrandoEnAccion === entrada.id}
                    onClick={() => manejarBaja(entrada)}
                  >
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="lista-negra__paginacion">
        <button
          type="button"
          disabled={pagina <= 1}
          onClick={() => setPagina((valor) => valor - 1)}
        >
          Anterior
        </button>
        <span>
          Página {pagina} de {totalPaginas}
        </span>
        <button
          type="button"
          disabled={pagina >= totalPaginas}
          onClick={() => setPagina((valor) => valor + 1)}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

export default ListaNegra;
