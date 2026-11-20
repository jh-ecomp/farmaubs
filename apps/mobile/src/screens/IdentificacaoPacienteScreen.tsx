import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
  type GestureResponderEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import {
  calcularIdade,
  formatarCNS,
  formatarCPF,
  formatarDataIsoParaBr,
  formatarMascaraDataBr,
  limparNaoNumericos,
  normalizarDataParaIso,
} from "@farmaubs/shared";
import { theme } from "../theme/tokens";
import { MENSAGEM_REDE } from "./login-form";
import { MENSAGEM_ACAO_OFFLINE } from "../services/conectividade";
import { TempoEsgotado } from "../services/api";
import { pacienteService } from "../services/paciente.service";
import {
  cnsDeveSerBuscado,
  cpfDeveSerBuscado,
  DEBOUNCE_BUSCA_MS,
  erroCnsAoSair,
  erroCpfAoSair,
  mensagemAlertaRetirada,
  pacientePronto,
  retiradaRecente,
  type PacienteEncontrado,
  type RetiradaRecente,
} from "./paciente-form";
import { proximoElastico } from "./elastico";

type IdentificacaoPacienteScreenProps = {
  apiBaseUrl: string;
  semConexao?: boolean;
  onVoltar: () => void;
  onAvancar: (pacienteId: string) => void;
};

/**
 * [DI-MOB-01]: Identificação do paciente a partir do atalho Dispensas.
 */
