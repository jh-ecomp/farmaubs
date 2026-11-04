import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  FORNECEDORES_INSTITUCIONAIS_PADRAO,
  type CabecalhoRecebimentoDto,
  type TipoDocumentoRecebimento,
} from "@farmaubs/shared";
import { FileText, Building2, Calendar, CheckCircle2, AlertCircle } from "lucide-react";

export const cabecalhoRecebimentoSchema = z.object({
  numeroDocumento: z
    .string()
    .trim()
    .min(2, "Informe o número do documento fiscal ou guia da CAF")
    .max(100, "O número do documento deve ter no máximo 100 caracteres"),
  tipoDocumento: z.enum([
    "GUIA_CAF",
    "NOTA_FISCAL",
    "REMESSA_DLOG",
    "COMPRA_PREGAO",
    "DOACAO",
    "TERMO_DOACAO",
    "REMANEJAMENTO_UBS",
  ]),
  fornecedorOrigem: z
    .string()
    .min(3, "Selecione ou informe o fornecedor de origem"),
  dataRecebimento: z
    .string()
    .min(10, "Informe a data do recebimento"),
  observacoes: z.string().max(500).optional(),
});

export type CabecalhoRecebimentoFormValues = z.infer<
  typeof cabecalhoRecebimentoSchema
>;

export interface CabecalhoRecebimentoFormProps {
  valoresIniciais?: Partial<CabecalhoRecebimentoDto>;
  onChange?: (dados: CabecalhoRecebimentoDto, valido: boolean) => void;
  onValidityChange?: (valido: boolean) => void;
  resetSignal?: number;
}

/**
 * Formata a data/hora local no padrão YYYY-MM-DDTHH:mm para input datetime-local.
 * @param data - Data de referência (padrão: agora).
 * @returns String formatada compatível com input datetime-local.
 */
function obterDataHoraLocalPadrao(data: Date = new Date()): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  const hora = String(data.getHours()).padStart(2, "0");
  const min = String(data.getMinutes()).padStart(2, "0");
  return `${ano}-${mes}-${dia}T${hora}:${min}`;
}

const OPCOES_TIPO_DOCUMENTO: { valor: TipoDocumentoRecebimento; rotulo: string }[] = [
  { valor: "GUIA_CAF", rotulo: "Guia CAF" },
  { valor: "NOTA_FISCAL", rotulo: "Nota Fiscal" },
  { valor: "REMESSA_DLOG", rotulo: "Remessa Ministerial" },
  { valor: "COMPRA_PREGAO", rotulo: "Compra / Pregão" },
  { valor: "DOACAO", rotulo: "Termo de Doação" },
  { valor: "REMANEJAMENTO_UBS", rotulo: "Remanejamento entre Unidades" },
];

/**
 * Formulário de cabeçalho da Guia/Nota Fiscal de Recebimento de Medicamentos.
 * Pré-seleciona a CAF Central de Parnaíba e valida o número do documento em tempo real.
 */
