import { useMemo } from "react";

interface IndicadorForcaSenhaProps {
  senha: string;
}

interface Requisito {
  id: string;
  label: string;
  atendido: boolean;
}

export function IndicadorForcaSenha({ senha }: IndicadorForcaSenhaProps) {
  const requisitos: Requisito[] = useMemo(() => {
    return [
      {
        id: "min-chars",
        label: "Mínimo de 8 caracteres",
        atendido: senha.length >= 8,
      },
      {
        id: "letras-case",
        label: "Letras maiúsculas e minúsculas",
        atendido: /[A-Z]/.test(senha) && /[a-z]/.test(senha),
      },
      {
        id: "numero",
        label: "Pelo menos um número",
        atendido: /[0-9]/.test(senha),
      },
      {
        id: "especial",
        label: "Pelo menos um caractere especial (@$!%*?&#)",
        atendido: /[@$!%*?&#]/.test(senha),
      },
    ];
  }, [senha]);

  const totalAtendidos = requisitos.filter((r) => r.atendido).length;

  const { nivel, texto, corBarra, percentual } = useMemo(() => {
    if (!senha) {
      return {
        nivel: "vazio",
        texto: "Digite uma senha",
        corBarra: "bg-border-crisp",
        percentual: "0%",
      };
    }
    if (totalAtendidos <= 2) {
      return {
        nivel: "fraca",
        texto: "Senha Fraca",
        corBarra: "bg-error",
        percentual: "33%",
      };
    }
    if (totalAtendidos === 3) {
      return {
        nivel: "media",
        texto: "Senha Média",
        corBarra: "bg-warning",
        percentual: "66%",
      };
    }
    return {
      nivel: "forte",
      texto: "Senha Forte",
      corBarra: "bg-status-optimal-fg",
      percentual: "100%",
    };
  }, [senha, totalAtendidos]);

  return (
    <div className="space-y-3 pt-1">
      {/* BARRA DE PROGRESSO VISUAL */}
      <div>
        <div className="flex items-center justify-between text-caption-micro mb-1">
          <span className="font-label-caps text-label-caps uppercase text-text-tertiary">
            Força da Senha
          </span>
          <span
            className={`font-body-md-medium text-caption-micro ${
              nivel === "fraca"
                ? "text-error"
                : nivel === "media"
                  ? "text-warning"
                  : nivel === "forte"
                    ? "text-status-optimal-fg"
                    : "text-text-tertiary"
            }`}
            aria-live="polite"
          >
            {texto}
          </span>
        </div>
        <div className="h-1.5 w-full bg-surface-subtle rounded-full overflow-hidden border border-border-crisp/40">
          <div
            className={`h-full transition-all duration-300 ${corBarra}`}
            style={{ width: percentual }}
          />
        </div>
      </div>

      {/* CHECKLIST ACESSÍVEL DE REQUISITOS */}
      <ul
        className="space-y-1.5"
        aria-label="Requisitos de segurança da nova senha"
      >
        {requisitos.map((req) => (
          <li
            key={req.id}
            className={`flex items-center gap-2 text-caption-micro transition-colors ${
              req.atendido ? "text-status-optimal-fg" : "text-text-tertiary"
            }`}
          >
            <span
              className={`material-symbols-outlined text-[16px] shrink-0 ${
                req.atendido
                  ? "text-status-optimal-fg"
                  : "text-text-tertiary opacity-40"
              }`}
            >
              {req.atendido ? "check_circle" : "radio_button_unchecked"}
            </span>
            <span
              className={
                req.atendido ? "font-body-md-medium text-text-primary" : ""
              }
            >
              {req.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
