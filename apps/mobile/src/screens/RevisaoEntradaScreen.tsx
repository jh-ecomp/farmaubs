import React, { useEffect, useRef, useState, type ComponentRef } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from "react-native";
import { formatarDataIsoParaBr, type CabecalhoRecebimentoDto, type ItemRecebimentoFormDto } from "@farmaubs/shared";
import { catalogoRecebimentoService } from "../services/catalogo-recebimento.service";
import { SessaoExpirada, TempoEsgotado } from "../services/api";
import { MENSAGEM_ACAO_OFFLINE } from "../services/conectividade";
import { MENSAGEM_REDE } from "./login-form";
import { theme } from "../theme/tokens";
import {
  MENSAGEM_VALIDADE_CURTA_CONFIRMACAO,
  type ReciboEntrada,
  alterarQuantidade,
  montarEntrada,
  temValidadeCurta,
  totaisDaCarga,
} from "./revisao-entrada";
import { alturaCobertaPeloTeclado } from "./teclado";

type RevisaoProps = {
  apiBaseUrl: string;
  cabecalho: CabecalhoRecebimentoDto;
  itens: ItemRecebimentoFormDto[];
  semConexao?: boolean;
  onMudarItens: (itens: ItemRecebimentoFormDto[]) => void;
  onVoltar: () => void;
  onConcluido: (recibo: ReciboEntrada) => void;
};

type ComprovanteProps = {
  recibo: ReciboEntrada;
  onNovo: () => void;
  onPainel: () => void;
};

/**
 * [RE-MOB-03]: Revisão da carga e POST único em /api/v1/recebimento/entradas.
 */
