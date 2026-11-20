import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ehMedicamentoIndiceTerapeuticoEstreito,
  formatarDataIsoParaBr,
  selecionarLoteSugeridoFEFO,
  type LoteDisponivelDto,
  type MedicamentoBuscaDto,
} from "@farmaubs/shared";
import { theme } from "../theme/tokens";
import { MENSAGEM_REDE } from "./login-form";
import { MENSAGEM_ACAO_OFFLINE } from "../services/conectividade";
import { TempoEsgotado } from "../services/api";
import { medicamentoService } from "../services/medicamento.service";
import {
  DEBOUNCE_BUSCA_MEDICAMENTO_MS,
  MENSAGEM_INDICE_ESTREITO,
  loteBloqueado,
  mensagemSaldoInsuficiente,
  quantidadeExcedeSaldo,
  termoDeveBuscar,
  textoBadgeFefo,
} from "./medicamento-busca";

type BuscaMedicamentoScreenProps = {
  apiBaseUrl: string;
  ubsId: string | null;
  semConexao?: boolean;
  totalItens: number;
  onVoltar: () => void;
  onIncluir: (item: { medicamento: MedicamentoBuscaDto; lote: LoteDisponivelDto; quantidade: number }) => void;
  onAbrirCarrinho: () => void;
};

/**
 * [DI-MOB-02]: Busca de medicamentos e escolha do lote FEFO da UBS ativa.
 */
