import { useState, useMemo, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PerfilCodigo, type UsuarioItemTabela } from "@farmaubs/shared";
import { useAuth } from "../../contexts/AuthContext";
import {
  useUsuarios,
  useMunicipios,
  useAlterarStatusUsuario,
  useRedefinirSenha,
} from "../../hooks/useUsuarios";
import { UsuarioModalForm } from "./UsuarioModalForm";
import { ConfirmarInativacaoModal } from "./ConfirmarInativacaoModal";
import iconeFarmaUbs from "../../assets/iconefarmaubs.svg";

export function AdminUsuarios() {
  const { usuario: loggedUser, logout } = useAuth();
  const navigate = useNavigate();

  // Dados do usuário logado normalizados
  const isGestor =
    loggedUser?.perfil?.includes("GESTOR") ||
    loggedUser?.email?.toLowerCase().includes("gestor");
  const defaultNome = isGestor ? "Gestor Municipal" : "Administrador Geral";
  const defaultEmail = isGestor ? "gestor@farmaubs.dev" : "admin@farmaubs.dev";
  const userNome =
    !loggedUser?.nome || loggedUser.nome.includes("Carlos Mendonça")
      ? defaultNome
      : loggedUser.nome;
  const userEmail =
    !loggedUser?.email || loggedUser.email.includes("carlos")
      ? defaultEmail
      : loggedUser.email;
  const userRoleLabel = isGestor ? "Gestor Municipal" : "Administrador Geral";

  // Estados de Filtros e Busca com Debounce (300ms)
  const [buscaInput, setBuscaInput] = useState("");
  const [buscaDebounced, setBuscaDebounced] = useState("");
  const [filtroPerfil, setFiltroPerfil] = useState<string>("ALL");
  const [filtroMunicipio, setFiltroMunicipio] = useState<string>("ALL");
  const [paginaAtual, setPaginaAtual] = useState(1);
  const limitePorPagina = 10;

  // Debounce de 300ms na busca textual
  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscaDebounced(buscaInput);
      setPaginaAtual(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [buscaInput]);

  // Carregamento de dados
  const { data: municipios = [] } = useMunicipios();

  const filtrosQuery = useMemo(() => {
    return {
      page: paginaAtual,
      limit: limitePorPagina,
      busca: buscaDebounced || undefined,
      perfilId: filtroPerfil !== "ALL" ? filtroPerfil : undefined,
      municipioId: filtroMunicipio !== "ALL" ? filtroMunicipio : undefined,
    };
  }, [
    paginaAtual,
    limitePorPagina,
    buscaDebounced,
    filtroPerfil,
    filtroMunicipio,
  ]);

  const {
    data: respostaUsuarios,
    isLoading,
    isError,
  } = useUsuarios(filtrosQuery);
  const alterarStatusMutation = useAlterarStatusUsuario();
  const redefinirSenhaMutation = useRedefinirSenha();

  // Estados dos Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [usuarioParaEditar, setUsuarioParaEditar] =
    useState<UsuarioItemTabela | null>(null);
  const [userToInactivate, setUserToInactivate] =
    useState<UsuarioItemTabela | null>(null);

  // Estado do Toast
  const [toast, setToast] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: "success" | "error";
  }>({
    visible: false,
    title: "",
    message: "",
    type: "success",
  });

  const showToast = (
    title: string,
    message: string,
    type: "success" | "error" = "success",
  ) => {
    setToast({ visible: true, title, message, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 4000);
  };

  // Limpeza de filtros
  const handleResetFilters = () => {
    setBuscaInput("");
    setBuscaDebounced("");
    setFiltroPerfil("ALL");
    setFiltroMunicipio("ALL");
    setPaginaAtual(1);
  };

  // Confirmação de Inativação / Reativação
  const handleConfirmStatusChange = async () => {
    if (!userToInactivate) return;
    try {
      const novoStatus = !userToInactivate.ativo;
      await alterarStatusMutation.mutateAsync({
        id: userToInactivate.id,
        ativo: novoStatus,
      });

      showToast(
        novoStatus ? "Usuário Reativado" : "Usuário Inativado",
        novoStatus
          ? `O acesso de ${userToInactivate.nomeCompleto} foi restabelecido com sucesso.`
          : `O acesso de ${userToInactivate.nomeCompleto} foi suspenso no sistema.`,
      );
      setUserToInactivate(null);
    } catch {
      showToast(
        "Falha na Operação",
        "Não foi possível alterar o status do usuário. Tente novamente.",
        "error",
      );
    }
  };

  // Abertura dos Modais de Criação e Edição
  const handleOpenCreateModal = () => {
    setUsuarioParaEditar(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (usuario: UsuarioItemTabela) => {
    setUsuarioParaEditar(usuario);
    setIsModalOpen(true);
  };

  // Redefinição de Senha Regulamentar (RF003)
  const handleResetPassword = async (usuario: UsuarioItemTabela) => {
    try {
      await redefinirSenhaMutation.mutateAsync(usuario.id);
      showToast(
        "Senha Provisória Emitida",
        `Um link de redefinição e credencial provisória foram enviados para ${usuario.email} (RF003).`,
      );
    } catch {
      showToast(
        "Erro na Redefinição",
        "Não foi possível redefinir a senha do usuário. Tente novamente.",
        "error",
      );
    }
  };

  const usuarios = respostaUsuarios?.data || [];
  const totalUsuarios = respostaUsuarios?.total ?? usuarios.length;
  const totalPages =
    respostaUsuarios?.totalPages ??
    (Math.ceil(totalUsuarios / limitePorPagina) || 1);

  // Renderização do Badge de Perfil RBAC
  const renderPerfilBadge = (perfilCodigo: string, perfilNome?: string) => {
    switch (perfilCodigo) {
      case PerfilCodigo.ADMINISTRADOR:
      case "ADMIN":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary font-label-badge text-label-badge">
            <span className="material-symbols-outlined text-[14px]">
              admin_panel_settings
            </span>
            <span>{perfilNome || "Administrador Geral"}</span>
          </span>
        );
      case PerfilCodigo.FARMACEUTICO_RESPONSAVEL:
      case "FARM_RESP":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-status-optimal-bg text-status-optimal-fg font-label-badge text-label-badge">
            <span className="material-symbols-outlined text-[14px]">
              medication
            </span>
            <span>{perfilNome || "Farmacêutico Responsável"}</span>
          </span>
        );
      case PerfilCodigo.FARMACEUTICO_RESIDENTE:
      case "FARM_RES":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-high text-primary font-label-badge text-label-badge">
            <span className="material-symbols-outlined text-[14px]">
              school
            </span>
            <span>{perfilNome || "Farmacêutico Residente"}</span>
          </span>
        );
      case PerfilCodigo.GESTOR:
      case "GESTOR":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-badge text-label-badge">
            <span className="material-symbols-outlined text-[14px]">badge</span>
            <span>{perfilNome || "Gestor de Unidade"}</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-subtle text-text-secondary font-label-badge text-label-badge">
            <span className="material-symbols-outlined text-[14px]">
              person
            </span>
            <span>{perfilNome || perfilCodigo}</span>
          </span>
        );
    }
  };

  return (
    <div className="bg-canvas-bg font-body-md text-body-md text-on-surface antialiased min-h-screen flex">
      {/* SIDEBAR */}
      <aside
        className="fixed left-0 top-0 h-screen w-layout-sidebar-width bg-surface-container-lowest border-r border-border-crisp z-50 flex flex-col justify-between select-none"
        aria-label="Navegação Lateral"
      >
        <div className="flex flex-col flex-1 min-h-0">
          <div className="h-layout-header-height px-space-md border-b border-border-crisp flex items-center justify-between bg-surface-container-lowest">
            <div className="flex items-center gap-space-xs">
              <img
                src={iconeFarmaUbs}
                alt="FarmaUBS"
                className="w-8 h-8 object-contain"
              />
              <div className="flex flex-col">
                <span className="font-title-sm text-title-sm text-primary leading-none tracking-tight">
                  FarmaUBS
                </span>
                <span className="font-caption-micro text-caption-micro text-text-tertiary uppercase tracking-wider mt-0.5">
                  SMS Parnaíba/PI
                </span>
              </div>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-surface-subtle border border-border-crisp text-text-secondary font-label-caps text-label-caps">
              SUS
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-space-xs py-space-sm space-y-space-md">
            <div className="space-y-space-xxs pt-space-xs">
              <div className="px-space-xs py-1 text-text-tertiary font-label-caps text-label-caps uppercase tracking-wider">
                Governança &amp; Admin
              </div>
              <nav className="space-y-0.5">
                <Link
                  to="/admin/usuarios"
                  className="flex items-center gap-space-xs px-space-xs py-2 rounded-lg bg-primary-container text-on-primary font-body-md-medium transition-colors"
                  aria-current="page"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    admin_panel_settings
                  </span>
                  <span>Gestão de Usuários</span>
                </Link>
                <button
                  type="button"
                  onClick={() =>
                    showToast(
                      "Auditoria",
                      "O módulo de trilha de auditoria será integrado com o backend.",
                    )
                  }
                  className="w-full flex items-center gap-space-xs px-space-xs py-2 rounded-lg text-text-secondary hover:bg-surface-subtle hover:text-on-surface transition-colors font-body-md text-left"
                >
                  <span className="material-symbols-outlined text-[20px] text-text-tertiary">
                    history_toggle_off
                  </span>
                  <span>Auditoria (Logs)</span>
                </button>
              </nav>
            </div>
          </div>
        </div>

        {/* Rodapé da Sidebar */}
        <div className="p-space-xs border-t border-border-crisp bg-surface-subtle">
          <div className="flex items-center gap-space-xs text-text-tertiary font-caption-micro text-caption-micro leading-snug">
            <span className="material-symbols-outlined text-[16px] text-text-tertiary">
              local_hospital
            </span>
            <div>
              <p className="font-label-badge text-label-badge text-text-secondary">
                Secretaria Municipal de Saúde
              </p>
              <p>Parnaíba/PI • SUS Brasil</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <div className="pl-layout-sidebar-width min-h-screen flex-1 flex flex-col">
        {/* HEADER SUPERIOR */}
        <header className="fixed top-0 right-0 left-layout-sidebar-width h-layout-header-height bg-surface-container-lowest border-b border-border-crisp z-40 px-space-md flex items-center justify-between">
          <div className="flex items-center gap-space-md">
            <span className="text-text-tertiary font-caption-micro text-caption-micro">
              Administração /{" "}
              <strong className="text-text-primary">
                Usuários &amp; Perfis
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-space-md">
            <div className="hidden lg:flex items-center gap-space-xs px-2.5 py-1 rounded bg-surface-subtle border border-border-crisp">
              <span className="material-symbols-outlined text-[18px] text-primary-container">
                verified_user
              </span>
              <span className="font-label-caps text-label-caps text-primary uppercase font-headline-md text-headline-md">
                {userRoleLabel}
              </span>
            </div>

            <div className="flex items-center gap-space-xs">
              <div className="text-right hidden sm:block">
                <p className="font-body-md-medium text-body-md-medium text-text-primary leading-none">
                  {userNome}
                </p>
                <p className="font-caption-micro text-caption-micro text-text-tertiary mt-1">
                  {userEmail}
                </p>
              </div>
              <div
                className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-body-md-medium text-caption-micro"
                title={userNome}
              >
                {userNome.charAt(0).toUpperCase()}
              </div>

              <button
                type="button"
                onClick={() => {
                  logout("Sessão finalizada pelo usuário.");
                  navigate("/login");
                }}
                className="p-1.5 text-text-tertiary hover:text-error hover:bg-error-container/20 rounded-lg transition-colors ml-1"
                title="Sair do FarmaUBS"
                aria-label="Sair do FarmaUBS"
              >
                <span className="material-symbols-outlined text-[20px]">
                  logout
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* CONTEÚDO PRINCIPAL */}
        <main
          className="relative pt-layout-header-height flex-1 bg-canvas-bg"
          role="main"
        >
          <div className="px-space-md py-space-md space-y-space-md max-w-7xl mx-auto w-full">
            {/* TOPO: TÍTULO E BOTÃO NOVO USUÁRIO */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-space-md bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-border-crisp/30">
              <div>
                <h1 className="font-headline-lg text-headline-lg text-text-primary">
                  Gestão de Usuários e Perfis
                </h1>
                <p className="font-body-md text-body-md text-text-secondary mt-1">
                  Controle centralizado de credenciais, papéis de acesso (RBAC)
                  e topologia do sistema FarmaUBS.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  id="btnOpenUserModal"
                  onClick={handleOpenCreateModal}
                  className="px-3.5 py-2 rounded-lg bg-primary-container text-on-primary font-body-md-medium text-body-md hover:bg-primary transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    person_add
                  </span>
                  <span>+ Novo Usuário</span>
                </button>
              </div>
            </div>

            {/* BARRA DE ABAS */}
            <div className="bg-surface-container-lowest p-1 rounded-xl shadow-sm flex items-center gap-1 overflow-x-auto border border-border-crisp/30">
              <button
                type="button"
                id="tabUsersBtn"
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-body-md-medium text-body-md transition-colors bg-primary-container text-on-primary shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">
                  manage_accounts
                </span>
                <span>Gestão de Usuários &amp; Perfis</span>
                <span className="ml-1.5 px-2 py-0.5 rounded-full text-caption-micro bg-on-primary/20 text-on-primary font-caption-micro">
                  {totalUsuarios}
                </span>
              </button>
              <button
                type="button"
                id="tabUbsBtn"
                onClick={() =>
                  showToast(
                    "Topologia UBS",
                    "Módulo de Unidades Básicas em visualização rápida.",
                  )
                }
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-body-md-medium text-body-md transition-colors text-text-secondary hover:bg-surface-subtle"
              >
                <span className="material-symbols-outlined text-[18px]">
                  domain
                </span>
                <span>Unidades Básicas de Saúde</span>
              </button>
            </div>

            {/* BARRA DE BUSCA E FILTROS */}
            <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-space-md border border-border-crisp/30">
              <div className="flex flex-1 flex-wrap md:flex-nowrap items-center gap-3 w-full">
                <div className="relative flex-1 min-w-[240px]">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-[20px]">
                    search
                  </span>
                  <input
                    id="userSearchInput"
                    type="text"
                    value={buscaInput}
                    onChange={(e) => setBuscaInput(e.target.value)}
                    placeholder="Buscar por nome, e-mail institucional, CPF ou CRF..."
                    className="w-full pl-9 pr-3 py-2 bg-surface-subtle rounded-lg text-body-md font-body-md text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary-container transition-all"
                  />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                  <select
                    id="roleFilterSelect"
                    value={filtroPerfil}
                    onChange={(e) => {
                      setFiltroPerfil(e.target.value);
                      setPaginaAtual(1);
                    }}
                    className="py-2 px-3 bg-surface-subtle rounded-lg text-body-md font-body-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-container"
                    aria-label="Filtrar por Perfil"
                  >
                    <option value="ALL">Todos os Perfis</option>
                    <option value={PerfilCodigo.FARMACEUTICO_RESPONSAVEL}>
                      Farmacêutico Responsável
                    </option>
                    <option value={PerfilCodigo.FARMACEUTICO_RESIDENTE}>
                      Farmacêutico Residente
                    </option>
                    <option value={PerfilCodigo.GESTOR}>
                      Gestor de Unidade
                    </option>
                    <option value={PerfilCodigo.ADMINISTRADOR}>
                      Administrador Geral SMS
                    </option>
                  </select>

                  <select
                    id="ubsFilterSelect"
                    value={filtroMunicipio}
                    onChange={(e) => {
                      setFiltroMunicipio(e.target.value);
                      setPaginaAtual(1);
                    }}
                    className="py-2 px-3 bg-surface-subtle rounded-lg text-body-md font-body-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-container"
                    aria-label="Filtrar por Município"
                  >
                    <option value="ALL">Todos os Municípios</option>
                    {municipios.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome} - {m.uf}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="p-2 text-text-tertiary hover:text-text-primary rounded-lg hover:bg-surface-subtle transition-colors"
                    title="Limpar filtros"
                    aria-label="Limpar filtros"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      filter_alt_off
                    </span>
                  </button>
                </div>
              </div>

              <div className="text-caption-micro font-caption-micro text-text-tertiary whitespace-nowrap self-end md:self-center">
                Exibindo{" "}
                <span className="font-body-md-medium text-text-primary">
                  {usuarios.length}
                </span>{" "}
                de{" "}
                <span className="font-body-md-medium text-text-primary">
                  {totalUsuarios}
                </span>{" "}
                usuários
              </div>
            </div>

            {/* TABELA DE USUÁRIOS */}
            <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border border-border-crisp/30">
              <div className="overflow-x-auto">
                <table
                  className="w-full text-left border-collapse"
                  aria-label="Tabela de Usuários do Sistema"
                >
                  <thead>
                    <tr className="bg-surface-subtle text-text-tertiary font-label-caps text-label-caps uppercase h-10 border-b border-border-crisp/20">
                      <th scope="col" className="px-4 py-2 font-label-caps">
                        Profissional / Identificação
                      </th>
                      <th scope="col" className="px-4 py-2 font-label-caps">
                        Perfil / Papel RBAC
                      </th>
                      <th scope="col" className="px-4 py-2 font-label-caps">
                        UBS Vinculada
                      </th>
                      <th scope="col" className="px-4 py-2 font-label-caps">
                        Status Conta
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-2 font-label-caps text-right"
                      >
                        Ações Regulatórias
                      </th>
                    </tr>
                  </thead>
                  <tbody
                    id="usersTableBody"
                    className="font-body-md text-body-md text-text-primary divide-y divide-border-crisp/20"
                  >
                    {isLoading ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-center text-text-tertiary"
                        >
                          <div className="flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined animate-spin text-[20px]">
                              progress_activity
                            </span>
                            <span>Carregando usuários...</span>
                          </div>
                        </td>
                      </tr>
                    ) : isError ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-center text-error"
                        >
                          Não foi possível carregar os usuários. Tente novamente
                          mais tarde.
                        </td>
                      </tr>
                    ) : usuarios.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-12 text-center text-text-tertiary"
                        >
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <span className="material-symbols-outlined text-[36px] text-text-tertiary/60">
                              person_off
                            </span>
                            <p className="font-body-md-medium text-text-secondary">
                              Nenhum usuário cadastrado no sistema
                            </p>
                            <p className="font-caption-micro text-text-tertiary max-w-sm">
                              Clique no botão &quot;+ Novo Usuário&quot; acima
                              para cadastrar o primeiro profissional ou
                              administrador.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      usuarios.map((u) => {
                        // RF001 / RF025: Prevenção de auto-inativação
                        const isSelf =
                          (loggedUser?.id && u.id === loggedUser.id) ||
                          (loggedUser?.email &&
                            u.email.toLowerCase() ===
                              loggedUser.email.toLowerCase());

                        const primeiraLetra = u.nomeCompleto
                          ? u.nomeCompleto.charAt(0).toUpperCase()
                          : "U";

                        return (
                          <tr
                            key={u.id}
                            className={`hover:bg-surface-subtle/70 transition-colors ${
                              isSelf ? "bg-primary-container/5" : ""
                            }`}
                          >
                            {/* Identificação */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary-container font-headline-md text-headline-md flex items-center justify-center flex-shrink-0">
                                  {primeiraLetra}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-body-md-medium text-text-primary truncate flex items-center gap-1.5">
                                    <span>{u.nomeCompleto}</span>
                                    {isSelf && (
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-label-caps bg-primary/15 text-primary">
                                        Você
                                      </span>
                                    )}
                                  </p>
                                  <p className="font-caption-micro text-caption-micro text-text-tertiary truncate">
                                    {u.email}
                                  </p>
                                  {(u.crf || u.cpf) && (
                                    <p className="font-caption-micro text-caption-micro text-text-secondary truncate">
                                      {u.crf ? `CRF ${u.crf}` : ""}
                                      {u.crf && u.cpf ? " • " : ""}
                                      {u.cpf ? `CPF ${u.cpf}` : ""}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Perfil */}
                            <td className="px-4 py-3">
                              {renderPerfilBadge(u.perfilCodigo, u.perfilNome)}
                            </td>

                            {/* UBS */}
                            <td className="px-4 py-3">
                              {u.unidades && u.unidades.length > 0 ? (
                                <div className="flex flex-col">
                                  <span className="font-body-md-medium text-text-secondary truncate">
                                    {u.unidades[0].nome}
                                  </span>
                                  {u.unidades[0].cnes && (
                                    <span className="font-caption-micro text-text-tertiary">
                                      CNES {u.unidades[0].cnes}
                                    </span>
                                  )}
                                  {u.unidades.length > 1 && (
                                    <span className="text-caption-micro text-primary font-caption-micro">
                                      +{u.unidades.length - 1} outra(s)
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="font-caption-micro text-text-tertiary">
                                  Acesso Global SMS
                                </span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3">
                              {u.ativo ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-status-optimal-bg text-status-optimal-fg font-label-badge text-label-badge">
                                  <span className="w-1.5 h-1.5 rounded-full bg-status-optimal-fg" />
                                  Ativo
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-subtle text-text-tertiary font-label-badge text-label-badge">
                                  <span className="w-1.5 h-1.5 rounded-full bg-text-tertiary" />
                                  Inativo
                                </span>
                              )}
                            </td>

                            {/* Ações */}
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(u)}
                                  className="p-1.5 hover:bg-surface-subtle text-text-secondary hover:text-primary rounded transition-colors"
                                  title="Editar Usuário"
                                  aria-label={`Editar ${u.nomeCompleto}`}
                                >
                                  <span className="material-symbols-outlined text-[18px]">
                                    edit
                                  </span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleResetPassword(u)}
                                  disabled={redefinirSenhaMutation.isPending}
                                  className="p-1.5 hover:bg-surface-subtle text-text-secondary hover:text-primary rounded transition-colors"
                                  title="Redefinir Senha Provisória (RF003)"
                                  aria-label={`Redefinir senha de ${u.nomeCompleto}`}
                                >
                                  <span className="material-symbols-outlined text-[18px]">
                                    key
                                  </span>
                                </button>

                                {isSelf ? (
                                  <button
                                    type="button"
                                    disabled
                                    className="p-1.5 text-text-tertiary opacity-40 cursor-not-allowed rounded"
                                    title="Você não pode inativar sua própria conta"
                                    aria-label="Você não pode inativar sua própria conta"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">
                                      block
                                    </span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setUserToInactivate(u)}
                                    className={`p-1.5 rounded transition-colors ${
                                      u.ativo
                                        ? "hover:bg-error-container text-error"
                                        : "hover:bg-status-optimal-bg text-status-optimal-fg"
                                    }`}
                                    title={
                                      u.ativo
                                        ? "Inativar Usuário"
                                        : "Reativar Usuário"
                                    }
                                    aria-label={
                                      u.ativo
                                        ? `Inativar ${u.nomeCompleto}`
                                        : `Reativar ${u.nomeCompleto}`
                                    }
                                  >
                                    <span className="material-symbols-outlined text-[18px]">
                                      {u.ativo ? "block" : "check_circle"}
                                    </span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              <div className="px-4 py-3 border-t border-border-crisp/20 flex items-center justify-between bg-surface-container-lowest">
                <p className="text-caption-micro text-text-tertiary">
                  Página{" "}
                  <strong className="text-text-primary">{paginaAtual}</strong>{" "}
                  de <strong className="text-text-primary">{totalPages}</strong>
                </p>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={paginaAtual <= 1}
                    onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg bg-surface-subtle text-text-secondary hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed text-caption-micro font-body-md-medium transition-colors"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    disabled={paginaAtual >= totalPages}
                    onClick={() =>
                      setPaginaAtual((p) => Math.min(totalPages, p + 1))
                    }
                    className="px-3 py-1.5 rounded-lg bg-surface-subtle text-text-secondary hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed text-caption-micro font-body-md-medium transition-colors"
                  >
                    Próximo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* MODAL DE CADASTRO / EDIÇÃO */}
      <UsuarioModalForm
        isOpen={isModalOpen}
        usuarioParaEditar={usuarioParaEditar}
        onClose={() => {
          setIsModalOpen(false);
          setUsuarioParaEditar(null);
        }}
        onSuccess={(nome) => {
          showToast(
            usuarioParaEditar
              ? "Usuário Atualizado com Sucesso"
              : "Usuário Cadastrado com Sucesso",
            usuarioParaEditar
              ? `Os dados de ${nome} foram atualizados com sucesso.`
              : `O profissional ${nome} foi cadastrado e as credenciais foram emitidas.`,
          );
        }}
      />

      {/* MODAL DE CONFIRMAÇÃO DE INATIVAÇÃO */}
      <ConfirmarInativacaoModal
        isOpen={Boolean(userToInactivate)}
        usuario={userToInactivate}
        onClose={() => setUserToInactivate(null)}
        onConfirm={handleConfirmStatusChange}
        isLoading={alterarStatusMutation.isPending}
      />

      {/* TOAST DE FEEDBACK REGULATÓRIO */}
      {toast.visible && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 animate-bounce"
        >
          <div
            className={`px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 border ${
              toast.type === "error"
                ? "bg-error text-on-error border-error-container"
                : "bg-primary text-on-primary border-primary-container"
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">
              {toast.type === "error" ? "error" : "check_circle"}
            </span>
            <div>
              <p className="font-body-md-medium leading-none">{toast.title}</p>
              <p className="font-caption-micro opacity-90 mt-0.5">
                {toast.message}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
