import nodemailer from "nodemailer";

export async function enviarCorreoVerificacion(correo: string, codigo: string) {
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
}

export async function enviarCorreoRecuperacion(correo: string, codigo: string) {
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
}

export async function enviarCorreoAdvertencia(correo: string, mensaje: string) {
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
