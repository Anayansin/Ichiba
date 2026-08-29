export function coincideRfcConCurp(rfc: string, curp: string): boolean {
  if (!rfc || !curp) return false;

  const rfcLimpio = rfc
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9Ñ]/g, "");
  const curpLimpio = curp
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9Ñ]/g, "");

  if (rfcLimpio.length < 10 || curpLimpio.length < 10) return false;

  return rfcLimpio.slice(0, 10) === curpLimpio.slice(0, 10);
}
