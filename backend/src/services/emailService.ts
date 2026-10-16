import nodemailer from "nodemailer";

function faltaConfigurarCorreo() {
  return !process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD;
}

export async function enviarCorreoVerificacion(
  correo: string,
  codigo: string,
): Promise<boolean> {
  if (faltaConfigurarCorreo()) {
    console.log(`[correo local] Código de verificación para ${correo}: ${codigo}`);
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"Ichiba" <${process.env.GMAIL_USER}>`,
    to: correo,
    subject: "Tu código de verificación de Ichiba",
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #d90429;">Ichiba</h2>
        <p>Tu código de verificación es:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px;">${codigo}</p>
        <p style="color: #888; font-size: 12px;">Este código expira en 10 minutos.</p>
      </div>
    `,
  });

  return true;
}

export async function enviarCorreoRecuperacion(
  correo: string,
  codigo: string,
): Promise<boolean> {
  if (faltaConfigurarCorreo()) {
    console.log(`[correo local] Código de recuperación para ${correo}: ${codigo}`);
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"Ichiba" <${process.env.GMAIL_USER}>`,
    to: correo,
    subject: "Recupera tu contraseña de Ichiba",
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #d90429;">Ichiba</h2>
        <p>Recibimos una solicitud para cambiar la contraseña de tu cuenta.</p>
        <p>Tu código de recuperación es:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px;">${codigo}</p>
        <p style="color: #888; font-size: 12px;">Este código expira en 10 minutos. Si no solicitaste este cambio, ignora este correo.</p>
      </div>
    `,
  });

  return true;
}

export async function enviarCorreoAdvertencia(
  correo: string,
  mensaje: string,
  opciones?: {
    /** Asunto alternativo (por defecto, el de confirmación de horario). */
    asunto?: string;
    /** Pie alternativo (por defecto, invita a confirmar el horario). */
    pie?: string;
  },
) {
  if (faltaConfigurarCorreo()) {
    console.log(`[correo local] Aviso para ${correo}: ${mensaje}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"Ichiba" <${process.env.GMAIL_USER}>`,
    to: correo,
    subject: opciones?.asunto ?? "Advertencia: confirma tu horario en Ichiba",
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #d90429;">Ichiba</h2>
        <p>${mensaje}</p>
        <p style="color: #888; font-size: 12px;">
          ${
            opciones?.pie ??
            "Ingresa a tu panel de vendedor y confirma o actualiza tu horario para evitar la eliminación de tu cuenta."
          }
        </p>
      </div>
    `,
  });
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function enviarCorreoNovedadesCategoria(
  correo: string,
  categoria: string,
  productos: { nombre: string; precio: number }[],
): Promise<boolean> {
  if (faltaConfigurarCorreo()) {
    console.log(
      `[correo local] ${productos.length} productos nuevos en ${categoria} para ${correo}`,
    );
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const listaProductos = productos
    .map(
      (producto) =>
        `<li>${escaparHtml(producto.nombre)} — $${producto.precio}</li>`,
    )
    .join("");

  await transporter.sendMail({
    from: `"Ichiba" <${process.env.GMAIL_USER}>`,
    to: correo,
    subject: `Nuevos productos en ${categoria}`,
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #d90429;">Ichiba</h2>
        <p>Hay nuevos productos en la categoría ${escaparHtml(categoria)}:</p>
        <ul>${listaProductos}</ul>
        <p style="color: #888; font-size: 12px;">
          Recibes este correo porque dejaste tu correo para recibir novedades de esta categoría en Ichiba.
        </p>
      </div>
    `,
  });

  return true;
}

/**
 * Avisa al dueño de una publicación publicitaria que alguien dejó un
 * comentario (RQF3). Si el vendedor no aceptó notificaciones publicitarias
 * en su registro, este correo no se envía: quien lo decide es el controlador.
 */
