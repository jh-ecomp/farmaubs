/**
 * [RL-07]: Controla a exibição de rotas de incrementos futuros (<EmDesenvolvimento />).
 * Em produção e desenvolvimento padrão, VITE_SHOW_FUTURE_MODULES é false.
 * Em ambiente de testes unitários isolados (MODE === 'test'), preserva a matriz completa
 * quando a variável não foi definida explicitamente, permitindo validar ambos os cenários.
 * @param override - Sobrescrita explícita opcional via prop de componente.
 * @returns Verdadeiro se módulos futuros devem aparecer na navegação.
 */
export function isFutureModulesEnabled(override?: boolean): boolean {
  if (typeof override === "boolean") {
    return override;
  }
  const raw = import.meta.env.VITE_SHOW_FUTURE_MODULES;
  if (raw !== undefined && raw !== "") {
    return String(raw).toLowerCase() === "true";
  }
  return import.meta.env.MODE === "test";
}
