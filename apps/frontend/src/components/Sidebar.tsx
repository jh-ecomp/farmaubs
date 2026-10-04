import { Link, useLocation } from "react-router-dom";
import { PerfilCodigo, MATRIZ_PERMISSOES_ROTAS } from "@farmaubs/shared";
import { useAuth } from "../contexts/AuthContext";
import iconeFarmaUbs from "../assets/iconefarmaubs.svg";

interface MenuItem {
  label: string;
  path: string;
  icon: string;
  allowedRoles: PerfilCodigo[];
  grupo?: "operacional" | "gestao" | "governanca";
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
    label: "Estoque",
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
  },
  // Gestão
  {
    label: "Relatórios",
    path: "/relatorios",
    icon: "description",
    allowedRoles: MATRIZ_PERMISSOES_ROTAS["/relatorios"],
    grupo: "gestao",
  },
  {
    label: "Parâmetros",
    path: "/parametros",
    icon: "tune",
    allowedRoles: MATRIZ_PERMISSOES_ROTAS["/parametros"],
    grupo: "gestao",
  },
  // Governança & Admin
  {
    label: "Auditoria (Logs)",
    path: "/log-auditoria",
    icon: "history_toggle_off",
    allowedRoles: MATRIZ_PERMISSOES_ROTAS["/log-auditoria"],
    grupo: "governanca",
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
  },
];

/**
 * [NF009 / ADR-006 / ADR-032]: Barra lateral de navegação com renderização condicional de links por perfil RBAC.
 * Itens não autorizados NÃO são renderizados no DOM.
 */
export function Sidebar() {
  const { hasRole } = useAuth();
  const location = useLocation();

  // Filtra rigorosamente os itens de menu permitidos para o perfil logado
  const visibleItems = MENU_ITEMS.filter((item) => hasRole(item.allowedRoles));

  const grupos = [
    { id: "operacional", label: "Operação UBS" },
    { id: "gestao", label: "Gestão & Controle" },
    { id: "governanca", label: "Governança & Admin" },
  ] as const;

  return (
    <aside
      className="h-screen w-layout-sidebar-width bg-surface-container-lowest border-r border-border-crisp flex flex-col justify-between select-none shrink-0"
      aria-label="Navegação Lateral"
    >
      <div className="flex flex-col flex-1 min-h-0">
        {/* Cabeçalho do FarmaUBS */}
        <div className="h-layout-header-height px-space-md border-b border-border-crisp flex items-center justify-between bg-surface-container-lowest shrink-0">
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

        {/* Links de Navegação Agrupados */}
        <nav
          className="flex-1 overflow-y-auto px-space-xs py-space-sm space-y-space-md"
          aria-label="Menu Principal"
        >
          {grupos.map((grupo) => {
            const itemsDoGrupo = visibleItems.filter(
              (item) => item.grupo === grupo.id,
            );
            if (itemsDoGrupo.length === 0) return null;

            return (
              <div key={grupo.id} className="space-y-space-xxs pt-space-xs">
                <div className="px-space-xs py-1 text-text-tertiary font-label-caps text-label-caps uppercase tracking-wider">
                  {grupo.label}
                </div>
                <div className="space-y-0.5">
                  {itemsDoGrupo.map((item) => {
                    const isActive =
                      location.pathname === item.path ||
                      (item.path === "/usuarios" &&
                        location.pathname.startsWith("/admin/usuarios"));

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        aria-current={isActive ? "page" : undefined}
                        className={`flex items-center gap-space-xs px-space-xs py-2 rounded-lg font-body-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
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
          <div>
            <p className="font-label-badge text-label-badge text-text-secondary">
              Secretaria Municipal de Saúde
            </p>
            <p>Parnaíba/PI • SUS Brasil</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
