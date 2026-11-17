import React, { useState } from "react";
import { Modal, Platform, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { theme } from "../theme/tokens";
import { podeAlternarUnidade, type UnidadeResumo } from "../services/unidade-ativa";

type SeletorUbsProps = {
  unidades: UnidadeResumo[];
  ativaId: string | null;
  aviso: string | null;
  onAlternar: (id: string) => void;
  onSair: () => void;
  reservaTopo?: boolean;
};

/**
 * [AC-MOB-03]: Topo do layout autenticado. Uma UBS fica fixa. Várias abrem o modal.
 */
export function SeletorUbs({
  unidades,
  ativaId,
  aviso,
  onAlternar,
  onSair,
  reservaTopo = true,
}: SeletorUbsProps) {
  const [aberto, setAberto] = useState(false);
  const ativa = unidades.find((unidade) => unidade.id === ativaId) ?? null;
  const nome = ativa?.nome ?? "Carregando unidade";
  const alterna = podeAlternarUnidade(unidades.length);

  function escolher(id: string) {
    setAberto(false);
    if (id !== ativaId) onAlternar(id);
  }

  const folgaTopo =
    (reservaTopo && Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) : 0) + theme.spacing.md;

  return (
    <View style={[styles.barra, { paddingTop: folgaTopo }]}>
      <Text style={styles.marca}>FarmaUBS</Text>
      {alterna ? (
        <Pressable
          onPress={() => setAberto(true)}
          accessibilityRole="button"
          accessibilityLabel={`UBS ativa ${nome}. Toque para trocar.`}
          style={styles.troca}
        >
          <Text style={styles.ativa}>UBS Ativa: {nome}</Text>
        </Pressable>
      ) : (
        <Text style={styles.ativa} accessibilityRole="text">
          UBS Ativa: {nome}
        </Text>
      )}
      <Pressable
        onPress={onSair}
        accessibilityRole="button"
        accessibilityLabel="Sair do Sistema"
        style={styles.sair}
      >
        <Text style={styles.sairTexto}>Sair do Sistema</Text>
      </Pressable>
      {aviso ? (
        <Text style={styles.aviso} accessibilityRole="alert">
          {aviso}
        </Text>
      ) : null}
      <Modal
        visible={aberto}
        transparent
        animationType="slide"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setAberto(false)}
      >
        <View style={styles.fundo}>
          <Pressable
            style={styles.fecha}
            onPress={() => setAberto(false)}
            accessibilityLabel="Fechar escolha de UBS"
          />
          <View style={styles.folha}>
            <Text style={styles.titulo}>Escolher UBS</Text>
            {unidades.map((unidade) => (
              <Pressable
                key={unidade.id}
                onPress={() => escolher(unidade.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: unidade.id === ativaId }}
                style={styles.item}
              >
                <Text style={styles.itemTexto}>
                  {unidade.id === ativaId ? "✓ " : ""}
                  {unidade.nome}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  barra: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  marca: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.action,
  },
  troca: {
    flexShrink: 1,
  },
  ativa: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.text.primary,
  },
  sair: {
    minHeight: 44,
    justifyContent: "center",
  },
  sairTexto: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.status.danger,
  },
  aviso: {
    marginTop: theme.spacing.sm,
    color: theme.colors.secondary.dark,
  },
  fundo: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.4)",
  },
  fecha: {
    flex: 1,
  },
  folha: {
    backgroundColor: theme.colors.surface,
    paddingTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md + (Platform.OS === "android" ? 12 : 0),
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
  },
  titulo: {
    fontSize: 18,
    fontWeight: "bold",
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  item: {
    paddingVertical: theme.spacing.md,
  },
  itemTexto: {
    fontSize: 16,
    color: theme.colors.text.primary,
  },
});
