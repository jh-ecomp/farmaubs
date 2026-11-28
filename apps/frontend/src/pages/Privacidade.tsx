import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import logoFarmaUbs from "../assets/logofarmaubs.svg";

/**
 * [NF010 / ADR-006 / ADR-018 / ADR-032 / RL-07]: Página pública de Política de Privacidade e Proteção de Dados (LGPD).
 */
export default function Privacidade() {
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
                to="/termos"
                className="text-blue-900 underline underline-offset-4 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900"
              >
                Termos de Uso
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
              Transparência e Conformidade LGPD
            </p>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">
              Política de Privacidade e Proteção de Dados
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              FarmaUBS — Sistema de Gestão de Assistência Farmacêutica para Unidades Básicas de Saúde (SUS)
            </p>
          </div>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">
              1. Finalidade e Base Legal (LGPD)
            </h2>
            <p className="text-sm leading-relaxed text-slate-700">
              O FarmaUBS trata dados pessoais estritamente necessários para a execução de políticas públicas de assistência farmacêutica no âmbito do Sistema Único de Saúde (SUS), a tutela da saúde e o cumprimento de obrigações legais e regulatórias sanitárias, em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD, arts. 7º, II e III, e 11, II, &ldquo;a&rdquo;, &ldquo;b&rdquo; e &ldquo;f&rdquo;).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">
              2. Dados Tratados e Isolamento Multi-Tenant
            </h2>
            <p className="text-sm leading-relaxed text-slate-700">
              São registrados apenas os dados indispensáveis à rastreabilidade de medicamentos e dispensações: identificação funcional dos operadores autorizados (nome, e-mail institucional, perfil de acesso e vínculo de UBS) e identificação do usuário SUS atendido (nome, CPF e/ou Cartão Nacional de Saúde — CNS), além dos dados sanitários de lote, validade e prescrição quando exigidos pela legislação aplicável.
            </p>
            <p className="text-sm leading-relaxed text-slate-700">
              Os registros de cada município permanecem segregados no banco de dados mediante políticas de segurança em nível de linha (<em>Row-Level Security</em>) e controle de acesso baseado em papéis (RBAC). Dados sensíveis e credenciais são automaticamente mascarados nos registros técnicos de observabilidade.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">
              3. Uso Estrito de Cookies de Sessão (HttpOnly)
            </h2>
            <p className="text-sm leading-relaxed text-slate-700">
              Esta aplicação utiliza exclusivamente o cookie técnico estritamente necessário{" "}
              <code className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-900 font-mono text-xs">
                farmaubs_session
              </code>
              , configurado com os atributos{" "}
              <code className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-900 font-mono text-xs">
                HttpOnly
              </code>
              ,{" "}
              <code className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-900 font-mono text-xs">
                Secure
              </code>{" "}
              e{" "}
              <code className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-900 font-mono text-xs">
                SameSite=Lax
              </code>{" "}
              para manter a sessão autenticada do profissional e protegê-la contra acesso via scripts maliciosos. Não utilizamos cookies publicitários, de perfilamento comportamental ou rastreadores de terceiros.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">
              4. Retenção Regulatória e Rastreabilidade Sanitária
            </h2>
            <p className="text-sm leading-relaxed text-slate-700">
              Os registros de movimentação de estoque, recebimentos, dispensações de antimicrobianos (RDC Anvisa nº 471/2021), medicamentos sujeitos a controle especial (Portaria SVS/MS nº 344/1998) e trilhas de auditoria são preservados pelos prazos legais exigidos pelos órgãos de controle sanitário e de contas públicas. Sessões expiradas e arquivos temporários de exportação são expurgados periodicamente de forma automatizada.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">
              5. Direitos do Titular e Contato Institucional
            </h2>
            <p className="text-sm leading-relaxed text-slate-700">
              Solicitações relativas aos direitos previstos no art. 18 da LGPD (confirmação de tratamento, acesso e correção de dados cadastrais inexatos, respeitadas as hipóteses legais de guarda sanitária obrigatória) devem ser encaminhadas à Secretaria Municipal de Saúde / Coordenação de Assistência Farmacêutica (CAF) responsável pela respectiva unidade de saúde.
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
