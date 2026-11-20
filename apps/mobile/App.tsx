import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { StatusBar } from "expo-status-bar";
import { LoginScreen } from "./src/screens/LoginScreen";
import { BannerConexao } from "./src/screens/BannerConexao";
import { SeletorUbs } from "./src/screens/SeletorUbs";
import { TrocaSenhaScreen } from "./src/screens/TrocaSenhaScreen";
import { IdentificacaoPacienteScreen } from "./src/screens/IdentificacaoPacienteScreen";
import { BuscaMedicamentoScreen } from "./src/screens/BuscaMedicamentoScreen";
import { CarrinhoScreen } from "./src/screens/CarrinhoScreen";
import { incluirNoCarrinho, type ItemCarrinho } from "./src/screens/carrinho";
import { MENSAGEM_SENHA_ALTERADA } from "./src/screens/senha-forte";
import { sessionService } from "./src/services/session.service";
import { encerrarSessao, MENSAGEM_CONFIRMAR_SAIDA } from "./src/services/logout";
import {
  DURACAO_BANNER_RESTABELECIDO_MS,
  proximaFase,
  redeEstaOffline,
  type FaseBanner,
  type RedeObservada,
} from "./src/services/conectividade";
import { definirAoNovaExpiracao, definirAoSessaoExpirar, fetchApi, SessaoExpirada } from "./src/services/api";
import { MENSAGEM_SESSAO_EXPIRADA } from "./src/services/session-gravada";
import {
  acaoDoToque,
  lerRenovarSessao,
  MENSAGEM_PERMISSAO_ALERTA,
  MENSAGEM_SESSAO_ESTENDIDA,
  MENSAGEM_SESSAO_INATIVIDADE,
} from "./src/services/alerta-sessao";
import {
  escutarToqueAlerta,
  marcarToqueTratado,
  notificationService,
  toqueJaTratado,
  ultimoToqueAlerta,
} from "./src/services/notification.service";
import {
  escolherIdUnidade,
  lerCatalogoUnidades,
  mensagemUnidadeAlterada,
  unidadesAutorizadas,
  type UnidadeResumo,
} from "./src/services/unidade-ativa";
import type { LoginSucesso } from "./src/screens/login-form";
import type { UsuarioAutenticado } from "@farmaubs/shared";
import { theme } from "./src/theme/tokens";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

type Destino = "login" | "trocar-senha" | "dashboard" | "dispensar";
type EtapaDispensa = "paciente" | "medicamento" | "carrinho";