export async function enviarCorreoComentarioPublicitario(
  correo: string,
  nombrePromocional: string,
  autor: string,
  comentario: string,
): Promise<boolean> {
  if (faltaConfigurarCorreo()) {
    console.log(
      `[correo local] Comentario de ${autor} en "${nombrePromocional}" para ${correo}: ${comentario}`,
    );
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"Ichiba" <${process.env.GMAIL_USER}>`,
    to: correo,
    subject: `Nuevo comentario en tu anuncio "${nombrePromocional}"`,
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #d90429;">Ichiba</h2>
        <p><strong>${escaparHtml(autor)}</strong> comentó en tu publicación
        <strong>${escaparHtml(nombrePromocional)}</strong>:</p>
        <blockquote style="background:#f8f9fa; border-left:4px solid #d90429; padding:10px 14px; margin:10px 0;">
          ${escaparHtml(comentario)}
        </blockquote>
        <p style="color: #888; font-size: 12px;">
          Recibes este correo porque aceptaste recibir notificaciones sobre
          comentarios en tus publicaciones publicitarias. Puedes desactivarlas
          desde tu panel de vendedor en "Preferencias de notificaciones".
        </p>
      </div>
    `,
  });

  return true;
}

export async function enviarCorreoTurnoDePago(
  correo: string,
  nombreProducto: string,
  minutosDePago: number,
): Promise<boolean> {
  if (faltaConfigurarCorreo()) {
    console.log(
      `[correo local] Turno de pago para ${correo} (${nombreProducto || "producto sin nombre"})`,
    );
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const detalleProducto = nombreProducto
    ? `<p>Ya puedes pagar <strong>${escaparHtml(nombreProducto)}</strong>.</p>`
    : "<p>Ya es tu turno de pagar.</p>";

  await transporter.sendMail({
    from: `"Ichiba" <${process.env.GMAIL_USER}>`,
    to: correo,
    subject: "Ya es tu turno de pagar en Ichiba",
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #d90429;">Ichiba</h2>
        ${detalleProducto}
        <p>Tienes ${minutosDePago} minutos para completar tu pago antes de perder tu lugar en la fila.</p>
        <p style="color: #888; font-size: 12px;">
          Recibes este correo porque dejaste tu correo al entrar en la fila.
        </p>
      </div>
    `,
  });

  return true;
}

/**
 * RQNF20: entrega al comprador la palabra clave numérica de 4 dígitos de su
 * sesión de pago (la necesita para registrar el comprobante en RQF22).
 * RQNF24.1: además se advierte que la atención será únicamente dentro del
 * bloque de horario de atención del vendedor.
 */
export async function enviarCorreoPalabraClaveCompra(
  correo: string,
  nombreProducto: string,
  codigoPago: string,
  atencionTexto: string | null,
): Promise<boolean> {
  if (faltaConfigurarCorreo()) {
    console.log(
      `[correo local] Palabra clave para ${correo}: ${codigoPago} (${nombreProducto || "producto sin nombre"})`,
    );
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const detalleProducto = nombreProducto
    ? `<p>Tu pago de <strong>${escaparHtml(nombreProducto)}</strong> quedó autorizado y el dinero está protegido por Ichiba.</p>`
    : "<p>Tu pago quedó autorizado y el dinero está protegido por Ichiba.</p>";

  const avisoHorario = atencionTexto
    ? `<p style="background:#fff4f4; border-left:4px solid #d90429; padding:10px 14px;">Aviso: la atención del vendedor será únicamente dentro de su bloque de horario de atención vigente (${escaparHtml(atencionTexto)}). Si escribes fuera de él, el vendedor te responderá en su siguiente bloque.</p>`
    : "";

  await transporter.sendMail({
    from: `"Ichiba" <${process.env.GMAIL_USER}>`,
    to: correo,
    subject: "Tu palabra clave de pago en Ichiba",
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #d90429;">Ichiba</h2>
        ${detalleProducto}
        <p>Esta es tu palabra clave para acreditar tu pago (la usarás al subir tu comprobante):</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px;">${codigoPago}</p>
        <p>Sube tu comprobante desde la página de tu compra dentro de las próximas 24 horas.</p>
        ${avisoHorario}
        <p style="color: #888; font-size: 12px;">
          No compartas esta palabra clave con el vendedor hasta que él confirme tu comprobante.
        </p>
      </div>
    `,
  });

  return true;
}

/** RQF30/RQF31: avisa al vendedor que llegó un comprobante por revisar. */
export async function enviarCorreoComprobanteRecibidoVendedor(
  correo: string,
  nombreProducto: string,
  limiteTexto: string | null,
): Promise<boolean> {
  if (faltaConfigurarCorreo()) {
    console.log(
      `[correo local] Comprobante por revisar para ${correo} (${nombreProducto || "producto sin nombre"})`,
    );
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"Ichiba" <${process.env.GMAIL_USER}>`,
    to: correo,
    subject: "Revisa el comprobante de pago que recibiste",
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #d90429;">Ichiba</h2>
        <p>Un comprador envió su comprobante de pago${nombreProducto ? ` de <strong>${escaparHtml(nombreProducto)}</strong>` : ""} y está en espera de tu revisión.</p>
        <p>Puedes verlo desde tu panel de vendedor, en "Comprobantes por revisar".</p>
        ${
          limiteTexto
            ? `<p style="background:#fff4f4; border-left:4px solid #d90429; padding:10px 14px;">Confírmalo o recházalo antes de que termine tu siguiente bloque de atención (${escaparHtml(limiteTexto)}); de lo contrario la compra se cancelará y se reembolsará al comprador de forma automática.</p>`
            : ""
        }
      </div>
    `,
  });

  return true;
}

