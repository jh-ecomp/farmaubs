import {
  validarValidadeRecebimento,
  type FabricanteResponseDto,
  type ItemRecebimentoFormDto,
  type ProdutoCatalogoResponseDto,
  type StatusValidadeRecebimento,
} from "@farmaubs/shared";

export const DEBOUNCE_CATALOGO_MS = 250;
export const MENSAGEM_VALIDADE_EXPIRADA =
  "❌ Data de validade expirada. Medicamentos vencidos não podem ser recebidos.";

export function mensagemValidadeCurta(dias: number): string {
  return `⚠️ Atenção: Validade curta (vence em ${dias} dias). Verifique a rotatividade do item.`;
}

export function nomeDoProduto(produto: ProdutoCatalogoResponseDto): string {
  const nome = produto.denominacaoGenerica || produto.principioAtivo || produto.nomeComercial || "";
  const conc = produto.concentracao || produto.dosagem || "";
  const forma = produto.formaFarmaceutica || produto.apresentacao || "";
  return `${nome} ${conc}${forma ? ` - ${forma}` : ""}`.trim();
}

export function somarPasso(atual: string, passo: number): string {
  const base = Number(atual);
  const n = Number.isInteger(base) && base > 0 ? base : 0;
  return String(n + passo);
}

/**
 * [RE-MOB-02]: validarValidadeRecebimento trata o dia de hoje como vencido (0 dias).
 */
export function avaliarValidade(
  iso: string,
  hoje: Date = new Date(),
): { status: StatusValidadeRecebimento; diasRestantes: number } | null {
  if (iso.trim().length < 10) return null;
  const detalhe = validarValidadeRecebimento(iso.trim(), hoje);
  const status: StatusValidadeRecebimento = detalhe.vencido
    ? "VENCIDO"
    : detalhe.validadeCurta
      ? "VALIDADE_CURTA"
      : "NORMAL";
  return { status, diasRestantes: detalhe.diasRestantes };
}

export function erroDoItem(
  produto: ProdutoCatalogoResponseDto | null,
  fabricanteId: string,
  lote: string,
  iso: string,
  quantidade: string,
  hoje: Date = new Date(),
): string | null {
  if (!produto) return "Selecione um medicamento padronizado na lista.";
  if (!fabricanteId) return "Selecione o fabricante do lote recebido.";
  const codigo = lote.trim();
  if (codigo.length < 2) return "Informe o código do lote impresso na embalagem.";
  if (codigo.length > 60) return "O número do lote não pode exceder 60 caracteres.";
  if (iso.trim().length < 10) return "Informe a data de validade.";
  if (avaliarValidade(iso, hoje)?.status === "VENCIDO") return MENSAGEM_VALIDADE_EXPIRADA;
  const qtd = Number(quantidade);
  if (!Number.isInteger(qtd) || qtd < 1) return "Informe uma quantidade inteira igual ou superior a 1.";
  return null;
}

export function montarItemConferencia(
  produto: ProdutoCatalogoResponseDto,
  fabricante: FabricanteResponseDto,
  lote: string,
  iso: string,
  quantidade: number,
  hoje: Date = new Date(),
): ItemRecebimentoFormDto {
  return {
    idProvisorio: `${produto.id}-${lote.trim()}-${hoje.getTime()}`,
    produtoId: produto.id,
    produtoNome: nomeDoProduto(produto),
    concentracao: produto.concentracao || produto.dosagem || "",
    formaFarmaceutica: produto.formaFarmaceutica || produto.apresentacao || "",
    fabricanteId: fabricante.id,
    fabricanteNome: fabricante.nomeFantasia || fabricante.razaoSocial,
    numeroLote: lote.trim().toUpperCase(),
    dataValidade: iso.trim(),
    quantidadeRecebida: quantidade,
    validadeCurta: avaliarValidade(iso, hoje)?.status === "VALIDADE_CURTA",
  };
}

function lerProduto(item: unknown): ProdutoCatalogoResponseDto | null {
  if (!item || typeof item !== "object") return null;
  const linha = item as Partial<ProdutoCatalogoResponseDto>;
  if (typeof linha.id !== "string" || typeof linha.principioAtivo !== "string") return null;
  return {
    id: linha.id,
    principioAtivo: linha.principioAtivo,
    nomeComercial: typeof linha.nomeComercial === "string" ? linha.nomeComercial : null,
    denominacaoGenerica: typeof linha.denominacaoGenerica === "string" ? linha.denominacaoGenerica : null,
    dosagem: typeof linha.dosagem === "string" ? linha.dosagem : null,
    concentracao: typeof linha.concentracao === "string" ? linha.concentracao : null,
    formaFarmaceutica: typeof linha.formaFarmaceutica === "string" ? linha.formaFarmaceutica : null,
    apresentacao: typeof linha.apresentacao === "string" ? linha.apresentacao : null,
    categoria: typeof linha.categoria === "string" ? linha.categoria : "",
    antimicrobiano: linha.antimicrobiano === true,
    ativo: linha.ativo !== false,
  };
}

export function lerProdutosCatalogo(data: unknown): ProdutoCatalogoResponseDto[] | null {
  if (!Array.isArray(data)) return null;
  const itens = data.flatMap((item) => {
    const linha = lerProduto(item);
    return linha ? [linha] : [];
  });
  if (itens.length !== data.length) return null;
  return itens;
}

export function lerFabricantes(data: unknown): FabricanteResponseDto[] | null {
  if (!Array.isArray(data)) return null;
  const itens = data.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const linha = item as Partial<FabricanteResponseDto>;
    if (typeof linha.id !== "string" || typeof linha.nomeFantasia !== "string" || typeof linha.razaoSocial !== "string") {
      return [];
    }
    return [{
      id: linha.id,
      razaoSocial: linha.razaoSocial,
      nomeFantasia: linha.nomeFantasia,
      cnpj: typeof linha.cnpj === "string" ? linha.cnpj : null,
      ativo: linha.ativo !== false,
    }];
  });
  if (itens.length !== data.length) return null;
  return itens;
}

export function lerFabricante(data: unknown): FabricanteResponseDto | null {
  const lista = lerFabricantes([data]);
  return lista?.[0] ?? null;
}
