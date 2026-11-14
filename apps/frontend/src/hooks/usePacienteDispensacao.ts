import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  limparNaoNumericos,
  type ItemHistoricoConsumoDto,
  type PacienteDto,
} from "@farmaubs/shared";
import { pacienteService } from "../services/paciente.service";

export interface UsePacienteDispensacaoRetorno {
  pacienteSelecionado: PacienteDto | null;
  sugestoesPacientes: PacienteDto[];
  historicoConsumo: ItemHistoricoConsumoDto[];
  buscandoPaciente: boolean;
  carregandoHistorico: boolean;
  erroBusca: string | null;
  dispararBuscaDebounced: (termo: string, delayMs?: number) => void;
  buscarPacienteImediato: (termo: string) => Promise<PacienteDto | null>;
  selecionarPaciente: (paciente: PacienteDto | null) => Promise<void>;
  definirHistoricoManual: (itens: ItemHistoricoConsumoDto[]) => void;
  limparPaciente: () => void;
}

/**
 * [RF010 / RF012 / ADR-013]: Hook gerenciador de busca de pacientes com debounce (300ms),
 * autocompletação por CPF/CNS, cache via TanStack Query e consulta de histórico de 90 dias.
 * @param historicoInicial - Lista opcional de histórico pré-carregada.
 * @returns Estado e ações para identificação do paciente na bancada de dispensação.
 */
export function usePacienteDispensacao(
  historicoInicial: ItemHistoricoConsumoDto[] = [],
): UsePacienteDispensacaoRetorno {
  let queryClient: ReturnType<typeof useQueryClient> | null = null;
  try {
    queryClient = useQueryClient();
  } catch {
    // Permite execução resiliente em testes unitários sem QueryClientProvider
  }

  const [pacienteSelecionado, setPacienteSelecionado] =
    useState<PacienteDto | null>(null);
  const [sugestoesPacientes, setSugestoesPacientes] = useState<PacienteDto[]>(
    [],
  );
  const [historicoConsumo, setHistoricoConsumo] =
    useState<ItemHistoricoConsumoDto[]>(historicoInicial);
  const [buscandoPaciente, setBuscandoPaciente] = useState(false);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * [RF012]: Carrega o histórico de dispensas dos últimos 90 dias do paciente identificado.
   * @param pacienteId - UUID do paciente.
   */
  const carregarHistoricoPaciente = useCallback(
    async (pacienteId: string) => {
      if (!pacienteId) return;
      setCarregandoHistorico(true);
      try {
        const resultado = queryClient
          ? await queryClient.fetchQuery({
              queryKey: ["paciente-historico", pacienteId],
              queryFn: () => pacienteService.consultarHistorico(pacienteId),
              staleTime: 30_000,
            })
          : await pacienteService.consultarHistorico(pacienteId);

        if (resultado && Array.isArray(resultado.itensConsumo)) {
          setHistoricoConsumo(resultado.itensConsumo);
        }
      } catch {
        // Mantém histórico atual ou vazio caso o endpoint retorne erro
      } finally {
        setCarregandoHistorico(false);
      }
    },
    [queryClient],
  );

  /**
   * [RF010]: Seleciona um paciente e dispara a busca do seu histórico de consumo recente.
   * @param paciente - Objeto PacienteDto ou null para limpar.
   */
  const selecionarPaciente = useCallback(
    async (paciente: PacienteDto | null) => {
      setPacienteSelecionado(paciente);
      if (paciente?.id) {
        await carregarHistoricoPaciente(paciente.id);
      } else {
        setHistoricoConsumo([]);
      }
    },
    [carregarHistoricoPaciente],
  );

  /**
   * [RF010]: Executa a busca imediata de paciente por CPF, CNS ou nome e autocompleta se houver match exato.
   * @param termo - Documento ou nome pesquisado.
   * @returns Paciente encontrado em match exato ou primeiro resultado, ou null.
   */
  const buscarPacienteImediato = useCallback(
    async (termo: string): Promise<PacienteDto | null> => {
      const limpo = termo.trim();
      if (limpo.length < 3) {
        setSugestoesPacientes([]);
        return null;
      }

      setBuscandoPaciente(true);
      setErroBusca(null);
      try {
        const lista = queryClient
          ? await queryClient.fetchQuery({
              queryKey: ["pacientes-busca", limpo],
              queryFn: () => pacienteService.buscarPacientes(limpo),
              staleTime: 30_000,
            })
          : await pacienteService.buscarPacientes(limpo);

        const resultados = Array.isArray(lista) ? lista : [];
        setSugestoesPacientes(resultados);

        const digitosBusca = limparNaoNumericos(limpo);
        const matchExato =
          resultados.find((p) => {
            const cpfDigitos = limparNaoNumericos(p.cpf || "");
            const cnsDigitos = limparNaoNumericos(p.cns || "");
            return (
              (digitosBusca.length === 11 && cpfDigitos === digitosBusca) ||
              (digitosBusca.length === 15 && cnsDigitos === digitosBusca)
            );
          }) ?? (resultados.length === 1 ? resultados[0] : null);

        if (matchExato) {
          await selecionarPaciente(matchExato);
          return matchExato;
        }

        return null;
      } catch (err) {
        setErroBusca(
          err instanceof Error ? err.message : "Erro ao buscar paciente.",
        );
        return null;
      } finally {
        setBuscandoPaciente(false);
      }
    },
    [queryClient, selecionarPaciente],
  );

  /**
   * [RF010 / NF010]: Agenda busca de paciente com debounce padrão de 300ms.
   * @param termo - CPF, CNS ou nome digitado.
   * @param delayMs - Tempo de debounce em milissegundos (padrão: 300ms).
   */
  const dispararBuscaDebounced = useCallback(
    (termo: string, delayMs = 300) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        void buscarPacienteImediato(termo);
      }, delayMs);
    },
    [buscarPacienteImediato],
  );

  const definirHistoricoManual = useCallback(
    (itens: ItemHistoricoConsumoDto[]) => {
      setHistoricoConsumo(itens);
    },
    [],
  );

  const limparPaciente = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setPacienteSelecionado(null);
    setSugestoesPacientes([]);
    setHistoricoConsumo([]);
    setErroBusca(null);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    pacienteSelecionado,
    sugestoesPacientes,
    historicoConsumo,
    buscandoPaciente,
    carregandoHistorico,
    erroBusca,
    dispararBuscaDebounced,
    buscarPacienteImediato,
    selecionarPaciente,
    definirHistoricoManual,
    limparPaciente,
  };
}
