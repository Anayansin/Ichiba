import { useState } from "react";
import BurbujaDeTexto from "../../components/BurbujaDeTexto/BurbujaDeTexto";
import "./Chats.css";

// Lista de contactos de prueba (mock data)
const contactosFalsos = [
  {
    id: 1,
    nombre: "Carlos Vendedor",
    ultimoMensaje: "Sí, todavía tengo stock",
    hora: "10:33",
    noLeidos: 0,
  },
  {
    id: 2,
    nombre: "Ana Gómez",
    ultimoMensaje: "¿Aún tienes disponible el artículo?",
    hora: "Ayer",
    noLeidos: 2,
  },
  {
    id: 3,
    nombre: "Luis Martínez",
    ultimoMensaje: "Te veo en el punto de entrega",
    hora: "28/06",
    noLeidos: 0,
  },
  {
    id: 4,
    nombre: "Sofía Ruiz",
    ultimoMensaje: "Muchas gracias por todo!",
    hora: "25/06",
    noLeidos: 0,
  },
];

function Chats() {
  const [contactoActivo, setContactoActivo] = useState(contactosFalsos[0]);

  return (
    <div className="chat-layout-principal">
      {}
      <div className="chat-sidebar">
        <div className="chat-sidebar-header">
          <h2>Mensajes</h2>
        </div>
        <div className="chat-lista-contactos">
          {contactosFalsos.map((contacto) => (
            <div
              key={contacto.id}
              className={`contacto-item ${contactoActivo.id === contacto.id ? "activo" : ""}`}
              onClick={() => setContactoActivo(contacto)}
            >
              <div className="contacto-avatar">{contacto.nombre.charAt(0)}</div>
              <div className="contacto-info">
                <div className="contacto-superior">
                  <span className="contacto-nombre">{contacto.nombre}</span>
                  <span className="contacto-hora">{contacto.hora}</span>
                </div>
                <div className="contacto-inferior">
                  <p className="contacto-ultimo-msj">
                    {contacto.ultimoMensaje}
                  </p>
                  {contacto.noLeidos > 0 && (
                    <span className="badge-no-leidos">{contacto.noLeidos}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {}
      <div className="chat-area-principal">
        {/* Cabecera del chat activo */}
        <div className="chat-header-activo">
          <div className="avatar-pequeno">
            {contactoActivo.nombre.charAt(0)}
          </div>
          <h3>{contactoActivo.nombre}</h3>
        </div>

        {}
        <div className="contenedor-chat">
          <BurbujaDeTexto
            contenido={`Hola, acerca de tu chat con ${contactoActivo.nombre}: ¿El producto sigue disponible?`}
            esRemitente={false}
            horario="10:32"
            estadoLectura="leido"
          />
          <BurbujaDeTexto
            contenido={contactoActivo.ultimoMensaje}
            esRemitente={true}
            horario={contactoActivo.hora}
            estadoLectura="leido"
          />
        </div>
      </div>
    </div>
  );
}

export default Chats;