export const CabecalhoRecebimentoForm: React.FC<CabecalhoRecebimentoFormProps> = ({
  valoresIniciais,
  onChange,
  onValidityChange,
  resetSignal,
}) => {
  const padraoFornecedor =
    FORNECEDORES_INSTITUCIONAIS_PADRAO.find((f) => f.padrao)?.nome ??
    "CAF Central - SMS Parnaíba";

  const {
    register,
    watch,
    reset,
    trigger,
    formState: { errors, isValid, touchedFields },
  } = useForm<CabecalhoRecebimentoFormValues>({
    resolver: zodResolver(cabecalhoRecebimentoSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      numeroDocumento: valoresIniciais?.numeroDocumento ?? "",
      tipoDocumento:
        (valoresIniciais?.tipoDocumento as TipoDocumentoRecebimento) ??
        "GUIA_CAF",
      fornecedorOrigem:
        valoresIniciais?.fornecedorOrigem ?? padraoFornecedor,
      dataRecebimento:
        valoresIniciais?.dataRecebimento ?? obterDataHoraLocalPadrao(),
      observacoes: valoresIniciais?.observacoes ?? "",
    },
  });

  useEffect(() => {
    if (resetSignal && resetSignal > 0) {
      reset({
        numeroDocumento: "",
        tipoDocumento: "GUIA_CAF",
        fornecedorOrigem: padraoFornecedor,
        dataRecebimento: obterDataHoraLocalPadrao(),
        observacoes: "",
      });
    }
  }, [resetSignal, reset, padraoFornecedor]);

  const valores = watch();
  const docValido =
    (valores.numeroDocumento ?? "").trim().length >= 2 &&
    (valores.fornecedorOrigem ?? "").trim().length >= 3 &&
    (valores.dataRecebimento ?? "").trim().length >= 10 &&
    !errors.numeroDocumento;

  useEffect(() => {
    onValidityChange?.(docValido);
    onChange?.(
      {
        numeroDocumento: (valores.numeroDocumento ?? "").trim(),
        tipoDocumento: valores.tipoDocumento ?? "GUIA_CAF",
        fornecedorOrigem: valores.fornecedorOrigem ?? padraoFornecedor,
        dataRecebimento: valores.dataRecebimento ?? obterDataHoraLocalPadrao(),
        observacoes: valores.observacoes?.trim() || undefined,
      },
      docValido,
    );
  }, [
    valores.numeroDocumento,
    valores.tipoDocumento,
    valores.fornecedorOrigem,
    valores.dataRecebimento,
    valores.observacoes,
    docValido,
    onChange,
    onValidityChange,
    padraoFornecedor,
  ]);

  const temErroNumeroDocumento = Boolean(
    errors.numeroDocumento ||
      (touchedFields.numeroDocumento &&
        (valores.numeroDocumento ?? "").trim().length < 2),
  );

  return (
    <section
      aria-labelledby="titulo-cabecalho-recebimento"
      className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-teal-50 text-teal-700">
            <FileText className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2
              id="titulo-cabecalho-recebimento"
              className="text-base font-semibold text-slate-900"
            >
              Dados da Guia ou Nota Fiscal
            </h2>
            <p className="text-xs text-slate-500">
              Identifique o documento de origem antes de adicionar os lotes recebidos.
            </p>
          </div>
        </div>

        <div
          data-testid="status-cabecalho-guia"
          aria-live="polite"
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
            docValido && isValid
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-amber-50 text-amber-700 border border-amber-200"
          }`}
        >
          {docValido ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Cabeçalho preenchido — pronto para incluir itens</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Preencha o número do documento para liberar o recebimento</span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Nº Nota Fiscal / Guia CAF */}
        <div className="md:col-span-4">
          <label
            htmlFor="numeroDocumento"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Nº Nota Fiscal / Guia CAF <span className="text-red-600">*</span>
          </label>
          <input
            id="numeroDocumento"
            type="text"
            autoFocus
            placeholder="Ex: GUIA-CAF-2026/104 ou NF 004591"
            aria-invalid={temErroNumeroDocumento ? "true" : "false"}
            aria-describedby={
              temErroNumeroDocumento ? "erro-numero-documento" : undefined
            }
            {...register("numeroDocumento", {
              onBlur: () => {
                void trigger("numeroDocumento");
              },
            })}
            className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors ${
              temErroNumeroDocumento
                ? "border-red-500 focus:ring-red-500 bg-red-50/30"
                : "border-slate-300 focus:ring-teal-600 focus:border-teal-600"
            }`}
          />
          {temErroNumeroDocumento && (
            <p
              id="erro-numero-documento"
              role="alert"
              className="mt-1 text-xs font-medium text-red-600"
            >
              {errors.numeroDocumento?.message ||
                "Informe o número do documento fiscal ou guia da CAF"}
            </p>
          )}
        </div>

        {/* Tipo de Documento */}
        <div className="md:col-span-3">
          <label
            htmlFor="tipoDocumento"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Tipo de Documento <span className="text-red-600">*</span>
          </label>
          <select
            id="tipoDocumento"
            {...register("tipoDocumento")}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
          >
            {OPCOES_TIPO_DOCUMENTO.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </select>
        </div>

        {/* Fornecedor / Origem */}
        <div className="md:col-span-3">
          <label
            htmlFor="fornecedorOrigem"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            <span className="inline-flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              Fornecedor / Origem <span className="text-red-600">*</span>
            </span>
          </label>
          <select
            id="fornecedorOrigem"
            {...register("fornecedorOrigem")}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
          >
            {FORNECEDORES_INSTITUCIONAIS_PADRAO.map((fornecedor) => (
              <option key={fornecedor.id} value={fornecedor.nome}>
                {fornecedor.nome}
              </option>
            ))}
          </select>
          {errors.fornecedorOrigem && (
            <p role="alert" className="mt-1 text-xs font-medium text-red-600">
              {errors.fornecedorOrigem.message}
            </p>
          )}
        </div>

        {/* Data/Hora do Recebimento */}
        <div className="md:col-span-2">
          <label
            htmlFor="dataRecebimento"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              Data/Hora do Recebimento
            </span>
          </label>
          <input
            id="dataRecebimento"
            type="datetime-local"
            {...register("dataRecebimento")}
            className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
          />
        </div>

        {/* Observações da Carga */}
        <div className="md:col-span-12">
          <label
            htmlFor="observacoesCabecalho"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Observações da Guia (opcional)
          </label>
          <input
            id="observacoesCabecalho"
            type="text"
            placeholder="Ex: Carga recebida sem avarias na embalagem térmica"
            {...register("observacoes")}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
          />
        </div>
      </div>
    </section>
  );
};
