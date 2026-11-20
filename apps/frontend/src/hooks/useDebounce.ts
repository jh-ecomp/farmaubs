import { useEffect, useState } from "react";

/**
 * [NF007 / ES-08]: Hook utilitário de debounce para postergar a atualização de um valor reativo.
 * @param valor - Valor original em rápida mutação (ex.: digitação no campo de busca).
 * @param atrasoMs - Tempo de espera em milissegundos (padrão: 300ms).
 * @returns Valor estabilizado após o intervalo de inatividade.
 */
export function useDebounce<T>(valor: T, atrasoMs: number = 300): T {
  const [valorDebounced, setValorDebounced] = useState<T>(valor);

  useEffect(() => {
    const timer = setTimeout(() => {
      setValorDebounced(valor);
    }, atrasoMs);

    return () => {
      clearTimeout(timer);
    };
  }, [valor, atrasoMs]);

  return valorDebounced;
}
