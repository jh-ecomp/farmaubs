import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import logoFarmaUbs from "../assets/logofarmaubs.svg";

/**
 * [NF009 / NF010 / ADR-032 / RL-07]: Página pública de Termos de Uso e Responsabilidade Operacional.
 */
export default function Termos() {
  const { isAuthenticated } = useAuth();
  const rotaRetorno = isAuthenticated ? "/dashboard" : "/login";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src={logoFarmaUbs}
              alt="Logo FarmaUBS"
              className="h-10 w-auto"
            />
          </div>
          <nav aria-label="Links institucionais">
            <div className="flex items-center gap-4 text-sm font-medium">
              <Link
                to="/privacidade"
                className="text-blue-900 underline underline-offset-4 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900"
              >
                Política de Privacidade
              </Link>
              <Link
                to={rotaRetorno}
                className="inline-flex items-center px-3.5 py-2 rounded-lg bg-blue-950 text-white hover:bg-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-950"
              >
                {isAuthenticated ? "Voltar ao Painel" : "Voltar ao Login"}
              </Link>
            </div>
          </nav>
        </header>

        <main className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-900">
              Governança e Uso Institucional
            </p>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">
              Termos de Uso do Sistema FarmaUBS
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Condições operacionais para profissionais e gestores vinculados às Unidades Básicas de Saúde
            </p>
          </div>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">
              1. Acesso Restrito e Credenciais Pessoais
            </h2>
            <p className="text-sm leading-relaxed text-slate-700">
              O acesso ao FarmaUBS é restrito a farmacêuticos, residentes, gerentes e administradores formalmente cadastrados e autorizados pela gestão municipal de saúde. As credenciais de autenticação são pessoais e intransferíveis, devendo a senha provisória inicial ser obrigatoriamente substituída no primeiro acesso.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">
              2. Integridade de Registros e Rastreabilidade (FEFO e Estornos)
            </h2>
            <p className="text-sm leading-relaxed text-slate-700">
              Todas as entradas de lotes, dispensações, ajustes de inventário e estornos são vinculados de forma imutável ao operador autenticado, à Unidade Básica de Saúde ativa e ao carimbo de tempo oficial (fuso horário civil brasileiro). Correções operacionais devem ser efetuadas exclusivamente pelas rotinas formais de estorno ou ajuste justificadas no sistema.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">
              3. Sigilo Profissional e Proteção de Dados
            </h2>
            <p className="text-sm leading-relaxed text-slate-700">
              O usuário compromete-se a observar o sigilo ético-profissional sobre os dados clínicos e cadastrais de pacientes acessados na plataforma, abstendo-se de exportar, compartilhar ou reproduzir relatórios fora das atribuições institucionais da assistência farmacêutica municipal.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">
              4. Disponibilidade e Limitações de Responsabilidade Operacional
            </h2>
            <p className="text-sm leading-relaxed text-slate-700">
              O FarmaUBS apoia o controle logístico e a ordenação FEFO (<em>First Expired, First Out</em>), não substituindo a conferência física do medicamento, do número de lote, da integridade da embalagem e da avaliação farmacêutica da prescrição no ato da dispensação presencial ao paciente.
            </p>
          </section>
        </main>

        <footer className="mt-6 text-center text-xs text-slate-600">
          Sistema Integrado de Gestão Farmacêutica • SUS
        </footer>
      </div>
    </div>
  );
}
