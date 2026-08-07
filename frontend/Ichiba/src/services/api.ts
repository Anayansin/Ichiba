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

export const URL_BACKEND = "http://localhost:5000";

export default api;