export function RevisaoEntradaScreen({
  apiBaseUrl,
  cabecalho,
  itens,
  semConexao = false,
  onMudarItens,
  onVoltar,
  onConcluido,
}: RevisaoProps) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [alerta, setAlerta] = useState(false);
  const [teclado, setTeclado] = useState(0);
  const [qtdTexto, setQtdTexto] = useState<Record<string, string>>({});
  const trava = useRef(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const posicoes = useRef<Record<string, number>>({});
  const totais = totaisDaCarga(itens);

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

  function aplicarQuantidade(item: ItemRecebimentoFormDto) {
    const texto = qtdTexto[item.idProvisorio];
    if (texto === undefined) return;
    const qtd = Number(texto);
    if (!texto || !Number.isInteger(qtd) || qtd < 1) {
      setQtdTexto((atual) => {
        const copia = { ...atual };
        delete copia[item.idProvisorio];
        return copia;
      });
      return;
    }
    onMudarItens(alterarQuantidade(itens, item.idProvisorio, qtd));
  }

  function cargaDigitada(): ItemRecebimentoFormDto[] | null {
    let mudou = false;
    const carga = itens.map((item) => {
      const texto = qtdTexto[item.idProvisorio];
      if (texto === undefined) return item;
      const qtd = Number(texto);
      if (!texto || !Number.isInteger(qtd) || qtd < 1) return null;
      if (qtd === item.quantidadeRecebida) return item;
      mudou = true;
      return { ...item, quantidadeRecebida: qtd };
    });
    if (carga.some((item) => item === null)) return null;
    const pronta = carga as ItemRecebimentoFormDto[];
    if (mudou) onMudarItens(pronta);
    return pronta;
  }

  async function enviar() {
    const carga = cargaDigitada();
    if (trava.current || !carga || carga.length === 0) {
      if (!carga) setErro("Informe uma quantidade inteira maior que zero.");
      return;
    }
    if (semConexao) {
      setAlerta(false);
      setErro(MENSAGEM_ACAO_OFFLINE);
      return;
    }
    trava.current = true;
    setEnviando(true);
    setErro(null);
    try {
      const recibo = await catalogoRecebimentoService.efetivarEntrada(
        apiBaseUrl,
        montarEntrada(cabecalho, carga),
      );
      Vibration.vibrate(40);
      setAlerta(false);
      onConcluido(recibo);
    } catch (falha) {
      setAlerta(false);
      if (falha instanceof SessaoExpirada) return;
      setErro(falha instanceof TempoEsgotado ? MENSAGEM_REDE : falha instanceof Error ? falha.message : MENSAGEM_REDE);
    } finally {
      trava.current = false;
      setEnviando(false);
    }
  }

  function pedirConfirmacao() {
    Keyboard.dismiss();
    const carga = cargaDigitada();
    if (enviando || !carga || carga.length === 0) {
      if (!carga) setErro("Informe uma quantidade inteira maior que zero.");
      return;
    }
    if (temValidadeCurta(carga)) {
      setAlerta(true);
      return;
    }
    void enviar();
  }

  return (
    <View style={[styles.flex, { paddingBottom: teclado }]}>
      <View style={styles.cabecalho}>
        <Text style={styles.miudo}>Guia</Text>
        <Text style={styles.titulo}>{cabecalho.numeroDocumento}</Text>
        <Text style={styles.miudo}>{cabecalho.fornecedorOrigem}</Text>
        <Pressable onPress={onVoltar} accessibilityRole="button" style={styles.voltar}>
          <Text style={styles.link}>Voltar à conferência</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scroll}
        style={styles.flex}
        contentContainerStyle={styles.lista}
        keyboardShouldPersistTaps="handled"
      >
        {itens.length === 0 ? (
          <Text style={styles.miudo}>Nenhum medicamento na remessa. Volte e confira ao menos um lote.</Text>
        ) : (
          itens.map((item) => (
            <View
              key={item.idProvisorio}
              style={styles.item}
              onLayout={(evento) => {
                posicoes.current[item.idProvisorio] = evento.nativeEvent.layout.y;
              }}
            >
              <Text style={styles.itemNome}>
                {item.produtoNome} {item.concentracao}
              </Text>
              <Text style={styles.miudo}>
                {item.fabricanteNome} · Lote {item.numeroLote}
              </Text>
              <Text style={styles.miudo}>Validade {formatarDataIsoParaBr(item.dataValidade)}</Text>
              {item.validadeCurta ? <Text style={styles.curta}>Validade curta</Text> : null}
              <Text style={styles.miudo}>Quantidade</Text>
              <TextInput
                value={qtdTexto[item.idProvisorio] ?? String(item.quantidadeRecebida)}
                onChangeText={(texto) => setQtdTexto((atual) => ({ ...atual, [item.idProvisorio]: texto.replace(/\D/g, "") }))}
                onFocus={() => {
                  setTimeout(() => {
                    scroll.current?.scrollTo({ y: Math.max(0, (posicoes.current[item.idProvisorio] ?? 0) - 36), animated: true });
                  }, 150);
                }}
                onBlur={() => aplicarQuantidade(item)}
                keyboardType="number-pad"
                maxLength={6}
                style={styles.campo}
              />
              <Pressable
                onPress={() => onMudarItens(itens.filter((atual) => atual.idProvisorio !== item.idProvisorio))}
                accessibilityRole="button"
                style={styles.voltar}
              >
                <Text style={styles.remover}>Remover</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>

      <View style={[styles.rodape, teclado > 0 && styles.rodapeComTeclado]}>
        <Text style={styles.totais}>
          {totais.medicamentos} medicamentos distintos · {totais.unidades} unidades
        </Text>
        {erro ? <Text style={styles.erro}>{erro}</Text> : null}
        <Pressable
          onPress={pedirConfirmacao}
          disabled={enviando || itens.length === 0}
          accessibilityRole="button"
          style={[styles.botao, (enviando || itens.length === 0) && styles.botaoOff]}
        >
          {enviando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.botaoTexto}>Confirmar Entrada no Estoque</Text>}
        </Pressable>
      </View>

      <Modal visible={alerta} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => {
          if (!enviando) setAlerta(false);
        }}>
        <View style={styles.modal}>
          <View style={styles.folha}>
            <Text style={styles.titulo}>Validade curta</Text>
            <Text style={styles.aviso}>{MENSAGEM_VALIDADE_CURTA_CONFIRMACAO}</Text>
            <Pressable onPress={() => void enviar()} disabled={enviando} accessibilityRole="button" style={styles.botao}>
              {enviando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.botaoTexto}>Confirmar recebimento</Text>}
            </Pressable>
            <Pressable onPress={() => setAlerta(false)} disabled={enviando} accessibilityRole="button" style={styles.voltar}>
              <Text style={styles.link}>Voltar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** [RE-MOB-03]: Comprovante com o número gravado pela API. A conferência local já foi limpa. */
export function ComprovanteEntradaScreen({ recibo, onNovo, onPainel }: ComprovanteProps) {
  return (
    <View style={styles.flex}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.lista}>
        <View style={styles.item}>
          <Text style={styles.titulo}>Entrada registrada</Text>
          <Text style={styles.miudo}>Guia</Text>
          <Text style={styles.protocolo}>{recibo.numeroDocumento}</Text>
          {recibo.fornecedorOrigem ? <Text style={styles.miudo}>{recibo.fornecedorOrigem}</Text> : null}
          <Text style={styles.miudo}>Registro {recibo.id}</Text>
          {recibo.avisos.map((aviso) => (
            <Text key={aviso} style={styles.curta}>
              {aviso}
            </Text>
          ))}
        </View>
      </ScrollView>
      <View style={styles.rodape}>
        <Pressable onPress={onNovo} accessibilityRole="button" style={styles.botao}>
          <Text style={styles.botaoTexto}>Novo recebimento</Text>
        </Pressable>
        <Pressable onPress={onPainel} accessibilityRole="button" style={styles.voltar}>
          <Text style={styles.link}>Voltar ao painel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  cabecalho: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    gap: 2,
  },
  lista: { padding: theme.spacing.md, gap: theme.spacing.sm },
  item: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: theme.spacing.md,
    gap: 4,
  },
  titulo: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  itemNome: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  protocolo: { fontSize: 20, fontWeight: "700", color: "#1D4ED8" },
  miudo: { fontSize: 12, color: "#475569" },
  curta: {
    backgroundColor: "#FEF3C7",
    color: "#92400E",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "700",
  },
  campo: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    color: "#0F172A",
    fontSize: 16,
  },
  remover: { color: "#991B1B", fontWeight: "700" },
  erro: { color: "#991B1B", fontWeight: "700", fontSize: 12 },
  totais: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  aviso: { fontSize: 14, color: "#0F172A", lineHeight: 20 },
  rodape: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: Platform.OS === "android" ? 56 : theme.spacing.md,
    gap: theme.spacing.sm,
  },
  rodapeComTeclado: { paddingBottom: theme.spacing.sm },
  botao: { minHeight: 44, borderRadius: 8, backgroundColor: "#1D4ED8", alignItems: "center", justifyContent: "center" },
  botaoOff: { opacity: 0.5 },
  botaoTexto: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  voltar: { minHeight: 44, justifyContent: "center" },
  link: { color: "#1D4ED8", fontWeight: "700" },
  modal: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.4)" },
  folha: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: theme.spacing.md,
    paddingBottom: Platform.OS === "android" ? 48 : theme.spacing.lg,
    gap: theme.spacing.sm,
  },
});
