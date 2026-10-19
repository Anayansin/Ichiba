/**
 * Traduce al español los mensajes nativos de validación del navegador
 * ("Please fill out this field", "Please enter an email address", etc.).
 *
 * El navegador no permite cambiar el idioma del mensaje, pero sí asignar un
 * mensaje propio con `setCustomValidity`. Como el evento `invalid` no burbujea,
 * se escucha en fase de captura sobre el documento: así todos los formularios
 * del proyecto (registro, publicación, pagos, panel del vendedor, etc.) quedan
 * cubiertos sin tocar campo por campo.
 */

type CampoValidable =
  | HTMLInputElement
  | HTMLSelectElement
  | HTMLTextAreaElement;

function esCampoValidable(objetivo: EventTarget | null): objetivo is CampoValidable {
  return (
    objetivo instanceof HTMLInputElement ||
    objetivo instanceof HTMLSelectElement ||
    objetivo instanceof HTMLTextAreaElement
  );
}

function mensajeEnEspanol(campo: CampoValidable): string {
  const validez = campo.validity;

  if (validez.valueMissing) {
    if (campo instanceof HTMLSelectElement) return "Selecciona una opción.";
    if (campo instanceof HTMLTextAreaElement) return "Escribe este dato.";
    if (campo.type === "file") return "Selecciona un archivo.";
    if (campo.type === "checkbox") {
      return "Marca esta casilla para continuar.";
    }
    if (campo.type === "radio") return "Selecciona una opción.";
    return "Completa este campo.";
  }

  if (validez.typeMismatch) {
    switch (campo.type) {
      case "email":
        return "Escribe un correo electrónico válido, por ejemplo nombre@dominio.com.";
      case "url":
        return "Escribe una dirección web válida, por ejemplo https://ejemplo.com.";
      default:
        return "Revisa el formato de este dato.";
    }
  }

  if (validez.patternMismatch) {
    return "Revisa el formato de este dato.";
  }

  if (validez.tooShort) {
    const minimo = campo.getAttribute("minlength");
    return minimo
      ? `Escribe al menos ${minimo} caracteres.`
      : "El texto es demasiado corto.";
  }

  if (validez.tooLong) {
    const maximo = campo.getAttribute("maxlength");
    return maximo
      ? `No escribas más de ${maximo} caracteres.`
      : "El texto es demasiado largo.";
  }

  if (validez.rangeUnderflow) {
    const minimo = campo.getAttribute("min");
    return minimo
      ? `El valor mínimo permitido es ${minimo}.`
      : "El valor es demasiado pequeño.";
  }

  if (validez.rangeOverflow) {
    const maximo = campo.getAttribute("max");
    return maximo
      ? `El valor máximo permitido es ${maximo}.`
      : "El valor es demasiado grande.";
  }

  if (validez.stepMismatch) {
    return "Usa un valor válido para este campo.";
  }

  if (validez.badInput) {
    return "Ingresa un valor válido.";
  }

  return "Revisa este campo antes de continuar.";
}

/**
 * Activa los mensajes en español. Se llama una sola vez al arrancar la app.
 */
export function activarMensajesDeValidacionEnEspanol(): void {
  document.addEventListener(
    "invalid",
    (evento) => {
      if (!esCampoValidable(evento.target)) return;
      evento.target.setCustomValidity(mensajeEnEspanol(evento.target));
    },
    true,
  );

  const limpiarMensaje = (evento: Event) => {
    if (!esCampoValidable(evento.target)) return;
    // Al corregir o cambiar el valor se vuelve a evaluar desde cero.
    evento.target.setCustomValidity("");
  };

  document.addEventListener("input", limpiarMensaje, true);
  document.addEventListener("change", limpiarMensaje, true);
  document.addEventListener("reset", limpiarMensaje, true);
}
