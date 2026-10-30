import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { LoginScreen } from "./src/screens/LoginScreen";
import { sessionService } from "./src/services/session.service";
import type { LoginSucesso } from "./src/screens/login-form";
import type { UsuarioAutenticado } from "@farmaubs/shared";
import { theme } from "./src/theme/tokens";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

type Destino = "login" | "trocar-senha" | "dashboard";

export default function App() {
  const [destino, setDestino] = useState<Destino>("login");
  const [usuario, setUsuario] = useState<UsuarioAutenticado | null>(null);

  async function handleLoginSuccess(dados: LoginSucesso) {
    await sessionService.salvarSessao(dados.token, dados.usuario);
    setUsuario(dados.usuario);
    setDestino(dados.usuario.deveTrocarSenha ? "trocar-senha" : "dashboard");
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      {destino === "login" && (
        <LoginScreen onLoginSuccess={handleLoginSuccess} apiBaseUrl={API_BASE_URL} />
      )}
      {destino === "trocar-senha" && <TrocaSenhaObrigatoria nome={usuario?.nomeCompleto} />}
      {destino === "dashboard" && <Dashboard nome={usuario?.nomeCompleto} />}
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
