import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from "react-native";
import type { LoginRequest } from "@farmaubs/shared";
import { theme } from "../theme/tokens";
import {
  classificarErroLogin,
  lerLoginSucesso,
  MENSAGEM_REDE,
  validarCamposLogin,
  type LoginSucesso,
} from "./login-form";

interface LoginScreenProps {
  onLoginSuccess: (dados: LoginSucesso) => void;
  apiBaseUrl: string;
}

// shortcut: 15s, quando a história definir o limite de timeout do login
const TIMEOUT_LOGIN_MS = 15_000;

export function LoginScreen({ onLoginSuccess, apiBaseUrl }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [bloqueioAte, setBloqueioAte] = useState<number | null>(null);

  const bloqueado = bloqueioAte != null && bloqueioAte > Date.now();

  useEffect(() => {
    if (bloqueioAte == null) return;
    const espera = bloqueioAte - Date.now();
    if (espera <= 0) {
      setBloqueioAte(null);
      return;
    }
    const id = setTimeout(() => setBloqueioAte(null), espera);
    return () => clearTimeout(id);
  }, [bloqueioAte]);

  async function handleLogin() {
    if (carregando || bloqueado) return;

    const validacao = validarCamposLogin(email, senha);
    if (validacao) {
      setErro(validacao);
      return;
    }

    setErro(null);
    setCarregando(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_LOGIN_MS);
    try {
      const payload: LoginRequest = {
        email: email.trim().toLowerCase(),
        senha,
      };

      const res = await fetch(`${apiBaseUrl}/api/v1/acesso/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      let data: unknown;
      try {
        data = await res.json();
      } catch {
        setErro(MENSAGEM_REDE);
        return;
      }

      if (!res.ok) {
        const minutos =
          data && typeof data === "object" && "minutosRestantes" in data
            ? (data as { minutosRestantes?: unknown }).minutosRestantes
            : undefined;
        const falha = classificarErroLogin(res.status, minutos);
        setErro(falha.mensagem);
        if (falha.tipo === "bloqueio") {
          setBloqueioAte(Date.now() + falha.minutos * 60_000);
        }
        return;
      }

      const sucesso = lerLoginSucesso(data);
      if (!sucesso) {
        setErro(MENSAGEM_REDE);
        return;
      }
      onLoginSuccess(sucesso);
    } catch {
      setErro(MENSAGEM_REDE);
    } finally {
      clearTimeout(timer);
      setCarregando(false);
    }
  }

  const acaoBloqueada = carregando || bloqueado;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.inner}
        >
          <View style={styles.header}>
            <Text style={styles.title}>FarmaUBS Mobile</Text>
            <Text style={styles.subtitle}>Gestão e Dispensação na Atenção Básica</Text>
          </View>

          <View style={styles.form}>
            {erro && (
              <View style={styles.errorBox} accessibilityRole="alert">
                <Text style={styles.errorIcon}>!</Text>
                <Text style={styles.errorText}>{erro}</Text>
              </View>
            )}

            <Text style={styles.label}>E-mail institucional</Text>
            <TextInput
              style={styles.input}
              placeholder="nome@ubs.gov.br"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              editable={!carregando}
            />

            <Text style={styles.label}>Senha</Text>
            <View style={styles.senhaRow}>
              <TextInput
                style={styles.senhaInput}
                placeholder="Sua senha de acesso"
                value={senha}
                onChangeText={setSenha}
                secureTextEntry={!mostrarSenha}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!carregando}
              />
              <TouchableOpacity
                onPress={() => setMostrarSenha((atual) => !atual)}
                accessibilityLabel={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                style={styles.olho}
              >
                <Text style={styles.olhoText}>{mostrarSenha ? "Ocultar" : "Mostrar"}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.button, acaoBloqueada && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={acaoBloqueada}
              activeOpacity={0.8}
            >
              {carregando ? (
                <ActivityIndicator color={theme.colors.text.inverse} />
              ) : (
                <Text style={styles.buttonText}>Acessar Sistema</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  flex: {
    flex: 1,
  },
  inner: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
  },
  header: {
    marginBottom: theme.spacing.xl,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: theme.colors.primary.default,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.xs,
    textAlign: "center",
  },
  form: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.text.primary,
    backgroundColor: theme.colors.surface,
  },
  senhaRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface,
  },
  senhaInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  olho: {
    paddingHorizontal: theme.spacing.md,
    minHeight: 48,
    justifyContent: "center",
  },
  olhoText: {
    color: theme.colors.primary.default,
    fontWeight: "600",
  },
  button: {
    backgroundColor: theme.colors.primary.default,
    height: 48,
    borderRadius: theme.borderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    marginTop: theme.spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: theme.colors.text.inverse,
    fontSize: 16,
    fontWeight: "bold",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.status.danger,
  },
  errorIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: "hidden",
    textAlign: "center",
    lineHeight: 22,
    color: theme.colors.text.inverse,
    backgroundColor: theme.colors.status.danger,
    fontWeight: "bold",
    marginRight: theme.spacing.sm,
  },
  errorText: {
    flex: 1,
    color: theme.colors.status.danger,
    fontSize: 13,
  },
});
