import { useState, useEffect, type FormEvent, type ChangeEvent } from "react";
import {
  calcularIdade,
  formatarCNS,
  formatarCPF,
  formatarDataIsoParaBr,
  formatarMascaraDataBr,
  limparNaoNumericos,
  normalizarDataParaIso,
  validarCNS,
  validarCPF,
  type ItemHistoricoConsumoDto,
  type PacienteDispensacaoRequest,
  type PacienteDto,
} from "@farmaubs/shared";
import { usePacienteDispensacao } from "../../hooks/usePacienteDispensacao";
import { HistoricoConsumoPacienteCard } from "./HistoricoConsumoPacienteCard";

export interface IdentificacaoPacienteFormProps {
  valorInicial?: Partial<PacienteDispensacaoRequest>;
  historicoInicial?: ItemHistoricoConsumoDto[];
  onPacienteValidoChange?: (
    paciente: PacienteDispensacaoRequest | null,
    valido: boolean,
  ) => void;
  onConfirmarPaciente?: (paciente: PacienteDispensacaoRequest) => void;
  exibirBotaoAvancar?: boolean;
  resetSignal?: number;
}

interface ErrosPacienteForm {
  cns?: string;
  cpf?: string;
  nomeCompleto?: string;
  dataNascimento?: string;
}

/**
 * [NF017]: Capitaliza visualmente as iniciais de cada palavra do nome do paciente.
 * @param nome - Texto digitado no campo Nome Completo.
 * @returns Nome com iniciais em maiúsculo.
 */