export function BuscaMedicamentoScreen({
  apiBaseUrl,
  ubsId,
  semConexao = false,
  totalItens,
  onVoltar,
  onIncluir,
  onAbrirCarrinho,
}: BuscaMedicamentoScreenProps) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<MedicamentoBuscaDto[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [medicamento, setMedicamento] = useState<MedicamentoBuscaDto | null>(null);
  const [lotes, setLotes] = useState<LoteDisponivelDto[]>([]);
  const [loteId, setLoteId] = useState<string | null>(null);
  const [carregandoLotes, setCarregandoLotes] = useState(false);
  const [quantidade, setQuantidade] = useState(1);
  const [trocarAberto, setTrocarAberto] = useState(false);
  const [registro, setRegistro] = useState<string | null>(null);
  const [avisoIncluso, setAvisoIncluso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const buscaAtual = useRef(0);
  const timerBusca = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lote = lotes.find((item) => item.id === loteId) ?? null;
  const saldo = lote?.saldoDisponivel ?? 0;
  const excede = lote ? quantidadeExcedeSaldo(quantidade, saldo) : true;
  const podeConfirmar = Boolean(lote) && !loteBloqueado(lote!) && !excede && !carregandoLotes;

  function limparBusca() {
    if (timerBusca.current) clearTimeout(timerBusca.current);
    buscaAtual.current += 1;
    setTermo("");
    setResultados([]);
    setBuscando(false);
  }

  function aoMudarTermo(valor: string) {
    setTermo(valor);
    setErro(null);
    if (timerBusca.current) clearTimeout(timerBusca.current);
    if (!termoDeveBuscar(valor)) {
      buscaAtual.current += 1;
      setResultados([]);
      setBuscando(false);
      return;
    }
    if (semConexao) {
      setErro(MENSAGEM_ACAO_OFFLINE);
      return;
    }
    const ordem = ++buscaAtual.current;
    setBuscando(true);
    timerBusca.current = setTimeout(() => {
      void consultar(valor.trim(), ordem);
    }, DEBOUNCE_BUSCA_MEDICAMENTO_MS);
  }

  async function consultar(texto: string, ordem: number) {
    try {
      const lista = await medicamentoService.buscar(apiBaseUrl, texto, ubsId);
      if (ordem !== buscaAtual.current) return;
      setResultados(lista);
    } catch (falha) {
      if (ordem !== buscaAtual.current) return;
      setResultados([]);
      setErro(falha instanceof TempoEsgotado ? MENSAGEM_REDE : falha instanceof Error ? falha.message : MENSAGEM_REDE);
    } finally {
      if (ordem === buscaAtual.current) setBuscando(false);
    }
  }

  async function escolherMedicamento(item: MedicamentoBuscaDto) {
    if (semConexao) {
      setErro(MENSAGEM_ACAO_OFFLINE);
      return;
    }
    limparBusca();
    setMedicamento(item);
    setLotes([]);
    setLoteId(null);
    setQuantidade(1);
    setRegistro(null);
    setErro(null);
    setCarregandoLotes(true);
    try {
      const sugestao = await medicamentoService.lotes(apiBaseUrl, item.id, ubsId);
      const disponiveis = sugestao?.lotesDisponiveis ?? [];
      const sugerido =
        sugestao?.loteSugerido ??
        selecionarLoteSugeridoFEFO(disponiveis) ??
        disponiveis.find((loteItem) => !loteBloqueado(loteItem)) ??
        null;
      setLotes(disponiveis);
      setLoteId(sugerido?.id ?? null);
      setQuantidade(1);
    } catch (falha) {
      setErro(falha instanceof TempoEsgotado ? MENSAGEM_REDE : falha instanceof Error ? falha.message : MENSAGEM_REDE);
    } finally {
      setCarregandoLotes(false);
    }
  }

  function escolherLote(id: string) {
    setLoteId(id);
    setQuantidade(1);
    setRegistro(null);
    setTrocarAberto(false);
  }

  function confirmar() {
    if (!podeConfirmar || !lote || !medicamento) return;
    onIncluir({ medicamento, lote, quantidade });
    setAvisoIncluso(`${medicamento.principioAtivo} incluído no atendimento.`);
    setRegistro(null);
    setMedicamento(null);
    setLotes([]);
    setLoteId(null);
  }

  const cabecalho = (
    <View style={styles.bloco}>
      <Pressable onPress={onVoltar} accessibilityRole="button" style={styles.voltar}>
        <Text style={styles.voltarTexto}>Voltar à identificação</Text>
      </Pressable>
      <Text style={styles.titulo}>2. Seleção de Medicamentos</Text>
      <Text style={styles.subtitulo}>
        Busque por princípio ativo, nome comercial ou apresentação
      </Text>
      <View style={styles.busca}>
        <Text style={styles.lupa}>⌕</Text>
        <TextInput
          value={termo}
          onChangeText={aoMudarTermo}
          placeholder="Ex.: Metformina 850mg"
          style={styles.campo}
          autoCorrect={false}
        />
        {buscando ? <ActivityIndicator color={theme.colors.action} /> : null}
        {termo ? (
          <Pressable onPress={limparBusca} accessibilityRole="button" accessibilityLabel="Limpar busca" style={styles.limpar}>
            <Text style={styles.limparTexto}>X</Text>
          </Pressable>
        ) : null}
      </View>
      {erro ? <Text style={styles.erro} accessibilityRole="alert">{erro}</Text> : null}
      {avisoIncluso ? <Text style={styles.incluso}>{avisoIncluso}</Text> : null}
      {totalItens > 0 ? (
        <Pressable onPress={onAbrirCarrinho} accessibilityRole="button" style={styles.verCarrinho}>
          <Text style={styles.verCarrinhoTexto}>Ver atendimento ({totalItens})</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <View style={styles.flex}>
      {medicamento ? (
        <ScrollView
          style={styles.flex}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.conteudo}
          showsVerticalScrollIndicator
        >
          {cabecalho}
          <CartaoLote
            medicamento={medicamento}
            lotes={lotes}
            lote={lote}
            carregando={carregandoLotes}
            quantidade={quantidade}
            excede={excede}
            saldo={saldo}
            podeConfirmar={podeConfirmar}
            registro={registro}
            onCancelar={() => {
              setMedicamento(null);
              setLotes([]);
              setLoteId(null);
              setRegistro(null);
            }}
            onTrocar={() => setTrocarAberto(true)}
            onQuantidade={(valor) => {
              setQuantidade(valor);
              setRegistro(null);
            }}
            onConfirmar={confirmar}
          />
        </ScrollView>
      ) : (
        <FlatList
          style={styles.flex}
          data={resultados}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.conteudo}
          showsVerticalScrollIndicator
          ListHeaderComponent={cabecalho}
          ListEmptyComponent={
            buscando || !termoDeveBuscar(termo) ? undefined : (
              <Text style={styles.vazio}>Nenhum medicamento encontrado na UBS.</Text>
            )
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => void escolherMedicamento(item)} accessibilityRole="button" style={styles.item}>
              <Text style={styles.itemTitulo}>{item.principioAtivo}</Text>
              <Text style={styles.tag}>{item.apresentacao}</Text>
              {item.nomeComercial ? <Text style={styles.itemSub}>Referência: {item.nomeComercial}</Text> : null}
              <Text style={styles.itemSub}>Saldo na UBS: {item.saldoTotalUbs} un.</Text>
            </Pressable>
          )}
        />
      )}
      <Modal
        visible={trocarAberto}
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        animationType="slide"
        onRequestClose={() => setTrocarAberto(false)}
      >
        <View style={styles.modal}>
          <Pressable style={styles.fundo} onPress={() => setTrocarAberto(false)} />
          <View style={styles.folha}>
            <Text style={styles.folhaTitulo}>Selecionar outro lote em estoque na UBS</Text>
            <FlatList
              style={styles.listaFolha}
              data={lotes}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const bloqueado = loteBloqueado(item);
                return (
                  <Pressable
                    disabled={bloqueado}
                    onPress={() => escolherLote(item.id)}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: bloqueado }}
                    style={[styles.loteLinha, bloqueado && styles.loteBloqueado]}
                  >
                    <Text style={[styles.loteTexto, bloqueado && styles.loteTextoBloqueado]}>
                      Lote: {item.numeroLote} | Vence: {formatarDataIsoParaBr(item.dataValidade)} | Saldo: {item.saldoDisponivel} un.
                      {item.sugeridoFefo ? " (FEFO)" : ""}
                      {bloqueado ? " (indisponível)" : ""}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function CartaoLote({
  medicamento,
  lotes,
  lote,
  carregando,
  quantidade,
  excede,
  saldo,
  podeConfirmar,
  registro,
  onCancelar,
  onTrocar,
  onQuantidade,
  onConfirmar,
}: {
  medicamento: MedicamentoBuscaDto;
  lotes: LoteDisponivelDto[];
  lote: LoteDisponivelDto | null;
  carregando: boolean;
  quantidade: number;
  excede: boolean;
  saldo: number;
  podeConfirmar: boolean;
  registro: string | null;
  onCancelar: () => void;
  onTrocar: () => void;
  onQuantidade: (valor: number) => void;
  onConfirmar: () => void;
}) {
  const validadeCurta = Boolean(lote && !lote.vencido && lote.diasParaVencimento >= 0 && lote.diasParaVencimento <= 30);
  return (
    <View style={styles.cartao}>
      <View style={styles.cartaoTopo}>
        <Text style={styles.itemTitulo}>
          {medicamento.principioAtivo}{medicamento.apresentacao ? ` - ${medicamento.apresentacao}` : ""}
        </Text>
        <Pressable onPress={onCancelar} accessibilityRole="button">
          <Text style={styles.cancelar}>Cancelar</Text>
        </Pressable>
      </View>
      {ehMedicamentoIndiceTerapeuticoEstreito(medicamento) ? (
        <Text style={styles.indice} accessibilityRole="alert">{MENSAGEM_INDICE_ESTREITO}</Text>
      ) : null}
      {carregando ? <ActivityIndicator color={theme.colors.action} /> : null}
      {!carregando && !lote ? (
        <Text style={styles.erro} accessibilityRole="alert">Nenhum lote válido com saldo disponível na unidade para este medicamento.</Text>
      ) : null}
      {lote ? (
        <View style={styles.loteAtual}>
          {lote.sugeridoFefo ? <Text style={styles.badgeFefo}>{textoBadgeFefo(lote)}</Text> : null}
          {validadeCurta ? <Text style={styles.badgeValidade}>⚠️ Vence em {lote.diasParaVencimento} dias</Text> : null}
          <Text style={styles.loteTexto}>
            Lote: {lote.numeroLote} | Validade: {formatarDataIsoParaBr(lote.dataValidade)} | Saldo: {lote.saldoDisponivel} un.
          </Text>
          {lotes.length > 1 ? (
            <Pressable onPress={onTrocar} accessibilityRole="button" style={styles.trocar}>
              <Text style={styles.trocarTexto}>Trocar Lote</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <Text style={styles.legenda}>Quantidade a Dispensar (un.)</Text>
      <View style={styles.stepper}>
        <Pressable onPress={() => onQuantidade(Math.max(1, quantidade - 1))} accessibilityRole="button" accessibilityLabel="Diminuir quantidade" style={styles.passo}>
          <Text style={styles.passoTexto}>-</Text>
        </Pressable>
        <Text style={styles.quantidade}>{quantidade}</Text>
        <Pressable onPress={() => onQuantidade(quantidade + 1)} accessibilityRole="button" accessibilityLabel="Aumentar quantidade" style={styles.passo}>
          <Text style={styles.passoTexto}>+</Text>
        </Pressable>
      </View>
      <View style={styles.atalhos}>
        {[10, 20, 30].map((delta) => (
          <Pressable key={delta} onPress={() => onQuantidade(quantidade + delta)} accessibilityRole="button" style={styles.atalho}>
            <Text style={styles.atalhoTexto}>+{delta}</Text>
          </Pressable>
        ))}
      </View>
      {lote && excede ? (
        <Text style={styles.erro} accessibilityRole="alert">{mensagemSaldoInsuficiente(saldo)}</Text>
      ) : null}
      <Pressable
        onPress={onConfirmar}
        disabled={!podeConfirmar}
        accessibilityRole="button"
        accessibilityState={{ disabled: !podeConfirmar }}
        style={[styles.botao, !podeConfirmar && styles.botaoDesabilitado]}
      >
        <Text style={styles.botaoTexto}>Adicionar ao Atendimento</Text>
      </Pressable>
      {registro ? <Text style={styles.registro}>{registro}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#F8FAFC" },
  conteudo: { padding: theme.spacing.md, paddingBottom: 48 },
  bloco: { gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  voltar: { minHeight: 44, justifyContent: "center" },
  voltarTexto: { color: "#1D4ED8", fontWeight: "700" },
  titulo: { fontSize: 16, fontWeight: "600", color: "#0F172A" },
  subtitulo: { fontSize: 12, color: "#64748B" },
  busca: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
  },
  lupa: { fontSize: 16, color: "#64748B" },
  campo: { flex: 1, height: 44, fontSize: 14, color: "#0F172A" },
  limpar: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  limparTexto: { fontWeight: "700", color: "#334155" },
  item: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: theme.spacing.md,
    gap: 4,
    marginBottom: theme.spacing.sm,
  },
  itemTitulo: { flex: 1, fontSize: 14, fontWeight: "700", color: "#0F172A" },
  tag: {
    alignSelf: "flex-start",
    backgroundColor: "#E2E8F0",
    color: "#1E293B",
    overflow: "hidden",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 11,
    fontWeight: "700",
  },
  itemSub: { fontSize: 12, color: "#475569" },
  vazio: { fontSize: 12, color: "#64748B" },
  erro: { color: "#DC2626", fontWeight: "700", fontSize: 12 },
  incluso: { color: "#065F46", fontWeight: "700", fontSize: 12 },
  verCarrinho: { minHeight: 44, justifyContent: "center" },
  verCarrinhoTexto: { color: "#047857", fontWeight: "700" },
  cartao: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 12,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  cartaoTopo: { flexDirection: "row", justifyContent: "space-between", gap: theme.spacing.sm },
  cancelar: { color: "#64748B", fontWeight: "700", fontSize: 12 },
  indice: {
    backgroundColor: "#FAF5FF",
    borderWidth: 1,
    borderColor: "#D8B4FE",
    color: "#3B0764",
    borderRadius: 8,
    padding: theme.spacing.sm,
    fontSize: 12,
    fontWeight: "600",
  },
  loteAtual: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#6EE7B7",
    borderRadius: 8,
    padding: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  badgeFefo: {
    backgroundColor: "#D1FAE5",
    color: "#064E3B",
    borderWidth: 1,
    borderColor: "#6EE7B7",
    borderRadius: 8,
    overflow: "hidden",
    padding: theme.spacing.sm,
    fontSize: 12,
    fontWeight: "700",
  },
  badgeValidade: {
    alignSelf: "flex-start",
    backgroundColor: "#FEF3C7",
    color: "#92400E",
    borderWidth: 1,
    borderColor: "#FCD34D",
    borderRadius: 8,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 11,
    fontWeight: "700",
  },
  loteTexto: { fontSize: 12, color: "#1E293B" },
  loteTextoBloqueado: { color: "#94A3B8" },
  trocar: { minHeight: 44, justifyContent: "center" },
  trocarTexto: { color: "#1D4ED8", fontWeight: "700" },
  legenda: { fontSize: 12, fontWeight: "600", color: "#334155" },
  stepper: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  passo: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  passoTexto: { fontSize: 20, fontWeight: "700", color: "#0F172A" },
  quantidade: { minWidth: 32, textAlign: "center", fontSize: 16, fontWeight: "700", color: "#0F172A" },
  atalhos: { flexDirection: "row", gap: theme.spacing.sm },
  atalho: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  atalhoTexto: { fontWeight: "700", color: "#1E293B" },
  botao: {
    height: 44,
    borderRadius: 8,
    backgroundColor: "#047857",
    alignItems: "center",
    justifyContent: "center",
  },
  botaoDesabilitado: { opacity: 0.5 },
  botaoTexto: { color: "#FFFFFF", fontWeight: "700" },
  registro: { color: "#065F46", fontWeight: "700", fontSize: 12 },
  modal: { flex: 1, justifyContent: "flex-end" },
  fundo: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
  },
  folha: {
    maxHeight: "70%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: theme.spacing.md,
    paddingBottom: 48,
    gap: theme.spacing.sm,
  },
  folhaTitulo: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  listaFolha: { maxHeight: 320 },
  loteLinha: { minHeight: 44, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  loteBloqueado: { backgroundColor: "#F1F5F9" },
});
