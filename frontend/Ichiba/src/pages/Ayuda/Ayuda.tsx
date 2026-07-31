import { useState } from "react";
import "./Ayuda.css";
import Boton from "../../components/Boton/Boton";
import ComoFunciona from "../../components/ComoFunciona/ComoFunciona";
import MisPedidos from "../../components/MisPedidos/MisPedidos";
import PreguntasFrecuentes from "../../components/PreguntasFrecuentes/PreguntasFrecuentes";
import PoliticasDePrivacidad from "../../components/PoliticasDePrivacidad/PoliticasDePrivacidad";

function Ayuda() {
  const [opcionActiva, setOpcionActiva] = useState("Mis pedidos");

  return (
    <div className="ayuda-layout">
      {}
      <div className="ayuda-sidebar">
        <h2>Centro de Ayuda</h2>
        <div
          className={`ayuda-opcion ${opcionActiva === "Mis pedidos" ? "activa" : ""}`}
          onClick={() => setOpcionActiva("Mis pedidos")}
        >
          Mis pedidos
        </div>
        <div
          className={`ayuda-opcion ${opcionActiva === "¿Cómo funciona?" ? "activa" : ""}`}
          onClick={() => setOpcionActiva("¿Cómo funciona?")}
        >
          ¿Cómo funciona?
        </div>
        <div
          className={`ayuda-opcion ${opcionActiva === "Reportes" ? "activa" : ""}`}
          onClick={() => setOpcionActiva("Reportes")}
        >
          Reportes
        </div>
        <div
          className={`ayuda-opcion ${opcionActiva === "Preguntas frecuentes" ? "activa" : ""}`}
          onClick={() => setOpcionActiva("Preguntas frecuentes")}
        >
          Preguntas frecuentes
        </div>
        <div
          className={`ayuda-opcion ${opcionActiva === "Sugerencias" ? "activa" : ""}`}
          onClick={() => setOpcionActiva("Sugerencias")}
        >
          Sugerencias
        </div>
        <div
          className={`ayuda-opcion ${opcionActiva === "Politica de Privacidad" ? "activa" : ""}`}
          onClick={() => setOpcionActiva("Politica de Privacidad")}
        >
          Politica de Privacidad
        </div>
      </div>

      {}
      <div className="ayuda-contenido">
        {opcionActiva === "Reportes" && (
          <div className="tarjeta-reporte">
            <h3>Levantar un reporte</h3>
            <p>Selecciona el motivo de tu reporte y cuéntanos qué sucedió:</p>
            <input
              type="text"
              placeholder="Asunto del reporte"
              className="ayuda-input"
            />
            <textarea
              placeholder="Descripción detallada..."
              className="ayuda-textarea"
            ></textarea>
            <Boton texto="Enviar" onClick={() => {}}></Boton>
          </div>
        )}

        {opcionActiva === "Mis pedidos" && (
          <div className="tarjeta-generica">
            <h3>{opcionActiva}</h3>
            <MisPedidos />
          </div>
        )}

        {opcionActiva === "¿Cómo funciona?" && (
          <div className="tarjeta-generica">
            <h3>{opcionActiva}</h3>
            <ComoFunciona />
          </div>
        )}

        {opcionActiva === "Preguntas frecuentes" && (
          <div className="tarjeta-generica">
            <h3>{opcionActiva}</h3>
            <PreguntasFrecuentes />
          </div>
        )}

        {opcionActiva === "Sugerencias" && (
          <div className="tarjeta-generica">
            <h3>{opcionActiva}</h3>
            <textarea
              placeholder="Ayudanos a mejorar para ti"
              className="ayuda-input"
            />
            <Boton texto="Enviar" onClick={() => {}}></Boton>
          </div>
        )}

        {opcionActiva === "Politica de Privacidad" && (
          <div className="tarjeta-generica">
            <h3>{opcionActiva}</h3>
            <PoliticasDePrivacidad />
          </div>
        )}
      </div>
    </div>
  );
}

export default Ayuda;
