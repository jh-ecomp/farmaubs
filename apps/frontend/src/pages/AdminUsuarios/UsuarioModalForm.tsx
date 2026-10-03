import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PerfilCodigo } from "@farmaubs/shared";
import type { UsuarioItemTabela } from "@farmaubs/shared";
import {
  useCadastrarUsuario,
  useAtualizarUsuario,
  useMunicipios,
  useUnidadesSaude,
} from "../../hooks/useUsuarios";
import { UsuarioApiError } from "../../services/usuario.service";
import {
  RedefinirSenhaModal,
  gerarSenhaSegura,
} from "./components/RedefinirSenhaModal";

const usuarioSchema = z.object({
  nomeCompleto: z
    .string()
    .min(3, "Nome completo deve ter pelo menos 3 caracteres."),
  email: z.string().email("Informe um endereço de e-mail válido."),
  cpf: z.string().optional(),
  crf: z.string().optional(),
  senha: z.string().optional(),
  municipioId: z.string().min(1, "Selecione um município de lotação."),
  perfil: z.string().min(1, "Selecione o perfil de acesso."),
  ubsIds: z
    .array(z.string())
    .min(
      1,
      "Vincule o usuário a pelo menos uma Unidade Básica de Saúde (UBS).",
    ),
  deveTrocarSenha: z.boolean().optional(),
});

export type UsuarioFormValues = z.infer<typeof usuarioSchema>;

interface UsuarioModalFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (nome: string) => void;
  usuarioParaEditar?: UsuarioItemTabela | null;
}

