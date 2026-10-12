Listed directory docs
Listed directory adrs
Listed directory historias-usuario
Listed directory documento-requisitos

Essa é uma das discussões mais maduras e importantes no ciclo de vida de um projeto. A sua percepção sobre a indústria está corretíssima: nos últimos anos, o pêndulo saiu do extremo da burocracia clássica (dezenas de diagramas UML e especificações de 200 páginas que ficam obsoletas na primeira semana) e foi para o extremo oposto do *"o código é a documentação"*, que na prática gera código sem contexto de negócio e decisões arquiteturais esquecidas.

Para encontrar o equilíbrio ideal no **FarmaUBS**, vamos analisar suas dúvidas:

---

### 1. O GitHub Wiki é uma boa opção?

**Geralmente, não.** Para projetos de software ativos, a Wiki do GitHub costuma se tornar um *"cemitério de documentação"*. Os motivos principais:

* **Desconectada do fluxo de código (PRs):** A Wiki é um repositório git à parte. Quando um desenvolvedor altera uma regra de negócio ou adiciona uma variável de ambiente, ele não consegue incluir a atualização da documentação no mesmo Pull Request.
* **Sem versionamento por branch:** A Wiki tem apenas uma versão (a atual). Se você estiver trabalhando em uma branch de uma funcionalidade futura, você não tem uma branch correspondente na wiki.
* **Longe do editor de código:** Desenvolvedores e ferramentas de IA (como assistentes de código e indexadores locais) trabalham direto na pasta do projeto. Ter os arquivos na árvore de diretórios facilita busca, leitura e edição instantânea.

> **Recomendação:** Adotar a abordagem **Docs-as-Code** (documentação como código), mantendo tudo em arquivos Markdown (`.md`) dentro do próprio repositório (ex.: na pasta [`docs/`](file:///c:/Users/jaohe/projetos/farmaubs/docs)), exatamente como você já começou a fazer.

---

### 2. Que tipo de documentação trazer sem exagero nem desleixo?

O código responde muito bem ao **COMO** algo funciona, mas é péssimo para responder **O QUÊ** o sistema deveria fazer (intenção de negócio) e **POR QUÊ** foi feito daquela forma (decisões arquiteturais).

Para um projeto de porte médio/grande como o FarmaUBS, o "kit essencial" moderno é composto por apenas **5 pilares**:

| Pilar | Pergunta que responde | O que colocar | Onde manter |
| :--- | :--- | :--- | :--- |
| **1. Onboarding / Operação** | *"Como começo a rodar isso?"* | Guia rápido de setup local, variáveis de ambiente necessárias e comandos para testar e rodar. | [`README.md`](file:///c:/Users/jaohe/projetos/farmaubs/README.md) na raiz |
| **2. ADRs (Decisões de Arquitetura)** | *"Por que escolhemos X e não Y?"* | Registro de decisões técnicas difíceis (ex.: monorepo, NestJS, estratégia de estoque, PostgreSQL). | [`docs/adrs/`](file:///c:/Users/jaohe/projetos/farmaubs/docs/adrs) *(Você já tem isso muito bem montado!)* |
| **3. Regras de Domínio & Histórias** | *"O que o negócio exige?"* | Critérios de aceite, regras de dispensação, rastreabilidade de lotes e fluxos do usuário. | [`docs/historias-usuario/`](file:///c:/Users/jaohe/projetos/farmaubs/docs/historias-usuario) e [`docs/documento-requisitos/`](file:///c:/Users/jaohe/projetos/farmaubs/docs/documento-requisitos) |
| **4. Glossário de Domínio (Linguagem Ubíqua)** | *"O que significa esse termo?"* | Definições simples do mundo farmacêutico do SUS (ex.: dispensação vs. distribuição, lote, RENAME, perda vs. avaria). | [`docs/GLOSSARIO.md`](file:///c:/Users/jaohe/projetos/farmaubs/docs) |
| **5. Contrato de API Vivo** | *"Como chamo esse endpoint?"* | Parâmetros, retornos e erros de HTTP gerados automaticamente pelo código. | Swagger / OpenAPI gerado direto no backend |

---

### 3. E quanto a diagramas? Como não exagerar?

Em vez de dezenas de diagramas UML de sequência ou classes que ninguém mantém:

1. **Adote o C4 Model (apenas Níveis 1 e 2):**
   * **Nível 1 (Contexto):** Um único diagrama mostrando quem usa o FarmaUBS (farmacêutico, atendente, gestor) e com quais sistemas externos ele fala (se houver, como ConecteSUS ou bases municipais).
   * **Nível 2 (Contêineres):** Um diagrama mostrando onde rodam as peças (Frontend Web/Mobile, API Backend, Banco de Dados PostgreSQL, Redis/Cache).
2. **Faça diagramas em Mermaid (dentro do próprio Markdown):**
   * Não use ferramentas que salvam binários ou exigem desenhar caixinhas manualmente. Com Mermaid, o diagrama é texto puro dentro do `.md`. Qualquer pessoa ou IA altera em segundos.

---

### 4. Qual estilo/estrutura de documentação adotar?

Uma excelente referência de organização na indústria atual é o **framework Diátaxis** (usado por times como Ubuntu, Cloudflare, Astro). Ele propõe dividir a documentação em 4 categorias claras:

1. **Tutoriais (Aprender):** Um guia passo a passo do primeiro setup do projeto para um dev novo.
2. **Guias How-To (Resolver problemas específicos):** *"Como rodar uma migration no banco"*, *"Como criar um novo módulo no backend"*, *"Como seedar dados de teste"*.
3. **Referência (Fatos puros):** Documentação de endpoints (Swagger), lista de variáveis de ambiente (`.env.example` documentado).
4. **Explicação (Entendimento e contexto):** Suas ADRs, a arquitetura hexagonal e o modelo de negócio das farmácias de UBS.

---

### Resumo prático para o FarmaUBS

Você já tem uma base excelente no repositório:
* O diretório [`docs/adrs/`](file:///c:/Users/jaohe/projetos/farmaubs/docs/adrs) com 30+ decisões registradas é padrão ouro na indústria.
* O [`docs/historias-usuario/`](file:///c:/Users/jaohe/projetos/farmaubs/docs/historias-usuario) e o [`ROADMAP_SPRINTS.md`](file:///c:/Users/jaohe/projetos/farmaubs/docs/ROADMAP_SPRINTS.md) cobrem o lado funcional.

**Sugestão de próximos passos pragmáticos:**
1. **Descontinuar a Wiki do GitHub:** Traga o que houver de relevante lá para dentro da pasta `docs/` e desative ou aponte a Wiki para o repositório.
2. **Criar um índice central:** Um arquivo [`docs/README.md`](file:///c:/Users/jaohe/projetos/farmaubs/docs) servindo como sumário amigável para navegar por ADRs, Histórias, Guias e Roadmap.
3. **Criar um `GLOSSARIO.md` curto:** Definir formalmente os conceitos farmacêuticos que impactam as tabelas e regras de negócio.

O que acha dessa abordagem? Se quiser, podemos revisar o que você tem na Wiki atualmente para organizar essa migração para a pasta `docs/`.