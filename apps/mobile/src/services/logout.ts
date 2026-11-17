export const MENSAGEM_CONFIRMAR_SAIDA = "Deseja realmente sair do FarmaUBS?";

/**
 * [AC-MOB-05]: A revogação no servidor pode falhar. O aparelho apaga a sessão mesmo assim.
 * @param revogar - POST de logout. Pode lançar se a rede cair.
 * @param limpar - Apaga token, usuário e UBS no SecureStore.
 */
export async function encerrarSessao(
  revogar: () => Promise<void>,
  limpar: () => Promise<void>,
): Promise<void> {
  try {
    await revogar();
  } finally {
    await limpar();
  }
}