/**
 * RQNF24.4: al confirmar el comprobante se entrega al comprador su código
 * confidencial de confirmación de entrega (se lo dará al vendedor el día de
 * la entrega, RQF26/RQF33).
 */
export async function enviarCorreoCodigoEntregaComprador(
  correo: string,
  nombreProducto: string,
  codigoEntrega: string,
  limiteTexto: string,
): Promise<boolean> {
  if (faltaConfigurarCorreo()) {
    console.log(
      `[correo local] Código de entrega para ${correo}: ${codigoEntrega} (${nombreProducto || "producto sin nombre"})`,
    );
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"Ichiba" <${process.env.GMAIL_USER}>`,
    to: correo,
    subject: "Tu comprobante fue confirmado: ya puedes coordinar la entrega",
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #d90429;">Ichiba</h2>
        <p>El vendedor confirmó tu comprobante de pago${nombreProducto ? ` de <strong>${escaparHtml(nombreProducto)}</strong>` : ""}. El chat de coordinación ya está abierto.</p>
        <p>Este es tu código confidencial de confirmación de entrega:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px;">${codigoEntrega}</p>
        <p>Entrégalo al vendedor únicamente cuando recibas tu producto en tus manos. Con este código se libera el dinero del vendedor.</p>
        <p style="color: #888; font-size: 12px;">Si el vendedor no entrega el producto antes del ${escaparHtml(limiteTexto)}, la compra se cancelará y se te reembolsará automáticamente. No compartas este código antes de tiempo.</p>
      </div>
    `,
  });

  return true;
}

/**
 * RQF23: al rechazar el comprobante, el comprador puede reportar al vendedor;
 * RQNF23: el turno pasa automáticamente al siguiente en la fila y se le
 * devuelve su dinero.
 */
