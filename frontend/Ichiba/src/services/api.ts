import axios from "axios";
import { obtenerCompradorId } from "../utils/compradorId";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
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

export const URL_BACKEND = "http://localhost:5000";

export default api;
