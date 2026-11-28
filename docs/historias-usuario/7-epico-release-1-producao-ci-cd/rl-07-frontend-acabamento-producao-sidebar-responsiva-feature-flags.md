# RL-07 feat(frontend): Acabamento de Produção, Sidebar Responsiva/Dinâmica, Feature Flags e Páginas Legais

---

- **Épico**: Release 1 — Prontidão para Produção, CI/CD e Infraestrutura
- **Requisitos Não-Funcionais**: NF001 (Interface intuitiva), NF002 (Design responsivo), NF003 (Português Brasil), NF010 (Transparência LGPD), ADR-032 (Acessibilidade WCAG 2.1 AA)
- **ADRs Vinculadas**: ADR-011 (React/Vite), ADR-012 (SPA), ADR-030 (Testes Playwright BDD — Camada D), ADR-032 (Acessibilidade)

---

## 1. História de usuário

> **Como** farmacêutico ou avaliador acessando o FarmaUBS em produção,  
> **quero** que o aplicativo apresente idioma português configurado corretamente no HTML, títulos de aba dinâmicos por tela, barra lateral adaptável a telas menores exibindo o nome real da minha unidade/município (sem texto fixo no código), bloqueio contra indexação por buscadores (`robots.txt`), ocultação de módulos futuros ainda não entregues e acesso público às páginas de Política de Privacidade e Termos de Uso,  
> **para que** o sistema ofereça uma experiência limpa, acessível, responsiva e coerente com uma entrega em produção real.

---

## 2. Regras de negócio e requisitos técnicos

1. **HTML, SEO Defensivo e Metadados (`apps/frontend/index.html` e `public/`)**:
   - Alterar `<html lang="en">` para `<html lang="pt-BR">` (`NF003`, `ADR-032`).
   - Criar `apps/frontend/public/robots.txt` contendo:
     ```text
     User-agent: *
     Disallow: /
     ```
   - Implementar atualização automática de `document.title` conforme a rota ativa (ex.: `Login | FarmaUBS`, `Dispensação | FarmaUBS`, `Recebimento | FarmaUBS`, `Controle de Estoque | FarmaUBS`).
   - Adicionar fallback de favicon (`favicon.ico` / `apple-touch-icon.png`) além do `favicon.svg` existente.
2. **Sidebar Dinâmica e Responsiva (`apps/frontend/src/components/Sidebar.tsx` e `MainLayout.tsx`)**:
   - Remover o texto hardcoded `"SMS Parnaíba/PI"` (linha 119 de `Sidebar.tsx`) e exibir dinamicamente o nome do município/UBS ativa do usuário autenticado (via `useAuth()`), com fallback seguro `"Gestão Farmacêutica SUS"`.
   - Tornar a `Sidebar` responsiva (`NF002`): em telas abaixo de `lg` (`< 1024px`), recolher a barra lateral para um *drawer* acionado por botão hambúrguer acessível (`aria-label="Abrir menu de navegação"`, `aria-expanded`) no cabeçalho do `MainLayout`, fechando ao clicar em um link ou pressionar `Esc`.
3. **Feature Flag para Módulos de Incrementos Futuros (`EmDesenvolvimento`)**:
   - Introduzir variável de build `VITE_SHOW_FUTURE_MODULES` (padrão `false` em produção).
   - Quando `false`, ocultar da `Sidebar` os itens que ainda apontam para `<EmDesenvolvimento />` (ex.: `Indicadores` / Curva ABC e relatórios avançados dos Incrementos 3 e 4), mantendo o menu limpo apenas com módulos funcionais entregues.
4. **Ajuste na Página 404 (`NotFound.tsx`) e Páginas Legais Públicas (`/privacidade` e `/termos`)**:
   - Em `NotFound.tsx`, se o usuário estiver autenticado (`useAuth().isAuthenticated`), direcionar o botão de retorno para `/dashboard` (ou `/dispensas`) em vez de `/login`.
   - Criar rotas públicas leves `/privacidade` e `/termos` com links discretos no rodapé da tela `/login`, informando: uso do cookie `HttpOnly` estritamente necessário para sessão, conformidade com a LGPD (`NF010`), política de retenção (`ADR-018`) e limitações de responsabilidade operacional.

---

## 3. Escopo de arquivos impactados

- `apps/frontend/index.html`
- `apps/frontend/public/robots.txt` (novo)
- `apps/frontend/src/components/Sidebar.tsx`
- `apps/frontend/src/components/MainLayout.tsx`
- `apps/frontend/src/hooks/useDocumentTitle.ts` (novo)
- `apps/frontend/src/pages/NotFound.tsx`
- `apps/frontend/src/pages/Privacidade.tsx` e `apps/frontend/src/pages/Termos.tsx` (novos)
- `apps/frontend/src/pages/Login.tsx` (links de rodapé para `/privacidade` e `/termos`)
- `apps/frontend/src/App.tsx`

---

## 4. Cenários de teste em BDD (Gherkin — camada D / Playwright)

```gherkin
# language: pt
Funcionalidade: Acabamento de Produção, Responsividade e Conformidade no Frontend

  Cenário: Documento HTML utiliza idioma pt-BR e título dinâmico por página
    Dado que o usuário acessa a rota "/login"
    Então o atributo "lang" da tag "html" deve ser "pt-BR"
    E o título da aba do navegador deve conter "Login" e "FarmaUBS"

  Cenário: Sidebar exibe município dinâmico e se recolhe em telas menores
    Dado que um farmacêutico autenticado está em um viewport de 768x1024 pixels
    Quando a tela de dispensação for carregada
    Então a barra lateral não deve sobrepor o formulário principal
    E o botão "Abrir menu de navegação" deve abrir e fechar o drawer corretamente

  Cenário: Páginas públicas de Privacidade e Termos são acessíveis sem login
    Dado que um visitante não autenticado está na tela "/login"
    Quando ele clicar no link "Política de Privacidade"
    Então a rota "/privacidade" deve ser exibida com as informações de proteção de dados (LGPD) sem redirecionar para login
```

---

## 5. Checklist de DoD e aceitação

- [x] `<html lang="pt-BR">`, `robots.txt` (`Disallow: /`) e `document.title` dinâmico implementados.
- [x] Texto hardcoded `SMS Parnaíba/PI` removido da `Sidebar` e substituído por dado do contexto autenticado.
- [x] `Sidebar` responsiva testada em viewports `390x844`, `768x1024` e `1366x768` sem quebra de layout.
- [x] Rotas `/privacidade` e `/termos` acessíveis publicamente e validadas com `@axe-core/playwright` (zero violações críticas de acessibilidade).
- [x] Módulos futuros não entregues ocultados quando `VITE_SHOW_FUTURE_MODULES=false`.
