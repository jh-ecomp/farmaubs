import { Link, useLocation } from "react-router-dom";
import { PerfilCodigo, MATRIZ_PERMISSOES_ROTAS } from "@farmaubs/shared";
import { useAuth } from "../contexts/AuthContext";
import type { UsuarioPayload } from "../types/auth";
import { isFutureModulesEnabled } from "../utils/featureFlags";
import iconeFarmaUbs from "../assets/iconefarmaubs.svg";

interface MenuItem {
  label: string;
  path: string;
  icon: string;
  allowedRoles: PerfilCodigo[];
  grupo: "operacional" | "gestao" | "governanca";
  futureModule?: boolean;
}

export interface SidebarProps {
  variant?: "desktop" | "drawer";
  showFutureModules?: boolean;
  onNavigate?: () => void;
  onCloseDrawer?: () => void;
}

const MENU_ITEMS: MenuItem[] = [
  // Operacional
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: "dashboard",
    allowedRoles: MATRIZ_PERMISSOES_ROTAS["/dashboard"],
    grupo: "operacional",
  },
  {
    label: "Recebimento",
    path: "/estoque",
    icon: "inventory_2",
    allowedRoles: MATRIZ_PERMISSOES_ROTAS["/estoque"],
    grupo: "operacional",
  },
  {
    label: "Dispensas",
    path: "/dispensas",
    icon: "medication",
    allowedRoles: MATRIZ_PERMISSOES_ROTAS["/dispensas"],
    grupo: "operacional",
  },
  {
    label: "Indicadores",
    path: "/indicadores",
    icon: "analytics",
    allowedRoles: MATRIZ_PERMISSOES_ROTAS["/indicadores"],
    grupo: "operacional",
    futureModule: true,
  },
  // Gestão
  {
    label: "Relatórios",
    path: "/relatorios",
    icon: "description",
    allowedRoles: MATRIZ_PERMISSOES_ROTAS["/relatorios"],
    grupo: "gestao",
    futureModule: true,
  },
  {
    label: "Parâmetros",
    path: "/parametros",
    icon: "tune",
    allowedRoles: MATRIZ_PERMISSOES_ROTAS["/parametros"],
    grupo: "gestao",
    futureModule: true,
  },
  // Governança & Admin
  {
    label: "Auditoria (Logs)",
    path: "/log-auditoria",
    icon: "history_toggle_off",
    allowedRoles: MATRIZ_PERMISSOES_ROTAS["/log-auditoria"],
    grupo: "governanca",
    futureModule: true,
  },
  {
    label: "Gestão de Usuários",
    path: "/usuarios",
    icon: "admin_panel_settings",
    allowedRoles: MATRIZ_PERMISSOES_ROTAS["/usuarios"],
    grupo: "governanca",
  },
  {
    label: "Gestão de UBS",
    path: "/ubs",
    icon: "local_hospital",
    allowedRoles: MATRIZ_PERMISSOES_ROTAS["/ubs"],
    grupo: "governanca",
    futureModule: true,
  },
];

/**
 * [RL-07]: Resolve o subtítulo institucional dinâmico a partir do contexto autenticado,
 * eliminando qualquer município hardcoded no código.
 */
function resolverContextoInstitucional(usuario: UsuarioPayload | null): string {
  if (usuario?.unidadeNome && usuario.unidadeNome.trim().length > 0) {
    return usuario.unidadeNome.trim();
  }
  if (usuario?.municipioNome && usuario.municipioNome.trim().length > 0) {
    const mun = usuario.municipioNome.trim();
    const uf = usuario.municipioUf?.trim().toUpperCase();
    return uf ? `SMS ${mun}/${uf}` : `SMS ${mun}`;
  }
  return "Gestão Farmacêutica SUS";
}

/**
 * [NF002 / NF009 / ADR-006 / ADR-032 / RL-07]: Barra lateral de navegação com RBAC estrito,
 * subtítulo dinâmico por tenant/UBS, feature flag de módulos futuros e variante responsiva de drawer.
 */