export function UsuarioModalForm({
  isOpen,
  onClose,
  onSuccess,
  usuarioParaEditar,
}: UsuarioModalFormProps) {
  const { data: municipios = [], isLoading: isLoadingMunicipios } =
    useMunicipios();
  const cadastrarMutation = useCadastrarUsuario();
  const atualizarMutation = useAtualizarUsuario();
  const isEditing = Boolean(usuarioParaEditar);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UsuarioFormValues>({
    resolver: zodResolver(usuarioSchema),
    defaultValues: {
      nomeCompleto: "",
      email: "",
      cpf: "",
      crf: "",
      senha: "",
      municipioId: "",
      perfil: PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
      ubsIds: [],
      deveTrocarSenha: true,
    },
  });

  const selectedMunicipioId = watch("municipioId");
  const selectedUbsIds = watch("ubsIds") || [];
  const municipioAnteriorRef = useRef<string | null>(null);
  const [isRedefinirModalOpen, setIsRedefinirModalOpen] = useState(false);
  const [senhaCopiada, setSenhaCopiada] = useState(false);

  const { data: unidades = [], isLoading: isLoadingUnidades } =
    useUnidadesSaude(selectedMunicipioId);

  // Inicializa o formulário com dados do usuário a editar ou valores padrão
  useEffect(() => {
    if (isOpen) {
      if (usuarioParaEditar) {
        municipioAnteriorRef.current = usuarioParaEditar.municipioId;
        reset({
          nomeCompleto: usuarioParaEditar.nomeCompleto,
          email: usuarioParaEditar.email,
          cpf: usuarioParaEditar.cpf || "",
          crf: usuarioParaEditar.crf || "",
          senha: "",
          municipioId: usuarioParaEditar.municipioId,
          perfil: String(usuarioParaEditar.perfilCodigo),
          ubsIds: usuarioParaEditar.unidades?.map((u) => u.id) || [],
          deveTrocarSenha: false,
        });
      } else {
        municipioAnteriorRef.current = null;
        const senhaAleatoria = gerarSenhaSegura();
        reset({
          nomeCompleto: "",
          email: "",
          cpf: "",
          crf: "",
          senha: senhaAleatoria,
          municipioId: "",
          perfil: PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
          ubsIds: [],
          deveTrocarSenha: true,
        });
      }
    } else {
      municipioAnteriorRef.current = null;
    }
  }, [isOpen, usuarioParaEditar, reset]);

  // Cascata: ao mudar o município durante a interação, limpa a seleção de UBSs anteriores (RF026)
  useEffect(() => {
    if (!isOpen) return;

    if (municipioAnteriorRef.current === null) {
      if (selectedMunicipioId) {
        municipioAnteriorRef.current = selectedMunicipioId;
      }
      return;
    }

    if (
      selectedMunicipioId &&
      selectedMunicipioId !== municipioAnteriorRef.current
    ) {
      municipioAnteriorRef.current = selectedMunicipioId;
      setValue("ubsIds", [], { shouldValidate: true });
    }
  }, [selectedMunicipioId, isOpen, setValue]);

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

  if (!isOpen) return null;

  const toggleUbs = (ubsId: string) => {
    if (selectedUbsIds.includes(ubsId)) {
      setValue(
        "ubsIds",
        selectedUbsIds.filter((id) => id !== ubsId),
        { shouldValidate: true },
      );
    } else {
      setValue("ubsIds", [...selectedUbsIds, ubsId], { shouldValidate: true });
    }
  };

  const onSubmit = async (values: UsuarioFormValues) => {
    try {
      if (isEditing && usuarioParaEditar) {
        await atualizarMutation.mutateAsync({
          id: usuarioParaEditar.id,
          dados: {
            nomeCompleto: values.nomeCompleto.trim(),
            email: values.email.trim().toLowerCase(),
            perfil: values.perfil,
            municipioId: values.municipioId,
            ubsIds: values.ubsIds,
            cpf: values.cpf?.trim() || undefined,
            crf: values.crf?.trim() || undefined,
          },
        });
        onSuccess(values.nomeCompleto);
        onClose();
        return;
      }

      // No cadastro, a senha provisória é sempre uma senha forte gerada aleatoriamente
      const senhaEfetiva = values.senha?.trim() || gerarSenhaSegura();

      await cadastrarMutation.mutateAsync({
        nomeCompleto: values.nomeCompleto.trim(),
        email: values.email.trim().toLowerCase(),
        senha: senhaEfetiva,
        perfil: values.perfil,
        municipioId: values.municipioId,
        ubsIds: values.ubsIds,
        cpf: values.cpf?.trim() || undefined,
        crf: values.crf?.trim() || undefined,
        deveTrocarSenha: true,
      });

      onSuccess(values.nomeCompleto);
      onClose();
    } catch (err) {
      if (err instanceof UsuarioApiError && err.status === 409) {
        // Cenário 4 BDD: 409 Conflict mantém o modal aberto e destaca erro no campo de e-mail
        setError("email", {
          type: "manual",
          message: "Este e-mail já está em uso por outro usuário.",
        });
      } else {
        setError("root", {
          type: "manual",
          message:
            err instanceof Error ? err.message : "Erro ao cadastrar usuário.",
        });
      }
    }
  };

  return (
    <div
      className="fixed inset-0 bg-[#001c6d]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      id="userModalBackdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modalTitle"
    >
      <div className="bg-surface-container-lowest w-full max-w-2xl rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header do Modal */}
        <div className="px-space-md py-space-sm bg-surface-container flex items-center justify-between border-b border-border-crisp/20">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">
              {isEditing ? "manage_accounts" : "person_add"}
            </span>
            <div>
              <h2
                className="font-headline-md text-headline-md text-text-primary"
                id="modalTitle"
              >
                {isEditing
                  ? "Editar Profissional"
                  : "Cadastrar Novo Profissional"}
              </h2>
              <p className="font-caption-micro text-caption-micro text-text-secondary">
                Definição de acesso municipal e governança de dados do FarmaUBS
              </p>
            </div>
          </div>
          <button
            type="button"
            className="text-text-tertiary hover:text-text-primary p-1 rounded-lg transition-colors"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Corpo do Formulário */}
        <div className="p-space-md space-y-4 overflow-y-auto flex-1">
          {errors.root && (
            <div
              className="p-3 bg-error-container text-error rounded-lg font-body-md text-body-md"
              role="alert"
            >
              {errors.root.message}
            </div>
          )}

          <form
            id="userForm"
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            {/* Nome Completo e CPF */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="formUserName"
                  className="block font-label-caps text-label-caps text-text-secondary uppercase mb-1"
                >
                  Nome Completo *
                </label>
                <input
                  id="formUserName"
                  type="text"
                  placeholder="Ex: Dra. Juliana Miranda"
                  className={`w-full px-3 py-2 bg-surface-subtle rounded-lg text-body-md font-body-md text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary-container transition-all ${
                    errors.nomeCompleto
                      ? "border border-error ring-1 ring-error"
                      : ""
                  }`}
                  {...register("nomeCompleto")}
                />
                {errors.nomeCompleto && (
                  <p className="text-error text-caption-micro mt-1">
                    {errors.nomeCompleto.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="formUserCpf"
                  className="block font-label-caps text-label-caps text-text-secondary uppercase mb-1"
                >
                  CPF (apenas números)
                </label>
                <input
                  id="formUserCpf"
                  type="text"
                  maxLength={14}
                  placeholder="000.000.000-00"
                  className="w-full px-3 py-2 bg-surface-subtle rounded-lg text-body-md font-body-md text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary-container transition-all"
                  {...register("cpf")}
                />
              </div>
            </div>

            {/* E-mail e CRF */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="formUserEmail"
                  className="block font-label-caps text-label-caps text-text-secondary uppercase mb-1"
                >
                  E-mail Institucional *
                </label>
                <input
                  id="formUserEmail"
                  type="email"
                  placeholder="usuario@saude.gov.br"
                  className={`w-full px-3 py-2 bg-surface-subtle rounded-lg text-body-md font-body-md text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary-container transition-all ${
                    errors.email
                      ? "border border-error ring-2 ring-error bg-error-container/20"
                      : ""
                  }`}
                  {...register("email")}
                />
                {errors.email && (
                  <p
                    id="email-error-msg"
                    className="text-error text-caption-micro mt-1 font-body-md-medium"
                  >
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="formUserCrf"
                  className="block font-label-caps text-label-caps text-text-secondary uppercase mb-1"
                >
                  Registro de Classe (CRF / COREN)
                </label>
                <input
                  id="formUserCrf"
                  type="text"
                  placeholder="Ex: CRF-PI 5912"
                  className="w-full px-3 py-2 bg-surface-subtle rounded-lg text-body-md font-body-md text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary-container transition-all"
                  {...register("crf")}
                />
              </div>
            </div>

            {/* Senha Provisória: no cadastro é sempre gerada pelo sistema; na edição é um botão opcional */}
            {isEditing ? (
              <div className="p-3.5 bg-surface-subtle border border-border-crisp/40 rounded-xl flex items-center justify-between gap-4">
                <div>
                  <label className="block font-label-caps text-label-caps text-text-secondary uppercase">
                    Senha Provisória (Opcional)
                  </label>
                  <p className="text-caption-micro text-text-tertiary mt-0.5">
                    A senha atual do profissional é mantida. Caso queira emitir uma nova senha de acesso, clique ao lado.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRedefinirModalOpen(true)}
                  className="px-3 py-2 rounded-lg bg-surface-container-highest text-primary hover:bg-surface-bright border border-primary/20 font-body-md-medium text-caption-micro flex items-center gap-1.5 transition-colors shrink-0"
                >
                  <span className="material-symbols-outlined text-[18px]">key</span>
                  <span>Gerar Senha Aleatória</span>
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="formUserPassword"
                    className="block font-label-caps text-label-caps text-text-secondary uppercase"
                  >
                    Senha Provisória (Gerada Automaticamente) *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const novaSenha = gerarSenhaSegura();
                      setValue("senha", novaSenha, { shouldValidate: true });
                    }}
                    className="text-primary hover:underline font-caption-micro text-caption-micro flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      casino
                    </span>
                    <span>Gerar Outra Senha</span>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="formUserPassword"
                    type="text"
                    readOnly
                    value={watch("senha") || ""}
                    className="w-full font-mono text-body-md px-3 py-2 bg-surface-subtle border border-border-crisp/50 rounded-lg text-text-primary select-all cursor-default focus:outline-none"
                    {...register("senha")}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const senhaAtual = watch("senha");
                      if (senhaAtual) {
                        if (
                          navigator.clipboard &&
                          navigator.clipboard.writeText
                        ) {
                          await navigator.clipboard.writeText(senhaAtual);
                        }
                        setSenhaCopiada(true);
                        setTimeout(() => setSenhaCopiada(false), 2000);
                      }
                    }}
                    className={`px-3 py-2 rounded-lg text-caption-micro font-body-md-medium flex items-center gap-1 shrink-0 transition-colors border border-border-crisp ${
                      senhaCopiada
                        ? "bg-status-optimal-fg text-on-primary border-status-optimal-fg"
                        : "bg-surface-subtle text-text-secondary hover:text-text-primary hover:bg-surface-container"
                    }`}
                    title={
                      senhaCopiada
                        ? "Copiado!"
                        : "Copiar senha para área de transferência"
                    }
                    aria-label={
                      senhaCopiada
                        ? "Senha copiada"
                        : "Copiar senha para área de transferência"
                    }
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {senhaCopiada ? "done" : "content_copy"}
                    </span>
                    <span>{senhaCopiada ? "Copiado!" : "Copiar"}</span>
                  </button>
                </div>
                <p className="text-caption-micro text-text-tertiary mt-1">
                  Senha segura gerada pelo sistema para evitar erros humanos. O
                  profissional será forçado a alterá-la no primeiro acesso.
                </p>
                {errors.senha && (
                  <p className="text-error text-caption-micro mt-1">
                    {errors.senha.message}
                  </p>
                )}
              </div>
            )}

            {/* Perfil de Acesso e Município (Cascata Trigger) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="formUserRole"
                  className="block font-label-caps text-label-caps text-text-secondary uppercase mb-1"
                >
                  Perfil de Acesso *
                </label>
                <select
                  id="formUserRole"
                  className="w-full px-3 py-2 bg-surface-subtle rounded-lg text-body-md font-body-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-container"
                  {...register("perfil")}
                >
                  <option value={PerfilCodigo.FARMACEUTICO_RESPONSAVEL}>
                    Farmacêutico Responsável (Dispensação & Pedido)
                  </option>
                  <option value={PerfilCodigo.FARMACEUTICO_RESIDENTE}>
                    Farmacêutico Residente (Dispensação & Estoque)
                  </option>
                  <option value={PerfilCodigo.GERENTE}>
                    Gerente de Unidade (Visualização Gerencial)
                  </option>
                  <option value={PerfilCodigo.ADMINISTRADOR}>
                    Administrador Municipal da Saúde (Acesso Total)
                  </option>
                </select>
                {errors.perfil && (
                  <p className="text-error text-caption-micro mt-1">
                    {errors.perfil.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="formUserMunicipio"
                  className="block font-label-caps text-label-caps text-text-secondary uppercase mb-1"
                >
                  Município de Lotação *
                </label>
                <select
                  id="formUserMunicipio"
                  className={`w-full px-3 py-2 bg-surface-subtle rounded-lg text-body-md font-body-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-container ${
                    errors.municipioId
                      ? "border border-error ring-1 ring-error"
                      : ""
                  }`}
                  {...register("municipioId")}
                >
                  <option value="">Selecione um município...</option>
                  {isLoadingMunicipios ? (
                    <option disabled>Carregando municípios...</option>
                  ) : (
                    municipios.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome} - {m.uf}
                      </option>
                    ))
                  )}
                </select>
                {errors.municipioId && (
                  <p className="text-error text-caption-micro mt-1">
                    {errors.municipioId.message}
                  </p>
                )}
              </div>
            </div>

            {/* Unidades Básicas de Saúde (Cascata dinâmica) */}
            <div className="space-y-1.5">
              <label className="block font-label-caps text-label-caps text-text-secondary uppercase">
                Unidades Básicas de Saúde (UBSs Vinculadas) *
              </label>

              {!selectedMunicipioId ? (
                <div className="p-3 bg-surface-subtle rounded-lg text-text-tertiary text-caption-micro">
                  Selecione um município de lotação acima para carregar as
                  Unidades Básicas de Saúde disponíveis.
                </div>
              ) : isLoadingUnidades ? (
                <div className="p-3 bg-surface-subtle rounded-lg text-text-tertiary text-caption-micro flex items-center gap-2">
                  <span className="material-symbols-outlined animate-spin text-[16px]">
                    progress_activity
                  </span>
                  Carregando UBSs do município...
                </div>
              ) : unidades.length === 0 ? (
                <div className="p-3 bg-surface-subtle rounded-lg text-text-secondary text-caption-micro">
                  Nenhuma UBS cadastrada para o município selecionado.
                </div>
              ) : (
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-2 bg-surface-subtle rounded-lg border border-border-crisp/40"
                  role="group"
                  aria-label="Seleção de UBSs"
                >
                  {unidades.map((ubs) => {
                    const isChecked = selectedUbsIds.includes(ubs.id);
                    return (
                      <label
                        key={ubs.id}
                        className={`flex items-start gap-2 p-2 rounded cursor-pointer transition-colors border ${
                          isChecked
                            ? "bg-surface-container-highest border-primary/40 text-primary"
                            : "bg-surface-container-lowest border-border-crisp/30 text-text-primary hover:bg-surface-bright"
                        }`}
                      >
                        <input
                          type="checkbox"
                          value={ubs.id}
                          checked={isChecked}
                          onChange={() => toggleUbs(ubs.id)}
                          className="mt-0.5 accent-primary rounded"
                        />
                        <div className="min-w-0">
                          <p className="font-body-md-medium text-caption-micro truncate">
                            {ubs.nome}
                          </p>
                          <p className="text-caption-micro text-text-tertiary truncate">
                            {ubs.endereco}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
              {errors.ubsIds && (
                <p className="text-error text-caption-micro mt-1">
                  {errors.ubsIds.message}
                </p>
              )}
            </div>

            {/* Rodapé / Ações */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-crisp/20">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-surface-subtle text-text-secondary hover:bg-surface-container font-body-md text-body-md transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  cadastrarMutation.isPending ||
                  atualizarMutation.isPending
                }
                className="px-4 py-2 rounded-lg bg-primary-container text-on-primary hover:bg-primary font-body-md-medium text-body-md shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {cadastrarMutation.isPending || atualizarMutation.isPending ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">
                      progress_activity
                    </span>
                    <span>Salvando...</span>
                  </>
                ) : (
                  <span>
                    {isEditing ? "Salvar Alterações" : "Cadastrar Usuário"}
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal opcional de redefinição de senha para edição */}
      {isEditing && usuarioParaEditar && (
        <RedefinirSenhaModal
          isOpen={isRedefinirModalOpen}
          usuario={usuarioParaEditar}
          onClose={() => setIsRedefinirModalOpen(false)}
          onSuccess={(msg) => {
            onSuccess(`${usuarioParaEditar.nomeCompleto} (${msg})`);
          }}
        />
      )}
    </div>
  );
}
