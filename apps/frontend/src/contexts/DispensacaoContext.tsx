import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import {
  calcularTotaisCarrinho,
  normalizarDataParaIso,
  validarReceitaAntimicrobiano,
  type LoteDisponivelDto,
  type MedicamentoBuscaDto,
  type PacienteDispensacaoRequest,
  type TotaisCarrinhoDispensacao,
  type ValidacaoReceitaAntimicrobianoResultado,
} from "@farmaubs/shared";

export interface ItemCarrinhoDispensacao {
  medicamento: MedicamentoBuscaDto;
  lote: LoteDisponivelDto;
  quantidadeDispensada: number;
  posologia: string;
}

export interface DispensacaoContextValue {
  paciente: PacienteDispensacaoRequest | null;
  pacienteValido: boolean;
  itens: ItemCarrinhoDispensacao[];
  receitaEmissaoEm: string;
  contemAntimicrobiano: boolean;
  validacaoReceita: ValidacaoReceitaAntimicrobianoResultado;
  totais: TotaisCarrinhoDispensacao;
  podeFinalizarAtendimento: boolean;
  definirPaciente: (
    paciente: PacienteDispensacaoRequest | null,
    valido: boolean,
  ) => void;
  adicionarItem: (novo: {
    medicamento: MedicamentoBuscaDto;
    lote: LoteDisponivelDto;
    quantidade: number;
    posologia?: string;
  }) => void;
  atualizarQuantidadeItem: (
    medicamentoId: string,
    loteId: string,
    quantidade: number,
  ) => void;
  atualizarPosologiaItem: (
    medicamentoId: string,
    loteId: string,
    posologia: string,
  ) => void;
  removerItem: (medicamentoId: string, loteId: string) => void;
  definirReceitaEmissaoEm: (data: string) => void;
  limparAtendimento: () => void;
}

const DispensacaoContext = createContext<DispensacaoContextValue | undefined>(
  undefined,
);

export interface DispensacaoProviderProps {
  children: ReactNode;
  itensIniciais?: ItemCarrinhoDispensacao[];
  receitaInicial?: string;
  dataReferencia?: Date;
}

/**
 * [RF010 / ADR-013]: Provedor de estado do carrinho da receita médica, gerenciando paciente identificado,
 * múltiplos medicamentos por atendimento, incremento de lote repetido, posologias e validação de antimicrobianos.
 */
