export function validarPassword(password: string): string | null {
  if (password.length < 10) {
    return "La contraseña debe tener al menos 10 caracteres";
  }
  if (!/[a-z]/.test(password)) {
    return "La contraseña debe tener al menos una letra minúscula";
  }
  if (!/[A-Z]/.test(password)) {
    return "La contraseña debe tener al menos una letra mayúscula";
  }
  if (!/[0-9]/.test(password)) {
    return "La contraseña debe tener al menos un número";
  }
  if (!/[!@#$%&*\-_]/.test(password)) {
    return "La contraseña debe tener al menos un carácter especial (!@#$%&*-_)";
  }
  if (/[^A-Za-z0-9!@#$%&*\-_]/.test(password)) {
    return "La contraseña solo puede contener letras, números y los símbolos !@#$%&*-_";
  }
  return null;
}
