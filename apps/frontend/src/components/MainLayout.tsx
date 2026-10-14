import type { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { UserMenu } from "./UserMenu";

interface MainLayoutProps {
  children?: ReactNode;
  titulo?: string;
}

/**
 * [NF001 / NF002 / ADR-034]: Layout padrão para telas autenticadas com Sidebar RBAC e Header com UserMenu.
 */
export function MainLayout({ children, titulo }: MainLayoutProps) {
  return (
    <div className="bg-canvas-bg font-body-md text-body-md text-on-surface antialiased min-h-screen flex">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-layout-header-height bg-surface-container-lowest border-b border-border-crisp px-space-md flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-space-xs text-text-tertiary font-caption-micro">
            <span>FarmaUBS</span>
            <span>/</span>
            <strong className="text-text-primary">
              {titulo || "Painel Geral"}
            </strong>
          </div>

          <UserMenu />
        </header>

        <main className="flex-1 p-space-md overflow-y-auto">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
