import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  Vibration,
  View,
} from "react-native";
import {
  formatarCNS,
  formatarCPF,
  formatarDataIsoParaBr,
  type DispensacaoEfetivadaResultado,
  type PacienteDispensacaoRequest,
} from "@farmaubs/shared";
import { theme } from "../theme/tokens";
import { SessaoExpirada, TempoEsgotado } from "../services/api";
import { MENSAGEM_ACAO_OFFLINE } from "../services/conectividade";
import { dispensacaoService, FalhaDispensacao } from "../services/dispensacao.service";
import { MENSAGEM_REDE } from "./login-form";
import type { ItemCarrinho } from "./carrinho";
import {
  ehFalhaSaldo,
  formatarDataHoraAtendimento,
  montarPedido,
  posologiaDoLote,
  protocoloAtendimento,
  textoComprovante,
} from "./fechamento";

type RevisaoProps = {
  apiBaseUrl: string;
  paciente: PacienteDispensacaoRequest;
  itens: ItemCarrinho[];
  dataReceita: string;
  ubsId: string | null;
  nomeUbs: string;
  semConexao?: boolean;
  onVoltar: () => void;
  onConcluido: (resultado: DispensacaoEfetivadaResultado) => void;
};

/**
 * [DI-MOB-04]: Revisão do atendimento e baixa no estoque, com trava de segundo toque.
 */
