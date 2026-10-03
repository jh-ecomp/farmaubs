import React, { useState, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { LoginScreen } from "./src/screens/LoginScreen";
import { sessionService } from "./src/services/session.service";
import type { LoginResponseDto, UsuarioAutenticado } from "@farmaubs/shared";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

export default function App() {
  const [usuario, setUsuario] = useState<UsuarioAutenticado | null>(null);

  useEffect(() => {
    sessionService.obterUsuario().then((u) => {
      if (u) setUsuario(u);
    });
  }, []);

  async function handleLoginSuccess(dados: LoginResponseDto) {
    if (dados.token && dados.usuario) {
      await sessionService.salvarSessao(dados.token, dados.usuario);
      setUsuario(dados.usuario);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <LoginScreen onLoginSuccess={handleLoginSuccess} apiBaseUrl={API_BASE_URL} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
