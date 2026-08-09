import twilio from "twilio";

export async function enviarSMS(telefono: string, codigo: string) {
  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN,
  );

  await client.messages.create({
    body: `Tu código de verificación de Ichiba es: ${codigo}`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: telefono,
  });
}
