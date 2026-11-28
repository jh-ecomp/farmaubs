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
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import {
  formatarDataIsoParaBr,
  type CabecalhoRecebimentoDto,
  type FabricanteResponseDto,
  type ItemRecebimentoFormDto,
  type ProdutoCatalogoResponseDto,
} from "@farmaubs/shared";
import { theme } from "../theme/tokens";
import { SessaoExpirada, TempoEsgotado } from "../services/api";
import { catalogoRecebimentoService } from "../services/catalogo-recebimento.service";
import { MENSAGEM_ACAO_OFFLINE } from "../services/conectividade";
import { isoDaDataLocal } from "./carrinho";
import { MENSAGEM_REDE } from "./login-form";
import {
  DEBOUNCE_CATALOGO_MS,
  MENSAGEM_VALIDADE_EXPIRADA,
  avaliarValidade,
  erroDoItem,
  mensagemValidadeCurta,
  montarItemConferencia,
  nomeDoProduto,
  somarPasso,
} from "./conferencia-item";
import { alturaCobertaPeloTeclado } from "./teclado";

type ConferenciaItensScreenProps = {
  apiBaseUrl: string;
  cabecalho: CabecalhoRecebimentoDto;
  itens: ItemRecebimentoFormDto[];
  semConexao?: boolean;
  onMudarItens: (itens: ItemRecebimentoFormDto[]) => void;
  onAlterarGuia: () => void;
  onRevisar: () => void;
  onVoltar: () => void;
};

/**
 * [RE-MOB-02]: Conferência do lote em cima da guia já aberta. Ainda não grava no estoque.
 */
