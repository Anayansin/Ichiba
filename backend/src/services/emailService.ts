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
