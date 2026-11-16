import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { theme } from "../theme/tokens";
import { fetchApi, SessaoExpirada, TempoEsgotado } from "../services/api";
import { MENSAGEM_ACAO_OFFLINE } from "../services/conectividade";
import { MENSAGEM_REDE } from "./login-form";
import {
  checklistSenha,
  MENSAGEM_SENHAS_DIFERENTES,
  podeSalvarSenha,
  senhasCoincidem,
} from "./senha-forte";

type TrocaSenhaScreenProps = {
  apiBaseUrl: string;
  onSucesso: () => void | Promise<void>;
  onSair: () => void;
  semConexao?: boolean;
  reservaTopo?: boolean;
};

function mensagemApi(data: unknown): string {
  if (!data || typeof data !== "object" || !("message" in data)) {
    return "Não foi possível alterar a senha.";
  }
  const message = (data as { message: unknown }).message;
  if (typeof message === "string") return message;
  if (Array.isArray(message) && typeof message[0] === "string") return message[0];
  return "Não foi possível alterar a senha.";
}

/**
 * [AC-MOB-04]: Troca obrigatória. O Voltar do Android não sai desta tela.
 */
export function TrocaSenhaScreen({
  apiBaseUrl,
  onSucesso,
  onSair,
  semConexao = false,
  reservaTopo = true,
}: TrocaSenhaScreenProps) {
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const itens = checklistSenha(novaSenha);
  const podeSalvar = podeSalvarSenha(novaSenha, confirmacao) && !enviando;
  const diverge = confirmacao.length > 0 && !senhasCoincidem(novaSenha, confirmacao);
  const folgaTopo = (reservaTopo && Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) : 0) + theme.spacing.md;

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, []);

  async function salvar() {
    if (!podeSalvarSenha(novaSenha, confirmacao) || enviando) return;
    if (semConexao) {
      setErro(MENSAGEM_ACAO_OFFLINE);
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetchApi(`${apiBaseUrl}/api/v1/acesso/trocar-senha`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novaSenha, confirmacaoSenha: confirmacao }),
      });
      if (!res.ok) {
        const data: unknown = await res.json().catch(() => null);
        setErro(mensagemApi(data));
        return;
      }
      await onSucesso();
    } catch (falha) {
      if (falha instanceof SessaoExpirada) return;
      setErro(falha instanceof TempoEsgotado ? MENSAGEM_REDE : "Não foi possível alterar a senha.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.flex}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.conteudo, { paddingTop: folgaTopo }]}
      >
        <View style={styles.card}>
          <Text style={styles.titulo}>Troca de senha</Text>
          <Text style={styles.texto}>
            Cadastre uma senha pessoal antes de continuar.
          </Text>

          {erro ? (
            <Text style={styles.erro} accessibilityRole="alert">
              {erro}
            </Text>
          ) : null}

          <Text style={styles.label}>Nova senha</Text>
          <View style={styles.senhaRow}>
            <TextInput
              style={styles.senhaInput}
              value={novaSenha}
              onChangeText={setNovaSenha}
              secureTextEntry={!mostrar}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!enviando}
              accessibilityLabel="Nova senha"
            />
            <Pressable
              onPress={() => setMostrar((atual) => !atual)}
              accessibilityLabel={mostrar ? "Ocultar senha" : "Mostrar senha"}
              style={styles.olho}
            >
              <Text style={styles.olhoTexto}>{mostrar ? "Ocultar" : "Mostrar"}</Text>
            </Pressable>
          </View>

          <View accessibilityRole="list" accessibilityLabel="Requisitos da nova senha">
            {itens.map((item) => (
              <Text
                key={item.id}
                style={item.atendido ? styles.itemOk : styles.itemPendente}
                accessibilityRole="text"
              >
                {item.atendido ? "✓" : "○"} {item.rotulo}
              </Text>
            ))}
          </View>

          <Text style={styles.label}>Confirmar nova senha</Text>
          <TextInput
            style={styles.input}
            value={confirmacao}
            onChangeText={setConfirmacao}
            secureTextEntry={!mostrar}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!enviando}
            accessibilityLabel="Confirmar nova senha"
          />
          {diverge ? (
            <Text style={styles.erro} accessibilityRole="alert">
              {MENSAGEM_SENHAS_DIFERENTES}
            </Text>
          ) : null}

          <Pressable
            style={[styles.botao, !podeSalvar && styles.botaoDesligado]}
            onPress={salvar}
            disabled={!podeSalvar}
            accessibilityRole="button"
            accessibilityState={{ disabled: !podeSalvar }}
          >
            {enviando ? (
              <ActivityIndicator color={theme.colors.text.inverse} />
            ) : (
              <Text style={styles.botaoTexto}>Salvar Nova Senha</Text>
            )}
          </Pressable>
          <Pressable
            onPress={onSair}
            accessibilityRole="button"
            accessibilityLabel="Sair do Sistema"
            style={styles.sair}
          >
            <Text style={styles.sairTexto}>Sair do Sistema</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.canvas },
  conteudo: {
    flexGrow: 1,
    justifyContent: "center",
    padding: theme.spacing.md,
  },
  card: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
  },
  titulo: {
    fontSize: 24,
    fontWeight: "700",
    color: theme.colors.text.primary,
  },
  texto: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    color: "#64748B",
    fontSize: 14,
  },
  label: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
    color: "#334155",
    fontSize: 14,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.text.primary,
    backgroundColor: theme.colors.surface,
  },
  senhaRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surface,
  },
  senhaInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.text.primary,
  },
  olho: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.md,
  },
  olhoTexto: {
    color: theme.colors.action,
    fontWeight: "600",
  },
  itemPendente: {
    color: "#94A3B8",
    marginTop: theme.spacing.xs,
  },
  itemOk: {
    color: theme.colors.status.success,
    marginTop: theme.spacing.xs,
  },
  erro: {
    marginTop: theme.spacing.sm,
    color: theme.colors.status.danger,
  },
  botao: {
    marginTop: theme.spacing.lg,
    height: 48,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.action,
    alignItems: "center",
    justifyContent: "center",
  },
  botaoDesligado: {
    opacity: 0.45,
  },
  botaoTexto: {
    color: theme.colors.text.inverse,
    fontWeight: "700",
    fontSize: 16,
  },
  sair: {
    marginTop: theme.spacing.md,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  sairTexto: {
    color: theme.colors.status.danger,
    fontWeight: "700",
  },
});