export default function App() {
  const [destino, setDestino] = useState<Destino>("login");
  const [etapaDispensa, setEtapaDispensa] = useState<EtapaDispensa>("paciente");
  const [itensCarrinho, setItensCarrinho] = useState<ItemCarrinho[]>([]);
  const [dataReceita, setDataReceita] = useState("");
  const [usuario, setUsuario] = useState<UsuarioAutenticado | null>(null);
  const [avisoSessao, setAvisoSessao] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  const [unidades, setUnidades] = useState<UnidadeResumo[]>([]);
  const [unidadeAtivaId, setUnidadeAtivaId] = useState<string | null>(null);
  const [avisoUnidade, setAvisoUnidade] = useState<string | null>(null);
  const [avisoSenha, setAvisoSenha] = useState<string | null>(null);
  const saindo = useRef(false);
  const [faseRede, setFaseRede] = useState<FaseBanner>("oculto");
  const faseRedeRef = useRef<FaseBanner>("oculto");
  const permissaoAlerta = useRef(true);
  const expiraEmAlerta = useRef<string | null>(null);
  const toqueTratado = useRef<string | null>(null);
  const [alertaIndisponivel, setAlertaIndisponivel] = useState(false);

  useEffect(() => {
    definirAoSessaoExpirar(() => {
      expiraEmAlerta.current = null;
      void notificationService.cancelarAlertaSessao();
      setUsuario(null);
      setUnidades([]);
      setUnidadeAtivaId(null);
      setAvisoUnidade(null);
      setAvisoSessao(MENSAGEM_SESSAO_EXPIRADA);
      setDestino("login");
    });
    definirAoNovaExpiracao(async (iso) => {
      expiraEmAlerta.current = iso;
      const atualizado = await sessionService.atualizarExpiraEm(iso);
      if (!atualizado || !permissaoAlerta.current) return;
      await notificationService.agendarAlertaSessao(iso);
    });
    let ativo = true;
    sessionService.restaurarSessao().then(async (sessao) => {
      if (!ativo) return;
      if (sessao.estado === "ausente") {
        setPronto(true);
        return;
      }
      if (sessao.estado === "expirada") {
        setAvisoSessao(MENSAGEM_SESSAO_INATIVIDADE);
        setPronto(true);
        return;
      }
      try {
        // shortcut: sem rede no /me a sessão local continua; o 401 o fetchApi já apaga.
        await fetchApi(`${API_BASE_URL}/api/v1/acesso/me`);
        if (!ativo) return;
        abrirSessao(sessao.usuario);
        void prepararAlertas(sessao.expiraEm);
      } catch (erro) {
        if (!ativo || erro instanceof SessaoExpirada) return;
        abrirSessao(sessao.usuario);
        void prepararAlertas(sessao.expiraEm);
      } finally {
        if (ativo) setPronto(true);
      }
    }).catch(() => {
      if (ativo) setPronto(true);
    });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    function aplicar(rede: RedeObservada) {
      const atual = faseRedeRef.current;
      const proxima = proximaFase(atual, redeEstaOffline(rede));
      faseRedeRef.current = proxima;
      setFaseRede(proxima);
      if (proxima === "offline" && timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (atual === "offline" && proxima === "restabelecida") {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          faseRedeRef.current = "oculto";
          setFaseRede("oculto");
          timer = null;
        }, DURACAO_BANNER_RESTABELECIDO_MS);
      }
    }
    const assinatura = NetInfo.addEventListener(aplicar);
    NetInfo.fetch().then(aplicar).catch(() => {});
    return () => {
      assinatura();
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!avisoUnidade) return;
    const id = setTimeout(() => setAvisoUnidade(null), 2500);
    return () => clearTimeout(id);
  }, [avisoUnidade]);

  useEffect(() => {
    if (!avisoSenha) return;
    const id = setTimeout(() => setAvisoSenha(null), 2500);
    return () => clearTimeout(id);
  }, [avisoSenha]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (estado) => {
      if (estado !== "active") return;
      void (async () => {
        const expira = expiraEmAlerta.current;
        if (!expira) return;
        const permitido = await notificationService.permissaoConcedida();
        if (expiraEmAlerta.current !== expira) return;
        permissaoAlerta.current = permitido;
        setAlertaIndisponivel(!permitido);
        if (permitido) await notificationService.agendarAlertaSessao(expira);
        else await notificationService.cancelarAlertaSessao();
      })();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!usuario) return;
    let vivo = true;
    (async () => {
      const salva = await sessionService.obterUnidadeAtiva();
      const id = escolherIdUnidade(usuario.unidadeIds, salva);
      if (!vivo) return;
      if (id) await sessionService.salvarUnidadeAtiva(id);
      if (!vivo) return;
      setUnidadeAtivaId(id);
      const locais = unidadesAutorizadas(
        await sessionService.obterCatalogoUnidades(),
        usuario.unidadeIds,
      );
      if (!vivo) return;
      if (locais.length > 0) setUnidades(locais);
      if (!usuario.municipioId) return;
      try {
        let catalogoBruto: unknown[] = [];
        const resMunicipios = await fetchApi(
          `${API_BASE_URL}/api/v1/administracao/municipios`,
        );
        if (resMunicipios.ok) {
          const municipios = await resMunicipios.json();
          if (Array.isArray(municipios)) {
            const promessas = municipios.map((m: { id?: string }) =>
              m.id
                ? fetchApi(
                    `${API_BASE_URL}/api/v1/administracao/unidades-saude?municipioId=${encodeURIComponent(m.id)}`,
                  )
                    .then((r) => (r.ok ? r.json() : []))
                    .catch(() => [])
                : Promise.resolve([]),
            );
            const resultados = await Promise.all(promessas);
            catalogoBruto = resultados.flat();
          }
        }
        if (catalogoBruto.length === 0) {
          const res = await fetchApi(
            `${API_BASE_URL}/api/v1/administracao/unidades-saude?municipioId=${encodeURIComponent(usuario.municipioId)}`,
          );
          if (res.ok) catalogoBruto = await res.json();
        }
        if (!vivo) return;
        const autorizadas = unidadesAutorizadas(
          lerCatalogoUnidades(catalogoBruto),
          usuario.unidadeIds,
        );
        if (!vivo || autorizadas.length === 0) return;
        await sessionService.salvarCatalogoUnidades(autorizadas);
        if (!vivo) return;
        setUnidades(autorizadas);
        const escolhida = escolherIdUnidade(
          autorizadas.map((unidade) => unidade.id),
          id,
        );
        if (escolhida && escolhida !== id) {
          await sessionService.salvarUnidadeAtiva(escolhida);
          if (!vivo) return;
          setUnidadeAtivaId(escolhida);
        }
      } catch (erro) {
        if (erro instanceof SessaoExpirada) return;
      }
    })();
    return () => {
      vivo = false;
    };
  }, [usuario]);

  function abrirSessao(pessoa: UsuarioAutenticado) {
    setUsuario(pessoa);
    setDestino(pessoa.deveTrocarSenha ? "trocar-senha" : "dashboard");
  }

  async function alternarUnidade(id: string) {
    const unidade = unidades.find((item) => item.id === id);
    if (!unidade) return;
    await sessionService.salvarUnidadeAtiva(unidade.id);
    setUnidadeAtivaId(unidade.id);
    setEtapaDispensa("paciente");
    setItensCarrinho([]);
    setDataReceita("");
    setAvisoUnidade(mensagemUnidadeAlterada(unidade.nome));
  }

  async function senhaAlterada() {
    const atualizado = await sessionService.marcarSenhaDefinitiva();
    if (atualizado) setUsuario(atualizado);
    setAvisoSenha(MENSAGEM_SENHA_ALTERADA);
    setDestino("dashboard");
  }

  async function prepararAlertas(expiresAt: string) {
    try {
      expiraEmAlerta.current = expiresAt;
      const permitido = await notificationService.pedirPermissao();
      permissaoAlerta.current = permitido;
      setAlertaIndisponivel(!permitido);
      if (permitido) await notificationService.agendarAlertaSessao(expiresAt);
      else await notificationService.cancelarAlertaSessao();
    } catch {
      permissaoAlerta.current = false;
      setAlertaIndisponivel(true);
    }
  }

  async function tratarToque(expiresAt: string, chave: string) {
    if (toqueTratado.current === chave || (await toqueJaTratado(chave))) {
      toqueTratado.current = chave;
      return;
    }
    toqueTratado.current = chave;
    await marcarToqueTratado(chave);
    if (acaoDoToque(expiresAt, Date.now()) === "expirada") {
      expiraEmAlerta.current = null;
      await notificationService.cancelarAlertaSessao();
      await sessionService.limparSessao();
      setUsuario(null);
      setUnidades([]);
      setUnidadeAtivaId(null);
      setAvisoUnidade(null);
      setAvisoSenha(null);
      setAvisoSessao(MENSAGEM_SESSAO_INATIVIDADE);
      setDestino("login");
      return;
    }
    try {
      const res = await fetchApi(`${API_BASE_URL}/api/v1/acesso/renovar`, { method: "POST" });
      if (!res.ok) return;
      const novo = lerRenovarSessao(await res.json());
      if (!novo) return;
      const pessoa = await sessionService.atualizarExpiraEm(novo);
      if (pessoa) abrirSessao(pessoa);
      if (permissaoAlerta.current) await notificationService.agendarAlertaSessao(novo);
      setAvisoSenha(MENSAGEM_SESSAO_ESTENDIDA);
    } catch (erro) {
      if (erro instanceof SessaoExpirada) return;
    }
  }

  useEffect(() => {
    const parar = escutarToqueAlerta((expiresAt, chave) => {
      void tratarToque(expiresAt, chave);
    });
    ultimoToqueAlerta()
      .then((ultimo) => {
        if (ultimo) void tratarToque(ultimo.expiresAt, ultimo.chave);
      })
      .catch(() => {});
    return parar;
  }, []);

  function pedirSaida() {
    Alert.alert("Sair do Sistema", MENSAGEM_CONFIRMAR_SAIDA, [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: () => void sair() },
    ]);
  }

  async function sair() {
    if (saindo.current) return;
    saindo.current = true;
    try {
      await encerrarSessao(
        async () => {
          if (faseRedeRef.current === "offline") return;
          await fetchApi(`${API_BASE_URL}/api/v1/acesso/logout`, { method: "POST" });
        },
        () => sessionService.limparSessao(),
      );
    } catch {
      // shortcut: sem rede o POST falha; encerrarSessao já apagou o SecureStore.
    } finally {
      setUsuario(null);
      setUnidades([]);
      setUnidadeAtivaId(null);
      setAvisoUnidade(null);
      setAvisoSenha(null);
      setAvisoSessao(null);
      setDestino("login");
      expiraEmAlerta.current = null;
      setAlertaIndisponivel(false);
      void notificationService.cancelarAlertaSessao();
      saindo.current = false;
    }
  }

  async function handleLoginSuccess(dados: LoginSucesso) {
    await sessionService.salvarSessao(dados.token, dados.usuario, dados.expiraEm);
    setAvisoSessao(null);
    abrirSessao(dados.usuario);
    void prepararAlertas(dados.expiraEm);
  }

  const autenticado = pronto && destino !== "login" && usuario;
  const semConexao = faseRede === "offline";
  const bannerAberto = faseRede !== "oculto";

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <BannerConexao fase={faseRede} />
      {!pronto && (
        <View style={styles.espera}>
          <ActivityIndicator color={theme.colors.action} />
        </View>
      )}
      {pronto && destino === "login" && (
        <LoginScreen
          onLoginSuccess={handleLoginSuccess}
          apiBaseUrl={API_BASE_URL}
          avisoSessao={avisoSessao}
          semConexao={semConexao}
        />
      )}
      {autenticado && destino === "trocar-senha" && (
        <TrocaSenhaScreen
          apiBaseUrl={API_BASE_URL}
          onSucesso={senhaAlterada}
          onSair={pedirSaida}
          semConexao={semConexao}
          reservaTopo={!bannerAberto}
        />
      )}
      {autenticado && destino === "dashboard" && (
        <SafeAreaView style={styles.autenticado}>
          <SeletorUbs
            unidades={unidades}
            ativaId={unidadeAtivaId}
            aviso={avisoUnidade}
            onAlternar={alternarUnidade}
            onSair={pedirSaida}
            reservaTopo={!bannerAberto}
          />
          {avisoSenha ? (
            <Text style={styles.avisoSenha} accessibilityRole="alert">
              {avisoSenha}
            </Text>
          ) : null}
          {/* shortcut: sem cache de consultas ainda; a key remonta a tela ao trocar a UBS. */}
          <ScrollView
            key={unidadeAtivaId ?? "sem-unidade"}
            style={styles.miolo}
            contentContainerStyle={styles.destino}
            keyboardShouldPersistTaps="handled"
          >
            <Dashboard
              nome={usuario.nomeCompleto}
              alertaIndisponivel={alertaIndisponivel}
              onDispensar={() => {
                setItensCarrinho([]);
                setDataReceita("");
                setEtapaDispensa("paciente");
                setDestino("dispensar");
              }}
            />
          </ScrollView>
        </SafeAreaView>
      )}
      {autenticado && destino === "dispensar" && (
        <SafeAreaView style={styles.autenticado}>
          <SeletorUbs
            unidades={unidades}
            ativaId={unidadeAtivaId}
            aviso={avisoUnidade}
            onAlternar={alternarUnidade}
            onSair={pedirSaida}
            reservaTopo={!bannerAberto}
          />
          <View style={styles.miolo}>
            {etapaDispensa === "paciente" ? (
              <IdentificacaoPacienteScreen
                key={unidadeAtivaId ?? "sem-unidade"}
                apiBaseUrl={API_BASE_URL}
                semConexao={semConexao}
                onVoltar={() => {
                  setItensCarrinho([]);
                  setDataReceita("");
                  setDestino("dashboard");
                }}
                onAvancar={() => setEtapaDispensa("medicamento")}
              />
            ) : etapaDispensa === "medicamento" ? (
              <BuscaMedicamentoScreen
                key={unidadeAtivaId ?? "sem-unidade"}
                apiBaseUrl={API_BASE_URL}
                ubsId={unidadeAtivaId}
                semConexao={semConexao}
                totalItens={itensCarrinho.length}
                onVoltar={() => setEtapaDispensa("paciente")}
                onIncluir={(item) => setItensCarrinho((atuais) => incluirNoCarrinho(atuais, item))}
                onAbrirCarrinho={() => setEtapaDispensa("carrinho")}
              />
            ) : (
              <CarrinhoScreen
                itens={itensCarrinho}
                dataReceita={dataReceita}
                onMudarItens={setItensCarrinho}
                onMudarData={setDataReceita}
                onVoltar={() => setEtapaDispensa("medicamento")}
              />
            )}
          </View>
        </SafeAreaView>
      )}
    </View>
  );
}

