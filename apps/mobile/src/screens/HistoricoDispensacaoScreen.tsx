import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { formatarCPF, type DispensacaoItemListaDto } from "@farmaubs/shared";
import { theme } from "../theme/tokens";
import { SessaoExpirada, TempoEsgotado } from "../services/api";
import { MENSAGEM_ACAO_OFFLINE } from "../services/conectividade";
import { dispensacaoService, FalhaDispensacao } from "../services/dispensacao.service";
import { formatarDataHoraAtendimento, protocoloAtendimento } from "./fechamento";
import { MENSAGEM_REDE } from "./login-form";
import {
  CHIPS_HISTORICO,
  DEBOUNCE_HISTORICO_MS,
  LIMITE_HISTORICO,
  consultasDaBusca,
  intervaloDoPeriodo,
  juntarItens,
  rotuloStatus,
  ultimosDigitosCpf,
  type PeriodoHistorico,
} from "./historico-dispensacao";

type HistoricoDispensacaoScreenProps = {
  apiBaseUrl: string;
  ubsId: string | null;
  semConexao?: boolean;
  onVoltar: () => void;
};

/**
 * [DI-MOB-05]: Histórico da UBS, chips de período, busca e folha de detalhe.
 */
export function HistoricoDispensacaoScreen({
  apiBaseUrl,
  ubsId,
  semConexao = false,
  onVoltar,
}: HistoricoDispensacaoScreenProps) {
  const [periodo, setPeriodo] = useState<PeriodoHistorico>("ONTEM_E_HOJE");
  const [termo, setTermo] = useState("");
  const [termoAplicado, setTermoAplicado] = useState("");
  const [itens, setItens] = useState<DispensacaoItemListaDto[]>([]);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<DispensacaoItemListaDto | null>(null);
  const ordem = useRef(0);
  const pedindoMais = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setTermoAplicado(termo), DEBOUNCE_HISTORICO_MS);
    return () => clearTimeout(timer);
  }, [termo]);

  useEffect(() => {
    setPagina(1);
    void carregar(1, true, false);
  }, [periodo, termoAplicado, ubsId]);

  async function carregar(paginaPedida: number, substituir: boolean, gesto: boolean) {
    if (semConexao) {
      setErro(MENSAGEM_ACAO_OFFLINE);
      setCarregando(false);
      setAtualizando(false);
      return;
    }
    const ticket = ++ordem.current;
    if (gesto) setAtualizando(true);
    else setCarregando(true);
    setErro(null);
    const intervalo = intervaloDoPeriodo(periodo);
    const base = {
      ubsId: ubsId ?? undefined,
      pagina: paginaPedida,
      limite: LIMITE_HISTORICO,
      dataInicio: intervalo.dataInicio,
      dataFim: intervalo.dataFim,
    };
    try {
      const consultas = consultasDaBusca(base, termoAplicado);
      const paginas = await Promise.all(consultas.map((consulta) => dispensacaoService.listar(apiBaseUrl, consulta)));
      if (ticket !== ordem.current) return;
      if (consultas.length > 1) {
        // shortcut: a busca por texto junta só a primeira página de cada filtro; paginar os dois juntos quando a UBS passar de 20 resultados numa busca.
        setItens(juntarItens(paginas));
        setTotalPaginas(1);
        setPagina(1);
      } else {
        const resposta = paginas[0];
        setTotalPaginas(resposta?.totalPaginas ?? 1);
        setPagina(paginaPedida);
        setItens((atuais) => (substituir ? resposta?.itens ?? [] : [...atuais, ...(resposta?.itens ?? [])]));
      }
    } catch (falha) {
      if (ticket !== ordem.current || falha instanceof SessaoExpirada) return;
      setErro(falha instanceof TempoEsgotado || !(falha instanceof FalhaDispensacao) ? MENSAGEM_REDE : falha.message);
    } finally {
      if (ticket === ordem.current) {
        setCarregando(false);
        setAtualizando(false);
      }
    }
  }

  return (
    <View style={styles.flex}>
      <View style={styles.topo}>
        <Pressable onPress={onVoltar} accessibilityRole="button" style={styles.voltar}>
          <Text style={styles.voltarTexto}>Voltar ao painel</Text>
        </Pressable>
        <Text style={styles.titulo}>Histórico de Atendimentos da Unidade</Text>
        <Text style={styles.subtitulo}>Consulte as dispensações da UBS ativa</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {CHIPS_HISTORICO.map((chip) => {
            const ativo = chip.id === periodo;
            return (
              <Pressable
                key={chip.id}
                onPress={() => setPeriodo(chip.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: ativo }}
                style={[styles.chip, ativo && styles.chipAtivo]}
              >
                <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>{chip.rotulo}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <TextInput
          value={termo}
          onChangeText={setTermo}
          placeholder="Paciente ou medicamento"
          style={styles.busca}
        />
        {erro ? <Text style={styles.erro} accessibilityRole="alert">{erro}</Text> : null}
      </View>
      {carregando && itens.length === 0 ? (
        <ActivityIndicator color="#1D4ED8" style={styles.espera} />
      ) : (
        <FlatList
          style={styles.flex}
          data={itens}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={atualizando} onRefresh={() => void carregar(1, true, true)} tintColor="#1D4ED8" colors={["#1D4ED8"]} />}
          contentContainerStyle={styles.lista}
          keyboardShouldPersistTaps="handled"
          onEndReached={() => {
            if (pedindoMais.current || termoAplicado.trim() || carregando || pagina >= totalPaginas) return;
            pedindoMais.current = true;
            void carregar(pagina + 1, false, false).finally(() => {
              pedindoMais.current = false;
            });
          }}
          ListEmptyComponent={<Text style={styles.vazio}>Nenhuma dispensação encontrada para o período e filtros selecionados.</Text>}
          renderItem={({ item }) => (
            <Pressable onPress={() => setSelecionado(item)} accessibilityRole="button" style={styles.cartao}>
              <View style={styles.cartaoTopo}>
                <Text style={styles.protocolo}>{protocoloAtendimento(item.numeroAtendimento)}</Text>
                <Text style={[styles.selo, item.status === "estornada" ? styles.seloVermelho : styles.seloVerde]}>
                  {rotuloStatus(item.status)}
                </Text>
              </View>
              <Text style={styles.hora}>{formatarDataHoraAtendimento(item.dataAtendimento)}</Text>
              <Text style={styles.paciente}>{item.pacienteNome}</Text>
              <Text style={styles.detalhe}>CPF final {ultimosDigitosCpf(item.pacienteCpf)}</Text>
              <Text style={styles.detalhe}>{item.medicamentosResumo || "Sem medicamentos no resumo"}</Text>
            </Pressable>
          )}
        />
      )}
      <Modal visible={selecionado !== null} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={() => setSelecionado(null)}>
        <View style={styles.modal}>
          <Pressable style={styles.fundo} onPress={() => setSelecionado(null)} accessibilityLabel="Fechar detalhes" />
          {selecionado ? (
            <View style={styles.folha}>
              <Text style={styles.titulo}>{protocoloAtendimento(selecionado.numeroAtendimento)}</Text>
              <Text style={styles.detalhe}>{formatarDataHoraAtendimento(selecionado.dataAtendimento)}</Text>
              <Text style={[styles.selo, selecionado.status === "estornada" ? styles.seloVermelho : styles.seloVerde]}>
                {rotuloStatus(selecionado.status)}
              </Text>
              <Text style={styles.paciente}>{selecionado.pacienteNome}</Text>
              <Text style={styles.detalhe}>CPF: {formatarCPF(selecionado.pacienteCpf)}</Text>
              <Text style={styles.detalhe}>CNS: {selecionado.pacienteCns}</Text>
              <Text style={styles.detalhe}>Farmacêutico: {selecionado.dispensadorNome || "Farmacêutico"}</Text>
              <Text style={styles.legenda}>Medicamentos dispensados</Text>
              <Text style={styles.detalhe}>{selecionado.medicamentosResumo || "Sem medicamentos no resumo"}</Text>
              <Text style={styles.detalhe}>{selecionado.totalItens} {selecionado.totalItens === 1 ? "item" : "itens"}</Text>
              {selecionado.status === "estornada" ? (
                <Text style={styles.detalhe}>Este atendimento foi estornado.</Text>
              ) : null}
              <Pressable onPress={() => setSelecionado(null)} accessibilityRole="button" style={styles.fechar}>
                <Text style={styles.fecharTexto}>Fechar</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#F8FAFC" },
  topo: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.md, gap: theme.spacing.sm },
  voltar: { minHeight: 44, justifyContent: "center" },
  voltarTexto: { color: "#1D4ED8", fontWeight: "700" },
  titulo: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  subtitulo: { fontSize: 12, color: "#64748B" },
  chips: { gap: theme.spacing.sm, paddingVertical: 4 },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  chipAtivo: { backgroundColor: "#1D4ED8" },
  chipTexto: { color: "#334155", fontWeight: "700", fontSize: 13 },
  chipTextoAtivo: { color: "#FFFFFF" },
  busca: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    color: "#0F172A",
  },
  espera: { marginTop: theme.spacing.lg },
  lista: { padding: theme.spacing.md, paddingBottom: 48 },
  vazio: { fontSize: 13, color: "#64748B" },
  cartao: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    gap: 4,
  },
  cartaoTopo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: theme.spacing.sm },
  protocolo: { flex: 1, fontSize: 14, fontWeight: "700", color: "#0F172A" },
  hora: { fontSize: 12, color: "#64748B" },
  paciente: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  detalhe: { fontSize: 12, color: "#334155" },
  selo: {
    alignSelf: "flex-start",
    overflow: "hidden",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 11,
    fontWeight: "700",
  },
  seloVerde: { backgroundColor: "#D1FAE5", color: "#065F46" },
  seloVermelho: { backgroundColor: "#FEE2E2", color: "#991B1B" },
  erro: { color: "#991B1B", fontWeight: "700", fontSize: 12 },
  modal: { flex: 1, justifyContent: "flex-end" },
  fundo: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(15,23,42,0.4)" },
  folha: {
    maxHeight: "70%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: theme.spacing.md,
    paddingBottom: 48,
    gap: theme.spacing.sm,
  },
  legenda: { fontSize: 12, fontWeight: "700", color: "#334155", marginTop: 4 },
  fechar: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  fecharTexto: { color: "#1D4ED8", fontWeight: "700" },
});
