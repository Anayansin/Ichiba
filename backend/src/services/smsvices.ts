import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

export async function enviarSMS(telefono: string, codigo: string) {
  await client.messages.create({
    body: `Tu código de verificación de Ichiba es: ${codigo}`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: telefono,
  });
}
