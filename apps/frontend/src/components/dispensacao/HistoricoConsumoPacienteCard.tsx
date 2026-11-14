import {
  formatarDataIsoParaBr,
  type ItemHistoricoConsumoDto,
} from "@farmaubs/shared";

export interface HistoricoConsumoPacienteCardProps {
  itens: ItemHistoricoConsumoDto[];
  carregando?: boolean;
  pacienteNome?: string;
}

/**
 * [RF012 / ADR-032]: Exibe o painel de histórico de retiradas do paciente nos últimos 90 dias,
 * destacando alertas visuais âmbar quando houver retirada recente (< 25 dias) do mesmo medicamento.
 * @param props - Lista de itens de histórico, estado de carregamento e nome opcional do paciente.
 */
export function HistoricoConsumoPacienteCard({
  itens,
  carregando = false,
  pacienteNome,
}: HistoricoConsumoPacienteCardProps) {
  const retiradasRecentes = itens.filter(
    (item) =>
      item.possivelUsoIrracional ||
      (typeof item.diasDesdeUltimaRetirada === "number" &&
        item.diasDesdeUltimaRetirada < 25),
  );

  return (
    <section
      aria-label="Histórico de Consumo do Paciente (Últimos 90 dias)"
      data-testid="historico-consumo-card"
      className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Histórico de Consumo (Últimos 90 dias)
          </h3>
          {pacienteNome && (
            <p className="text-xs text-slate-600">
              Paciente: <span className="font-medium">{pacienteNome}</span>
            </p>
          )}
        </div>
        <span className="inline-flex items-center rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-800">
          {itens.length} {itens.length === 1 ? "retirada" : "retiradas"}
        </span>
      </div>

      {/* Alertas de possível uso irracional / retirada há menos de 25 dias (RF012) */}
      {retiradasRecentes.map((alerta, index) => (
        <div
          key={`${alerta.dispensacaoId}-${alerta.medicamentoId}-${index}`}
          role="alert"
          data-testid="alerta-retirada-recente"
          className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2"
        >
          <span aria-hidden="true" className="text-base leading-none">
            ⚠️
          </span>
          <div>
            <strong className="font-semibold">Atenção:</strong> Paciente retirou{" "}
            <span className="font-semibold">{alerta.medicamentoNome}</span> há{" "}
            <span className="font-semibold">
              {alerta.diasDesdeUltimaRetirada} dias
            </span>
            . Ciclo padrão de 30 dias ainda em andamento.
          </div>
        </div>
      ))}

      {carregando ? (
        <p className="text-xs text-slate-500 py-2" role="status">
          Carregando histórico de retiradas...
        </p>
      ) : itens.length === 0 ? (
        <p className="text-xs text-slate-500 py-2">
          Nenhuma retirada registrada nos últimos 90 dias neste município.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th scope="col" className="py-1.5 pr-2 font-semibold">
                  Medicamento
                </th>
                <th scope="col" className="py-1.5 px-2 font-semibold">
                  Qtd.
                </th>
                <th scope="col" className="py-1.5 px-2 font-semibold">
                  Data
                </th>
                <th scope="col" className="py-1.5 pl-2 font-semibold text-right">
                  Intervalo
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {itens.map((item, idx) => {
                const recente =
                  item.possivelUsoIrracional ||
                  item.diasDesdeUltimaRetirada < 25;
                const dataStr =
                  item.dataDispensacao instanceof Date
                    ? formatarDataIsoParaBr(
                        item.dataDispensacao.toISOString().slice(0, 10),
                      )
                    : formatarDataIsoParaBr(String(item.dataDispensacao));

                return (
                  <tr
                    key={`${item.dispensacaoId}-${item.medicamentoId}-${idx}`}
                    className="text-slate-800"
                  >
                    <td className="py-2 pr-2 font-medium">
                      <div>{item.medicamentoNome}</div>
                      {item.posologia && (
                        <div className="text-[11px] text-slate-500">
                          {item.posologia}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-2">{item.quantidadeDispensada} un.</td>
                    <td className="py-2 px-2">{dataStr}</td>
                    <td className="py-2 pl-2 text-right">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          recente
                            ? "bg-amber-100 text-amber-900 border border-amber-300"
                            : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        }`}
                      >
                        Há {item.diasDesdeUltimaRetirada} dias
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default HistoricoConsumoPacienteCard;
