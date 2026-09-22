export type EntradaConocimiento = {
  id: string;
  pregunta: string;
  respuesta: string;
  claves: string[];
};

export const SALUDO =
  "¡Hola! 👋 Soy el asistente automatizado de soporte de Ichiba. Escribe tu duda y te respondo al instante, o toca uno de los temas de abajo.";

export const PREGUNTA_NO_ENTENDIDA =
  "No tengo esa información todavía 😅.\n\nPuedo ayudarte con la fila virtual, el tiempo de pago, PayPal, métodos de entrega, tu cuenta de vendedor, reportes, notificaciones y más. Prueba con otras palabras o toca un tema sugerido.";

export const BASE_CONOCIMIENTO: EntradaConocimiento[] = [
  {
    id: "saludo",
    pregunta: "Saludos",
    respuesta:
      "¡Hola! 👋 Para ayudarte, cuéntame tu duda: por ejemplo «¿cuánto tiempo tengo para pagar?» o «¿cómo recupero mi contraseña?».",
    claves: ["hola", "buenas", "que tal", "buenos dias", "buenas tardes", "hey", "ayuda", "soporte"],
  },
  {
    id: "como-funciona",
    pregunta: "¿Cómo funciona Ichiba?",
    respuesta:
      "Ichiba funciona en 5 pasos:\n1) Explora el catálogo sin necesidad de cuenta.\n2) Entra a la fila del producto que te interesa.\n3) Espera tu turno en la posición 1.\n4) Paga con PayPal.\n5) Coordina la entrega por el chat privado.\n\nLo tienes también en Ayuda → Cómo funciona.",
    claves: [
      "como funciona ichiba",
      "que es ichiba",
      "como se usa",
      "como funciona la plataforma",
      "pasos para comprar",
      "guia de uso",
    ],
  },
  {
    id: "cuenta-comprar",
    pregunta: "¿Necesito una cuenta para comprar?",
    respuesta:
      "No. Puedes explorar el catálogo y entrar a la fila virtual de cualquier producto sin registrarte. Solo los vendedores necesitan crear una cuenta y verificar su identidad.",
    claves: [
      "necesito cuenta para comprar",
      "comprar sin cuenta",
      "comprar sin registrarme",
      "crearme cuenta para comprar",
      "solo quiero comprar",
      "registro de comprador",
    ],
  },
  {
    id: "fila-virtual",
    pregunta: "¿Cómo funciona la fila virtual?",
    respuesta:
      "Cuando entras a la fila de un producto se te asigna una posición ordenada según el momento en que llegaste. Solo la persona en la posición 1 puede pagar. Si esa persona completa el pago o sale de la fila, todos los demás avanzan un lugar automáticamente. Puedes seguir tu avance desde la burbuja flotante de filas.",
    claves: [
      "fila virtual",
      "como funciona la fila",
      "entrar a la fila",
      "posicion en la fila",
      "como se usa la fila",
      "turno de compra",
      "avanzar en la fila",
    ],
  },
  {
    id: "quien-puede-pagar",
    pregunta: "¿Quién puede pagar y con qué método?",
    respuesta:
      "Solo puede pagar quien está en la posición 1, usando el botón «Pagar con PayPal» que aparece en la ficha del producto. El pago se procesa de forma segura y va directo a la cuenta de PayPal del vendedor. No se puede pagar antes de tu turno ni fuera de la plataforma.",
    claves: [
      "como pago",
      "metodo de pago",
      "paypal",
      "tarjeta de credito",
      "pagar con paypal",
      "quien puede pagar",
      "boton de pago",
      "formas de pago",
    ],
  },
  {
    id: "tiempo-pago",
    pregunta: "¿Cuánto tiempo tengo para pagar?",
    respuesta:
      "El tiempo de pago empieza a contar en cuanto llegas a la posición 1 de la fila. Según el producto, dispones de un mínimo de 30 minutos y un máximo de 3 horas (por defecto 1 hora), tal como lo indica la ficha del producto.\n\nSi el tiempo se agota, pierdes tu turno y la siguiente persona de la fila puede pagar.",
    claves: [
      "cuanto tiempo tengo para pagar",
      "tiempo limite de pago",
      "cuando empieza a correr el tiempo",
      "reloj de pago",
      "minutos para pagar",
      "se acabo mi tiempo",
      "perdi mi turno",
      "cuenta regresiva",
      "expiro el tiempo",
    ],
  },
  {
    id: "maximo-filas",
    pregunta: "¿En cuántas filas puedo estar al mismo tiempo?",
    respuesta: "Puedes estar activo en un máximo de 3 filas simultáneas. Si ya estás en 3, sal de una para poder entrar a otra.",
    claves: [
      "cuantas filas puedo estar",
      "cuantas filas puedo tener",
      "cuantas filas",
      "maximo de filas",
      "limite de filas",
      "varias filas al mismo tiempo",
      "tener filas",
      "3 filas",
    ],
  },
  {
    id: "salir-fila",
    pregunta: "¿Cómo salgo de una fila?",
    respuesta:
      "Puedes salir de la fila en cualquier momento desde la burbuja de filas o desde la ficha del producto. Al salir, tu turno se libera y las personas de atrás avanzan automáticamente. Ten en cuenta que perderás tu posición.",
    claves: [
      "salir de la fila",
      "abandonar la fila",
      "me quiero salir",
      "cancelar mi turno",
      "salirme de la fila",
      "dejar la fila",
    ],
  },
  {
    id: "mi-posicion",
    pregunta: "¿Dónde veo mi posición en la fila?",
    respuesta:
      "Tu posición se muestra en la burbuja flotante de filas y en la ficha del producto. Cuando llegas a la posición 1, además ves la cuenta regresiva de tu tiempo de pago y el botón «Pagar con PayPal».",
    claves: [
      "donde veo mi fila",
      "mi posicion",
      "sigo en la fila",
      "burbuja de filas",
      "burbuja flotante",
      "consultar mi turno",
    ],
  },
  {
    id: "chat-vendedor",
    pregunta: "¿Cuándo puedo hablar con el vendedor?",
    respuesta:
      "El chat se habilita únicamente después de completar el pago de un producto, para coordinar la entrega. No existe comunicación con el vendedor antes de ese momento.",
    claves: [
      "hablar con el vendedor",
      "contactar al vendedor",
      "chat con el vendedor",
      "preguntarle al vendedor",
      "escribirle al vendedor",
      "comunicarme con el vendedor",
    ],
  },
  {
    id: "metodo-entrega",
    pregunta: "¿Cómo se entrega el producto?",
    respuesta:
      "Cada producto indica su método de entrega: domicilio, tienda o punto de encuentro, además del horario de coordinación que eligió el vendedor (por ejemplo, de 09:00 a 18:00). Una vez confirmado el pago, acuerdan los detalles por el chat privado.",
    claves: [
      "metodo de entrega",
      "como me llega el producto",
      "domicilio",
      "punto de encuentro",
      "entrega en tienda",
      "horario de coordinacion",
      "coordina la entrega",
      "donde me entregan",
      "envio",
    ],
  },
  {
    id: "condiciones-uso",
    pregunta: "¿Qué significan las condiciones de uso del producto?",
    respuesta:
      "En la ficha de cada producto verás su condición: Nuevo, Usado - como nuevo, Usado - buen estado o Usado - aceptable. Revísala antes de entrar a la fila para saber en qué estado recibes el artículo.",
    claves: [
      "condiciones de uso",
      "estado del producto",
      "esta nuevo",
      "producto usado",
      "como nuevo",
      "buen estado",
      "estado del articulo",
      "condicion del producto",
    ],
  },
  {
    id: "producto-no-disponible",
    pregunta: "¿Por qué un producto ya no está disponible?",
    respuesta:
      "Si un producto ya no está disponible es porque fue vendido o desactivado por su vendedor: cada producto solo puede comprarse una vez. Te sugerimos explorar otros artículos de la misma categoría.",
    claves: [
      "producto no disponible",
      "ya no esta disponible",
      "producto agotado",
      "producto vendido",
      "producto desactivado",
      "no lo encuentro",
    ],
  },
  {
    id: "notificaciones",
    pregunta: "¿Cómo recibo notificaciones de ofertas?",
    respuesta:
      "Al entrar por primera vez a una fila aparece el modal de términos y condiciones. Ahí puedes dejar tu correo y marcar una o más categorías (Ropa, Hogar, Electrodomésticos, Coleccionables, Artesanías u Otros) para recibir avisos de ofertas. Solo aceptar los términos es obligatorio.",
    claves: [
      "notificaciones",
      "ofertas por correo",
      "correos de ofertas",
      "suscribirme a ofertas",
      "categorias de ofertas",
      "quiero recibir correos",
      "avisos de ofertas",
    ],
  },
  {
    id: "recuperar-contrasena",
    pregunta: "¿Cómo recupero mi contraseña?",
    respuesta:
      "En la ventana de inicio de sesión pulsa «¿Olvidaste tu contraseña?». Escribe tu correo y te enviaremos un código de 6 dígitos (válido por 15 minutos). Después elige tu nueva contraseña: mínimo 10 caracteres, con mayúscula, minúscula, número y un carácter especial (!@#$%&*-_).",
    claves: [
      "olvide mi contrasena",
      "recuperar cuenta",
      "cambiar contrasena",
      "no recuerdo mi contrasena",
      "restablecer contrasena",
      "codigo de recuperacion",
      "clave olvidada",
    ],
  },
  {
    id: "registro-vendedor",
    pregunta: "¿Qué necesito para vender en Ichiba?",
    respuesta:
      "Para publicar como vendedor necesitas:\n• Nombre completo, dirección, teléfono, correo y RFC.\n• Contraseña y aceptación de términos.\n• Frente y reverso de tu INE.\n• Confirmar tu correo electrónico.\n• Registrar tu cuenta de PayPal (donde recibes el dinero).\n• Definir tus horarios de atención.",
    claves: [
      "ser vendedor",
      "registrarme como vendedor",
      "crear cuenta de vendedor",
      "que necesito para vender",
      "que necesita para vender",
      "necesito para vender",
      "requisitos para vender",
      "quiero vender",
      "publicar productos",
      "vender en ichiba",
      "datos para vender",
    ],
  },
  {
    id: "verificacion-vendedor",
    pregunta: "¿Cómo se verifica a los vendedores?",
    respuesta:
      "Cada vendedor debe registrar su identificación oficial (INE, frente y reverso), confirmar su correo electrónico y su cuenta de PayPal antes de poder publicar productos.",
    claves: [
      "como se verifica a los vendedores",
      "verificacion de vendedor",
      "identificacion oficial",
      "ine del vendedor",
      "documentos para vender",
      "vendedor verificado",
    ],
  },
  {
    id: "horario-vendedor",
    pregunta: "¿Qué pasa si un vendedor no confirma su horario mensual?",
    respuesta:
      "Los vendedores deben confirmar su disponibilidad cada mes. Si no lo hacen, reciben advertencias por correo y, tras un periodo prolongado sin confirmar, su cuenta puede ser eliminada.",
    claves: [
      "confirmar horario",
      "horario mensual",
      "cuenta eliminada",
      "eliminan mi cuenta",
      "disponibilidad del vendedor",
      "no confirme mi horario",
    ],
  },
  {
    id: "mis-pedidos",
    pregunta: "¿Dónde veo mis compras?",
    respuesta:
      "En Ayuda → Mis pedidos verás tus compras con fecha, monto y un enlace directo al chat con el vendedor para coordinar la entrega. Si aún no has comprado nada, aparecerá «Aún no has completado ninguna compra».",
    claves: [
      "mis pedidos",
      "donde veo mis compras",
      "historial de compras",
      "estado de mi pedido",
      "mis compras",
      "ventas realizadas",
    ],
  },
  {
    id: "reportar-vendedor",
    pregunta: "¿Cómo reporto a alguien?",
    respuesta:
      "Puedes reportar desde dos lugares:\n1) Ayuda → Reportar un vendedor: selecciona la compra relacionada, elige qué quieres reportar (mensaje, comentario, comprobante, estafa, producto u otro) y una categoría.\n2) Chats: abre la conversación y toca el botón ⚠ Reportar; sirve tanto para el comprador como para el vendedor.\nLas categorías indican si es una falta leve o grave; los reportes por reincidencia generan bloqueos automáticos (3 faltas leves = 7 días, 1 falta grave = 30 días y 2 faltas graves = bloqueo permanente).",
    claves: [
      "reportar vendedor",
      "reportar vendedor o comprador",
      "reportar",
      "denunciar vendedor",
      "denunciar",
      "reporte",
      "denuncia",
      "sospecha de fraude",
      "me estafaron",
      "comprobante falso",
      "producto no coincide",
      "vendedor no respondio",
      "hacer un reporte",
      "como reporto",
    ],
  },
  {
    id: "sanciones",
    pregunta: "¿Qué pasa con los reportes y bloqueos?",
    respuesta:
      "Cada reporte con categoría registrada genera una falta en la cuenta de la otra persona:\n• 3 faltas leves = bloqueo de 7 días.\n• 1 falta grave = bloqueo de 30 días.\n• 2 faltas graves = bloqueo permanente.\nMientras la sanción esté vigente no puedes entrar a filas, publicar o editar productos ni enviar mensajes (los reportes siempre están permitidos). Además, ningún campo del proyecto acepta palabras ofensivas: si escribes una, te marcará el campo a corregir.",
    claves: [
      "sancion",
      "sanciones",
      "bloqueo",
      "bloqueado",
      "bloquearon mi cuenta",
      "suspendido",
      "suspension",
      "castigo",
      "faltas",
      "falta leve",
      "falta grave",
      "palabras prohibidas",
      "palabras ofensivas",
      "palabrotas",
      "groserias",
      "insultos",
      "no me deja enviar mensajes",
      "no me deja entrar a la fila",
      "reincidencia",
    ],
  },
  {
    id: "privacidad",
    pregunta: "¿Qué dice la política de privacidad?",
    respuesta:
      "Puedes consultar las Políticas de privacidad en Ayuda → Políticas de privacidad. Al entrar a una fila aceptas los términos y condiciones de Ichiba, que rigen el uso de la plataforma y el tratamiento de tus datos.",
    claves: [
      "privacidad",
      "datos personales",
      "politicas de privacidad",
      "terminos y condiciones",
      "tratamiento de datos",
      "acepte los terminos",
    ],
  },
];

/**
 * Normaliza el texto: minúsculas, sin acentos ni signos de puntuación.
 */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!.,;:"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Busca la entrada del conocimiento que mejor coincide con la consulta.
 * Las frases exactas pesan más que las palabras sueltas.
 */
export function buscarRespuesta(consulta: string): EntradaConocimiento | null {
  const texto = normalizar(consulta);
  if (!texto) return null;

  let mejor: EntradaConocimiento | null = null;
  let mejorPuntaje = 0;

  for (const entrada of BASE_CONOCIMIENTO) {
    const claves = [entrada.pregunta, ...entrada.claves];
    let puntaje = 0;

    for (const clave of claves) {
      const claveNormalizada = normalizar(clave);
      if (!claveNormalizada) continue;

      if (texto === claveNormalizada) puntaje += 10;
      else if (texto.includes(claveNormalizada))
        puntaje += claveNormalizada.includes(" ") ? 4 : 2;
    }

    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejor = entrada;
    }
  }

  return mejorPuntaje >= 2 ? mejor : null;
}
