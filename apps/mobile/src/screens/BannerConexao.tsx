import React, { useEffect, useRef, useState } from "react";
import { Animated, Platform, StatusBar, StyleSheet, Text } from "react-native";
import { theme } from "../theme/tokens";
import {
  MENSAGEM_CONEXAO_RESTABELECIDA,
  MENSAGEM_MODO_OFFLINE,
  type FaseBanner,
} from "../services/conectividade";

type BannerConexaoProps = {
  fase: FaseBanner;
};

/**
 * [AC-MOB-06]: Faixa no fluxo da tela, abaixo da barra do sistema. Não cobre o Sair nem a UBS.
 */
export function BannerConexao({ fase }: BannerConexaoProps) {
  const [visivel, setVisivel] = useState<FaseBanner>(fase);
  const opacidade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (fase === "oculto") {
      Animated.timing(opacidade, { toValue: 0, duration: 300, useNativeDriver: true }).start(
        ({ finished }) => {
          if (finished) setVisivel("oculto");
        },
      );
      return;
    }
    setVisivel(fase);
    Animated.timing(opacidade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [fase, opacidade]);

  if (visivel === "oculto") return null;

  const offline = visivel === "offline";
  const folga = (Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) : 0) + theme.spacing.sm;

  return (
    <Animated.View
      accessibilityRole="alert"
      style={[
        styles.faixa,
        { opacity: opacidade, paddingTop: folga },
        offline ? styles.offline : styles.online,
      ]}
    >
      <Text style={[styles.texto, offline ? styles.textoOffline : styles.textoOnline]}>
        {offline ? MENSAGEM_MODO_OFFLINE : MENSAGEM_CONEXAO_RESTABELECIDA}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  faixa: {
    paddingBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  offline: {
    backgroundColor: theme.colors.status.warning,
  },
  online: {
    backgroundColor: theme.colors.status.success,
  },
  texto: {
    fontSize: 14,
    fontWeight: "700",
  },
  textoOffline: {
    color: "#1C1917",
  },
  textoOnline: {
    color: theme.colors.text.inverse,
  },
});
