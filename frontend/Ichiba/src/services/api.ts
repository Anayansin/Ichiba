import axios from "axios";
import { obtenerCompradorId } from "../utils/compradorId";

/**
 * URL raíz del backend (sin `/api`).
 *
 * En desarrollo es `http://localhost:5000`; al publicar basta con definir la
 * variable `VITE_BACKEND_URL` en el hosting (o en `frontend/Ichiba/.env`) y
 * todo el frontend apunta al servidor nuevo sin tocar código.
 */
export const URL_BACKEND = (
  import.meta.env.VITE_BACKEND_URL ?? "http://localhost:5000"
).replace(/\/+$/, "");

const api = axios.create({
  baseURL: `${URL_BACKEND}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (config.headers) {
    config.headers["x-comprador-id"] = obtenerCompradorId();
  }

  return config;
});

api.interceptors.response.use(
  (respuesta) => respuesta,
  (error) => {
    const estado = error.response?.status;
    const seEnvioToken = Boolean(error.config?.headers?.Authorization);
    const esInicioDeSesion = String(error.config?.url ?? "").includes(
      "/usuarios/login",
    );

    if (estado === 401 && seEnvioToken && !esInicioDeSesion) {
      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
      window.location.assign("/inicio");
    }

    return Promise.reject(error);
  },
);

export default api;
