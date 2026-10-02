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
        <p style="color: #888; font-size: 12px;">Este código expira en 15 minutos. Si no solicitaste este cambio, ignora este correo.</p>
      </div>
    `,
  });

  return true;
}

export async function enviarCorreoAdvertencia(correo: string, mensaje: string) {
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
    subject: "Advertencia: confirma tu horario en Ichiba",
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #d90429;">Ichiba</h2>
        <p>${mensaje}</p>
        <p style="color: #888; font-size: 12px;">
          Ingresa a tu panel de vendedor y confirma o actualiza tu horario para evitar la eliminación de tu cuenta.
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
