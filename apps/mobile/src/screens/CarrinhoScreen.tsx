import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { formatarDataIsoParaBr } from "@farmaubs/shared";
import { theme } from "../theme/tokens";
import {
  MENSAGEM_CARD_ANTIMICROBIANO,
  MENSAGEM_DATA_FUTURA,
  alterarPosologia,
  alterarQuantidade,
  contemAntimicrobiano,
  isoDaDataLocal,
  mensagemReceitaVencida,
  podeRevisarAtendimento,
  removerItem,
  totaisDoCarrinho,
  validarReceitaDoCarrinho,
  type ItemCarrinho,
} from "./carrinho";

type CarrinhoScreenProps = {
  itens: ItemCarrinho[];
  dataReceita: string;
  onMudarItens: (itens: ItemCarrinho[]) => void;
  onMudarData: (iso: string) => void;
  onVoltar: () => void;
  onRevisar: () => void;
};

/**
 * [DI-MOB-03]: Lista do atendimento, posologia e bloqueio da receita de antimicrobiano.
 */
export function CarrinhoScreen({ itens, dataReceita, onMudarItens, onMudarData, onVoltar, onRevisar }: CarrinhoScreenProps) {
  const [calendarioAberto, setCalendarioAberto] = useState(false);
  const antibiotico = contemAntimicrobiano(itens);
  const validacao = validarReceitaDoCarrinho(itens, dataReceita);
  const totais = totaisDoCarrinho(itens);
  const pode = podeRevisarAtendimento(itens, dataReceita);
  const mostrarErro = dataReceita.trim().length > 0 && !validacao.valida;

  function aoEscolherData(evento: DateTimePickerEvent, data?: Date) {
    setCalendarioAberto(false);
    if (evento.type !== "set" || !data) return;
    onMudarData(isoDaDataLocal(data));
  }

  function pedirRemocao(item: ItemCarrinho) {
    const nome = item.medicamento.principioAtivo;
    Alert.alert("Remover item", `Deseja retirar ${nome} do atendimento?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: () => {
          onMudarItens(removerItem(itens, item.medicamento.id, item.lote.id));
        },
      },
    ]);
  }

  return (
    <View style={styles.flex}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
        <Pressable onPress={onVoltar} accessibilityRole="button" style={styles.voltar}>
          <Text style={styles.voltarTexto}>Voltar aos medicamentos</Text>
        </Pressable>
        <Text style={styles.titulo}>3. Medicamentos do Atendimento</Text>
        <Text style={styles.subtitulo}>Confira quantidades e a orientação de uso de cada item</Text>

        {antibiotico ? (
          <View style={styles.avisoAzul}>
            <Text style={styles.avisoAzulTexto}>{MENSAGEM_CARD_ANTIMICROBIANO}</Text>
            <Text style={styles.legenda}>Data da Receita Médica <Text style={styles.obrigatorio}>*</Text></Text>
            <Pressable onPress={() => setCalendarioAberto(true)} accessibilityRole="button" style={styles.data}>
              <Text style={styles.dataTexto}>{dataReceita ? formatarDataIsoParaBr(dataReceita) : "Selecionar data"}</Text>
            </Pressable>
          </View>
        ) : null}

        {mostrarErro && validacao.motivo === "PRAZO_EXPIRADO" ? (
          <Text style={styles.erro} accessibilityRole="alert">{mensagemReceitaVencida(validacao.diasDecorridos ?? 0)}</Text>
        ) : null}
        {mostrarErro && validacao.motivo === "DATA_FUTURA" ? (
          <Text style={styles.erro} accessibilityRole="alert">{MENSAGEM_DATA_FUTURA}</Text>
        ) : null}

        {itens.length === 0 ? (
          <Text style={styles.vazio}>Nenhum medicamento adicionado à receita.</Text>
        ) : null}

        {itens.map((item) => {
          const nome = `${item.medicamento.principioAtivo}${item.medicamento.apresentacao ? ` - ${item.medicamento.apresentacao}` : ""}`;
          return (
            <View key={`${item.medicamento.id}:${item.lote.id}`} style={styles.cartao}>
              <View style={styles.cartaoTopo}>
                <View style={styles.cartaoTexto}>
                  <Text style={styles.nome}>{nome}</Text>
                  {item.medicamento.nomeComercial ? (
                    <Text style={styles.detalhe}>Referência: {item.medicamento.nomeComercial}</Text>
                  ) : null}
                  {item.medicamento.antimicrobiano ? <Text style={styles.seloAzul}>Antimicrobiano</Text> : null}
                  <Text style={styles.detalhe}>
                    Lote: {item.lote.numeroLote} | Validade: {formatarDataIsoParaBr(item.lote.dataValidade)} | Saldo: {item.lote.saldoDisponivel} un.
                  </Text>
                  {item.lote.alertaValidadeCurta ? (
                    <Text style={styles.seloAmber}>⚠️ Vence em {item.lote.diasParaVencimento} dias</Text>
                  ) : null}
                </View>
                <Pressable onPress={() => pedirRemocao(item)} accessibilityRole="button" accessibilityLabel={`Remover ${nome}`} style={styles.remover}>
                  <Text style={styles.removerTexto}>Remover</Text>
                </Pressable>
              </View>
              <Text style={styles.legenda}>Quantidade</Text>
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => onMudarItens(alterarQuantidade(itens, item.medicamento.id, item.lote.id, item.quantidade - 1))}
                  accessibilityRole="button"
                  accessibilityLabel={`Diminuir quantidade de ${nome}`}
                  style={styles.passo}
                >
                  <Text style={styles.passoTexto}>-</Text>
                </Pressable>
                <Text style={styles.quantidade}>{item.quantidade}</Text>
                <Pressable
                  onPress={() => onMudarItens(alterarQuantidade(itens, item.medicamento.id, item.lote.id, item.quantidade + 1))}
                  accessibilityRole="button"
                  accessibilityLabel={`Aumentar quantidade de ${nome}`}
                  style={styles.passo}
                >
                  <Text style={styles.passoTexto}>+</Text>
                </Pressable>
              </View>
              <Text style={styles.legenda}>Posologia</Text>
              <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.posologiaCaixa}>
                <TextInput
                  value={item.posologia}
                  onChangeText={(texto) => onMudarItens(alterarPosologia(itens, item.medicamento.id, item.lote.id, texto))}
                  placeholder="Ex.: 1 cp a cada 8h por 5 dias"
                  multiline
                  style={styles.posologia}
                />
              </ScrollView>
            </View>
          );
        })}

      </ScrollView>

      {calendarioAberto ? (
        <DateTimePicker
          value={dataReceita ? new Date(`${dataReceita}T12:00:00`) : new Date()}
          mode="date"
          onChange={aoEscolherData}
        />
      ) : null}

      <View style={styles.rodape}>
        <Text style={styles.total}>{totais.totalItens} {totais.totalItens === 1 ? "item" : "itens"}</Text>
        <Text style={styles.total}>{totais.totalUnidades} unidades</Text>
        <Pressable
          onPress={onRevisar}
          disabled={!pode}
          accessibilityRole="button"
          accessibilityState={{ disabled: !pode }}
          style={[styles.botao, !pode && styles.botaoDesabilitado]}
        >
          <Text style={styles.botaoTexto}>Revisar Atendimento</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#F8FAFC" },
  conteudo: { padding: theme.spacing.md, paddingBottom: 196, gap: theme.spacing.sm },
  voltar: { minHeight: 44, justifyContent: "center" },
  voltarTexto: { color: "#1D4ED8", fontWeight: "700" },
  titulo: { fontSize: 16, fontWeight: "600", color: "#0F172A" },
  subtitulo: { fontSize: 12, color: "#64748B", marginBottom: theme.spacing.sm },
  vazio: { fontSize: 13, color: "#64748B" },
  cartao: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  cartaoTopo: { flexDirection: "row", gap: theme.spacing.sm },
  cartaoTexto: { flex: 1, gap: 4 },
  nome: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  detalhe: { fontSize: 12, color: "#334155" },
  seloAzul: {
    alignSelf: "flex-start",
    backgroundColor: "#DBEAFE",
    color: "#1E3A8A",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 11,
    fontWeight: "700",
  },
  seloAmber: {
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
  remover: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  removerTexto: { color: "#B91C1C", fontWeight: "700", fontSize: 12 },
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
  quantidade: { minWidth: 36, textAlign: "center", fontSize: 16, fontWeight: "700", color: "#0F172A" },
  posologiaCaixa: {
    height: 96,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
  },
  posologia: {
    minHeight: 96,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: "#0F172A",
    textAlignVertical: "top",
  },
  avisoAzul: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 12,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  avisoAzulTexto: { color: "#1E3A8A", fontSize: 13, fontWeight: "600" },
  obrigatorio: { color: "#DC2626" },
  data: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  dataTexto: { fontSize: 14, color: "#0F172A", fontWeight: "600" },
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
    // shortcut: barra de 3 botões do Android cobre o rodapé; o SafeAreaView do RN não aplica esse inset
    paddingBottom: Platform.OS === "android" ? 56 : theme.spacing.md,
    gap: theme.spacing.sm,
  },
  total: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  botao: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: "#1D4ED8",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  botaoDesabilitado: { opacity: 0.5 },
  botaoTexto: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
});
