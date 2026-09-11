/**
 * Remove qualquer caractere não numérico de uma string.
 */
export function limparNaoNumericos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/**
 * Normaliza e-mail: remove espaços externos e converte para minúsculas.
 */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Formata string numérica como CPF: 000.000.000-00.
 */
export function formatarCPF(cpf: string): string {
  const limpo = limparNaoNumericos(cpf).slice(0, 11);
  return limpo
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

/**
 * Valida se um CPF é matematicamente válido pelos dígitos verificadores.
 */
export function validarCPF(cpf: string): boolean {
  const limpo = limparNaoNumericos(cpf);
  if (limpo.length !== 11) return false;

  // Rejeita sequências com todos os dígitos iguais (ex: 111.111.111-11)
  if (/^(\d)\1{10}$/.test(limpo)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(limpo.charAt(i), 10) * (10 - i);
  }
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(limpo.charAt(9), 10)) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(limpo.charAt(i), 10) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(limpo.charAt(10), 10)) return false;

  return true;
}
