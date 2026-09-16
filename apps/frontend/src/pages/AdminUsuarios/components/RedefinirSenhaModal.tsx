import { useState, useEffect, useRef } from "react";
import { authService } from "../../../services/api";

export interface RedefinirSenhaUsuario {
  id: string;
  nomeCompleto?: string;
  nome?: string;
  email: string;
}

interface RedefinirSenhaModalProps {
  isOpen: boolean;
  onClose: () => void;
  usuario: RedefinirSenhaUsuario | null;
  onSuccess?: (mensagem: string) => void;
}

export function gerarSenhaSegura(): string {
  const maiusculas = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const minusculas = "abcdefghjkmnpqrstuvwxyz";
  const numeros = "23456789";
  const especiais = "@$!%*?&#";
  const todos = maiusculas + minusculas + numeros + especiais;

  // Garante ao menos um caractere de cada categoria
  const partes = [
    maiusculas[Math.floor(Math.random() * maiusculas.length)],
    minusculas[Math.floor(Math.random() * minusculas.length)],
    numeros[Math.floor(Math.random() * numeros.length)],
    especiais[Math.floor(Math.random() * especiais.length)],
  ];

  while (partes.length < 10) {
    partes.push(todos[Math.floor(Math.random() * todos.length)]);
  }

  // Embaralha
  return partes.sort(() => Math.random() - 0.5).join("");
}