export async function enviarCorreoComprobanteRechazadoComprador(
  correo: string,
  nombreProducto: string,
  motivo: string,
): Promise<boolean> {
  if (faltaConfigurarCorreo()) {
    console.log(
      `[correo local] Comprobante rechazado para ${correo} (${nombreProducto || "producto sin nombre"})`,
    );
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"Ichiba" <${process.env.GMAIL_USER}>`,
    to: correo,
    subject: "Tu comprobante de pago fue rechazado",
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #d90429;">Ichiba</h2>
        <p>El vendedor rechazó el comprobante de pago${nombreProducto ? ` de <strong>${escaparHtml(nombreProducto)}</strong>` : ""}.</p>
        <p><strong>Motivo:</strong> ${escaparHtml(motivo)}</p>
        <p>Se te devolvió el dinero de tu pago y el turno pasó al siguiente comprador en la fila.</p>
        <p>Si consideras que el rechazo fue injustificado, puedes reportar al vendedor desde tu compra en Ichiba ("Reportar al vendedor").</p>
      </div>
    `,
  });

  return true;
}

/** RQNF26 / RQNF27: la entrega quedó confirmada y los fondos, liberados. */
export async function enviarCorreoEntregaCompletada(
  correo: string,
  nombreProducto: string,
  esVendedor: boolean,
): Promise<boolean> {
  if (faltaConfigurarCorreo()) {
    console.log(
      `[correo local] Entrega completada para ${correo} (${nombreProducto || "producto sin nombre"})`,
    );
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"Ichiba" <${process.env.GMAIL_USER}>`,
    to: correo,
    subject: "Entrega confirmada: transacción completada",
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #d90429;">Ichiba</h2>
        <p>Se registró el código de confirmación de entrega${nombreProducto ? ` de <strong>${escaparHtml(nombreProducto)}</strong>` : ""}: la transacción quedó completada y el chat se cerró.</p>
        ${
          esVendedor
            ? "<p>El dinero retenido en escrow fue liberado a tu cuenta de cobro.</p>"
            : "<p>Si aún no calificas al vendedor, puedes hacerlo de 1 a 5 estrellas desde tu compra.</p>"
        }
      </div>
    `,
  });

  return true;
}

/**
 * RQNF24 / RQNF28 / RQNF31 / RQNF10.2: aviso de cancelación automática del
 * escrow. Se informa la hora y el día de la resolución y el reembolso.
 */
export async function enviarCorreoVentaCancelada(
  correo: string,
  nombreProducto: string,
  motivo: string,
  resolucionTexto: string,
  reembolsoTexto: string,
  esVendedor = false,
): Promise<boolean> {
  if (faltaConfigurarCorreo()) {
    console.log(
      `[correo local] Compra cancelada para ${correo} (${nombreProducto || "producto sin nombre"}): ${motivo}`,
    );
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"Ichiba" <${process.env.GMAIL_USER}>`,
    to: correo,
    subject: esVendedor
      ? "Se canceló una de tus ventas en Ichiba"
      : "Tu compra fue cancelada y tu dinero será devuelto",
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #d90429;">Ichiba</h2>
        <p>${
          esVendedor
            ? `Se canceló la venta${nombreProducto ? ` de <strong>${escaparHtml(nombreProducto)}</strong>` : ""}.`
            : `La compra${nombreProducto ? ` de <strong>${escaparHtml(nombreProducto)}</strong>` : ""} fue cancelada.`
        }</p>
        <p><strong>Motivo:</strong> ${escaparHtml(motivo)}</p>
        <p>${escaparHtml(reembolsoTexto)}</p>
        <p style="color: #888; font-size: 12px;">Resolución emitida el ${escaparHtml(resolucionTexto)} (hora del centro, GMT-6).</p>
      </div>
    `,
  });

  return true;
}

/**
 * RQF11 / RQNF10.5: notifica al vendedor que su cuenta fue cancelada de forma
 * permanente al acumular 8 puntos de reputación, indicando el motivo y los
 * reportes que la originaron.
 */
