import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Keyboard,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  Vibration,
  View,
} from "react-native";
import type { DetalhesRecebimentoCompleto, ItemResumoHistoricoRecebimento, PeriodoPredefinido } from "@farmaubs/shared";
import { formatarDataIsoParaBr } from "@farmaubs/shared";
import { theme } from "../../theme/tokens";
import { SessaoExpirada, TempoEsgotado } from "../../services/api";
import { MENSAGEM_ACAO_OFFLINE } from "../../services/conectividade";
import { catalogoRecebimentoService } from "../../services/catalogo-recebimento.service";
import { MENSAGEM_REDE } from "../login-form";
import { alturaCobertaPeloTeclado } from "../teclado";
import {
  CHIPS_RECEBIMENTO,
  DEBOUNCE_HISTORICO_RECEBIMENTO_MS,
  PERIODO_INICIAL_RECEBIMENTO,
  consultaHistorico,
  estaEstornado,
  formatarDataRecebimento,
  textoProtocolo,
} from "./historico-recebimento";

if (Platform.OS === "android" && typeof UIManager.setLayoutAnimationEnabledExperimental === "function") {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type HistoricoProps = {
  apiBaseUrl: string;
  semConexao?: boolean;
  onVoltar: () => void;
};

/**
 * [RE-MOB-04]: Lista o histórico da API. O estorno continua só no computador.
 */
export function useHistoricoRecebimentos(apiBaseUrl: string, semConexao: boolean) {
  const [periodo, setPeriodo] = useState<PeriodoPredefinido>(PERIODO_INICIAL_RECEBIMENTO);
  const [termo, setTermo] = useState("");
  const [termoAplicado, setTermoAplicado] = useState("");
  const [itens, setItens] = useState<ItemResumoHistoricoRecebimento[]>([]);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const ordem = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setTermoAplicado(termo), DEBOUNCE_HISTORICO_RECEBIMENTO_MS);
    return () => clearTimeout(timer);
  }, [termo]);

  async function carregar(paginaPedida: number, substituir: boolean, gesto: boolean) {
    if (semConexao) {
      setErro(MENSAGEM_ACAO_OFFLINE);
      setCarregando(false);
      setAtualizando(false);
      return;
    }
    const ticket = ++ordem.current;
    if (gesto) setAtualizando(true);
    else if (substituir) setCarregando(true);
    setErro(null);
    try {
      const paginaResposta = await catalogoRecebimentoService.listarHistorico(
        apiBaseUrl,
        consultaHistorico(periodo, termoAplicado, paginaPedida),
      );
      if (ticket !== ordem.current) return;
      setTotalPaginas(paginaResposta.totalPaginas);
      setPagina(paginaPedida);
      setItens((atuais) => (substituir ? paginaResposta.itens : [...atuais, ...paginaResposta.itens]));
    } catch (falha) {
      if (ticket !== ordem.current || falha instanceof SessaoExpirada) return;
      setErro(falha instanceof TempoEsgotado ? MENSAGEM_REDE : falha instanceof Error ? falha.message : MENSAGEM_REDE);
    } finally {
      if (ticket === ordem.current) {
        setCarregando(false);
        setAtualizando(false);
      }
    }
  }

  useEffect(() => {
    void carregar(1, true, false);
  }, [periodo, termoAplicado, semConexao]);

  return {
    periodo,
    setPeriodo,
    termo,
    setTermo,
    itens,
    pagina,
    totalPaginas,
    carregando,
    atualizando,
    erro,
    carregar,
  };
}