export function RedefinirSenhaModal({
  isOpen,
  onClose,
  usuario,
  onSuccess,
}: RedefinirSenhaModalProps) {
  const [senhaInput, setSenhaInput] = useState("");
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState("");
  const [isPending, setIsPending] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reseta estados ao abrir/fechar
  useEffect(() => {
    if (isOpen) {
      setSenhaInput("");
      setSenhaGerada(null);
      setCopiado(false);
      setErro("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Fecha com tecla Escape (Acessibilidade WCAG)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !usuario) return null;

  const handleGerarSenha = () => {
    const novaSenha = gerarSenhaSegura();
    setSenhaInput(novaSenha);
    setErro("");
  };

  const handleConfirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");

    const senhaFinal = senhaInput.trim() || gerarSenhaSegura();

    if (senhaFinal.length < 8) {
      setErro("A senha provisória deve ter no mínimo 8 caracteres.");
      return;
    }

    setIsPending(true);
    try {
      const res = await authService.redefinirSenhaProvisoria(
        usuario.id,
        senhaFinal,
      );

      setSenhaGerada(res.senhaProvisoria || senhaFinal);
      const nomeExibicao = usuario.nomeCompleto || usuario.nome || "Usuário";
      onSuccess?.(`Senha provisória gerada para ${nomeExibicao}`);
    } catch {
      setErro(
        "Não foi possível redefinir a senha do usuário. Tente novamente.",
      );
    } finally {
      setIsPending(false);
    }
  };

  const handleCopiar = async () => {
    if (!senhaGerada) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(senhaGerada);
      } else {
        // Fallback
        const textarea = document.createElement("textarea");
        textarea.value = senhaGerada;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Falha ao copiar
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim/40 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="redefinir-senha-modal-title"
      ref={modalRef}
    >
      <div className="relative w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-xl border border-border-crisp overflow-hidden">
        {/* CABEÇALHO */}
        <div className="p-6 border-b border-border-crisp flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">key</span>
            </div>
            <div>
              <h3
                id="redefinir-senha-modal-title"
                className="font-headline-md text-headline-md text-text-primary"
              >
                {senhaGerada ? "Senha Provisória Gerada" : "Redefinir Senha"}
              </h3>
              <p className="font-caption-micro text-caption-micro text-text-secondary mt-0.5">
                {usuario.nomeCompleto || usuario.nome || "Usuário"} (
                {usuario.email})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary p-1.5 rounded-lg hover:bg-surface-subtle transition-colors"
            aria-label="Fechar modal"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* CORPO: ESTADO 2 (SENHA GERADA E CÓPIA) */}
        {senhaGerada ? (
          <div className="p-6 space-y-5">
            <div className="p-4 rounded-xl bg-status-optimal-bg/15 border border-status-optimal-fg/20 flex items-start gap-3">
              <span className="material-symbols-outlined text-status-optimal-fg text-[20px] shrink-0 mt-0.5">
                check_circle
              </span>
              <p className="text-body-md text-text-primary font-body-md">
                A senha provisória foi gerada com sucesso e vinculada à conta.
              </p>
            </div>

            <div>
              <label
                htmlFor="senha-provisoria-display"
                className="block font-label-caps text-label-caps uppercase text-text-tertiary mb-1.5"
              >
                Senha Provisória
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="senha-provisoria-display"
                  type="text"
                  readOnly
                  value={senhaGerada}
                  className="w-full font-mono text-body-md-medium text-text-primary px-3.5 py-2.5 bg-surface-subtle border border-border-crisp rounded-lg select-all"
                />
                <button
                  type="button"
                  onClick={handleCopiar}
                  className={`px-4 py-2.5 rounded-lg text-body-md-medium flex items-center gap-1.5 shrink-0 transition-colors ${
                    copiado
                      ? "bg-status-optimal-fg text-on-primary"
                      : "bg-primary text-on-primary hover:bg-primary-hover"
                  }`}
                  aria-label={copiado ? "Senha copiada" : "Copiar Senha"}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {copiado ? "done" : "content_copy"}
                  </span>
                  <span>{copiado ? "Copiado!" : "Copiar"}</span>
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-primary-container/10 border border-primary/20">
              <p className="font-caption-micro text-caption-micro text-text-secondary leading-relaxed">
                <strong className="text-primary font-body-md-medium">
                  Atenção:{" "}
                </strong>
                Entregue esta senha ao usuário. No próximo acesso, ele será
                obrigado a cadastrar uma nova senha pessoal.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-lg bg-primary text-on-primary hover:bg-primary-hover font-body-md-medium text-body-md-medium transition-colors"
              >
                Concluir
              </button>
            </div>
          </div>
        ) : (
          /* CORPO: ESTADO 1 (FORMULÁRIO DE EMISSÃO) */
          <form onSubmit={handleConfirmar} className="p-6 space-y-4">
            <p className="font-body-md text-body-md text-text-secondary">
              Você pode digitar uma senha provisória específica ou clicar em
              &quot;Gerar Senha Segura&quot; para criá-la automaticamente.
            </p>

            {erro && (
              <div
                className="p-3 rounded-xl bg-error-container/20 border border-error/30 text-error text-body-md flex items-center gap-2"
                role="alert"
              >
                <span className="material-symbols-outlined text-[18px]">
                  error
                </span>
                <span>{erro}</span>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="senha-provisoria-input"
                  className="block font-label-caps text-label-caps uppercase text-text-secondary"
                >
                  Senha Provisória
                </label>
                <button
                  type="button"
                  onClick={handleGerarSenha}
                  className="text-primary hover:underline font-caption-micro text-caption-micro flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    casino
                  </span>
                  <span>Gerar Senha Segura</span>
                </button>
              </div>
              <input
                id="senha-provisoria-input"
                ref={inputRef}
                type="text"
                value={senhaInput}
                onChange={(e) => setSenhaInput(e.target.value)}
                placeholder="Clique em Gerar Senha ou digite aqui..."
                className="w-full font-mono text-body-md px-3.5 py-2.5 bg-surface-container-lowest border border-border-crisp rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-text-primary placeholder:text-text-tertiary"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-surface-subtle border border-border-crisp">
              <p className="font-caption-micro text-caption-micro text-text-tertiary leading-relaxed">
                Ao confirmar, a credencial atual será revogada e o usuário será
                forçado a redefinir sua senha pessoal no primeiro acesso.
              </p>
            </div>

            <div className="pt-3 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="px-4 py-2.5 rounded-lg border border-border-crisp text-text-secondary hover:bg-surface-subtle font-body-md-medium text-body-md-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-5 py-2.5 rounded-lg bg-primary text-on-primary hover:bg-primary-hover font-body-md-medium text-body-md-medium flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {isPending && (
                  <span className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                )}
                <span>{isPending ? "Emitindo..." : "Confirmar Emissão"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
