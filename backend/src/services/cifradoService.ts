/**
 * Cifrado simétrico (AES-256-GCM) para los secretos que otorgan las
 * pasarelas.
 *
 * RQNF4 exige que el Token de Acceso (y el Merchant ID asociado) que PayPal
 * otorga al vendedor al vincular su cuenta se guarden cifrados: aunque alguien
 * lea la base de datos, solo obtiene texto ilegible sin la llave, que vive en
 * `backend/.env` (y en las variables del hosting, nunca en el repositorio).
 *
 * Formato almacenado: `<iv>.<tag>.<datos>`, cada bloque en base64.
 */

import crypto from "crypto";

const ALGORITMO = "aes-256-gcm";

function llaveCifrado(): Buffer {
  const hex = process.env.PAYPAL_LLAVE_CIFRADO;

  if (!hex) {
    throw new Error(
      "Falta PAYPAL_LLAVE_CIFRADO en backend/.env (64 dígitos hexadecimales)",
    );
  }

  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      "PAYPAL_LLAVE_CIFRADO debe tener 64 dígitos hexadecimales (32 bytes)",
    );
  }

  return Buffer.from(hex, "hex");
}

export function cifrar(texto: string): string {
  const iv = crypto.randomBytes(12);
  const cifrador = crypto.createCipheriv(ALGORITMO, llaveCifrado(), iv);
  const datos = Buffer.concat([cifrador.update(texto, "utf8"), cifrador.final()]);
  const tag = cifrador.getAuthTag();

  return `${iv.toString("base64")}.${tag.toString("base64")}.${datos.toString("base64")}`;
}

export function descifrar(bloque: string): string {
  const [ivBase64, tagBase64, datosBase64] = bloque.split(".");

  if (!ivBase64 || !tagBase64 || !datosBase64) {
    throw new Error("El bloque cifrado no tiene el formato esperado");
  }

  const descifrador = crypto.createDecipheriv(
    ALGORITMO,
    llaveCifrado(),
    Buffer.from(ivBase64, "base64"),
  );
  descifrador.setAuthTag(Buffer.from(tagBase64, "base64"));

  return Buffer.concat([
    descifrador.update(Buffer.from(datosBase64, "base64")),
    descifrador.final(),
  ]).toString("utf8");
}
