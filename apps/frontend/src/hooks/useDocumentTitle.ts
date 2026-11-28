import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ROUTE_TITLES: Record<string, string> = {
  "/login": "Login",
  "/trocar-senha": "Trocar Senha",
  "/trocar-senha-obrigatoria": "Troca Obrigatória de Senha",
  "/dashboard": "Dashboard",
  "/estoque": "Controle de Estoque e Recebimento",
  "/recebimento": "Recebimento de Medicamentos",
  "/dispensas": "Dispensação de Medicamentos",
  "/dispensacao": "Dispensação de Medicamentos",
  "/indicadores": "Indicadores Operacionais",
  "/relatorios": "Relatórios e Inventário",
  "/parametros": "Parâmetros do Sistema",
  "/log-auditoria": "Trilha de Auditoria",
  "/usuarios": "Gestão de Usuários",
  "/ubs": "Gestão de UBS",
  "/admin/cadastro": "Cadastro Administrativo",
  "/privacidade": "Política de Privacidade",
  "/termos": "Termos de Uso",
  "/403": "Acesso Negado",
  "/500": "Erro no Servidor",
};

/**
 * [NF003 / ADR-032 / RL-07]: Resolve o título semântico da aba a partir do caminho atual da rota.
 * @param pathname - Caminho da URL ativa no React Router.
 * @returns Título formatado "<Tópico> | FarmaUBS".
 */
export function resolveRouteDocumentTitle(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, "") || "/login";
  const topic = ROUTE_TITLES[normalized] ?? "Página não encontrada";
  return `${topic} | FarmaUBS`;
}

/**
 * [NF003 / ADR-032 / RL-07]: Atualiza document.title dinamicamente conforme o título informado.
 * @param pageTitle - Nome específico da tela (sem o sufixo "| FarmaUBS").
 */
export function useDocumentTitle(pageTitle?: string): void {
  useEffect(() => {
    if (pageTitle && pageTitle.trim().length > 0) {
      document.title = pageTitle.includes("FarmaUBS")
        ? pageTitle.trim()
        : `${pageTitle.trim()} | FarmaUBS`;
    }
  }, [pageTitle]);
}

/**
 * [NF003 / ADR-032 / RL-07]: Observador global de rotas que mantém o título da aba sincronizado em navegações SPA.
 */
export function RouteTitleUpdater(): null {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = resolveRouteDocumentTitle(pathname);
  }, [pathname]);

  return null;
}