export function IdentificacaoPacienteScreen({
  apiBaseUrl,
  semConexao = false,
  onVoltar,
  onAvancar,
}: IdentificacaoPacienteScreenProps) {
  const [cns, setCns] = useState("");
  const [cpf, setCpf] = useState("");
  const [nome, setNome] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [erroCpf, setErroCpf] = useState<string | null>(null);
  const [erroCns, setErroCns] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pacienteId, setPacienteId] = useState<string | null>(null);
  const [historico, setHistorico] = useState<RetiradaRecente[]>([]);
  const [historicoAberto, setHistoricoAberto] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const buscaAtual = useRef(0);
  const timerBusca = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pull = useRef(new Animated.Value(0)).current;
  const pullAtual = useRef(0);
  const noFim = useRef(false);
  const toqueY = useRef<number | null>(null);

  function aoRolar(evento: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = evento.nativeEvent;
    const limite = Math.max(0, contentSize.height - layoutMeasurement.height);
    noFim.current = contentOffset.y >= limite - 2;
  }

  function aoToque(evento: GestureResponderEvent) {
    toqueY.current = evento.nativeEvent.pageY;
    pull.stopAnimation();
  }

  function aoArrastar(evento: GestureResponderEvent) {
    if (Platform.OS !== "android") return;
    const y = evento.nativeEvent.pageY;
    const anterior = toqueY.current;
    toqueY.current = y;
    if (anterior == null) return;
    const proximo = proximoElastico(pullAtual.current, y - anterior, noFim.current);
    if (proximo === pullAtual.current) return;
    pullAtual.current = proximo;
    pull.setValue(proximo);
  }

  function aoSoltar() {
    toqueY.current = null;
    if (pullAtual.current === 0) return;
    pullAtual.current = 0;
    Animated.spring(pull, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 0 }).start();
  }

  useEffect(() => {
    return () => {
      if (timerBusca.current) clearTimeout(timerBusca.current);
    };
  }, []);

  const pronto = pacientePronto(cns, cpf, nome, nascimento);
  const idade = calcularIdade(normalizarDataParaIso(nascimento));

  function limparEncontrado() {
    setPacienteId(null);
    setHistorico([]);
  }

  function agendarBusca(digitos: string) {
    if (timerBusca.current) clearTimeout(timerBusca.current);
    timerBusca.current = setTimeout(() => {
      void buscar(digitos);
    }, DEBOUNCE_BUSCA_MS);
  }

  async function buscar(digitos: string) {
    if (semConexao) {
      setErro(MENSAGEM_ACAO_OFFLINE);
      return;
    }
    const ordem = ++buscaAtual.current;
    setBuscando(true);
    setErro(null);
    try {
      const lista = await pacienteService.buscar(apiBaseUrl, digitos);
      if (ordem !== buscaAtual.current) return;
      const encontrado = lista[0];
      if (!encontrado) {
        limparEncontrado();
        return;
      }
      aplicarEncontrado(encontrado);
      Vibration.vibrate(15);
      const itens = await pacienteService.historico(apiBaseUrl, encontrado.id);
      if (ordem !== buscaAtual.current) return;
      setHistorico(itens);
      setHistoricoAberto(true);
    } catch (falha) {
      if (ordem !== buscaAtual.current) return;
      setErro(falha instanceof TempoEsgotado ? MENSAGEM_REDE : falha instanceof Error ? falha.message : MENSAGEM_REDE);
    } finally {
      if (ordem === buscaAtual.current) setBuscando(false);
    }
  }

  function aplicarEncontrado(encontrado: PacienteEncontrado) {
    setPacienteId(encontrado.id);
    setCns(formatarCNS(encontrado.cns));
    setCpf(formatarCPF(encontrado.cpf));
    setNome(encontrado.nomeCompleto);
    setNascimento(formatarDataIsoParaBr(encontrado.dataNascimento));
    setErroCpf(null);
    setErroCns(null);
  }

  function aoMudarCpf(valor: string) {
    if (limparNaoNumericos(cpf).length >= 11 && limparNaoNumericos(valor).length > 11) return;
    const formatado = formatarCPF(valor);
    setCpf(formatado);
    setErroCpf(null);
    limparEncontrado();
    const digitos = limparNaoNumericos(formatado);
    if (cpfDeveSerBuscado(digitos)) agendarBusca(digitos);
  }

  function aoMudarCns(valor: string) {
    if (limparNaoNumericos(cns).length >= 15 && limparNaoNumericos(valor).length > 15) return;
    const formatado = formatarCNS(valor);
    setCns(formatado);
    setErroCns(null);
    limparEncontrado();
    const digitos = limparNaoNumericos(formatado);
    if (cnsDeveSerBuscado(digitos)) agendarBusca(digitos);
  }

  async function avancar() {
    if (!pronto || enviando) return;
    if (semConexao) {
      setErro(MENSAGEM_ACAO_OFFLINE);
      return;
    }
    if (pacienteId) {
      onAvancar(pacienteId);
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const criado = await pacienteService.cadastrar(apiBaseUrl, {
        cns: limparNaoNumericos(cns),
        cpf: limparNaoNumericos(cpf),
        nomeCompleto: nome.trim(),
        dataNascimento: normalizarDataParaIso(nascimento),
      });
      setPacienteId(criado.id);
      setHistorico([]);
      setHistoricoAberto(true);
    } catch (falha) {
      setErro(falha instanceof TempoEsgotado ? MENSAGEM_REDE : falha instanceof Error ? falha.message : MENSAGEM_REDE);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.conteudo}
        showsVerticalScrollIndicator
        scrollEventThrottle={16}
        overScrollMode="always"
        onScroll={aoRolar}
        onTouchStart={aoToque}
        onTouchMove={aoArrastar}
        onTouchEnd={aoSoltar}
        onTouchCancel={aoSoltar}
      >
        {/* shortcut: elástico manual no fim, o Android desta tela só faz um brilho nativo */}
        <Animated.View style={{ transform: [{ translateY: pull }] }}>
          <View style={styles.formulario}>
            <Pressable onPress={onVoltar} accessibilityRole="button" style={styles.voltar}>
              <Text style={styles.voltarTexto}>Voltar ao painel</Text>
            </Pressable>
            <View style={styles.cabecalho}>
              <View style={styles.cabecalhoTexto}>
                <Text style={styles.titulo}>1. Identificação do Paciente</Text>
                <Text style={styles.subtitulo}>
                  Informe os dados do paciente para localizar o cadastro e consultar retiradas anteriores
                </Text>
              </View>
              {buscando ? (
                <Text style={styles.seloBusca}>Buscando cadastro...</Text>
              ) : null}
            </View>
            {erro ? (
              <Text style={styles.erro} accessibilityRole="alert">
                {erro}
              </Text>
            ) : null}

            <Text style={styles.legenda}>CPF <Text style={styles.obrigatorio}>*</Text></Text>
            <TextInput
              value={cpf}
              onChangeText={aoMudarCpf}
              onBlur={() => setErroCpf(erroCpfAoSair(limparNaoNumericos(cpf)))}
              keyboardType="number-pad"
              maxLength={14}
              placeholder="000.000.000-00"
              style={[styles.campo, erroCpf ? styles.campoErro : null]}
            />
            {erroCpf ? <Text style={styles.erroCampo}>{erroCpf}</Text> : null}

            <Text style={styles.legenda}>
              Cartão Nacional de Saúde (CNS) <Text style={styles.obrigatorio}>*</Text>
            </Text>
            <TextInput
              value={cns}
              onChangeText={aoMudarCns}
              onBlur={() => setErroCns(erroCnsAoSair(limparNaoNumericos(cns)))}
              keyboardType="number-pad"
              maxLength={18}
              placeholder="000 0000 0000 0000"
              style={[styles.campo, erroCns ? styles.campoErro : null]}
            />
            {erroCns ? <Text style={styles.erroCampo}>{erroCns}</Text> : null}

            <Text style={styles.legenda}>Nome Completo <Text style={styles.obrigatorio}>*</Text></Text>
            <TextInput
              value={nome}
              onChangeText={setNome}
              autoCapitalize="words"
              placeholder="Nome completo do paciente"
              style={styles.campo}
            />

            <View style={styles.linhaData}>
              <Text style={styles.legenda}>Data de Nascimento <Text style={styles.obrigatorio}>*</Text></Text>
              {idade !== null ? (
                <Text style={styles.seloIdade}>{idade} {idade === 1 ? "ano" : "anos"}</Text>
              ) : null}
            </View>
            <TextInput
              value={nascimento}
              onChangeText={(valor) => setNascimento(formatarMascaraDataBr(valor))}
              keyboardType="number-pad"
              placeholder="DD/MM/AAAA"
              style={styles.campo}
            />
          </View>
          <View style={styles.rodape}>
            {pacienteId ? (
              <View style={styles.historico}>
                <Pressable
                  onPress={() => setHistoricoAberto((aberto) => !aberto)}
                  accessibilityRole="button"
                  style={styles.historicoTopo}
                >
                  <View style={styles.cabecalhoTexto}>
                    <Text style={styles.historicoTitulo}>Histórico de Consumo (Últimos 90 dias)</Text>
                    {nome ? <Text style={styles.pacienteNome}>Paciente: {nome}</Text> : null}
                  </View>
                  <Text style={styles.seloContagem}>
                    {historico.length} {historico.length === 1 ? "retirada" : "retiradas"}
                  </Text>
                </Pressable>
                {historicoAberto && historico.length === 0 ? (
                  <Text style={styles.vazio}>Nenhuma retirada registrada nos últimos 90 dias neste município.</Text>
                ) : null}
                {historicoAberto
                  ? historico.map((item, indice) => (
                      <View key={`${item.dispensacaoId}:${item.medicamentoNome}:${indice}`} style={styles.linhaHistorico}>
                        {retiradaRecente(item) ? (
                          <Text style={styles.alerta} accessibilityRole="alert">
                            {mensagemAlertaRetirada(item.diasDesdeUltimaRetirada)}
                          </Text>
                        ) : null}
                        <View style={styles.linhaItem}>
                          <Text style={styles.medicamento}>{item.medicamentoNome}</Text>
                          <Text style={styles.detalhe}>{item.quantidadeDispensada} un.</Text>
                          <Text style={styles.detalhe}>{formatarDataIsoParaBr(item.dataDispensacao)}</Text>
                          <Text style={[styles.intervalo, retiradaRecente(item) && styles.intervaloAlerta]}>
                            Há {item.diasDesdeUltimaRetirada} dias
                          </Text>
                        </View>
                      </View>
                    ))
                  : null}
              </View>
            ) : null}
            <Pressable
              onPress={() => void avancar()}
              disabled={!pronto || enviando}
              accessibilityRole="button"
              accessibilityState={{ disabled: !pronto || enviando }}
              style={[styles.botao, (!pronto || enviando) && styles.botaoDesabilitado]}
            >
              {enviando ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.botaoTexto}>Avançar para Medicamentos</Text>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#F8FAFC" },
  conteudo: { padding: theme.spacing.md, paddingBottom: 48 },
  formulario: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  voltar: { minHeight: 44, justifyContent: "center" },
  voltarTexto: { color: "#1D4ED8", fontWeight: "700" },
  cabecalho: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: theme.spacing.sm,
  },
  cabecalhoTexto: { flex: 1 },
  titulo: { fontSize: 16, fontWeight: "600", color: "#0F172A" },
  subtitulo: { fontSize: 12, color: "#64748B", marginTop: 2 },
  seloBusca: {
    alignSelf: "flex-start",
    backgroundColor: "#EFF6FF",
    color: "#1D4ED8",
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  legenda: { marginTop: theme.spacing.sm, fontSize: 12, fontWeight: "600", color: "#334155" },
  obrigatorio: { color: "#DC2626" },
  linhaData: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  seloIdade: {
    backgroundColor: "#EFF6FF",
    color: "#1E40AF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 999,
    overflow: "hidden",
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  campo: {
    height: 44,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    fontSize: 14,
    color: "#0F172A",
  },
  campoErro: { borderColor: "#EF4444" },
  erroCampo: { color: "#DC2626", fontSize: 12, fontWeight: "600" },
  erro: { color: "#DC2626", fontWeight: "700" },
  rodape: { gap: theme.spacing.md },
  historico: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  historicoTopo: { flexDirection: "row", justifyContent: "space-between", gap: theme.spacing.sm },
  historicoTitulo: { fontSize: 14, fontWeight: "600", color: "#0F172A" },
  pacienteNome: { fontSize: 12, color: "#475569", marginTop: 2 },
  seloContagem: {
    alignSelf: "flex-start",
    backgroundColor: "#E2E8F0",
    color: "#1E293B",
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: "hidden",
  },
  alerta: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FCD34D",
    borderRadius: 8,
    color: "#78350F",
    fontWeight: "700",
    padding: theme.spacing.sm,
  },
  linhaHistorico: { gap: theme.spacing.xs, borderTopWidth: 1, borderTopColor: "#E2E8F0", paddingTop: theme.spacing.sm },
  linhaItem: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: theme.spacing.sm },
  medicamento: { flexGrow: 1, fontSize: 13, fontWeight: "600", color: "#1E293B" },
  detalhe: { fontSize: 12, color: "#334155" },
  intervalo: {
    borderWidth: 1,
    borderColor: "#A7F3D0",
    backgroundColor: "#ECFDF5",
    color: "#065F46",
    borderRadius: 999,
    overflow: "hidden",
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  intervaloAlerta: { borderColor: "#FCD34D", backgroundColor: "#FEF3C7", color: "#78350F" },
  vazio: { fontSize: 12, color: "#64748B" },
  botao: {
    height: 44,
    borderRadius: 8,
    backgroundColor: "#1D4ED8",
    alignItems: "center",
    justifyContent: "center",
  },
  botaoDesabilitado: { opacity: 0.6 },
  botaoTexto: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
});
