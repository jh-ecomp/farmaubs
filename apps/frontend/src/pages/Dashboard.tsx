import { Link } from "react-router-dom";
import { MainLayout } from "../components/MainLayout";
import { useAuth } from "../contexts/AuthContext";
import { isFutureModulesEnabled } from "../utils/featureFlags";

/**
 * [RF002 / NF001 / RL-07]: Painel principal / Dashboard operacional do FarmaUBS.
 */
export default function Dashboard() {
  const { usuario } = useAuth();
  const showFuture = isFutureModulesEnabled();

  return (
    <MainLayout titulo="Dashboard Operacional">
      <div className="space-y-space-md">
        <div className="bg-surface-container-lowest border border-border-crisp rounded-xl p-space-lg shadow-sm">
          <h1 className="font-headline-md text-headline-md text-text-primary">
            Bem-vindo(a), {usuario?.nomeCompleto || usuario?.nome || "Profissional"}!
          </h1>
          <p className="font-body-md text-body-md text-text-secondary mt-1">
            Sistema Integrado de Gestão Farmacêutica — Rede Municipal de Saúde (SUS)
          </p>
        </div>

        <div className={`grid grid-cols-1 ${showFuture ? "md:grid-cols-3" : "md:grid-cols-2"} gap-space-md`}>
          <Link
            to="/estoque"
            className="bg-surface-container-lowest border border-border-crisp rounded-xl p-space-md shadow-sm hover:border-primary transition-colors block"
          >
            <div className="flex items-center gap-space-xs text-primary mb-2">
              <span className="material-symbols-outlined text-[24px]" aria-hidden="true">inventory_2</span>
              <h2 className="font-title-sm text-title-sm text-text-primary">Recebimento e Estoque</h2>
            </div>
            <p className="font-body-md text-text-secondary text-caption-micro">
              Controle de lotes, validades e entradas de medicamentos.
            </p>
          </Link>

          <Link
            to="/dispensas"
            className="bg-surface-container-lowest border border-border-crisp rounded-xl p-space-md shadow-sm hover:border-primary transition-colors block"
          >
            <div className="flex items-center gap-space-xs text-primary mb-2">
              <span className="material-symbols-outlined text-[24px]" aria-hidden="true">medication</span>
              <h2 className="font-title-sm text-title-sm text-text-primary">Dispensas</h2>
            </div>
            <p className="font-body-md text-text-secondary text-caption-micro">
              Registro ágil e consulta de dispensações a pacientes do SUS.
            </p>
          </Link>

          {showFuture && (
            <Link
              to="/indicadores"
              className="bg-surface-container-lowest border border-border-crisp rounded-xl p-space-md shadow-sm hover:border-primary transition-colors block"
            >
              <div className="flex items-center gap-space-xs text-primary mb-2">
                <span className="material-symbols-outlined text-[24px]" aria-hidden="true">analytics</span>
                <h2 className="font-title-sm text-title-sm text-text-primary">Indicadores</h2>
              </div>
              <p className="font-body-md text-text-secondary text-caption-micro">
                Métricas de consumo, curva ABC e taxa de cobertura da UBS.
              </p>
            </Link>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