export async function enviarCorreoCuentaCancelada(
  correo: string,
  nombreCompleto: string,
  puntos: number,
  reportes: {
    categoriaNombre: string;
    tipoFalta: string;
    puntos: number;
    fecha: Date | string | null;
  }[],
): Promise<boolean> {
  const listaReportes = reportes
    .map(
      (reporte) =>
        `<li>${escaparHtml(reporte.categoriaNombre)} — falta ${escaparHtml(
          reporte.tipoFalta,
        )} (${reporte.puntos} punto${reporte.puntos === 1 ? "" : "s"})${
          reporte.fecha
            ? `, ${escaparHtml(new Date(reporte.fecha).toLocaleDateString("es-MX"))}`
            : ""
        }</li>`,
    )
    .join("");

  if (faltaConfigurarCorreo()) {
    console.log(
      `[correo local] Cuenta cancelada de ${correo} (${nombreCompleto}): ${puntos} puntos. Reportes: ${reportes
        .map((reporte) => reporte.categoriaNombre)
        .join(", ")}`,
    );
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"Ichiba" <${process.env.GMAIL_USER}>`,
    to: correo,
    subject: "Tu cuenta de Ichiba fue cancelada de forma permanente",
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #d90429;">Ichiba</h2>
        <p>Hola${nombreCompleto ? ` ${escaparHtml(nombreCompleto)}` : ""}:</p>
        <p>Tu cuenta de vendedor fue <strong>cancelada de forma permanente y sin posibilidad de recuperación</strong> porque acumulaste <strong>${puntos} puntos</strong> de reputación por infracción (el límite es de 8 puntos).</p>
        <p><strong>Reportes confirmados que originaron la cancelación:</strong></p>
        <ul>${listaReportes}</ul>
        <p>Conservamos únicamente tu RFC y los datos de tu identificación oficial en una lista negra para impedir que vuelvas a registrarte.</p>
        <p>Si tenías compras con pago confirmado pendientes de entrega, aún puedes ingresar a completarlas; no tendrás acceso a ninguna otra función de la plataforma.</p>
        <p style="color: #888; font-size: 12px;">
          Resolución emitida el ${escaparHtml(new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" }))} (hora del centro, GMT-6).
        </p>
      </div>
    `,
  });

  return true;
}

/**
 * RQNF33 / RQNF34 / RQNF35: avisa al usuario sancionado que un reporte
 * confirmado (o la reincidencia de faltas) le aplicó un bloqueo temporal,
 * una suspensión indefinida o el envío a revisión administrativa.
 */
export async function enviarCorreoSancionAplicada(
  correo: string,
  nombre: string,
  datos: {
    descripcion: string;
    motivo: string;
    revision: boolean;
    hasta: Date | null;
  },
): Promise<boolean> {
  const detalleHasta = datos.hasta
    ? `<p>El bloqueo concluirá de forma automática el <strong>${escaparHtml(
        new Date(datos.hasta).toLocaleString("es-MX", {
          dateStyle: "long",
          timeStyle: "short",
        }),
      )}</strong>, sin que tengas que hacer ningún trámite.</p>`
    : "";
  const detalleRevision = datos.revision
    ? "<p>Tu caso fue enviado a <strong>revisión administrativa</strong>: el equipo de Ichiba analizará lo sucedido y podrá levantar la suspensión si corresponde.</p>"
    : "";

  if (faltaConfigurarCorreo()) {
    console.log(
      `[correo local] Sanción para ${correo}: ${datos.descripcion} (motivo: ${datos.motivo})`,
    );
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"Ichiba" <${process.env.GMAIL_USER}>`,
    to: correo,
    subject: datos.revision
      ? "Tu cuenta quedó suspendida y en revisión administrativa"
      : "Tu cuenta tiene una sanción activa en Ichiba",
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #d90429;">Ichiba</h2>
        <p>Hola${nombre ? ` ${escaparHtml(nombre)}` : ""}:</p>
        <p>${escaparHtml(datos.descripcion)}</p>
        <p><strong>Motivo:</strong> ${escaparHtml(datos.motivo)}</p>
        ${detalleHasta}
        ${detalleRevision}
        <p>Mientras la sanción esté vigente no podrás entrar a filas, publicar o editar productos ni enviar mensajes (reportar siempre está permitido). Las faltas solo cuentan durante 13 meses y después prescriben.</p>
        <p style="color: #888; font-size: 12px;">
          Resolución emitida el ${escaparHtml(
            new Date().toLocaleString("es-MX", {
              timeZone: "America/Mexico_City",
            }),
          )} (hora del centro, GMT-6).
        </p>
      </div>
    `,
  });

  return true;
}

