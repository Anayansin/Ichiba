import { useState, useEffect, useCallback } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  fetchPerfil,
  type PerfilUsuario,
} from "../../services/usuarioServices";
import {
  fetchMisProductos,
  fetchCategoriaPopular,
  type Producto,
} from "../../services/productoService";
import {
  fetchMisPromocionales,
  type Promocional,
} from "../../services/promocionalService";
import {
  fetchMisVentasVendedor,
  fetchMisVentasComprador,
  type VentaConProducto,
} from "../../services/mensajeService";
import { mensajeDeError } from "../../utils/errores";
import "./Estadisticas.css";

type CategoriaPopular = {
  categoria: string | null;
  totalInteres: number;
};

function Estadisticas() {
  const { usuario } = useAuth();
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [promocionales, setPromocionales] = useState<Promocional[]>([]);
  const [ventas, setVentas] = useState<VentaConProducto[]>([]);
  const [compras, setCompras] = useState<VentaConProducto[]>([]);
  const [categoriaPopular, setCategoriaPopular] =
    useState<CategoriaPopular | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargarDatos = useCallback(() => {
    setCargando(true);
    setError("");

    Promise.all([
      fetchPerfil(),
      fetchMisProductos(),
      fetchMisPromocionales().catch(() => [] as Promocional[]),
      fetchMisVentasVendedor().catch(() => [] as VentaConProducto[]),
      fetchMisVentasComprador().catch(() => [] as VentaConProducto[]),
      fetchCategoriaPopular().catch(
        () => ({ categoria: null, totalInteres: 0 }) as CategoriaPopular,
      ),
    ])
      .then(
        ([datosPerfil, misProductos, misPromocionales, ventasPropias, comprasRealizadas, popular]) => {
          setPerfil(datosPerfil);
          setProductos(misProductos);
          setPromocionales(misPromocionales);
          setVentas(ventasPropias);
          setCompras(comprasRealizadas);
          setCategoriaPopular(popular);
        },
      )
      .catch((err) => setError(mensajeDeError(err)))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    if (!usuario) return;
    cargarDatos();
  }, [usuario, cargarDatos]);

  if (!usuario) return <Navigate to="/" replace />;
  if (cargando)
    return <p className="mis-estadisticas__cargando">Cargando tus estadísticas...</p>;

  if (error || !perfil) {
    return (
      <p className="mis-estadisticas__cargando">
        {error || "No pudimos cargar tus estadísticas."}{" "}
        <button type="button" className="mis-estadisticas__reintentar" onClick={cargarDatos}>
          Reintentar
        </button>
      </p>
    );
  }

  const productosActivos = productos.filter((p) => p.activo);
  const productosInactivos = productos.filter((p) => !p.activo);
  const promocionalesActivos = promocionales.filter((p) => p.activo);
  const promocionalesInactivos = promocionales.filter((p) => !p.activo);

  const montoVendido = ventas.reduce((total, venta) => total + venta.monto, 0);
  const montoComprado = compras.reduce((total, venta) => total + venta.monto, 0);

  const conteoPorCategoria = productos.reduce<Record<string, number>>(
    (acumulador, producto) => {
      acumulador[producto.categoria] =
        (acumulador[producto.categoria] ?? 0) + 1;
      return acumulador;
    },
    {},
  );
  const categorias = Object.entries(conteoPorCategoria).sort(
    (a, b) => b[1] - a[1],
  );
  const mayorConteo = categorias.length > 0 ? categorias[0][1] : 1;

  const dinero = (cantidad: number) =>
    `$${cantidad.toLocaleString("es-MX")}`;

  return (
    <div className="mis-estadisticas">
      <Link to="/panel-vendedor" className="mis-estadisticas__volver">
        ← Volver a mi panel
      </Link>

      <h1>Estadísticas de {perfil.nombreCompleto}</h1>
      <p className="mis-estadisticas__nota">
        Resumen de tu actividad dentro de Ichiba.
      </p>

      <div className="mis-estadisticas__tarjetas">
        <div className="mis-estadisticas__tarjeta">
          <span className="mis-estadisticas__numero">{ventas.length}</span>
          <span className="mis-estadisticas__etiqueta">Ventas realizadas</span>
          <span className="mis-estadisticas__detalle">{dinero(montoVendido)}</span>
        </div>
        <div className="mis-estadisticas__tarjeta">
          <span className="mis-estadisticas__numero">{compras.length}</span>
          <span className="mis-estadisticas__etiqueta">Compras realizadas</span>
          <span className="mis-estadisticas__detalle">{dinero(montoComprado)}</span>
        </div>
        <div className="mis-estadisticas__tarjeta">
          <span className="mis-estadisticas__numero">{perfil.ventasExitosas}</span>
          <span className="mis-estadisticas__etiqueta">
            Ventas concluidas sin problemas
          </span>
          <span className="mis-estadisticas__detalle">
            {perfil.totalReportes} reportes recibidos
          </span>
        </div>
      </div>

      <section className="mis-estadisticas__seccion">
        <h2>Tus publicaciones</h2>
        <div className="mis-estadisticas__tabla">
          <p>
            <strong>Productos:</strong> {productos.length} en total —{" "}
            {productosActivos.length} activos y {productosInactivos.length}{" "}
            inactivos
          </p>
          <p>
            <strong>Promocionales:</strong> {promocionales.length} en total —{" "}
            {promocionalesActivos.length} activos y{" "}
            {promocionalesInactivos.length} inactivos
          </p>
        </div>
      </section>

      <section className="mis-estadisticas__seccion">
        <h2>Tus productos por categoría</h2>
        {categorias.length === 0 ? (
          <p className="mis-estadisticas__vacio">
            Todavía no has publicado productos.
          </p>
        ) : (
          <div className="mis-estadisticas__barras">
            {categorias.map(([categoria, cantidad]) => (
              <div key={categoria} className="mis-estadisticas__barra-fila">
                <span className="mis-estadisticas__barra-nombre">{categoria}</span>
                <div className="mis-estadisticas__barra">
                  <div
                    className="mis-estadisticas__barra-relleno"
                    style={{
                      width: `${Math.round((cantidad / mayorConteo) * 100)}%`,
                    }}
                  />
                </div>
                <span className="mis-estadisticas__barra-cantidad">{cantidad}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mis-estadisticas__seccion">
        <h2>Categoría con más interés en Ichiba</h2>
        {categoriaPopular?.categoria ? (
          <p className="mis-estadisticas__popular">
            <strong>{categoriaPopular.categoria}</strong> con{" "}
            {categoriaPopular.totalInteres} productos vistos
          </p>
        ) : (
          <p className="mis-estadisticas__vacio">
            Aún no hay suficientes visitas para mostrarla.
          </p>
        )}
      </section>
    </div>
  );
}

export default Estadisticas;
