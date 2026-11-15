import React, { useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { LoginScreen } from "./src/screens/LoginScreen";
import { SeletorUbs } from "./src/screens/SeletorUbs";
import { TrocaSenhaScreen } from "./src/screens/TrocaSenhaScreen";
import { MENSAGEM_SENHA_ALTERADA } from "./src/screens/senha-forte";
import { sessionService } from "./src/services/session.service";
import { definirAoSessaoExpirar, fetchApi, SessaoExpirada } from "./src/services/api";
import { MENSAGEM_SESSAO_EXPIRADA } from "./src/services/session-gravada";
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

type Destino = "login" | "trocar-senha" | "dashboard";

export default function App() {
  const [destino, setDestino] = useState<Destino>("login");
  const [usuario, setUsuario] = useState<UsuarioAutenticado | null>(null);
  const [avisoSessao, setAvisoSessao] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  const [unidades, setUnidades] = useState<UnidadeResumo[]>([]);
  const [unidadeAtivaId, setUnidadeAtivaId] = useState<string | null>(null);
  const [avisoUnidade, setAvisoUnidade] = useState<string | null>(null);
  const [avisoSenha, setAvisoSenha] = useState<string | null>(null);

  useEffect(() => {
    definirAoSessaoExpirar(() => {
      setUsuario(null);
      setUnidades([]);
      setUnidadeAtivaId(null);
      setAvisoUnidade(null);
      setAvisoSessao(MENSAGEM_SESSAO_EXPIRADA);
      setDestino("login");
    });
    let ativo = true;
    sessionService.restaurarSessao().then(async (sessao) => {
      if (!ativo) return;
      if (!sessao) {
        setPronto(true);
        return;
      }
      try {
        // shortcut: sem rede no /me a sessão local continua; o 401 o fetchApi já apaga.
        await fetchApi(`${API_BASE_URL}/api/v1/acesso/me`);
        if (!ativo) return;
        abrirSessao(sessao.usuario);
      } catch (erro) {
        if (!ativo || erro instanceof SessaoExpirada) return;
        abrirSessao(sessao.usuario);
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
        const res = await fetchApi(
          `${API_BASE_URL}/api/v1/administracao/unidades-saude?municipioId=${encodeURIComponent(usuario.municipioId)}`,
        );
        if (!vivo || !res.ok) return;
        const autorizadas = unidadesAutorizadas(
          lerCatalogoUnidades(await res.json()),
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
    setAvisoUnidade(mensagemUnidadeAlterada(unidade.nome));
  }

  async function senhaAlterada() {
    const atualizado = await sessionService.marcarSenhaDefinitiva();
    if (atualizado) setUsuario(atualizado);
    setAvisoSenha(MENSAGEM_SENHA_ALTERADA);
    setDestino("dashboard");
  }

  async function handleLoginSuccess(dados: LoginSucesso) {
    await sessionService.salvarSessao(dados.token, dados.usuario, dados.expiraEm);
    setAvisoSessao(null);
    abrirSessao(dados.usuario);
  }

  const autenticado = pronto && destino !== "login" && usuario;

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
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
        />
      )}
      {autenticado && destino === "trocar-senha" && (
        <TrocaSenhaScreen apiBaseUrl={API_BASE_URL} onSucesso={senhaAlterada} />
      )}
      {autenticado && destino === "dashboard" && (
        <SafeAreaView style={styles.autenticado}>
          <SeletorUbs
            unidades={unidades}
            ativaId={unidadeAtivaId}
            aviso={avisoUnidade}
            onAlternar={alternarUnidade}
          />
          {avisoSenha ? (
            <Text style={styles.avisoSenha} accessibilityRole="alert">
              {avisoSenha}
            </Text>
          ) : null}
          {/* shortcut: sem cache de consultas ainda; a key remonta a tela ao trocar a UBS. */}
          <View key={unidadeAtivaId ?? "sem-unidade"} style={styles.miolo}>
            <Dashboard nome={usuario.nomeCompleto} />
          </View>
        </SafeAreaView>
      )}
    </View>
  );
}

function Dashboard({ nome }: { nome?: string }) {
  return (
    <View style={styles.destino}>
      <View style={styles.painel}>
        <Text style={styles.titulo}>Bem-vindo(a), {nome || "Profissional"}!</Text>
        <Text style={styles.texto}>
          Sistema Integrado de Gestão Farmacêutica — FarmaUBS
        </Text>
      </View>
      <View style={styles.grade}>
        <Atalho titulo="Estoque" texto="Controle de lotes, validades e entradas de medicamentos." />
        <Atalho titulo="Dispensas" texto="Registro e consulta de dispensações a pacientes do SUS." />
        <Atalho titulo="Indicadores" texto="Métricas de consumo, curva ABC e cobertura da UBS." />
      </View>
    </View>
  );
}

function Atalho({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <View style={styles.atalho} accessibilityRole="text">
      <Text style={styles.atalhoTitulo}>{titulo}</Text>
      <Text style={styles.atalhoTexto}>{texto}</Text>
    </View>
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
    flex: 1,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.canvas,
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
  texto: {
    fontSize: 16,
    color: "#64748B",
  },
});
