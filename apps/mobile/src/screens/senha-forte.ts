export type ItemSenha = {
  id: string;
  rotulo: string;
  atendido: boolean;
};

export const MENSAGEM_SENHAS_DIFERENTES = "As senhas não coincidem";
export const MENSAGEM_SENHA_ALTERADA = "Senha alterada com sucesso!";

/**
 * [NF011]: Os cinco itens do checklist, na ordem da história.
 * @param senha - O que está digitado em Nova senha.
 * @returns Cada regra com atendido true ou false.
 */
export function checklistSenha(senha: string): ItemSenha[] {
  return [
    { id: "tamanho", rotulo: "Mínimo de 8 caracteres", atendido: senha.length >= 8 },
    { id: "maiuscula", rotulo: "Pelo menos 1 letra maiúscula", atendido: /[A-Z]/.test(senha) },
    { id: "minuscula", rotulo: "Pelo menos 1 letra minúscula", atendido: /[a-z]/.test(senha) },
    { id: "numero", rotulo: "Pelo menos 1 número", atendido: /[0-9]/.test(senha) },
    {
      id: "especial",
      rotulo: "Pelo menos 1 caractere especial",
      atendido: /[^a-zA-Z0-9]/.test(senha),
    },
  ];
}

/**
 * [AC-MOB-04]: A confirmação só vale quando as duas senhas foram digitadas e são iguais.
 * @param novaSenha - Campo Nova senha.
 * @param confirmacao - Campo Confirmar nova senha.
 * @returns True se pode comparar e os textos são iguais.
 */
export function senhasCoincidem(novaSenha: string, confirmacao: string): boolean {
  return novaSenha.length > 0 && novaSenha === confirmacao;
}

/**
 * [AC-MOB-04]: O botão Salvar só liga com o checklist completo e a confirmação igual.
 * @param novaSenha - Campo Nova senha.
 * @param confirmacao - Campo Confirmar nova senha.
 * @returns True quando a API pode receber a senha.
 */
export function podeSalvarSenha(novaSenha: string, confirmacao: string): boolean {
  return checklistSenha(novaSenha).every((item) => item.atendido) && senhasCoincidem(novaSenha, confirmacao);
}
