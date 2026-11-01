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

/**
 * Valida formato do Cartão Nacional de Saúde (CNS).
 * Requer 15 dígitos numéricos e rejeita sequências com todos os dígitos iguais.
 */
export function validarCNS(cns: string): boolean {
  const limpo = limparNaoNumericos(cns);
  if (limpo.length !== 15) return false;
  if (/^(\d)\1{14}$/.test(limpo)) return false;
  return true;
}

/**
 * [NF017]: Formata string numérica como Cartão Nacional de Saúde (CNS): 000 0000 0000 0000.
 * @param cns - String contendo dígitos do CNS.
 * @returns String formatada com espaços a cada bloco do CNS.
 */
export function formatarCNS(cns: string): string {
  const limpo = limparNaoNumericos(cns).slice(0, 15);
  return limpo
    .replace(/^(\d{3})(\d)/, "$1 $2")
    .replace(/^(\d{3}) (\d{4})(\d)/, "$1 $2 $3")
    .replace(/^(\d{3}) (\d{4}) (\d{4})(\d)/, "$1 $2 $3 $4");
}

/**
 * [NF017]: Formata string de dígitos em máscara de data brasileira DD/MM/AAAA.
 * @param valor - String digitada pelo usuário.
 * @returns Data formatada parcialmente ou completa em DD/MM/AAAA.
 */
export function formatarMascaraDataBr(valor: string): string {
  const limpo = limparNaoNumericos(valor).slice(0, 8);
  return limpo
    .replace(/^(\d{2})(\d)/, "$1/$2")
    .replace(/^(\d{2})\/(\d{2})(\d)/, "$1/$2/$3");
}

/**
 * [NF017]: Converte data no formato DD/MM/AAAA ou AAAA-MM-DD para ISO AAAA-MM-DD.
 * @param valor - String de data em DD/MM/AAAA ou AAAA-MM-DD.
 * @returns String ISO AAAA-MM-DD ou string vazia se inválida.
 */
export function normalizarDataParaIso(valor: string): string {
  const limpo = valor.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(limpo)) {
    return limpo;
  }
  const matchBr = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(limpo);
  if (matchBr) {
    const [, dia, mes, ano] = matchBr;
    return `${ano}-${mes}-${dia}`;
  }
  return "";
}

/**
 * [NF017]: Converte data ISO (AAAA-MM-DD) para exibição brasileira (DD/MM/AAAA).
 * @param dataIso - String ISO AAAA-MM-DD.
 * @returns Data formatada em DD/MM/AAAA.
 */
export function formatarDataIsoParaBr(dataIso: string): string {
  const base = String(dataIso || "").slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(base);
  if (!match) return dataIso;
  const [, ano, mes, dia] = match;
  return `${dia}/${mes}/${ano}`;
}

/**
 * [RF010 / NF017]: Calcula a idade em anos completos a partir de uma data de nascimento (AAAA-MM-DD ou DD/MM/AAAA).
 * @param dataNascimento - Data de nascimento do paciente.
 * @param dataReferencia - Data base para o cálculo (padrão: hoje).
 * @returns Idade em anos completos ou null se a data for inválida ou futura.
 */
export function calcularIdade(
  dataNascimento: string,
  dataReferencia: Date = new Date(),
): number | null {
  const iso = normalizarDataParaIso(dataNascimento);
  if (!iso) return null;

  const [anoStr, mesStr, diaStr] = iso.split("-");
  const ano = Number(anoStr);
  const mes = Number(mesStr);
  const dia = Number(diaStr);

  const dtNasc = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    Number.isNaN(dtNasc.getTime()) ||
    dtNasc.getUTCFullYear() !== ano ||
    dtNasc.getUTCMonth() !== mes - 1 ||
    dtNasc.getUTCDate() !== dia
  ) {
    return null;
  }

  const hojeUtc = new Date(
    Date.UTC(
      dataReferencia.getFullYear(),
      dataReferencia.getMonth(),
      dataReferencia.getDate(),
    ),
  );

  if (dtNasc.getTime() > hojeUtc.getTime()) {
    return null;
  }

  let idade = hojeUtc.getUTCFullYear() - ano;
  const mesAtual = hojeUtc.getUTCMonth() + 1;
  const diaAtual = hojeUtc.getUTCDate();

  if (mesAtual < mes || (mesAtual === mes && diaAtual < dia)) {
    idade--;
  }

  return idade >= 0 ? idade : null;
}
