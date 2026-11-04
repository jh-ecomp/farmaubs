import React, { useEffect, useId, useState } from "react";
import {
  classificarValidadeRecebimento,
  type FabricanteResponseDto,
  type ItemRecebimentoFormDto,
  type ProdutoCatalogoResponseDto,
} from "@farmaubs/shared";
import { recebimentoService } from "../../../services/recebimento.service";
import { ModalNovoFabricante } from "./ModalNovoFabricante";
import {
  PackagePlus,
  Search,
  Plus,
  AlertTriangle,
  AlertCircle,
  Loader2,
} from "lucide-react";

export interface ItemRecebimentoFormProps {
  onAdicionarItem: (item: ItemRecebimentoFormDto) => void;
  dataReferencia?: Date;
}

/**
 * Formulário de adição de item/lote à guia de recebimento.
 * Inclui combobox de busca textual no catálogo padronizado, seleção obrigatória de fabricante,
 * cadastro rápido de laboratório e validação em tempo real da data de validade.
 */
export const ItemRecebimentoForm: React.FC<ItemRecebimentoFormProps> = ({
  onAdicionarItem,
  dataReferencia,
}) => {
  const listboxId = useId();

  // Busca de medicamento no catálogo
  const [termoBusca, setTermoBusca] = useState("");
  const [produtosSugeridos, setProdutosSugeridos] = useState<
    ProdutoCatalogoResponseDto[]
  >([]);
  const [buscandoProdutos, setBuscandoProdutos] = useState(false);
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const [indiceDestacado, setIndiceDestacado] = useState(-1);
  const [produtoSelecionado, setProdutoSelecionado] =
    useState<ProdutoCatalogoResponseDto | null>(null);

  // Fabricantes
  const [fabricantes, setFabricantes] = useState<FabricanteResponseDto[]>([]);
  const [fabricanteId, setFabricanteId] = useState("");
  const [modalFabricanteAberto, setModalFabricanteAberto] = useState(false);

  // Dados do lote
  const [numeroLote, setNumeroLote] = useState("");
  const [dataValidade, setDataValidade] = useState("");
  const [quantidadeRecebida, setQuantidadeRecebida] = useState("");
  const [erroFormulario, setErroFormulario] = useState<string | null>(null);

  // Carrega fabricantes ativos ao montar
  useEffect(() => {
    let ativo = true;
    recebimentoService
      .listarFabricantes()
      .then((lista) => {
        if (ativo) {
          setFabricantes(lista);
        }
      })
      .catch(() => {
        // Silencia erro inicial se vazio
      });
    return () => {
      ativo = false;
    };
  }, []);

  // Debounce de 300ms para busca textual no catálogo
  useEffect(() => {
    const limpo = termoBusca.trim();
    if (
      produtoSelecionado &&
      limpo === formatarRotuloProduto(produtoSelecionado)
    ) {
      return;
    }

    if (limpo.length < 2) {
      setProdutosSugeridos([]);
      setDropdownAberto(false);
      setBuscandoProdutos(false);
      return;
    }

    let cancelado = false;
    setBuscandoProdutos(true);

    const timer = window.setTimeout(async () => {
      try {
        const resultados = await recebimentoService.buscarProdutosCatalogo(limpo);
        if (!cancelado) {
          setProdutosSugeridos(resultados);
          setDropdownAberto(true);
          setIndiceDestacado(resultados.length > 0 ? 0 : -1);
        }
      } catch {
        if (!cancelado) {
          setProdutosSugeridos([]);
        }
      } finally {
        if (!cancelado) {
          setBuscandoProdutos(false);
        }
      }
    }, 300);

    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [termoBusca, produtoSelecionado]);

  function formatarRotuloProduto(p: ProdutoCatalogoResponseDto): string {
    const nome = p.denominacaoGenerica || p.principioAtivo || p.nomeComercial || "";
    const conc = p.concentracao || p.dosagem || "";
    const forma = p.formaFarmaceutica || p.apresentacao || "";
    return `${nome} ${conc}${forma ? ` - ${forma}` : ""}`.trim();
  }

  function selecionarProduto(produto: ProdutoCatalogoResponseDto) {
    setProdutoSelecionado(produto);
    setTermoBusca(formatarRotuloProduto(produto));
    setDropdownAberto(false);
    setIndiceDestacado(-1);
    setErroFormulario(null);
  }

  const handleKeyDownCombobox = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!dropdownAberto || produtosSugeridos.length === 0) {
      if (e.key === "Escape") {
        setDropdownAberto(false);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndiceDestacado((prev) =>
        prev < produtosSugeridos.length - 1 ? prev + 1 : 0,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndiceDestacado((prev) =>
        prev > 0 ? prev - 1 : produtosSugeridos.length - 1,
      );
    } else if (e.key === "Enter" && indiceDestacado >= 0) {
      e.preventDefault();
      const escolhido = produtosSugeridos[indiceDestacado];
      if (escolhido) {
        selecionarProduto(escolhido);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDropdownAberto(false);
    }
  };

  // Classificação em tempo real da validade
  const statusValidade =
    dataValidade.trim().length >= 10
      ? classificarValidadeRecebimento(dataValidade, dataReferencia)
      : null;

  const loteVencido = statusValidade === "VENCIDO";
  const loteValidadeCurta = statusValidade === "VALIDADE_CURTA";

  const qtdNumerica = Number(quantidadeRecebida);
  const quantidadeValida =
    Number.isInteger(qtdNumerica) && qtdNumerica >= 1;

  const podeAdicionar =
    Boolean(produtoSelecionado) &&
    fabricanteId.trim().length > 0 &&
    numeroLote.trim().length >= 2 &&
    dataValidade.trim().length >= 10 &&
    !loteVencido &&
    quantidadeValida;

  const handleAdicionarItem = (e: React.FormEvent) => {
    e.preventDefault();
    setErroFormulario(null);

    if (loteVencido) {
      setErroFormulario("A data de validade deve ser futura");
      return;
    }

    if (!produtoSelecionado) {
      setErroFormulario("Selecione um medicamento padronizado na lista.");
      return;
    }

    const fab = fabricantes.find((f) => f.id === fabricanteId);
    if (!fab) {
      setErroFormulario("Selecione o fabricante do lote recebido.");
      return;
    }

    if (numeroLote.trim().length < 2) {
      setErroFormulario("Informe o código do lote impresso na embalagem.");
      return;
    }

    if (!quantidadeValida) {
      setErroFormulario("Informe uma quantidade inteira igual ou superior a 1.");
      return;
    }

    const novoItem: ItemRecebimentoFormDto = {
      idProvisorio: `${produtoSelecionado.id}-${numeroLote.trim()}-${Date.now()}`,
      produtoId: produtoSelecionado.id,
      produtoNome:
        produtoSelecionado.denominacaoGenerica ||
        produtoSelecionado.principioAtivo ||
        produtoSelecionado.nomeComercial ||
        "",
      concentracao:
        produtoSelecionado.concentracao || produtoSelecionado.dosagem || "",
      formaFarmaceutica:
        produtoSelecionado.formaFarmaceutica ||
        produtoSelecionado.apresentacao ||
        "",
      fabricanteId: fab.id,
      fabricanteNome: fab.nomeFantasia || fab.razaoSocial,
      numeroLote: numeroLote.trim().toUpperCase(),
      dataValidade: dataValidade.trim(),
      quantidadeRecebida: qtdNumerica,
      validadeCurta: loteValidadeCurta,
    };

    onAdicionarItem(novoItem);

    // Limpa campos do item para a próxima digitação mantendo a agilidade
    setProdutoSelecionado(null);
    setTermoBusca("");
    setProdutosSugeridos([]);
    setFabricanteId("");
    setNumeroLote("");
    setDataValidade("");
    setQuantidadeRecebida("");
    setErroFormulario(null);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
      <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100">
        <div className="p-2 rounded-lg bg-teal-50 text-teal-700">
          <PackagePlus className="w-5 h-5" aria-hidden="true" />
        </div>
        <div>
          <h2
            id="titulo-inclusao-item-recebimento"
            className="text-base font-semibold text-slate-900"
          >
            Incluir Medicamento e Lote na Guia
          </h2>
          <p className="text-xs text-slate-500">
            Busque o medicamento pelo nome genérico e informe o laboratório, lote, validade e quantidade física.
          </p>
        </div>
      </div>

      <form onSubmit={handleAdicionarItem} className="space-y-4" noValidate>
        {erroFormulario && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs font-medium text-red-700"
          >
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{erroFormulario}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Combobox de Busca Textual do Medicamento */}
          <div className="md:col-span-5 relative">
            <label
              htmlFor="buscaMedicamentoCatalogo"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Medicamento <span className="text-red-600">*</span>
            </label>
            <div className="relative">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="buscaMedicamentoCatalogo"
                type="text"
                role="combobox"
                aria-expanded={dropdownAberto}
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-activedescendant={
                  dropdownAberto &&
                  indiceDestacado >= 0 &&
                  produtosSugeridos[indiceDestacado]
                    ? `${listboxId}-opt-${produtosSugeridos[indiceDestacado].id}`
                    : undefined
                }
                value={termoBusca}
                onChange={(e) => {
                  setTermoBusca(e.target.value);
                  if (produtoSelecionado) {
                    setProdutoSelecionado(null);
                  }
                }}
                onKeyDown={handleKeyDownCombobox}
                placeholder="Digite o nome genérico (ex: Losartana, Amoxicilina)..."
                className="w-full rounded-lg border border-slate-300 pl-9 pr-8 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
              />
              {buscandoProdutos && (
                <Loader2
                  className="w-4 h-4 text-teal-600 animate-spin absolute right-3 top-1/2 -translate-y-1/2"
                  aria-label="Buscando medicamentos"
                />
              )}
            </div>

            {dropdownAberto && (
              <ul
                id={listboxId}
                role="listbox"
                aria-label="Sugestões de medicamentos do catálogo"
                className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
              >
                {produtosSugeridos.length === 0 ? (
                  <li className="px-3 py-2.5 text-xs text-slate-500">
                    Nenhum medicamento encontrado no catálogo para &ldquo;{termoBusca}&rdquo;.
                  </li>
                ) : (
                  produtosSugeridos.map((prod, idx) => {
                    const rotulo = formatarRotuloProduto(prod);
                    const ativo = idx === indiceDestacado;
                    return (
                      <li
                        key={prod.id}
                        id={`${listboxId}-opt-${prod.id}`}
                        role="option"
                        aria-selected={ativo}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selecionarProduto(prod);
                        }}
                        className={`cursor-pointer px-3 py-2 text-sm transition-colors ${
                          ativo
                            ? "bg-teal-50 text-teal-900 font-medium"
                            : "text-slate-800 hover:bg-slate-50"
                        }`}
                      >
                        <div className="font-medium text-slate-900">{rotulo}</div>
                        <div className="text-xs text-slate-500">
                          Apresentação: {prod.unidadeMedida || prod.formaFarmaceutica}
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </div>

          {/* Fabricante Obrigatório + Botão + Novo Fabricante */}
          <div className="md:col-span-4">
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="fabricanteLoteSelect"
                className="block text-xs font-semibold text-slate-700"
              >
                Fabricante / Laboratório <span className="text-red-600">*</span>
              </label>
              <button
                type="button"
                onClick={() => setModalFabricanteAberto(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>+ Novo Fabricante</span>
              </button>
            </div>
            <select
              id="fabricanteLoteSelect"
              value={fabricanteId}
              onChange={(e) => setFabricanteId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
            >
              <option value="">Selecione o laboratório...</option>
              {fabricantes.map((fab) => (
                <option key={fab.id} value={fab.id}>
                  {fab.nomeFantasia || fab.razaoSocial}
                </option>
              ))}
            </select>
          </div>

          {/* Código do Lote */}
          <div className="md:col-span-3">
            <label
              htmlFor="codigoLoteInput"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Código do Lote <span className="text-red-600">*</span>
            </label>
            <input
              id="codigoLoteInput"
              type="text"
              value={numeroLote}
              onChange={(e) => setNumeroLote(e.target.value)}
              placeholder="Ex: LOTE-2026A"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase text-slate-900 placeholder:normal-case placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
            />
          </div>

          {/* Data de Validade */}
          <div className="md:col-span-4">
            <label
              htmlFor="dataValidadeInput"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Data de Validade <span className="text-red-600">*</span>
            </label>
            <input
              id="dataValidadeInput"
              type="date"
              value={dataValidade}
              aria-invalid={loteVencido ? "true" : "false"}
              onChange={(e) => setDataValidade(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 ${
                loteVencido
                  ? "border-red-500 bg-red-50/30 focus:ring-red-500"
                  : loteValidadeCurta
                    ? "border-amber-400 bg-amber-50/30 focus:ring-amber-500"
                    : "border-slate-300 focus:ring-teal-600 focus:border-teal-600"
              }`}
            />

            {loteVencido && (
              <p
                role="alert"
                className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-red-600"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>A data de validade deve ser futura</span>
              </p>
            )}

            {loteValidadeCurta && (
              <div
                role="status"
                className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800"
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Atenção: lote com validade inferior a 6 meses</span>
              </div>
            )}
          </div>

          {/* Quantidade Recebida */}
          <div className="md:col-span-3">
            <label
              htmlFor="quantidadeRecebidaInput"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Quantidade Recebida <span className="text-red-600">*</span>
            </label>
            <input
              id="quantidadeRecebidaInput"
              type="number"
              min={1}
              step={1}
              value={quantidadeRecebida}
              onChange={(e) => setQuantidadeRecebida(e.target.value)}
              placeholder="Ex: 500"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
            />
          </div>

          {/* Botão Adicionar Item à Guia */}
          <div className="md:col-span-5 flex items-end">
            <button
              type="submit"
              disabled={!podeAdicionar}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Adicionar Item à Guia</span>
            </button>
          </div>
        </div>
      </form>

      <ModalNovoFabricante
        aberto={modalFabricanteAberto}
        onFechar={() => setModalFabricanteAberto(false)}
        onFabricanteCriado={(novoFab) => {
          setFabricantes((atuais) => [...atuais, novoFab]);
          setFabricanteId(novoFab.id);
        }}
      />
    </div>
  );
};