/**
 * RQNF33: avisa al usuario que su bloqueo temporal concluyó (de forma
 * automática al expirar) o que la administración revirtió la sanción.
 */
export async function enviarCorreoSancionLevantada(
  correo: string,
  nombre: string,
  motivo: string,
): Promise<boolean> {
  if (faltaConfigurarCorreo()) {
    console.log(`[correo local] Sanción levantada para ${correo}: ${motivo}`);
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"Ichiba" <${process.env.GMAIL_USER}>`,
    to: correo,
    subject: "Tu sanción en Ichiba fue levantada",
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #d90429;">Ichiba</h2>
        <p>Hola${nombre ? ` ${escaparHtml(nombre)}` : ""}:</p>
        <p>${escaparHtml(motivo)}</p>
        <p>Ya puedes volver a entrar a filas, publicar productos y enviar mensajes en la plataforma. Te pedimos mantener el respeto y cumplir con tus entregas para evitar nuevas sanciones.</p>
      </div>
    `,
  });

  return true;
}

/**
 * RQNF10.7: avisa al cliente que fue retirado de una fila virtual porque el
 * vendedor canceló su cuenta: el producto ya no está disponible.
 */
export async function enviarCorreoProductoNoDisponible(
  correo: string,
  nombreProducto: string,
): Promise<boolean> {
  if (faltaConfigurarCorreo()) {
    console.log(
      `[correo local] Producto no disponible para ${correo} (${nombreProducto || "producto sin nombre"})`,
    );
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"Ichiba" <${process.env.GMAIL_USER}>`,
    to: correo,
    subject: "El producto ya no está disponible",
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #d90429;">Ichiba</h2>
        <p>Te retiramos de la fila${nombreProducto ? ` de <strong>${escaparHtml(nombreProducto)}</strong>` : ""}: el producto ya no está disponible porque el vendedor canceló su cuenta.</p>
        <p>Tu lugar en la fila quedó eliminado de tus filas activas. Puedes explorar otros productos en el catálogo.</p>
      </div>
    `,
  });

  return true;
}

/**
 * RQNF37: avisa al vendedor que la plataforma cubrió un reembolso por su
 * culpa directa y que su cuenta queda suspendida con un saldo pendiente por
 * liquidar.
 */
export async function enviarCorreoAdeudoRegistrado(
  correo: string,
  nombre: string,
  datos: {
    producto: string;
    monto: number;
    motivo: string;
    saldoTotal: number;
  },
): Promise<boolean> {
  const montoTexto = `$${datos.monto.toFixed(2)}`;
  const saldoTexto = `$${datos.saldoTotal.toFixed(2)}`;

  if (faltaConfigurarCorreo()) {
    console.log(
      `[correo local] Adeudo para ${correo} (${nombre}): ${montoTexto} — ${datos.motivo} (saldo total ${saldoTexto})`,
    );
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"Ichiba" <${process.env.GMAIL_USER}>`,
    to: correo,
    subject: "Tienes un saldo pendiente en Ichiba",
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #d90429;">Ichiba</h2>
        <p>Hola${nombre ? ` ${escaparHtml(nombre)}` : ""}:</p>
        <p>La plataforma cubrió el reembolso${datos.producto ? ` de <strong>${escaparHtml(datos.producto)}</strong>` : ""} por <strong>${montoTexto}</strong> ante el incumplimiento de tu entrega.</p>
        <p><strong>Motivo:</strong> ${escaparHtml(datos.motivo)}</p>
        <p>Tu cuenta quedó <strong>suspendida con un saldo pendiente de ${saldoTexto}</strong>. Puedes terminar las entregas que ya tenían pago confirmado, pero no publicar productos ni recibir nuevos clientes.</p>
        <p>Para reactivar tu cuenta deberás liquidar la totalidad del adeudo. El equipo de Ichiba se pondrá en contacto contigo para acordar el pago por transferencia.</p>
        <p style="color: #888; font-size: 12px;">Resolución emitida el ${escaparHtml(new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" }))} (hora del centro, GMT-6).</p>
      </div>
    `,
  });

  return true;
}

