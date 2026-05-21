import { z } from "zod";

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function formatCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export function isValidCpf(value: string) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calcDigit = (sliceLength: number) => {
    const sum = cpf
      .slice(0, sliceLength)
      .split("")
      .reduce((acc, digit, index) => acc + Number(digit) * (sliceLength + 1 - index), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return calcDigit(9) === Number(cpf[9]) && calcDigit(10) === Number(cpf[10]);
}

export function isStrongEnoughPassword(value: string) {
  return value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);
}

export const passwordSchema = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .refine(isStrongEnoughPassword, "A senha precisa ter pelo menos uma letra e um numero.");

export const signUpSchema = z
  .object({
    fullName: z.string().trim().min(2, "Informe seu nome completo."),
    email: z.string().trim().email("Informe um e-mail valido."),
    cpf: z.string().trim().refine(isValidCpf, "Informe um CPF valido."),
    birthDate: z.string().min(1, "Informe sua data de nascimento."),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirme a senha."),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas precisam ser iguais.",
  });

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Informe um e-mail valido."),
  birthDate: z.string().min(1, "Informe sua data de nascimento."),
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirme a senha."),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas precisam ser iguais.",
  });