export function DispensacaoProvider({
  children,
  itensIniciais = [],
  receitaInicial = "",
  dataReferencia,
}: DispensacaoProviderProps) {
  const [paciente, setPaciente] = useState<PacienteDispensacaoRequest | null>(
    null,
  );
  const [pacienteValido, setPacienteValido] = useState<boolean>(false);
  const [itens, setItens] = useState<ItemCarrinhoDispensacao[]>(itensIniciais);
  const [receitaEmissaoEm, setReceitaEmissaoEm] =
    useState<string>(receitaInicial);

  const definirPaciente = useCallback(
    (novoPaciente: PacienteDispensacaoRequest | null, valido: boolean) => {
      setPaciente(novoPaciente);
      setPacienteValido(valido);
    },
    [],
  );

  const adicionarItem = useCallback(
    (novo: {
      medicamento: MedicamentoBuscaDto;
      lote: LoteDisponivelDto;
      quantidade: number;
      posologia?: string;
    }) => {
      const qtdAdicionar = Math.max(1, novo.quantidade);
      setItens((atuais) => {
        const idxExistente = atuais.findIndex(
          (i) =>
            i.medicamento.id === novo.medicamento.id &&
            i.lote.id === novo.lote.id,
        );
        if (idxExistente >= 0) {
          const copia = [...atuais];
          const itemAtual = copia[idxExistente];
          const novaQtd = Math.min(
            itemAtual.lote.saldoDisponivel,
            itemAtual.quantidadeDispensada + qtdAdicionar,
          );
          copia[idxExistente] = {
            ...itemAtual,
            quantidadeDispensada: novaQtd,
            posologia: novo.posologia?.trim()
              ? novo.posologia.trim()
              : itemAtual.posologia,
          };
          return copia;
        }

        return [
          ...atuais,
          {
            medicamento: novo.medicamento,
            lote: novo.lote,
            quantidadeDispensada: Math.min(
              novo.lote.saldoDisponivel,
              qtdAdicionar,
            ),
            posologia: novo.posologia?.trim() ?? "",
          },
        ];
      });
    },
    [],
  );

  const atualizarQuantidadeItem = useCallback(
    (medicamentoId: string, loteId: string, quantidade: number) => {
      setItens((atuais) =>
        atuais.map((item) => {
          if (
            item.medicamento.id === medicamentoId &&
            item.lote.id === loteId
          ) {
            const limitada = Math.max(
              1,
              Math.min(item.lote.saldoDisponivel, quantidade || 1),
            );
            return { ...item, quantidadeDispensada: limitada };
          }
          return item;
        }),
      );
    },
    [],
  );

  const atualizarPosologiaItem = useCallback(
    (medicamentoId: string, loteId: string, posologia: string) => {
      setItens((atuais) =>
        atuais.map((item) =>
          item.medicamento.id === medicamentoId && item.lote.id === loteId
            ? { ...item, posologia }
            : item,
        ),
      );
    },
    [],
  );

  const removerItem = useCallback((medicamentoId: string, loteId: string) => {
    setItens((atuais) =>
      atuais.filter(
        (item) =>
          !(item.medicamento.id === medicamentoId && item.lote.id === loteId),
      ),
    );
  }, []);

  const definirReceitaEmissaoEm = useCallback((data: string) => {
    setReceitaEmissaoEm(data);
  }, []);

  const limparAtendimento = useCallback(() => {
    setPaciente(null);
    setPacienteValido(false);
    setItens([]);
    setReceitaEmissaoEm("");
  }, []);

  const contemAntimicrobiano = useMemo(
    () =>
      itens.some(
        (i) =>
          i.medicamento.antimicrobiano || i.medicamento.requerDataReceita,
      ),
    [itens],
  );

  const validacaoReceita = useMemo(() => {
    const iso = normalizarDataParaIso(receitaEmissaoEm) || receitaEmissaoEm;
    return validarReceitaAntimicrobiano(
      iso,
      contemAntimicrobiano,
      dataReferencia ?? new Date(),
    );
  }, [receitaEmissaoEm, contemAntimicrobiano, dataReferencia]);

  const totais = useMemo(() => calcularTotaisCarrinho(itens), [itens]);

  const itensValidos = useMemo(
    () =>
      itens.length > 0 &&
      itens.every(
        (i) =>
          i.quantidadeDispensada >= 1 &&
          i.quantidadeDispensada <= i.lote.saldoDisponivel,
      ),
    [itens],
  );

  const podeFinalizarAtendimento =
    pacienteValido &&
    Boolean(paciente) &&
    itensValidos &&
    validacaoReceita.valida;

  const value: DispensacaoContextValue = {
    paciente,
    pacienteValido,
    itens,
    receitaEmissaoEm,
    contemAntimicrobiano,
    validacaoReceita,
    totais,
    podeFinalizarAtendimento,
    definirPaciente,
    adicionarItem,
    atualizarQuantidadeItem,
    atualizarPosologiaItem,
    removerItem,
    definirReceitaEmissaoEm,
    limparAtendimento,
  };

  return (
    <DispensacaoContext.Provider value={value}>
      {children}
    </DispensacaoContext.Provider>
  );
}

/**
 * [RF010]: Hook de acesso ao contexto de dispensação.
 */
export function useDispensacao(): DispensacaoContextValue {
  const ctx = useContext(DispensacaoContext);
  if (!ctx) {
    throw new Error(
      "useDispensacao deve ser utilizado dentro de um DispensacaoProvider.",
    );
  }
  return ctx;
}