export function Sidebar({
  variant = "desktop",
  showFutureModules,
  onNavigate,
  onCloseDrawer,
}: SidebarProps = {}) {
  const { hasRole, usuario } = useAuth();
  const location = useLocation();

  const exibirFuturos = isFutureModulesEnabled(showFutureModules);
  const subtituloInstitucional = resolverContextoInstitucional(usuario);

  const visibleItems = MENU_ITEMS.filter(
    (item) =>
      hasRole(item.allowedRoles) && (!item.futureModule || exibirFuturos),
  );

  const grupos = [
    { id: "operacional", label: "Operação UBS" },
    { id: "gestao", label: "Gestão & Controle" },
    { id: "governanca", label: "Governança & Admin" },
  ] as const;

  const navContent = (
    <>
      <div className="flex flex-col flex-1 min-h-0">
        {/* Cabeçalho do FarmaUBS */}
        <div className="min-h-16 pt-[1.5vh] pb-3 px-4 h-layout-header-height px-space-md border-b border-border-crisp flex items-center justify-between bg-surface-container-lowest shrink-0">
          <div className="flex items-center gap-2.5 gap-space-xs min-w-0">
            <img
              src={iconeFarmaUbs}
              alt="FarmaUBS"
              className="w-8 h-8 object-contain shrink-0"
            />
            <div className="flex flex-col min-w-0">
              <span className="font-title-sm text-title-sm text-primary leading-none tracking-tight">
                FarmaUBS
              </span>
              <span
                className="font-caption-micro text-caption-micro text-text-tertiary uppercase tracking-wider mt-0.5 truncate"
                data-testid="sidebar-contexto-institucional"
              >
                {subtituloInstitucional}
              </span>
            </div>
          </div>

          {variant === "drawer" ? (
            <button
              type="button"
              onClick={onCloseDrawer}
              aria-label="Fechar menu de navegação"
              className="inline-flex items-center justify-center min-w-9 min-h-9 rounded-lg text-text-secondary hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                close
              </span>
            </button>
          ) : (
            <span className="px-1.5 py-0.5 rounded bg-surface-subtle border border-border-crisp text-text-secondary font-label-caps text-label-caps shrink-0">
              SUS
            </span>
          )}
        </div>

        {/* Links de Navegação Agrupados */}
        <nav
          className="flex-1 overflow-y-auto px-3 py-4 px-space-xs py-space-sm space-y-4 space-y-space-md"
          aria-label={variant === "drawer" ? "Menu Móvel" : "Menu Principal"}
        >
          {grupos.map((grupo) => {
            const itemsDoGrupo = visibleItems.filter(
              (item) => item.grupo === grupo.id,
            );
            if (itemsDoGrupo.length === 0) return null;

            return (
              <div
                key={grupo.id}
                className="space-y-1 space-y-space-xxs pt-2 pt-space-xs"
              >
                <div className="px-2.5 px-space-xs py-1 text-text-tertiary font-label-caps text-label-caps uppercase tracking-wider">
                  {grupo.label}
                </div>
                <div className="space-y-0.5">
                  {itemsDoGrupo.map((item) => {
                    const isActive =
                      location.pathname === item.path ||
                      (item.path === "/estoque" &&
                        location.pathname === "/recebimento");

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={onNavigate}
                        aria-current={isActive ? "page" : undefined}
                        className={`flex items-center gap-2.5 gap-space-xs px-3 px-space-xs py-2 rounded-lg font-body-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                          isActive
                            ? "bg-primary-container text-on-primary font-body-md-medium"
                            : "text-text-secondary hover:bg-surface-subtle hover:text-on-surface"
                        }`}
                      >
                        <span
                          className={`material-symbols-outlined text-[20px] ${
                            isActive ? "text-on-primary" : "text-text-tertiary"
                          }`}
                          aria-hidden="true"
                        >
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Rodapé Institucional SUS */}
      <div className="p-space-xs border-t border-border-crisp bg-surface-subtle shrink-0">
        <div className="flex items-center gap-space-xs text-text-tertiary font-caption-micro text-caption-micro leading-snug">
          <span
            className="material-symbols-outlined text-[16px] text-text-tertiary"
            aria-hidden="true"
          >
            local_hospital
          </span>
          <div className="min-w-0">
            <p className="font-label-badge text-label-badge text-text-secondary truncate">
              Secretaria Municipal de Saúde
            </p>
            <p className="truncate">{subtituloInstitucional} • SUS Brasil</p>
          </div>
        </div>
      </div>
    </>
  );

  if (variant === "drawer") {
    return (
      <div className="h-[100svh] w-72 max-w-[85vw] bg-surface-container-lowest border-r border-border-crisp flex flex-col justify-between select-none shadow-xl">
        {navContent}
      </div>
    );
  }

  return (
    <aside
      className="hidden lg:flex h-screen w-64 w-layout-sidebar-width bg-surface-container-lowest border-r border-border-crisp flex-col justify-between select-none shrink-0"
      aria-label="Lateral"
    >
      {navContent}
    </aside>
  );
}

export default Sidebar;