export function RevisaoDispensacaoScreen({
  apiBaseUrl,
  paciente,
  itens,
  dataReceita,
  ubsId,
  nomeUbs,
  semConexao = false,
  onVoltar,
  onConcluido,
}: RevisaoProps) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [saldoMudou, setSaldoMudou] = useState(false);
  const [rede, setRede] = useState(false);
  const trava = useRef(false);
  const unidades = itens.reduce((soma, item) => soma + item.quantidade, 0);

  async function confirmar() {
    if (trava.current) return;
    if (semConexao) {
      setErro(MENSAGEM_ACAO_OFFLINE);
      setRede(true);
      setSaldoMudou(false);
      return;
    }
    trava.current = true;
    setEnviando(true);
    setErro(null);
    setRede(false);
    setSaldoMudou(false);
    try {
      const resultado = await dispensacaoService.efetivar(
        apiBaseUrl,
        montarPedido(paciente, itens, dataReceita, ubsId),
      );
      Vibration.vibrate(40);
      onConcluido(resultado);
    } catch (falha) {
      if (falha instanceof SessaoExpirada) return;
      if (falha instanceof TempoEsgotado) {
        setErro(MENSAGEM_REDE);
        setRede(true);
        return;
      }
      const mensagem = falha instanceof Error ? falha.message : MENSAGEM_REDE;
      if (falha instanceof FalhaDispensacao && ehFalhaSaldo(falha.status, mensagem)) {
        setErro(mensagem);
        setSaldoMudou(true);
        return;
      }
      setErro(mensagem);
      setRede(!(falha instanceof FalhaDispensacao));
    } finally {
      trava.current = false;
      setEnviando(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
        <Pressable onPress={onVoltar} disabled={enviando} accessibilityRole="button" style={styles.voltar}>
          <Text style={styles.voltarTexto}>Voltar ao atendimento</Text>
        </Pressable>
        <Text style={styles.titulo}>Confirmar Dispensação e Baixa de Estoque</Text>
        <Text style={styles.subtitulo}>Verifique o paciente e os lotes selecionados antes de gravar a saída definitiva</Text>

        <View style={styles.cartao}>
          <Text style={styles.nome}>{paciente.nomeCompleto}</Text>
          <Text style={styles.detalhe}>CPF: {formatarCPF(paciente.cpf)} | CNS: {formatarCNS(paciente.cns)}</Text>
          <Text style={styles.detalhe}>Nascimento: {formatarDataIsoParaBr(paciente.dataNascimento)}</Text>
          <Text style={styles.detalhe}>UBS: {nomeUbs || "Unidade não selecionada"}</Text>
          {dataReceita ? <Text style={styles.receita}>Data de Emissão da Receita: {formatarDataIsoParaBr(dataReceita)}</Text> : null}
        </View>

        {itens.map((item) => {
          const nome = `${item.medicamento.principioAtivo}${item.medicamento.apresentacao ? ` - ${item.medicamento.apresentacao}` : ""}`;
          return (
            <View key={`${item.medicamento.id}:${item.lote.id}`} style={styles.linha}>
              <View style={styles.linhaTexto}>
                <Text style={styles.nomeItem}>{nome}</Text>
                <Text style={styles.detalhe}>
                  Lote: {item.lote.numeroLote} | Validade: {formatarDataIsoParaBr(item.lote.dataValidade)}
                  {item.posologia.trim() ? ` | Posologia: ${item.posologia.trim()}` : ""}
                </Text>
              </View>
              <Text style={styles.qtd}>{item.quantidade} un.</Text>
            </View>
          );
        })}

        <Text style={styles.detalhe}>Total de itens: {itens.length}</Text>
        <Text style={styles.detalhe}>Total de unidades a baixar: {unidades} un.</Text>
        {erro ? <Text style={styles.erro} accessibilityRole="alert">{erro}</Text> : null}
        {saldoMudou ? (
          <Text style={styles.detalhe}>O atendimento foi mantido. Volte e escolha outro lote com saldo.</Text>
        ) : null}
      </ScrollView>
      <View style={styles.rodape}>
        <Pressable
          onPress={() => void confirmar()}
          disabled={enviando || itens.length === 0}
          accessibilityRole="button"
          accessibilityState={{ disabled: enviando || itens.length === 0, busy: enviando }}
          style={[styles.botao, (enviando || itens.length === 0) && styles.botaoDesabilitado]}
        >
          {enviando ? <ActivityIndicator color="#FFFFFF" /> : (
            <Text style={styles.botaoTexto}>{rede ? "Tentar Novamente" : "Confirmar e Efetivar Baixa"}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

type ComprovanteProps = {
  resultado: DispensacaoEfetivadaResultado;
  nomeUbs: string;
  itens: ItemCarrinho[];
  onNovoAtendimento: () => void;
};

/**
 * [DI-MOB-04]: Recibo com o protocolo da API e o compartilhamento nativo.
 */
export function ComprovanteDispensacaoScreen({ resultado, nomeUbs, itens, onNovoAtendimento }: ComprovanteProps) {
  const [erroShare, setErroShare] = useState<string | null>(null);
  const quando = formatarDataHoraAtendimento(resultado.dataAtendimento);
  const linhas = resultado.itens.map((item) => ({
    id: item.itemId,
    nome: item.medicamentoNome,
    lote: item.numeroLote,
    quantidade: item.quantidadeDispensada,
    posologia: posologiaDoLote(itens, item.loteId),
  }));

  async function compartilhar() {
    setErroShare(null);
    try {
      await Share.share({
        title: `Comprovante ${protocoloAtendimento(resultado.numeroAtendimento)}`,
        message: textoComprovante({
          numeroAtendimento: resultado.numeroAtendimento,
          dataHora: quando,
          ubsNome: nomeUbs || "UBS",
          farmaceutico: resultado.dispensador.nomeCompleto || "Farmacêutico",
          pacienteNome: resultado.paciente.nomeCompleto,
          linhas,
        }),
      });
    } catch {
      setErroShare("Não foi possível abrir o compartilhamento.");
    }
  }

  return (
    <View style={styles.flex}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.conteudoRecibo}>
        <Text style={styles.titulo}>Comprovante Digital de Dispensação</Text>
        <Text style={styles.protocolo}>{protocoloAtendimento(resultado.numeroAtendimento)}</Text>
        <Text style={styles.detalhe}>Data: {quando}</Text>
        <Text style={styles.detalhe}>UBS: {nomeUbs || "UBS"}</Text>
        <Text style={styles.detalhe}>Farmacêutico: {resultado.dispensador.nomeCompleto || "Farmacêutico"}</Text>
        <View style={styles.cartao}>
          <Text style={styles.nome}>{resultado.paciente.nomeCompleto}</Text>
          <Text style={styles.detalhe}>CPF: {formatarCPF(resultado.paciente.cpf)} | CNS: {formatarCNS(resultado.paciente.cns)}</Text>
        </View>
        {linhas.map((linha) => (
          <View key={linha.id} style={styles.linha}>
            <View style={styles.linhaTexto}>
              <Text style={styles.nomeItem}>{linha.nome}</Text>
              <Text style={styles.detalhe}>
                Lote: {linha.lote}{linha.posologia ? ` | ${linha.posologia}` : ""}
              </Text>
            </View>
            <Text style={styles.qtd}>{linha.quantidade} un.</Text>
          </View>
        ))}
        {erroShare ? <Text style={styles.erro} accessibilityRole="alert">{erroShare}</Text> : null}
      </ScrollView>
      <View style={styles.rodape}>
        <Pressable onPress={() => void compartilhar()} accessibilityRole="button" style={styles.botao}>
          <Text style={styles.botaoTexto}>Compartilhar Comprovante</Text>
        </Pressable>
        <Pressable onPress={onNovoAtendimento} accessibilityRole="button" style={styles.botaoSecundario}>
          <Text style={styles.botaoSecundarioTexto}>Novo Atendimento</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#F8FAFC" },
  conteudo: { padding: theme.spacing.md, paddingBottom: 140, gap: theme.spacing.sm },
  conteudoRecibo: { padding: theme.spacing.md, paddingBottom: 180, gap: theme.spacing.sm },
  voltar: { minHeight: 44, justifyContent: "center" },
  voltarTexto: { color: "#1D4ED8", fontWeight: "700" },
  titulo: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  subtitulo: { fontSize: 12, color: "#64748B" },
  protocolo: { fontSize: 20, fontWeight: "700", color: "#1D4ED8" },
  cartao: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: theme.spacing.md,
    gap: 4,
  },
  nome: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  detalhe: { fontSize: 12, color: "#334155" },
  receita: { fontSize: 12, color: "#1E3A8A", fontWeight: "600" },
  linha: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: theme.spacing.md,
  },
  linhaTexto: { flex: 1, gap: 4 },
  nomeItem: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  qtd: {
    backgroundColor: "#EFF6FF",
    color: "#1E3A8A",
    fontWeight: "700",
    borderRadius: 8,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  erro: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    color: "#991B1B",
    borderRadius: 8,
    padding: theme.spacing.sm,
    fontWeight: "700",
    fontSize: 13,
  },
  rodape: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: Platform.OS === "android" ? 56 : theme.spacing.md,
    gap: theme.spacing.sm,
  },
  botao: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: "#1D4ED8",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  botaoDesabilitado: { opacity: 0.5 },
  botaoTexto: { color: "#FFFFFF", fontWeight: "700", fontSize: 14, textAlign: "center" },
  botaoSecundario: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  botaoSecundarioTexto: { color: "#0F172A", fontWeight: "700", fontSize: 14 },
});
