import type { ChangeEvent } from "react";
import {
  normalizarDataParaIso,
  validarReceitaAntimicrobiano,
  type ValidacaoReceitaAntimicrobianoResultado,
} from "@farmaubs/shared";

export interface ValidacaoReceitaAntimicrobianoProps {
  visivel?: boolean;
  dataEmissao: string;
  onChangeDataEmissao: (novaData: string) => void;
  dataReferencia?: Date;
  validacaoExterna?: ValidacaoReceitaAntimicrobianoResultado;
}

/**
 * [RF010 / NF017 / ADR-032]: Componente de validação legal de receituário de antimicrobianos (RDC 20/2011),
 * exigindo data de emissão e bloqueando receitas vencidas (> 10 dias corridos) ou com data futura.
 */
export function ValidacaoReceitaAntimicrobiano({
  visivel = true,
  dataEmissao,
  onChangeDataEmissao,
  dataReferencia,
  validacaoExterna,
}: ValidacaoReceitaAntimicrobianoProps) {
  if (!visivel) {
    return null;
  }

  const iso = normalizarDataParaIso(dataEmissao) || dataEmissao;
  const validacao =
    validacaoExterna ??
    validarReceitaAntimicrobiano(iso, true, dataReferencia ?? new Date());

  const temDataPreenchida = dataEmissao.trim().length > 0;
  const exibirErro = temDataPreenchida && !validacao.valida;

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChangeDataEmissao(e.target.value);
  };

  return (
    <div
      data-testid="validacao-receita-antimicrobiano"
      className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 space-y-3"
    >
      <div
        role="note"
        className="flex items-start gap-2 text-xs text-blue-950"
      >
        <span aria-hidden="true" className="text-sm font-bold text-blue-700">
          ℹ️
        </span>
        <p>
          <strong>Prescrição contém antimicrobianos.</strong> Validade legal da
          receita: 10 dias corridos a partir da emissão.
        </p>
      </div>

      <div>
        <label
          htmlFor="data-emissao-receita-input"
          className="block text-xs font-semibold text-slate-800 mb-1"
        >
          Data de Emissão da Receita Médica{" "}
          <span className="text-red-600">*</span>
        </label>
        <input
          id="data-emissao-receita-input"
          name="receitaEmissaoEm"
          type="date"
          required
          value={iso}
          onChange={handleInputChange}
          aria-invalid={exibirErro}
          aria-describedby={
            exibirErro ? "erro-validacao-antimicrobiano" : undefined
          }
          className={`w-full sm:w-64 rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 ${
            exibirErro
              ? "border-red-500 focus:ring-red-500"
              : "border-slate-300 focus:ring-blue-600"
          }`}
        />
      </div>

      {exibirErro && validacao.motivo === "PRAZO_EXPIRADO" && (
        <div
          id="erro-validacao-antimicrobiano"
          role="alert"
          data-testid="erro-receita-expirada"
          className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs font-medium text-red-900"
        >
          ❌ Receita médica vencida há {validacao.diasDecorridos} dias. O prazo
          legal para dispensação de antimicrobianos é de até 10 dias.
        </div>
      )}

      {exibirErro && validacao.motivo === "DATA_FUTURA" && (
        <div
          id="erro-validacao-antimicrobiano"
          role="alert"
          data-testid="erro-receita-futura"
          className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs font-medium text-red-900"
        >
          ❌ Data de emissão inválida: a receita médica não pode ter data futura.
        </div>
      )}

      {exibirErro && validacao.motivo === "DATA_INVALIDA" && (
        <div
          id="erro-validacao-antimicrobiano"
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs font-medium text-red-900"
        >
          ❌ Formato de data inválido para emissão da receita.
        </div>
      )}
    </div>
  );
}

export default ValidacaoReceitaAntimicrobiano;