function Dashboard({
  nome,
  alertaIndisponivel,
  onDispensar,
}: {
  nome?: string;
  alertaIndisponivel?: boolean;
  onDispensar: () => void;
}) {
  return (
    <View style={styles.gradeAviso}>
      {alertaIndisponivel ? <AvisoInatividade /> : null}
      <View style={styles.painel}>
        <Text style={styles.titulo}>Bem-vindo(a), {nome || "Profissional"}!</Text>
        <Text style={styles.texto}>
          Sistema Integrado de Gestão Farmacêutica — FarmaUBS
        </Text>
      </View>
      <View style={styles.grade}>
        <Atalho titulo="Estoque" texto="Controle de lotes, validades e entradas de medicamentos." />
        <Atalho
          titulo="Dispensas"
          texto="Registro e consulta de dispensações a pacientes do SUS."
          onPress={onDispensar}
        />
        <Atalho titulo="Indicadores" texto="Métricas de consumo, curva ABC e cobertura da UBS." />
      </View>
    </View>
  );
}

function AvisoInatividade() {
  return (
    <View style={styles.avisoInatividade} accessibilityRole="alert">
      <View style={styles.avisoInatividadeTopo}>
        <Text style={styles.avisoInatividadeTitulo}>Aviso de Inatividade</Text>
        <Text style={styles.seloSeguranca}>Segurança</Text>
      </View>
      <Text style={styles.avisoInatividadeTexto}>{MENSAGEM_PERMISSAO_ALERTA}</Text>
    </View>
  );
}

