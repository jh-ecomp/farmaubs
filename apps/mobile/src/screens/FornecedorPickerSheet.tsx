import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { FORNECEDORES_INSTITUCIONAIS_PADRAO } from "@farmaubs/shared";
import { theme } from "../theme/tokens";

type FornecedorPickerSheetProps = {
  aberto: boolean;
  selecionado: string;
  onFechar: () => void;
  onEscolher: (nome: string) => void;
};

/**
 * [RE-MOB-01]: Lista rápida dos fornecedores institucionais.
 */
export function FornecedorPickerSheet({ aberto, selecionado, onFechar, onEscolher }: FornecedorPickerSheetProps) {
  return (
    <Modal visible={aberto} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onFechar}>
      <View style={styles.modal}>
        <Pressable style={styles.fundo} onPress={onFechar} accessibilityLabel="Fechar fornecedores" />
        <View style={styles.folha}>
          <Text style={styles.titulo}>Fornecedor / Origem</Text>
          {FORNECEDORES_INSTITUCIONAIS_PADRAO.map((fornecedor) => {
            const ativo = fornecedor.nome === selecionado;
            return (
              <Pressable
                key={fornecedor.id}
                onPress={() => onEscolher(fornecedor.nome)}
                accessibilityRole="button"
                accessibilityState={{ selected: ativo }}
                style={[styles.linha, ativo && styles.linhaAtiva]}
              >
                <Text style={styles.nome}>{fornecedor.nome}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, justifyContent: "flex-end" },
  fundo: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(15,23,42,0.4)" },
  folha: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: theme.spacing.md,
    paddingBottom: 48,
    gap: theme.spacing.sm,
  },
  titulo: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  linha: {
    minHeight: 44,
    justifyContent: "center",
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: "#F8FAFC",
  },
  linhaAtiva: { backgroundColor: "#DBEAFE" },
  nome: { fontSize: 14, color: "#0F172A", fontWeight: "600" },
});
