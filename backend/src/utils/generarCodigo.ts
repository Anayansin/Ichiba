import { randomInt } from "crypto";

export function generarCodigo(): string {
  return String(randomInt(1000, 10000));
}