function Atalho({ titulo, texto, onPress }: { titulo: string; texto: string; onPress?: () => void }) {
  if (!onPress) {
    return (
      <View style={styles.atalho} accessibilityRole="text">
        <Text style={styles.atalhoTitulo}>{titulo}</Text>
        <Text style={styles.atalhoTexto}>{texto}</Text>
      </View>
    );
  }
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.atalho}>
      <Text style={styles.atalhoTitulo}>{titulo}</Text>
      <Text style={styles.atalhoTexto}>{texto}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  espera: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.canvas,
  },
  autenticado: {
    flex: 1,
    backgroundColor: theme.colors.canvas,
  },
  miolo: {
    flex: 1,
  },
  destino: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.canvas,
  },
  gradeAviso: {
    gap: theme.spacing.md,
  },
  painel: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
  },
  grade: {
    gap: theme.spacing.md,
  },
  atalho: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  atalhoTitulo: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.action,
    marginBottom: theme.spacing.xs,
  },
  atalhoTexto: {
    fontSize: 14,
    color: "#64748B",
  },
  titulo: {
    fontSize: 22,
    fontWeight: "700",
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  avisoSenha: {
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    color: theme.colors.status.success,
    fontWeight: "700",
  },
  avisoInatividade: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  avisoInatividadeTopo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  avisoInatividadeTitulo: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text.primary,
  },
  seloSeguranca: {
    fontSize: 11,
    fontWeight: "600",
    color: "#001c6d",
    backgroundColor: "#E0E7FF",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  avisoInatividadeTexto: {
    fontSize: 14,
    lineHeight: 21,
    color: "#475569",
  },
  texto: {
    fontSize: 16,
    color: "#64748B",
  },
});
