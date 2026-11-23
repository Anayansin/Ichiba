export type RequisitoPassword = {
  texto: string;
  test: (password: string) => boolean;
};

export const REQUISITOS_PASSWORD: RequisitoPassword[] = [
  {
    texto: "Al menos 10 caracteres",
    test: (p) => p.length >= 10,
  },
  {
    texto: "Al menos una letra mayúscula",
    test: (p) => /[A-Z]/.test(p),
  },
  {
    texto: "Al menos una letra minúscula",
    test: (p) => /[a-z]/.test(p),
  },
  { texto: "Al menos un número", test: (p) => /[0-9]/.test(p) },
  {
    texto: "Al menos un carácter especial (!@#$%&*-_)",
    test: (p) => /[!@#$%&*\-_]/.test(p),
  },
  {
    texto: "Solo letras, números y los símbolos !@#$%&*-_",
    test: (p) => /^[A-Za-z0-9!@#$%&*\-_]+$/.test(p),
  },
];

export function cumpleRequisitosPassword(password: string): boolean {
  return REQUISITOS_PASSWORD.every((requisito) => requisito.test(password));
}
