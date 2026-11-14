import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { LoginScreen } from "./src/screens/LoginScreen";
import { sessionService } from "./src/services/session.service";
import { definirAoSessaoExpirar, fetchApi, SessaoExpirada } from "./src/services/api";
import { MENSAGEM_SESSAO_EXPIRADA } from "./src/services/session-gravada";
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

  useEffect(() => {
    definirAoSessaoExpirar(() => {
      setUsuario(null);
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

  function abrirSessao(pessoa: UsuarioAutenticado) {
    setUsuario(pessoa);
    setDestino(pessoa.deveTrocarSenha ? "trocar-senha" : "dashboard");
  }

  async function handleLoginSuccess(dados: LoginSucesso) {
    await sessionService.salvarSessao(dados.token, dados.usuario, dados.expiraEm);
    setAvisoSessao(null);
    abrirSessao(dados.usuario);
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      {!pronto && (
        <View style={styles.destino}>
          <ActivityIndicator color={theme.colors.primary.default} />
        </View>
      )}
      {pronto && destino === "login" && (
        <LoginScreen
          onLoginSuccess={handleLoginSuccess}
          apiBaseUrl={API_BASE_URL}
          avisoSessao={avisoSessao}
        />
      )}
      {pronto && destino === "trocar-senha" && <TrocaSenhaObrigatoria nome={usuario?.nomeCompleto} />}
      {pronto && destino === "dashboard" && <Dashboard nome={usuario?.nomeCompleto} />}
    </View>
  );
}

function TrocaSenhaObrigatoria({ nome }: { nome?: string }) {
  return (
    <View style={styles.destino}>
      <Text style={styles.titulo}>Troca de senha</Text>
      <Text style={styles.texto}>
        {nome ? `${nome}, sua ` : "Sua "}
        senha provisória precisa ser trocada antes de continuar.
      </Text>
    </View>
  );
}

function Dashboard({ nome }: { nome?: string }) {
  return (
    <View style={styles.destino}>
      <Text style={styles.titulo}>Dashboard</Text>
      <Text style={styles.texto}>
        {nome ? `Olá, ${nome}.` : "Sessão iniciada."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  destino: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: theme.colors.background,
  },
  titulo: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.colors.primary.default,
    marginBottom: 12,
  },
  texto: {
    fontSize: 16,
    color: theme.colors.text.primary,
  },
});