export function ConferenciaItensScreen({
  apiBaseUrl,
  cabecalho,
  itens,
  semConexao = false,
  onMudarItens,
  onAlterarGuia,
  onRevisar,
  onVoltar,
}: ConferenciaItensScreenProps) {
  const [termo, setTermo] = useState("");
  const [produtos, setProdutos] = useState<ProdutoCatalogoResponseDto[]>([]);
  const [produto, setProduto] = useState<ProdutoCatalogoResponseDto | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [fabricantes, setFabricantes] = useState<FabricanteResponseDto[]>([]);
  const [fabricanteId, setFabricanteId] = useState("");
  const [listaFabAberta, setListaFabAberta] = useState(false);
  const [novoAberto, setNovoAberto] = useState(false);
  const [lote, setLote] = useState("");
  const [validade, setValidade] = useState("");
  const [calendario, setCalendario] = useState(false);
  const [quantidade, setQuantidade] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [teclado, setTeclado] = useState(0);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const posicoes = useRef<Record<string, number>>({});
  const campo = useRef("busca");
  const ordem = useRef(0);

  const fabricante = fabricantes.find((item) => item.id === fabricanteId) ?? null;
  const avaliacao = avaliarValidade(validade);
  const vencido = avaliacao?.status === "VENCIDO";
  const curta = avaliacao?.status === "VALIDADE_CURTA";

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

  useEffect(() => {
    if (semConexao) return;
    let vivo = true;
    catalogoRecebimentoService.listarFabricantes(apiBaseUrl).then((lista) => {
      if (vivo) setFabricantes(lista);
    }).catch((falha) => {
      if (!vivo || falha instanceof SessaoExpirada) return;
      setErro(falha instanceof TempoEsgotado ? MENSAGEM_REDE : falha instanceof Error ? falha.message : MENSAGEM_REDE);
    });
    return () => {
      vivo = false;
    };
  }, [apiBaseUrl, semConexao]);

  useEffect(() => {
    if (produto || termo.trim().length < 2) {
      setProdutos([]);
      setBuscando(false);
      return;
    }
    if (semConexao) {
      setErro(MENSAGEM_ACAO_OFFLINE);
      return;
    }
    const ticket = ++ordem.current;
    const timer = setTimeout(() => {
      setBuscando(true);
      catalogoRecebimentoService.buscarProdutos(apiBaseUrl, termo).then((lista) => {
        if (ticket !== ordem.current) return;
        setProdutos(lista);
        setErro(null);
      }).catch((falha) => {
        if (ticket !== ordem.current || falha instanceof SessaoExpirada) return;
        setProdutos([]);
        setErro(falha instanceof TempoEsgotado ? MENSAGEM_REDE : falha instanceof Error ? falha.message : MENSAGEM_REDE);
      }).finally(() => {
        if (ticket === ordem.current) setBuscando(false);
      });
    }, DEBOUNCE_CATALOGO_MS);
    return () => clearTimeout(timer);
  }, [termo, produto, apiBaseUrl, semConexao]);

  function escolherData(evento: DateTimePickerEvent, data?: Date) {
    setCalendario(false);
    if (evento.type !== "set" || !data) return;
    setValidade(isoDaDataLocal(data));
    setErro(null);
  }

  function adicionar() {
    const falha = erroDoItem(produto, fabricanteId, lote, validade, quantidade);
    if (falha || !produto || !fabricante) {
      setErro(falha ?? "Selecione o fabricante do lote recebido.");
      return;
    }
    onMudarItens([...itens, montarItemConferencia(produto, fabricante, lote, validade, Number(quantidade))]);
    Vibration.vibrate(40);
    setProduto(null);
    setTermo("");
    setProdutos([]);
    setFabricanteId("");
    setLote("");
    setValidade("");
    setQuantidade("");
    setErro(null);
  }

  function incluirFabricante(criado: FabricanteResponseDto) {
    setFabricantes((atuais) => [...atuais, criado].sort((a, b) => a.nomeFantasia.localeCompare(b.nomeFantasia)));
    setFabricanteId(criado.id);
    setNovoAberto(false);
  }

  return (
    <View style={styles.flex}>
      <View style={styles.topo}>
        <Pressable onPress={onVoltar} accessibilityRole="button" style={styles.voltar}>
          <Text style={styles.voltarTexto}>Voltar ao painel</Text>
        </Pressable>
        <View style={styles.cartao}>
          <Text style={styles.cartaoNumero}>{cabecalho.numeroDocumento}</Text>
          <Text style={styles.miudo}>{cabecalho.fornecedorOrigem}</Text>
          <Pressable onPress={onAlterarGuia} accessibilityRole="button" style={styles.voltar}>
            <Text style={styles.voltarTexto}>Alterar dados da guia</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.flex, { paddingBottom: teclado }]}>
        <ScrollView ref={scroll} style={styles.flex} contentContainerStyle={styles.formulario} keyboardShouldPersistTaps="handled">
          <Text style={styles.titulo}>Incluir Medicamento e Lote na Guia</Text>
          {erro ? <Text style={styles.erro} accessibilityRole="alert">{erro}</Text> : null}

          <Text style={styles.legenda}>Medicamento <Text style={styles.obrigatorio}>*</Text></Text>
          <TextInput
            value={termo}
            onChangeText={(texto) => {
              setTermo(texto);
              setProduto(null);
            }}
            onFocus={() => {
              campo.current = "busca";
            }}
            onLayout={(evento) => {
              posicoes.current.busca = evento.nativeEvent.layout.y;
            }}
            placeholder="Digite o nome genérico (ex.: Dipirona)"
            style={styles.campo}
          />
          {buscando ? <ActivityIndicator color="#1D4ED8" /> : null}
          {termo.trim().length >= 2 && !produto ? (
            <ScrollView nestedScrollEnabled style={styles.sugestoes} keyboardShouldPersistTaps="handled">
              {produtos.length === 0 && !buscando ? (
                <Text style={styles.miudo}>Nenhum medicamento encontrado no catálogo para “{termo.trim()}”.</Text>
              ) : (
                produtos.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      setProduto(item);
                      setTermo(nomeDoProduto(item));
                      setProdutos([]);
                      setErro(null);
                    }}
                    accessibilityRole="button"
                    style={styles.sugestao}
                  >
                    <Text style={styles.sugestaoTexto}>{nomeDoProduto(item)}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          ) : null}

          <View style={styles.linhaTitulo}>
            <Text style={styles.legenda}>Fabricante / Laboratório <Text style={styles.obrigatorio}>*</Text></Text>
            <Pressable onPress={() => setNovoAberto(true)} accessibilityRole="button" style={styles.novo}>
              <Text style={styles.voltarTexto}>+ Novo</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => setListaFabAberta(true)} accessibilityRole="button" style={styles.campo}>
            <Text style={styles.campoTexto}>{fabricante ? fabricante.nomeFantasia || fabricante.razaoSocial : "Selecione o laboratório..."}</Text>
          </Pressable>

          <Text style={styles.legenda}>Código do Lote <Text style={styles.obrigatorio}>*</Text></Text>
          <TextInput
            value={lote}
            onChangeText={setLote}
            onFocus={() => {
              campo.current = "lote";
            }}
            onLayout={(evento) => {
              posicoes.current.lote = evento.nativeEvent.layout.y;
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={60}
            placeholder="Ex.: LOTE-998"
            style={styles.campo}
          />

          <Text style={styles.legenda}>Data de Validade <Text style={styles.obrigatorio}>*</Text></Text>
          <Pressable onPress={() => setCalendario(true)} accessibilityRole="button" style={[styles.campo, vencido && styles.campoErro]}>
            <Text style={styles.campoTexto}>{validade ? formatarDataIsoParaBr(validade) : "DD/MM/AAAA"}</Text>
          </Pressable>
          {vencido ? <Text style={styles.erro} accessibilityRole="alert">{MENSAGEM_VALIDADE_EXPIRADA}</Text> : null}
          {curta && avaliacao ? <Text style={styles.curta}>{mensagemValidadeCurta(avaliacao.diasRestantes)}</Text> : null}

          <Text style={styles.legenda}>Quantidade Recebida <Text style={styles.obrigatorio}>*</Text></Text>
          <TextInput
            value={quantidade}
            onChangeText={(texto) => setQuantidade(texto.replace(/\D/g, ""))}
            onFocus={() => {
              campo.current = "quantidade";
            }}
            onLayout={(evento) => {
              posicoes.current.quantidade = evento.nativeEvent.layout.y;
            }}
            keyboardType="number-pad"
            placeholder="Ex.: 200"
            style={styles.campo}
          />
          <View style={styles.passos}>
            {[10, 50, 100].map((passo) => (
              <Pressable key={passo} onPress={() => setQuantidade(somarPasso(quantidade, passo))} accessibilityRole="button" style={styles.passo}>
                <Text style={styles.passoTexto}>+{passo}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.titulo}>Itens da guia ({itens.length})</Text>
          {itens.length === 0 ? <Text style={styles.miudo}>Nenhum medicamento conferido ainda.</Text> : null}
          {itens.map((item) => (
            <View key={item.idProvisorio} style={styles.item}>
              <Text style={styles.itemNome}>{item.produtoNome}</Text>
              <Text style={styles.miudo}>{item.fabricanteNome} · {item.numeroLote}</Text>
              <Text style={styles.miudo}>{formatarDataIsoParaBr(item.dataValidade)} · {item.quantidadeRecebida} un.</Text>
              {item.validadeCurta ? <Text style={styles.curta}>Validade curta</Text> : null}
              <Pressable
                onPress={() => onMudarItens(itens.filter((atual) => atual.idProvisorio !== item.idProvisorio))}
                accessibilityRole="button"
                style={styles.voltar}
              >
                <Text style={styles.remover}>Remover</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>

        <View style={[styles.rodape, teclado > 0 && styles.rodapeComTeclado]}>
          {itens.length > 0 ? (
            <Pressable onPress={onRevisar} accessibilityRole="button" style={styles.botaoSecundario}>
              <Text style={styles.botaoSecundarioTexto}>Revisar entrada</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={adicionar} accessibilityRole="button" style={styles.botao}>
            <Text style={styles.botaoTexto}>Adicionar à Remessa</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={listaFabAberta} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={() => setListaFabAberta(false)}>
        <View style={styles.modal}>
          <Pressable style={styles.fundo} onPress={() => setListaFabAberta(false)} accessibilityLabel="Fechar laboratórios" />
          <View style={styles.folha}>
            <Text style={styles.titulo}>Fabricante / Laboratório</Text>
            <ScrollView style={styles.listaFab}>
              {fabricantes.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setFabricanteId(item.id);
                    setListaFabAberta(false);
                    setErro(null);
                  }}
                  accessibilityRole="button"
                  style={[styles.sugestao, item.id === fabricanteId && styles.sugestaoAtiva]}
                >
                  <Text style={styles.sugestaoTexto}>{item.nomeFantasia || item.razaoSocial}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <NovoFabricante
        aberto={novoAberto}
        apiBaseUrl={apiBaseUrl}
        semConexao={semConexao}
        onFechar={() => setNovoAberto(false)}
        onCriado={incluirFabricante}
      />

      {calendario ? (
        <DateTimePicker value={validade ? new Date(`${validade}T12:00:00`) : new Date()} mode="date" onChange={escolherData} />
      ) : null}
    </View>
  );
}

function NovoFabricante({
  aberto,
  apiBaseUrl,
  semConexao,
  onFechar,
  onCriado,
}: {
  aberto: boolean;
  apiBaseUrl: string;
  semConexao: boolean;
  onFechar: () => void;
  onCriado: (fabricante: FabricanteResponseDto) => void;
}) {
  const [razao, setRazao] = useState("");
  const [fantasia, setFantasia] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [teclado, setTeclado] = useState(0);

  useEffect(() => {
    const mostrar = Keyboard.addListener("keyboardDidShow", (evento) => {
      setTeclado(alturaCobertaPeloTeclado(Dimensions.get("window").height, Dimensions.get("screen").height, evento.endCoordinates));
    });
    const esconder = Keyboard.addListener("keyboardDidHide", () => setTeclado(0));
    return () => {
      mostrar.remove();
      esconder.remove();
    };
  }, []);

  useEffect(() => {
    if (!aberto) {
      setRazao("");
      setFantasia("");
      setCnpj("");
      setErro(null);
      setSalvando(false);
    }
  }, [aberto]);

  async function salvar() {
    if (semConexao) {
      setErro(MENSAGEM_ACAO_OFFLINE);
      return;
    }
    if (razao.trim().length < 3) {
      setErro("Informe a razão social do laboratório (mínimo de 3 caracteres).");
      return;
    }
    if (fantasia.trim().length < 2) {
      setErro("Informe o nome fantasia do laboratório.");
      return;
    }
    const digitos = cnpj.replace(/\D/g, "");
    if (digitos && digitos.length !== 14) {
      setErro("O CNPJ deve conter exatamente 14 dígitos numéricos.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const criado = await catalogoRecebimentoService.cadastrarFabricante(apiBaseUrl, {
        razaoSocial: razao.trim(),
        nomeFantasia: fantasia.trim(),
        cnpj: digitos || null,
      });
      onCriado(criado);
    } catch (falha) {
      if (falha instanceof SessaoExpirada) return;
      setErro(falha instanceof TempoEsgotado ? MENSAGEM_REDE : falha instanceof Error ? falha.message : MENSAGEM_REDE);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal visible={aberto} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onFechar}>
      <View style={styles.modal}>
        <Pressable style={styles.fundo} onPress={onFechar} accessibilityLabel="Fechar cadastro" />
        <View style={[styles.folha, { paddingBottom: 48 + teclado }]}>
          <Text style={styles.titulo}>Cadastrar Novo Fabricante</Text>
          {erro ? <Text style={styles.erro}>{erro}</Text> : null}
          <TextInput value={razao} onChangeText={setRazao} placeholder="Razão social" style={styles.campo} />
          <TextInput value={fantasia} onChangeText={setFantasia} placeholder="Nome fantasia" style={styles.campo} />
          <TextInput value={cnpj} onChangeText={setCnpj} placeholder="CNPJ (opcional)" keyboardType="number-pad" style={styles.campo} />
          <Pressable onPress={() => void salvar()} disabled={salvando} accessibilityRole="button" style={styles.botao}>
            {salvando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.botaoTexto}>Cadastrar</Text>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#F8FAFC" },
  topo: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.md, gap: 4 },
  voltar: { minHeight: 44, justifyContent: "center" },
  voltarTexto: { color: "#1D4ED8", fontWeight: "700" },
  cartao: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  cartaoNumero: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  formulario: { padding: theme.spacing.md, paddingBottom: 24, gap: theme.spacing.sm },
  titulo: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  legenda: { fontSize: 12, fontWeight: "700", color: "#334155", marginTop: 4 },
  obrigatorio: { color: "#DC2626" },
  miudo: { fontSize: 12, color: "#64748B" },
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
  curta: {
    backgroundColor: "#FEF3C7",
    color: "#92400E",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "700",
  },
  sugestoes: { maxHeight: 180, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 8 },
  sugestao: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12 },
  sugestaoAtiva: { backgroundColor: "#DBEAFE" },
  sugestaoTexto: { fontSize: 14, color: "#0F172A" },
  linhaTitulo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  novo: { minHeight: 44, justifyContent: "center", paddingLeft: 12 },
  passos: { flexDirection: "row", gap: theme.spacing.sm },
  passo: { flex: 1, minHeight: 44, borderRadius: 8, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
  passoTexto: { color: "#1D4ED8", fontWeight: "700" },
  item: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: theme.spacing.md,
    gap: 4,
  },
  itemNome: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  remover: { color: "#991B1B", fontWeight: "700" },
  rodape: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: Platform.OS === "android" ? 56 : theme.spacing.md,
    gap: theme.spacing.sm,
  },
  botaoSecundario: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1D4ED8",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  botaoSecundarioTexto: { color: "#1D4ED8", fontWeight: "700", fontSize: 14 },
  rodapeComTeclado: { paddingBottom: theme.spacing.sm },
  botao: { minHeight: 44, borderRadius: 8, backgroundColor: "#1D4ED8", alignItems: "center", justifyContent: "center" },
  botaoTexto: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
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
  listaFab: { maxHeight: 320 },
});
