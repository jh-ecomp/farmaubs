import {
  useState,
  useEffect,
  useRef,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { MedicamentoBuscaDto } from "@farmaubs/shared";
import { catalogoDispensacaoService } from "../../services/catalogo-dispensacao.service";

export interface BuscaMedicamentoInputProps {
  ubsId?: string;
  onSelecionarMedicamento: (medicamento: MedicamentoBuscaDto) => void;
  debounceMs?: number;
  placeholder?: string;
}

/**
 * [RF010 / NF010 / ADR-032]: Caixa de pesquisa textual de medicamentos com debounce de 250ms,
 * navegação por teclado (ArrowDown, ArrowUp, Enter, Escape) e marcação acessível WAI-ARIA listbox.
 */
export function BuscaMedicamentoInput({
  ubsId,
  onSelecionarMedicamento,
  debounceMs = 250,
  placeholder = "Buscar por princípio ativo, nome comercial ou apresentação (ex.: Losartana 50mg)...",
}: BuscaMedicamentoInputProps) {
  let queryClient: ReturnType<typeof useQueryClient> | null = null;
  try {
    queryClient = useQueryClient();
  } catch {
    // Permite execução resiliente em testes isolados sem QueryClientProvider
  }

  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<MedicamentoBuscaDto[]>([]);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [indiceAtivo, setIndiceAtivo] = useState<number>(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const buscaLimpa = termo.trim();
    if (buscaLimpa.length < 2) {
      setResultados([]);
      setAberto(false);
      setIndiceAtivo(-1);
      return;
    }

    timerRef.current = setTimeout(async () => {
      setCarregando(true);
      try {
        const lista = queryClient
          ? await queryClient.fetchQuery({
              queryKey: ["dispensacao-medicamentos", buscaLimpa, ubsId],
              queryFn: () =>
                catalogoDispensacaoService.buscarMedicamentos(buscaLimpa, ubsId),
              staleTime: 20_000,
            })
          : await catalogoDispensacaoService.buscarMedicamentos(
              buscaLimpa,
              ubsId,
            );

        const itens = Array.isArray(lista) ? lista : [];
        setResultados(itens);
        setAberto(true);
        setIndiceAtivo(itens.length > 0 ? 0 : -1);
      } catch {
        setResultados([]);
      } finally {
        setCarregando(false);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [termo, ubsId, debounceMs, queryClient]);

  const confirmarSelecao = (medicamento: MedicamentoBuscaDto) => {
    onSelecionarMedicamento(medicamento);
    setTermo("");
    setResultados([]);
    setAberto(false);
    setIndiceAtivo(-1);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setTermo(e.target.value);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!aberto || resultados.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndiceAtivo((prev) => (prev + 1) % resultados.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndiceAtivo(
        (prev) => (prev - 1 + resultados.length) % resultados.length,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const alvo = resultados[indiceAtivo >= 0 ? indiceAtivo : 0];
      if (alvo) {
        confirmarSelecao(alvo);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setAberto(false);
    }
  };

  const activeOptionId =
    aberto && indiceAtivo >= 0 && resultados[indiceAtivo]
      ? `opcao-med-${resultados[indiceAtivo].id}`
      : undefined;

  return (
    <div className="relative">
      <label
        htmlFor="busca-medicamento-input"
        className="block text-xs font-semibold text-slate-700 mb-1"
      >
        Pesquisar Medicamento no Estoque da UBS
      </label>
      <div className="relative">
        <input
          id="busca-medicamento-input"
          type="text"
          role="combobox"
          aria-expanded={aberto}
          aria-controls="lista-sugestoes-medicamentos"
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
          placeholder={placeholder}
          value={termo}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
        {carregando && (
          <span
            role="status"
            className="absolute right-3 top-2.5 text-xs text-slate-500"
          >
            Buscando...
          </span>
        )}
      </div>

      {aberto && (
        <ul
          id="lista-sugestoes-medicamentos"
          role="listbox"
          aria-label="Sugestões de medicamentos"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {resultados.length === 0 ? (
            <li className="px-3 py-2 text-xs text-slate-500">
              Nenhum medicamento encontrado para "{termo}".
            </li>
          ) : (
            resultados.map((med, idx) => {
              const selecionado = idx === indiceAtivo;
              return (
                <li
                  key={med.id}
                  id={`opcao-med-${med.id}`}
                  role="option"
                  aria-selected={selecionado}
                  onClick={() => confirmarSelecao(med)}
                  onMouseEnter={() => setIndiceAtivo(idx)}
                  className={`cursor-pointer px-3 py-2 text-xs flex items-center justify-between gap-2 ${
                    selecionado ? "bg-blue-50 text-blue-950" : "text-slate-800"
                  }`}
                >
                  <div>
                    <div className="font-semibold">
                      {med.principioAtivo}{" "}
                      {med.apresentacao ? `- ${med.apresentacao}` : ""}
                    </div>
                    {med.nomeComercial && (
                      <div className="text-[11px] text-slate-500">
                        Ref.: {med.nomeComercial}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {med.antimicrobiano && (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">
                        Antimicrobiano
                      </span>
                    )}
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                        med.saldoTotalUbs > 0
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-red-50 text-red-700 border border-red-200"
                      }`}
                    >
                      Saldo: {med.saldoTotalUbs} un.
                    </span>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

export default BuscaMedicamentoInput;