function capitalizarIniciaisNome(nome: string): string {
  const preposicoes = new Set(["da", "de", "do", "das", "dos", "e"]);
  return nome
    .split(" ")
    .map((palavra, idx) => {
      if (!palavra) return "";
      const lower = palavra.toLowerCase();
      if (idx > 0 && preposicoes.has(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/**
 * [RF010 / RF012 / NF017 / ADR-032]: Formulário obrigatório de identificação do paciente (CNS, CPF, Nome e Data de Nascimento)
 * com máscaras reativas, autocompletação via API e exibição do histórico de consumo dos últimos 90 dias.
 */
export function IdentificacaoPacienteForm({
  valorInicial,
  historicoInicial = [],
  onPacienteValidoChange,
  onConfirmarPaciente,
  exibirBotaoAvancar = true,
  resetSignal = 0,
}: IdentificacaoPacienteFormProps) {
  const {
    pacienteSelecionado,
    historicoConsumo,
    buscandoPaciente,
    carregandoHistorico,
    buscarPacienteImediato,
    dispararBuscaDebounced,
    limparPaciente,
  } = usePacienteDispensacao(historicoInicial);

  const [pacienteId, setPacienteId] = useState<string | undefined>(
    valorInicial?.id,
  );
  const [cns, setCns] = useState<string>(() =>
    valorInicial?.cns ? formatarCNS(valorInicial.cns) : "",
  );
  const [cpf, setCpf] = useState<string>(() =>
    valorInicial?.cpf ? formatarCPF(valorInicial.cpf) : "",
  );
  const [nomeCompleto, setNomeCompleto] = useState<string>(
    valorInicial?.nomeCompleto ?? "",
  );
  const [dataNascimento, setDataNascimento] = useState<string>(() =>
    valorInicial?.dataNascimento
      ? formatarDataIsoParaBr(valorInicial.dataNascimento)
      : "",
  );
  const [erros, setErros] = useState<ErrosPacienteForm>({});
  const [mostrarHistorico, setMostrarHistorico] = useState<boolean>(
    historicoInicial.length > 0,
  );

  // Reset externo após conclusão do atendimento (DI-09)
  useEffect(() => {
    if (resetSignal > 0) {
      setPacienteId(undefined);
      setCns("");
      setCpf("");
      setNomeCompleto("");
      setDataNascimento("");
      setErros({});
      setMostrarHistorico(false);
      limparPaciente();
    }
  }, [resetSignal, limparPaciente]);

  /**
   * [RF010]: Preenche automaticamente os campos do formulário quando um paciente existente é localizado.
   * @param encontrado - Paciente retornado pela API.
   */
  const aplicarPacienteEncontrado = (encontrado: PacienteDto) => {
    setPacienteId(encontrado.id);
    if (encontrado.cns) {
      setCns(formatarCNS(encontrado.cns));
    }
    if (encontrado.cpf) {
      setCpf(formatarCPF(encontrado.cpf));
    }
    setNomeCompleto(encontrado.nomeCompleto);
    setDataNascimento(formatarDataIsoParaBr(encontrado.dataNascimento));
    setErros({});
    setMostrarHistorico(true);
  };

  /**
   * [RF010 / NF017]: Valida todos os 4 campos obrigatórios e retorna o objeto de erros.
   */
  const validarCampos = (valores: {
    cnsVal: string;
    cpfVal: string;
    nomeVal: string;
    dataVal: string;
  }): ErrosPacienteForm => {
    const novosErros: ErrosPacienteForm = {};
    const cnsLimpo = limparNaoNumericos(valores.cnsVal);
    const cpfLimpo = limparNaoNumericos(valores.cpfVal);
    const nomeLimpo = valores.nomeVal.trim();
    const dataIso = normalizarDataParaIso(valores.dataVal);

    if (!cnsLimpo) {
      novosErros.cns = "O Cartão Nacional de Saúde (CNS) é obrigatório.";
    } else if (!validarCNS(cnsLimpo)) {
      novosErros.cns = "CNS inválido. Informe os 15 dígitos numéricos.";
    }

    if (!cpfLimpo) {
      novosErros.cpf = "O CPF do paciente é obrigatório.";
    } else if (!validarCPF(cpfLimpo)) {
      novosErros.cpf = "CPF inválido. Verifique os dígitos informados.";
    }

    if (!nomeLimpo) {
      novosErros.nomeCompleto = "O nome completo do paciente é obrigatório.";
    } else if (nomeLimpo.length < 3) {
      novosErros.nomeCompleto =
        "O nome completo deve ter no mínimo 3 caracteres.";
    }

    if (!valores.dataVal.trim()) {
      novosErros.dataNascimento = "A data de nascimento é obrigatória.";
    } else if (!dataIso) {
      novosErros.dataNascimento =
        "Data de nascimento inválida. Use o formato DD/MM/AAAA.";
    } else {
      const idadeCalculada = calcularIdade(dataIso);
      if (idadeCalculada === null) {
        novosErros.dataNascimento =
          "Data de nascimento inválida ou no futuro.";
      }
    }

    return novosErros;
  };

  // Notifica o container pai sobre a validade em tempo real dos 4 campos (DI-09)
  useEffect(() => {
    if (!onPacienteValidoChange) return;
    const validacao = validarCampos({
      cnsVal: cns,
      cpfVal: cpf,
      nomeVal: nomeCompleto,
      dataVal: dataNascimento,
    });
    const ehValido = Object.keys(validacao).length === 0;
    if (ehValido) {
      onPacienteValidoChange(
        {
          id: pacienteId,
          cns: limparNaoNumericos(cns),
          cpf: limparNaoNumericos(cpf),
          nomeCompleto: nomeCompleto.trim(),
          dataNascimento: normalizarDataParaIso(dataNascimento),
        },
        true,
      );
    } else {
      onPacienteValidoChange(null, false);
    }
  }, [cns, cpf, nomeCompleto, dataNascimento, pacienteId, onPacienteValidoChange]);

  const handleCnsChange = (e: ChangeEvent<HTMLInputElement>) => {
    const formatado = formatarCNS(e.target.value);
    setCns(formatado);
    if (erros.cns) {
      setErros((prev) => ({ ...prev, cns: undefined }));
    }
    const digitos = limparNaoNumericos(formatado);
    if (digitos.length === 15 && validarCNS(digitos)) {
      void buscarPacienteImediato(digitos).then((encontrado) => {
        if (encontrado) aplicarPacienteEncontrado(encontrado);
      });
    } else if (digitos.length >= 6) {
      dispararBuscaDebounced(digitos, 300);
    }
  };

  const handleCpfChange = (e: ChangeEvent<HTMLInputElement>) => {
    const formatado = formatarCPF(e.target.value);
    setCpf(formatado);
    if (erros.cpf) {
      setErros((prev) => ({ ...prev, cpf: undefined }));
    }
    const digitos = limparNaoNumericos(formatado);
    if (digitos.length === 11) {
      if (!validarCPF(digitos)) {
        setErros((prev) => ({
          ...prev,
          cpf: "CPF inválido. Verifique os dígitos informados.",
        }));
      } else {
        void buscarPacienteImediato(digitos).then((encontrado) => {
          if (encontrado) aplicarPacienteEncontrado(encontrado);
        });
      }
    } else if (digitos.length >= 6) {
      dispararBuscaDebounced(digitos, 300);
    }
  };

  const handleNomeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const capitalizado = capitalizarIniciaisNome(e.target.value);
    setNomeCompleto(capitalizado);
    if (erros.nomeCompleto) {
      setErros((prev) => ({ ...prev, nomeCompleto: undefined }));
    }
  };

  const handleDataChange = (e: ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
      setDataNascimento(formatarDataIsoParaBr(valor));
    } else {
      setDataNascimento(formatarMascaraDataBr(valor));
    }
    if (erros.dataNascimento) {
      setErros((prev) => ({ ...prev, dataNascimento: undefined }));
    }
  };

  const handleBlurCns = () => {
    const cnsLimpo = limparNaoNumericos(cns);
    if (!cnsLimpo) return;
    if (!validarCNS(cnsLimpo)) {
      setErros((prev) => ({
        ...prev,
        cns: "CNS inválido. Informe os 15 dígitos numéricos.",
      }));
    }
  };

  const handleBlurCpf = () => {
    const cpfLimpo = limparNaoNumericos(cpf);
    if (!cpfLimpo) return;
    if (!validarCPF(cpfLimpo)) {
      setErros((prev) => ({
        ...prev,
        cpf: "CPF inválido. Verifique os dígitos informados.",
      }));
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const novosErros = validarCampos({
      cnsVal: cns,
      cpfVal: cpf,
      nomeVal: nomeCompleto,
      dataVal: dataNascimento,
    });
    setErros(novosErros);

    if (Object.keys(novosErros).length > 0) {
      return;
    }

    const payload: PacienteDispensacaoRequest = {
      id: pacienteId,
      cns: limparNaoNumericos(cns),
      cpf: limparNaoNumericos(cpf),
      nomeCompleto: nomeCompleto.trim(),
      dataNascimento: normalizarDataParaIso(dataNascimento),
    };

    onConfirmarPaciente?.(payload);
  };

  const idadePaciente = calcularIdade(dataNascimento);
  const deveExibirHistorico =
    mostrarHistorico ||
    Boolean(pacienteSelecionado) ||
    historicoConsumo.length > 0;

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit}
        noValidate
        aria-label="Identificação Obrigatória do Paciente"
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              1. Identificação do Paciente
            </h2>
            <p className="text-xs text-slate-500">
              Informe os dados do paciente para localizar o cadastro e consultar
              retiradas anteriores
            </p>
          </div>
          {buscandoPaciente && (
            <span
              role="status"
              className="text-xs font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full"
            >
              Buscando cadastro...
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Campo CPF */}
          <div>
            <label
              htmlFor="paciente-cpf"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              CPF <span className="text-red-600">*</span>
            </label>
            <input
              id="paciente-cpf"
              name="cpf"
              type="text"
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={handleCpfChange}
              onBlur={handleBlurCpf}
              aria-invalid={Boolean(erros.cpf)}
              aria-describedby={erros.cpf ? "erro-paciente-cpf" : undefined}
              className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 ${
                erros.cpf
                  ? "border-red-500 focus:ring-red-500"
                  : "border-slate-300 focus:ring-blue-600"
              }`}
            />
            {erros.cpf && (
              <p
                id="erro-paciente-cpf"
                role="alert"
                className="mt-1 text-xs font-medium text-red-600"
              >
                {erros.cpf}
              </p>
            )}
          </div>

          {/* Campo CNS */}
          <div>
            <label
              htmlFor="paciente-cns"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Cartão Nacional de Saúde (CNS){" "}
              <span className="text-red-600">*</span>
            </label>
            <input
              id="paciente-cns"
              name="cns"
              type="text"
              inputMode="numeric"
              placeholder="000 0000 0000 0000"
              value={cns}
              onChange={handleCnsChange}
              onBlur={handleBlurCns}
              aria-invalid={Boolean(erros.cns)}
              aria-describedby={erros.cns ? "erro-paciente-cns" : undefined}
              className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 ${
                erros.cns
                  ? "border-red-500 focus:ring-red-500"
                  : "border-slate-300 focus:ring-blue-600"
              }`}
            />
            {erros.cns && (
              <p
                id="erro-paciente-cns"
                role="alert"
                className="mt-1 text-xs font-medium text-red-600"
              >
                {erros.cns}
              </p>
            )}
          </div>

          {/* Campo Nome Completo */}
          <div>
            <label
              htmlFor="paciente-nome"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Nome Completo <span className="text-red-600">*</span>
            </label>
            <input
              id="paciente-nome"
              name="nomeCompleto"
              type="text"
              placeholder="Nome completo do paciente"
              value={nomeCompleto}
              onChange={handleNomeChange}
              aria-invalid={Boolean(erros.nomeCompleto)}
              aria-describedby={
                erros.nomeCompleto ? "erro-paciente-nome" : undefined
              }
              className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 ${
                erros.nomeCompleto
                  ? "border-red-500 focus:ring-red-500"
                  : "border-slate-300 focus:ring-blue-600"
              }`}
            />
            {erros.nomeCompleto && (
              <p
                id="erro-paciente-nome"
                role="alert"
                className="mt-1 text-xs font-medium text-red-600"
              >
                {erros.nomeCompleto}
              </p>
            )}
          </div>

          {/* Campo Data de Nascimento */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="paciente-data-nascimento"
                className="block text-xs font-semibold text-slate-700"
              >
                Data de Nascimento <span className="text-red-600">*</span>
              </label>
              {idadePaciente !== null && (
                <span
                  data-testid="badge-idade-paciente"
                  className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800 border border-blue-200"
                >
                  {idadePaciente} {idadePaciente === 1 ? "ano" : "anos"}
                </span>
              )}
            </div>
            <input
              id="paciente-data-nascimento"
              name="dataNascimento"
              type="text"
              inputMode="numeric"
              placeholder="DD/MM/AAAA"
              value={dataNascimento}
              onChange={handleDataChange}
              aria-invalid={Boolean(erros.dataNascimento)}
              aria-describedby={
                erros.dataNascimento ? "erro-paciente-data" : undefined
              }
              className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 ${
                erros.dataNascimento
                  ? "border-red-500 focus:ring-red-500"
                  : "border-slate-300 focus:ring-blue-600"
              }`}
            />
            {erros.dataNascimento && (
              <p
                id="erro-paciente-data"
                role="alert"
                className="mt-1 text-xs font-medium text-red-600"
              >
                {erros.dataNascimento}
              </p>
            )}
          </div>
        </div>

        {exibirBotaoAvancar && (
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              Confirmar Identificação
            </button>
          </div>
        )}
      </form>

      {deveExibirHistorico && (
        <HistoricoConsumoPacienteCard
          itens={historicoConsumo}
          carregando={carregandoHistorico}
          pacienteNome={nomeCompleto || pacienteSelecionado?.nomeCompleto}
        />
      )}
    </div>
  );
}

export default IdentificacaoPacienteForm;