export function HistoricoRecebimentosScreen({ apiBaseUrl, semConexao = false, onVoltar }: HistoricoProps) {
  const historico = useHistoricoRecebimentos(apiBaseUrl, semConexao);
  const [detalhe, setDetalhe] = useState<DetalhesRecebimentoCompleto | null>(null);
  const [abrindo, setAbrindo] = useState(false);
  const [erroDetalhe, setErroDetalhe] = useState<string | null>(null);
  const [folhaAberta, setFolhaAberta] = useState(false);
  const [teclado, setTeclado] = useState(0);
  const pedindoMais = useRef(false);

  useEffect(() => {
    const mostrar = Keyboard.addListener("keyboardDidShow", (evento) => {
      setTeclado(
        alturaCobertaPeloTeclado(Dimensions.get("window").height, Dimensions.get("screen").height, evento.endCoordinates),
      );
    });
    const esconder = Keyboard.addListener("keyboardDidHide", () => setTeclado(0));
    return () => {
      mostrar.remove();
      esconder.remove();
    };
  }, []);

  function escolherPeriodo(id: PeriodoPredefinido) {
    if (id === historico.periodo) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Vibration.vibrate(10);
    historico.setPeriodo(id);
  }

  async function abrir(item: ItemResumoHistoricoRecebimento) {
    setFolhaAberta(true);
    setDetalhe(null);
    setErroDetalhe(null);
    setAbrindo(true);
    try {
      setDetalhe(await catalogoRecebimentoService.obterRecebimento(apiBaseUrl, item.id));
    } catch (falha) {
      if (falha instanceof SessaoExpirada) return;
      setErroDetalhe(falha instanceof TempoEsgotado ? MENSAGEM_REDE : falha instanceof Error ? falha.message : MENSAGEM_REDE);
    } finally {
      setAbrindo(false);
    }
  }

  async function compartilhar() {
    if (!detalhe) return;
    try {
      await Share.share({ message: textoProtocolo(detalhe) });
    } catch {
      // o usuário fechou a folha nativa
    }
  }

  return (
    <View style={[styles.flex, { paddingBottom: teclado }]}>
      <View style={styles.topo}>
        <Pressable onPress={onVoltar} accessibilityRole="button" style={styles.voltar}>
          <Text style={styles.link}>Voltar ao painel</Text>
        </Pressable>
        <Text style={styles.titulo}>Histórico de Recebimentos</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {CHIPS_RECEBIMENTO.map((chip) => {
            const ativo = chip.id === historico.periodo;
            return (
              <Pressable
                key={chip.id}
                onPress={() => escolherPeriodo(chip.id)}
                accessibilityRole="button"
                style={[styles.chip, ativo && styles.chipAtivo]}
              >
                <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>{chip.rotulo}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <TextInput
          value={historico.termo}
          onChangeText={historico.setTermo}
          placeholder="Documento ou fornecedor"
          placeholderTextColor="#94A3B8"
          autoCapitalize="characters"
          style={styles.campo}
        />
        {historico.erro ? <Text style={styles.erro}>{historico.erro}</Text> : null}
      </View>
      {historico.carregando ? (
        <ActivityIndicator color="#1D4ED8" style={styles.espera} />
      ) : (
        <FlatList
          data={historico.itens}
          keyExtractor={(item) => item.id}
          style={styles.flex}
          contentContainerStyle={styles.lista}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={historico.atualizando}
              onRefresh={() => void historico.carregar(1, true, true)}
              colors={["#1D4ED8"]}
            />
          }
          onEndReached={() => {
            if (pedindoMais.current || historico.pagina >= historico.totalPaginas) return;
            pedindoMais.current = true;
            void historico.carregar(historico.pagina + 1, false, false).finally(() => {
              pedindoMais.current = false;
            });
          }}
          ListEmptyComponent={<Text style={styles.miudo}>Nenhum recebimento neste período.</Text>}
          renderItem={({ item }) => (
            <Pressable onPress={() => void abrir(item)} accessibilityRole="button" style={styles.card}>
              <View style={styles.linha}>
                <Text style={styles.cardTitulo}>{item.numeroDocumento}</Text>
                {estaEstornado(item.status) ? <Text style={styles.badge}>ESTORNADO</Text> : null}
              </View>
              <Text style={styles.miudo}>{item.fornecedorOrigem}</Text>
              <Text style={styles.miudo}>{formatarDataRecebimento(item.dataRecebimento)}</Text>
              <Text style={styles.qtd}>
                {item.totalItens} itens · {item.totalUnidades} unidades
              </Text>
            </Pressable>
          )}
        />
      )}
      <Modal
        visible={folhaAberta}
        transparent
        animationType="slide"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setFolhaAberta(false)}
      >
        <View style={styles.modal}>
          <Pressable style={styles.fundo} onPress={() => setFolhaAberta(false)} accessibilityLabel="Fechar detalhe" />
          <View style={styles.folha}>
            {abrindo ? <ActivityIndicator color="#1D4ED8" /> : null}
            {erroDetalhe ? <Text style={styles.erro}>{erroDetalhe}</Text> : null}
            {detalhe ? (
              <>
                <View style={styles.linha}>
                  <Text style={styles.titulo}>{detalhe.numeroDocumento}</Text>
                  {estaEstornado(detalhe.status) ? <Text style={styles.badge}>ESTORNADO</Text> : null}
                </View>
                <Text style={styles.miudo}>{detalhe.fornecedorOrigem}</Text>
                <Text style={styles.miudo}>
                  {detalhe.totalItens} itens · {detalhe.totalUnidades} unidades
                </Text>
                <ScrollView style={styles.itens}>
                  {detalhe.itens.map((item) => (
                    <View key={item.id} style={styles.item}>
                      <Text style={styles.cardTitulo}>
                        {item.produtoNome} {item.concentracao}
                      </Text>
                      <Text style={styles.miudo}>
                        {item.fabricanteNome} · Lote {item.numeroLote}
                      </Text>
                      <Text style={styles.miudo}>Validade {formatarDataIsoParaBr(item.dataValidade)}</Text>
                      <Text style={styles.qtd}>{item.quantidadeRecebida} un.</Text>
                      {estaEstornado(detalhe.status) ? <Text style={styles.cancelado}>Cancelado</Text> : null}
                    </View>
                  ))}
                </ScrollView>
                <Pressable onPress={() => void compartilhar()} accessibilityRole="button" style={styles.botao}>
                  <Text style={styles.botaoTexto}>Compartilhar Protocolo</Text>
                </Pressable>
              </>
            ) : null}
            <Pressable onPress={() => setFolhaAberta(false)} accessibilityRole="button" style={styles.voltar}>
              <Text style={styles.link}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topo: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.sm, gap: theme.spacing.sm },
  titulo: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  chips: { gap: theme.spacing.sm },
  chip: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  chipAtivo: { backgroundColor: "#1D4ED8", borderColor: "#1D4ED8" },
  chipTexto: { color: "#1D4ED8", fontWeight: "700" },
  chipTextoAtivo: { color: "#FFFFFF" },
  campo: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    color: "#0F172A",
    fontSize: 14,
  },
  lista: { padding: theme.spacing.md, paddingBottom: Platform.OS === "android" ? 96 : theme.spacing.md },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    gap: 4,
  },
  linha: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  cardTitulo: { flex: 1, fontSize: 14, fontWeight: "700", color: "#0F172A" },
  qtd: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  miudo: { fontSize: 12, color: "#475569" },
  badge: {
    backgroundColor: "#FEF2F2",
    color: "#991B1B",
    borderRadius: 8,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: "700",
  },
  cancelado: { color: "#991B1B", fontWeight: "700", fontSize: 12 },
  erro: { color: "#991B1B", fontWeight: "700", fontSize: 12 },
  espera: { marginTop: theme.spacing.lg },
  voltar: { minHeight: 44, justifyContent: "center" },
  link: { color: "#1D4ED8", fontWeight: "700" },
  botao: { minHeight: 44, borderRadius: 8, backgroundColor: "#1D4ED8", alignItems: "center", justifyContent: "center" },
  botaoTexto: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  modal: { flex: 1, justifyContent: "flex-end" },
  fundo: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(15,23,42,0.4)" },
  folha: {
    maxHeight: "80%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: theme.spacing.md,
    paddingBottom: Platform.OS === "android" ? 56 : theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  itens: { maxHeight: 280 },
  item: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingVertical: theme.spacing.sm,
    gap: 2,
  },
});
