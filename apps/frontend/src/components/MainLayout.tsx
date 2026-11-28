import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { UserMenu } from "./UserMenu";

interface MainLayoutProps {
  children?: ReactNode;
  titulo?: string;
}

/**
 * [NF001 / NF002 / ADR-032 / ADR-034 / RL-07]: Layout padrão autenticado com Sidebar fixa em desktop (>= 1024px)
 * e drawer modal nativo (<dialog>) em tablets e telas menores (< 1024px).
 */
export function MainLayout({ children, titulo }: MainLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  const openDrawer = () => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      dialog.setAttribute("open", "");
    }
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    const dialog = dialogRef.current;
    if (dialog) {
      if (typeof dialog.close === "function" && dialog.open) {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    }
    setDrawerOpen(false);
  };

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        closeDrawer();
      }
    };
    mediaQuery.addEventListener("change", handleViewportChange);
    return () => mediaQuery.removeEventListener("change", handleViewportChange);
  }, []);

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (sheetRef.current && !sheetRef.current.contains(event.target as Node)) {
      closeDrawer();
    }
  };

  return (
    <div className="bg-canvas-bg font-body-md text-body-md text-on-surface antialiased min-h-screen flex">
      <Sidebar variant="desktop" />

      {/* Drawer modal nativo para viewports abaixo de lg (< 1024px) */}
      <dialog
        ref={dialogRef}
        id="mobile-nav-drawer"
        aria-label="Menu principal"
        onClose={() => setDrawerOpen(false)}
        onClick={handleBackdropClick}
        className="lg:hidden m-0 p-0 max-w-none max-h-none w-full h-full bg-transparent border-0 backdrop:bg-slate-900/50"
      >
        <div ref={sheetRef} className="w-fit h-full">
          {drawerOpen && (
            <Sidebar
              variant="drawer"
              onNavigate={closeDrawer}
              onCloseDrawer={closeDrawer}
            />
          )}
        </div>
      </dialog>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="min-h-16 pt-[1.5vh] pb-3 px-4 sm:px-6 h-layout-header-height bg-surface-container-lowest border-b border-border-crisp px-space-md flex items-center justify-between gap-3 sticky top-0 z-40">
          <div className="flex items-center gap-2 gap-space-xs min-w-0">
            <button
              type="button"
              onClick={openDrawer}
              aria-label="Abrir menu de navegação"
              aria-expanded={drawerOpen}
              aria-controls="mobile-nav-drawer"
              className="lg:hidden inline-flex items-center justify-center min-w-10 min-h-10 rounded-lg text-text-secondary hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary shrink-0"
            >
              <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                menu
              </span>
            </button>

            <div className="flex items-center gap-2 gap-space-xs text-text-tertiary font-caption-micro truncate">
              <span className="hidden sm:inline">FarmaUBS</span>
              <span className="hidden sm:inline" aria-hidden="true">/</span>
              <strong className="text-text-primary truncate">
                {titulo || "Painel Geral"}
              </strong>
            </div>
          </div>

          <UserMenu />
        </header>

        <main className="flex-1 p-4 sm:p-6 p-space-md overflow-y-auto">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
