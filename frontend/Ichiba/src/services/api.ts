import axios from "axios";
import { obtenerCompradorId } from "../utils/compradorId";
import { borrarSesion, tokenDeSesion } from "../utils/sesion";

export const URL_BACKEND = "";

const api = axios.create({
  baseURL: `${URL_BACKEND}/api`,
});

api.interceptors.request.use((config) => {
  const token = tokenDeSesion();
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
      borrarSesion();
      window.location.assign("/inicio");
    }

    return Promise.reject(error);
  },
);

export default api;
