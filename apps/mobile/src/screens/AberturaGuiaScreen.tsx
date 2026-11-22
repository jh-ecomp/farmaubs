import React, { useEffect, useRef, useState, type ComponentRef } from "react";
import {
  Dimensions,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import type { CabecalhoRecebimentoDto, TipoDocumentoRecebimento } from "@farmaubs/shared";
import { theme } from "../theme/tokens";
import { formatarDataHoraAtendimento } from "./fechamento";
import { FornecedorPickerSheet } from "./FornecedorPickerSheet";
import {
  TIPOS_GUIA,
  aplicarDia,
  aplicarHora,
  erroNumeroDocumento,
  erroObservacao,
  fornecedorPadrao,
  montarCabecalho,
  podeProsseguirGuia,
} from "./abertura-guia";
import { alturaCobertaPeloTeclado } from "./teclado";

type AberturaGuiaScreenProps = {
  inicial: CabecalhoRecebimentoDto | null;
  onVoltar: () => void;
  onProsseguir: (cabecalho: CabecalhoRecebimentoDto) => void;
};

/**
 * [RE-MOB-01]: Cabeçalho da guia. A conferência dos itens entra na próxima história.
 */
export function AberturaGuiaScreen({ inicial, onVoltar, onProsseguir }: AberturaGuiaScreenProps) {
  const [numero, setNumero] = useState(inicial?.numeroDocumento ?? "");
  const [tipo, setTipo] = useState<TipoDocumentoRecebimento>(inicial?.tipoDocumento ?? "GUIA_CAF");
  const [fornecedor, setFornecedor] = useState(inicial?.fornecedorOrigem ?? fornecedorPadrao());
  const [quando, setQuando] = useState(() => {
    const lida = inicial?.dataRecebimento ? new Date(inicial.dataRecebimento) : new Date();
    return Number.isNaN(lida.getTime()) ? new Date() : lida;
  });
  const [observacoes, setObservacoes] = useState(inicial?.observacoes ?? "");
  const [tocouNumero, setTocouNumero] = useState(false);
  const [mostrouErro, setMostrouErro] = useState(false);
  const [fornecedorAberto, setFornecedorAberto] = useState(false);
  const [passoRelogio, setPassoRelogio] = useState<null | "data" | "hora">(null);
  const [teclado, setTeclado] = useState(0);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const posicoes = useRef<Record<string, number>>({});
  const campo = useRef("numero");

  useEffect(() => {
    const mostrar = Keyboard.addListener("keyboardDidShow", (evento) => {
      setTeclado(alturaCobertaPeloTeclado(Dimensions.get("window").height, Dimensions.get("screen").height, evento.endCoordinates));
      setTimeout(() => {
        const y = posicoes.current[campo.current] ?? 0;
        scroll.current?.scrollTo({ y: Math.max(0, y - 36), animated: true });
      }, 150);
    });
    const esconder = Keyboard.addListener("keyboardDidHide", () => setTeclado(0));
    return () => {
      mostrar.remove();
      esconder.remove();
    };
  }, []);

  const pode = podeProsseguirGuia(numero, tipo, fornecedor, quando, observacoes);
  const erroNumero = erroNumeroDocumento(numero);
  const mostrarErroNumero = (tocouNumero || mostrouErro) && erroNumero !== null;
  const erroNota = erroObservacao(observacoes);

  function escolherRelogio(evento: DateTimePickerEvent, data?: Date) {
    if (evento.type === "dismissed" || !data) {
      setPassoRelogio(null);
      return;
    }
    if (Platform.OS === "ios") {
      setQuando(data);
      return;
    }
    if (passoRelogio === "data") {
      setQuando((atual) => aplicarDia(atual, data));
      setPassoRelogio(null);
      setTimeout(() => setPassoRelogio("hora"), 0);
      return;
    }
    setQuando((atual) => aplicarHora(atual, data));
    setPassoRelogio(null);
  }

  function prosseguir() {
    if (!pode) {
      setMostrouErro(true);
      return;
    }
    onProsseguir(montarCabecalho(numero, tipo, fornecedor, quando, observacoes));
  }

  return (
    <View style={styles.flex}>
      <View style={styles.topo}>
        <Pressable onPress={onVoltar} accessibilityRole="button" style={styles.voltar}>
          <Text style={styles.voltarTexto}>Voltar ao painel</Text>
        </Pressable>
        <Text style={styles.titulo}>Dados da Guia ou Nota Fiscal</Text>
        <Text style={styles.subtitulo}>Identifique o documento antes de conferir os medicamentos.</Text>
      </View>

      <View style={[styles.flex, { paddingBottom: teclado }]}>
          <ScrollView ref={scroll} style={styles.flex} contentContainerStyle={styles.formulario} keyboardShouldPersistTaps="handled">
            <Text style={[styles.status, pode ? styles.statusOk : styles.statusPendente]}>
              {pode
                ? "Cabeçalho preenchido — pronto para incluir itens"
                : "Preencha o número do documento para liberar o recebimento"}
            </Text>

            <Text style={styles.legenda}>Número do Documento <Text style={styles.obrigatorio}>*</Text></Text>
            <TextInput
              value={numero}
              onChangeText={setNumero}
              onBlur={() => setTocouNumero(true)}
              onFocus={() => {
                campo.current = "numero";
              }}
              onLayout={(evento) => {
                posicoes.current.numero = evento.nativeEvent.layout.y;
              }}
              autoFocus
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={100}
              placeholder="Ex.: GUIA-2026/099"
              accessibilityLabel="Número do Documento"
              style={[styles.campo, mostrarErroNumero && styles.campoErro]}
            />
            {mostrarErroNumero ? <Text style={styles.erro} accessibilityRole="alert">{erroNumero}</Text> : null}

            <Text style={styles.legenda}>Tipo de Documento <Text style={styles.obrigatorio}>*</Text></Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {TIPOS_GUIA.map((opcao) => {
                const ativo = opcao.valor === tipo;
                return (
                  <Pressable
                    key={opcao.valor}
                    onPress={() => setTipo(opcao.valor)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: ativo }}
                    style={[styles.chip, ativo && styles.chipAtivo]}
                  >
                    <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>{opcao.rotulo}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={styles.legenda}>Fornecedor / Origem <Text style={styles.obrigatorio}>*</Text></Text>
            <Pressable onPress={() => setFornecedorAberto(true)} accessibilityRole="button" style={styles.campo}>
              <Text style={styles.campoTexto}>{fornecedor}</Text>
            </Pressable>

            <Text style={styles.legenda}>Data/Hora do Recebimento</Text>
            <Pressable onPress={() => setPassoRelogio("data")} accessibilityRole="button" style={styles.campo}>
              <Text style={styles.campoTexto}>{formatarDataHoraAtendimento(quando)}</Text>
            </Pressable>

            <Text style={styles.legenda}>Observações de Recepção</Text>
            <TextInput
              value={observacoes}
              onChangeText={setObservacoes}
              onFocus={() => {
                campo.current = "observacoes";
              }}
              onLayout={(evento) => {
                posicoes.current.observacoes = evento.nativeEvent.layout.y;
              }}
              maxLength={1000}
              placeholder="Avarias aparentes na carga"
              style={styles.campo}
            />
            {erroNota ? <Text style={styles.erro} accessibilityRole="alert">{erroNota}</Text> : null}
          </ScrollView>

          <View style={[styles.rodape, teclado > 0 && styles.rodapeComTeclado]}>
            <Pressable
              onPress={prosseguir}
              accessibilityRole="button"
              accessibilityState={{ disabled: !pode }}
              style={[styles.botao, !pode && styles.botaoDesabilitado]}
            >
              <Text style={styles.botaoTexto}>Prosseguir para Conferência de Medicamentos</Text>
            </Pressable>
          </View>
        </View>

      <FornecedorPickerSheet
        aberto={fornecedorAberto}
        selecionado={fornecedor}
        onFechar={() => setFornecedorAberto(false)}
        onEscolher={(nome) => {
          setFornecedor(nome);
          setFornecedorAberto(false);
        }}
      />

      {passoRelogio === "data" ? (
        <DateTimePicker
          value={quando}
          mode={Platform.OS === "ios" ? "datetime" : "date"}
          onChange={escolherRelogio}
        />
      ) : null}
      {passoRelogio === "hora" ? (
        <DateTimePicker value={quando} mode="time" onChange={escolherRelogio} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#F8FAFC" },
  topo: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.md, gap: 4 },
  voltar: { minHeight: 44, justifyContent: "center" },
  voltarTexto: { color: "#1D4ED8", fontWeight: "700" },
  titulo: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  subtitulo: { fontSize: 12, color: "#64748B", marginBottom: theme.spacing.sm },
  formulario: { padding: theme.spacing.md, paddingBottom: 24, gap: theme.spacing.sm },
  status: { borderRadius: 999, overflow: "hidden", paddingHorizontal: 12, paddingVertical: 6, fontSize: 12, fontWeight: "700" },
  statusOk: { backgroundColor: "#D1FAE5", color: "#065F46" },
  statusPendente: { backgroundColor: "#FEF3C7", color: "#92400E" },
  legenda: { fontSize: 12, fontWeight: "700", color: "#334155", marginTop: 4 },
  obrigatorio: { color: "#DC2626" },
  campo: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    justifyContent: "center",
    color: "#0F172A",
    fontSize: 14,
  },
  campoTexto: { fontSize: 14, color: "#0F172A", fontWeight: "600" },
  campoErro: { borderColor: "#DC2626", backgroundColor: "#FEF2F2" },
  erro: { color: "#991B1B", fontWeight: "700", fontSize: 12 },
  chips: { gap: theme.spacing.sm, paddingVertical: 4 },
  chip: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderRadius: 8, backgroundColor: "#F1F5F9" },
  chipAtivo: { backgroundColor: "#1D4ED8" },
  chipTexto: { color: "#334155", fontWeight: "700", fontSize: 13 },
  chipTextoAtivo: { color: "#FFFFFF" },
  rodape: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: Platform.OS === "android" ? 56 : theme.spacing.md,
  },
  rodapeComTeclado: { paddingBottom: theme.spacing.sm },
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
});
