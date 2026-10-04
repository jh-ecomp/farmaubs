import { MainLayout } from "../components/MainLayout";
import { useAuth } from "../contexts/AuthContext";

/**
 * [RF002 / NF001]: Painel principal / Dashboard operacional do FarmaUBS.
 */
export default function Dashboard() {
  const { usuario } = useAuth();

  return (
    <MainLayout titulo="Dashboard Operacional">
      <div className="space-y-space-md">
        <div className="bg-surface-container-lowest border border-border-crisp rounded-xl p-space-lg shadow-sm">
          <h1 className="font-headline-md text-headline-md text-text-primary">
            Bem-vindo(a), {usuario?.nomeCompleto || usuario?.nome || "Profissional"}!
          </h1>
          <p className="font-body-md text-body-md text-text-secondary mt-1">
            Sistema Integrado de Gestão Farmacêutica — FarmaUBS Parnaíba/PI
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
          <div className="bg-surface-container-lowest border border-border-crisp rounded-xl p-space-md shadow-sm">
            <div className="flex items-center gap-space-xs text-primary mb-2">
              <span className="material-symbols-outlined text-[24px]">inventory_2</span>
              <h2 className="font-title-sm text-title-sm text-text-primary">Estoque</h2>
            </div>
            <p className="font-body-md text-text-secondary text-caption-micro">
              Controle de lotes, validades e entradas de medicamentos.
            </p>
          </div>

          <div className="bg-surface-container-lowest border border-border-crisp rounded-xl p-space-md shadow-sm">
            <div className="flex items-center gap-space-xs text-primary mb-2">
              <span className="material-symbols-outlined text-[24px]">medication</span>
              <h2 className="font-title-sm text-title-sm text-text-primary">Dispensas</h2>
            </div>
            <p className="font-body-md text-text-secondary text-caption-micro">
              Registro ágil e consulta de dispensações a pacientes do SUS.
            </p>
          </div>

          <div className="bg-surface-container-lowest border border-border-crisp rounded-xl p-space-md shadow-sm">
            <div className="flex items-center gap-space-xs text-primary mb-2">
              <span className="material-symbols-outlined text-[24px]">analytics</span>
              <h2 className="font-title-sm text-title-sm text-text-primary">Indicadores</h2>
            </div>
            <p className="font-body-md text-text-secondary text-caption-micro">
              Métricas de consumo, curva ABC e taxa de cobertura da UBS.
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