/**
 * RQNF38: confirma al vendedor que la administración registró la liquidación
 * de su adeudo. Si el saldo llegó a cero, su cuenta queda reactivada.
 */
export async function enviarCorreoAdeudoLiquidado(
  correo: string,
  nombre: string,
  datos: { monto: number; saldoRestante: number },
): Promise<boolean> {
  const montoTexto = `$${datos.monto.toFixed(2)}`;

  if (faltaConfigurarCorreo()) {
    console.log(
      `[correo local] Adeudo liquidado para ${correo} (${nombre}): ${montoTexto} (saldo restante $${datos.saldoRestante.toFixed(2)})`,
    );
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const saldado = datos.saldoRestante <= 0;

  await transporter.sendMail({
    from: `"Ichiba" <${process.env.GMAIL_USER}>`,
    to: correo,
    subject: saldado
      ? "Tu adeudo quedó liquidado: cuenta reactivada"
      : "Registramos un pago de tu adeudo en Ichiba",
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #d90429;">Ichiba</h2>
        <p>Hola${nombre ? ` ${escaparHtml(nombre)}` : ""}:</p>
        <p>Registramos la liquidación de <strong>${montoTexto}</strong> de tu adeudo con la plataforma.</p>
        ${
          saldado
            ? "<p>Tu saldo pendiente quedó en <strong>$0.00</strong> y tu cuenta fue <strong>reactivada</strong>: ya puedes volver a publicar productos y recibir clientes.</p>"
            : `<p>Tu saldo pendiente restante es de <strong>$${datos.saldoRestante.toFixed(2)}</strong>. La cuenta seguirá suspendida hasta liquidarlo por completo.</p>`
        }
        <p>Gracias por regularizar tu situación con Ichiba.</p>
      </div>
    `,
  });

  return true;
}

/**
 * RQF40 / RQNF32: avisa al vendedor que un comprador abrió una disputa de
 * reembolso sobre una de sus ventas y que el pago quedó retenido hasta que
 * responda y la administración la resuelva.
 */
export async function enviarCorreoDisputaAbiertaVendedor(
  correo: string,
  nombreProducto: string,
  datos: { motivo: string; descripcion: string; monto: number },
): Promise<boolean> {
  if (faltaConfigurarCorreo()) {
    console.log(
      `[correo local] Disputa abierta para ${correo} (${nombreProducto || "producto sin nombre"}): ${datos.motivo}`,
    );
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"Ichiba" <${process.env.GMAIL_USER}>`,
    to: correo,
    subject: "Se abrió una disputa sobre una de tus ventas",
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #d90429;">Ichiba</h2>
        <p>El comprador${nombreProducto ? ` de <strong>${escaparHtml(nombreProducto)}</strong>` : ""} abrió una disputa de reembolso por <strong>$${datos.monto.toFixed(2)}</strong>.</p>
        <p><strong>Motivo:</strong> ${escaparHtml(datos.motivo)}</p>
        <p><strong>Descripción:</strong> ${escaparHtml(datos.descripcion)}</p>
        <p>El pago quedó <strong>retenido</strong> en el escrow de Ichiba mientras la disputa esté abierta. Ingresa a tu panel de vendedor para responder con tus propias evidencias (fotografías, comprobantes o capturas del chat); la administración revisará todo y dictaminará la resolución.</p>
      </div>
    `,
  });

  return true;
}

/** RQF40: avisa al comprador que el vendedor respondió su disputa. */
export async function enviarCorreoDisputaRespondidaComprador(
  correo: string,
  nombreProducto: string,
  respuesta: string,
): Promise<boolean> {
  if (faltaConfigurarCorreo()) {
    console.log(
      `[correo local] Disputa respondida para ${correo} (${nombreProducto || "producto sin nombre"}): ${respuesta}`,
    );
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"Ichiba" <${process.env.GMAIL_USER}>`,
    to: correo,
    subject: "El vendedor respondió tu disputa",
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #d90429;">Ichiba</h2>
        <p>El vendedor${nombreProducto ? ` de <strong>${escaparHtml(nombreProducto)}</strong>` : ""} respondió a tu disputa de reembolso:</p>
        <blockquote style="background:#f8f9fa; border-left:4px solid #d90429; padding:10px 14px; margin:10px 0;">
          ${escaparHtml(respuesta)}
        </blockquote>
        <p>La administración de Ichiba revisará las evidencias de ambas partes y dictaminará la resolución. El pago permanece retenido mientras tanto.</p>
      </div>
    `,
  });

  return true;
}

/**
 * RQF40: informa a las partes el dictamen del administrador sobre una
 * disputa de reembolso (a favor del comprador con reembolso, o rechazada).
 */
export async function enviarCorreoDisputaResuelta(
  correo: string,
  nombreProducto: string,
  datos: {
    reembolsada: boolean;
    nota: string;
    esVendedor: boolean;
    monto: number;
  },
): Promise<boolean> {
  if (faltaConfigurarCorreo()) {
    console.log(
      `[correo local] Disputa resuelta (${datos.reembolsada ? "reembolsada" : "rechazada"}) para ${correo} (${nombreProducto || "producto sin nombre"})`,
    );
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const cuerpo = datos.reembolsada
    ? datos.esVendedor
      ? `<p>La administración resolvió la disputa <strong>a favor del comprador</strong>${nombreProducto ? ` de <strong>${escaparHtml(nombreProducto)}</strong>` : ""}: la plataforma cubrió el reembolso de <strong>$${datos.monto.toFixed(2)}</strong>.</p>
         <p>Ese monto quedó registrado como un <strong>saldo pendiente a tu cargo</strong> y tu cuenta fue suspendida. Para reactivarla deberás liquidar la totalidad del adeudo con el equipo de Ichiba.</p>`
      : `<p>La administración resolvió tu disputa <strong>a favor</strong>${nombreProducto ? ` de <strong>${escaparHtml(nombreProducto)}</strong>` : ""}: se procesó el reembolso de <strong>$${datos.monto.toFixed(2)}</strong> a tu medio de pago. Puede tardar unos días en reflejarse.</p>`
    : datos.esVendedor
      ? `<p>La administración <strong>rechazó</strong> la disputa${nombreProducto ? ` de <strong>${escaparHtml(nombreProducto)}</strong>` : ""}: se retiró la retención preventiva y el pago sigue el curso normal de la venta.</p>`
      : `<p>La administración revisó las evidencias y <strong>rechazó</strong> tu disputa${nombreProducto ? ` de <strong>${escaparHtml(nombreProducto)}</strong>` : ""}: el pago se liberó al vendedor conforme al flujo normal de la venta.</p>`;

  await transporter.sendMail({
    from: `"Ichiba" <${process.env.GMAIL_USER}>`,
    to: correo,
    subject: datos.reembolsada
      ? "Resolución de tu disputa: reembolso aprobado"
      : "Resolución de tu disputa: rechazada",
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #d90429;">Ichiba</h2>
        ${cuerpo}
        ${datos.nota ? `<p><strong>Dictamen:</strong> ${escaparHtml(datos.nota)}</p>` : ""}
        <p style="color: #888; font-size: 12px;">Resolución emitida el ${escaparHtml(new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" }))} (hora del centro, GMT-6).</p>
      </div>
    `,
  });

  return true;
}
