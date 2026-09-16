import { useEffect } from "react";
import type { UsuarioItemTabela } from "@farmaubs/shared";

interface ConfirmarInativacaoModalProps {
  isOpen: boolean;
  usuario: UsuarioItemTabela | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
}

export function ConfirmarInativacaoModal({
  isOpen,
  usuario,
  onClose,
  onConfirm,
  isLoading,
}: ConfirmarInativacaoModalProps) {
  // Acessibilidade WCAG 2.1 AA (ADR-032): Fechamento via tecla Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !usuario) return null;

  const isInativando = usuario.ativo;
  const acaoTitulo = isInativando ? "Inativar Usuário" : "Reativar Usuário";
  const acaoBotao = isInativando
    ? "Confirmar Inativação"
    : "Confirmar Reativação";

  return (
    <div
      className="fixed inset-0 bg-[#001c6d]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-desc"
    >
      <div className="bg-surface-container-lowest w-full max-w-md rounded-xl shadow-xl overflow-hidden flex flex-col p-space-md space-y-space-md border border-border-crisp">
        {/* Cabeçalho */}
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              isInativando
                ? "bg-error-container text-error"
                : "bg-status-optimal-bg text-status-optimal-fg"
            }`}
          >
            <span className="material-symbols-outlined text-[24px]">
              {isInativando ? "warning" : "check_circle"}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <h2
              id="confirm-modal-title"
              className="font-headline-md text-headline-md text-text-primary leading-tight"
            >
              {acaoTitulo}
            </h2>
            <p className="font-body-md text-body-md text-text-secondary mt-1">
              {usuario.nomeCompleto}
            </p>
            <p className="font-caption-micro text-caption-micro text-text-tertiary truncate">
              {usuario.email}
            </p>
          </div>
        </div>

        {/* Mensagem e impacto regulatório SUS */}
        <div
          id="confirm-modal-desc"
          className="p-3 bg-surface-subtle rounded-lg text-body-md font-body-md text-text-secondary leading-relaxed"
        >
          {isInativando ? (
            <p>
              Ao inativar este usuário, seu acesso aos módulos de dispensação,
              pedidos de medicamentos da CAF e relatórios clínicos será{" "}
              <strong className="text-error font-body-md-medium">
                imediatamente revogado
              </strong>
              . Os registros históricos e a rastreabilidade sanitária serão
              preservados para auditoria.
            </p>
          ) : (
            <p>
              Ao reativar este usuário, o acesso às Unidades Básicas de Saúde
              vinculadas será restabelecido conforme o perfil previamente
              configurado.
            </p>
          )}
        </div>

        {/* Ações */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-crisp/20">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg bg-surface-subtle text-text-secondary hover:bg-surface-container font-body-md text-body-md transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg font-body-md-medium text-body-md transition-colors flex items-center gap-1.5 shadow-sm ${
              isInativando
                ? "bg-error text-on-error hover:bg-error/90"
                : "bg-primary-container text-on-primary hover:bg-primary"
            }`}
          >
            {isLoading ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[18px]">
                  progress_activity
                </span>
                <span>Processando...</span>
              </>
            ) : (
              <span>{acaoBotao}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
