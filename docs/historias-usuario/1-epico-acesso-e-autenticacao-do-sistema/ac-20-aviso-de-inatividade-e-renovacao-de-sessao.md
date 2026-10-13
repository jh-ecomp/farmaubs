# AC-20 Aviso de inatividade e renovação de sessão (NF012)

- **Épico**: Acesso e Autenticação do Sistema (RF001–RF004, NF009–NF012)
- **Requisitos Funcionais**: RF002 (Autenticação e Sessão), RF004 (Encerramento de Sessão)
- **Requisitos Não-Funcionais**: NF002 (Responsividade), NF003 (Idioma pt-BR), NF012 (Aviso 5 min antes e Timeout)
- **ADRs Vinculadas**: ADR-011 (React 19 + Vite), ADR-012 (CSR), ADR-013 (TanStack Query + AuthContext), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes - Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA)

---

## 1. História de Usuário

> **Como** operador do FarmaUBS em uma UBS,  
> **quero** ser alertado visualmente quando minha sessão estiver prestes a expirar por inatividade (faltando 5 minutos) com a opção de estendê-la em um clique,  
> **para que** eu não perca dados de prescrições ou dispensações em andamento e seja redirecionado com segurança para a tela de login se me ausentar do computador (NF012, NF002).

---

## 2. Regras de Negócio e Casos de Borda

1. **Sincronização Reativa via Cabeçalho (Sem Polling)**:
   - O interceptor HTTP do frontend (Axios/fetch em `api.ts`) inspeciona todas as respostas bem-sucedidas.
   - Se o cabeçalho `X-Session-Expires-At` estiver presente, o frontend atualiza imediatamente o `expiresAt` do `AuthContext` e do `localStorage`.
   - Essa abordagem posterga o cronômetro de inatividade automaticamente a cada clique ou consulta à API, sem sobrecarregar a rede com chamadas de *heartbeat*.

2. **Detecção e Disparo do Aviso aos 5 Minutos**:
   - O hook `useSessionTimeout` calcula o tempo restante em segundos:
     `segundosRestantes = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)`.
   - Quando `segundosRestantes <= warningSeconds` (padrão 300 segundos = 5 minutos), a flag `isWarning` torna-se `true` e o modal [`SessionTimeoutModal`](file:///c:/Users/jaohe/projetos/farmaubs/apps/frontend/src/components/SessionTimeoutModal.tsx) é renderizado.

3. **Comportamento do `SessionTimeoutModal`**:
   - Exibe a contagem regressiva viva formatada (`mm:ss`).
   - Não bloqueia a leitura do que está atrás (fundo escurecido translúcido).
   - **Destaque de Urgência**: Quando restarem menos de 60 segundos, a paleta visual muda para tons vermelhos de emergência.
   - Acessibilidade: `role="alertdialog"`, `aria-modal="true"`, foco retido (*focus trap*) no botão primário e fechamento seguro.

4. **Ação "Continuar Conectado"**:
   - O usuário clica no botão "Continuar Conectado".
   - Dispara `extendSession()`, que invoca `POST /api/v1/acesso/renovar`.
   - Ao receber o novo `expiresAt`, o modal fecha imediatamente e a contagem regressiva é redefinida para 60 minutos.

5. **Ação "Sair do Sistema"**:
   - O usuário clica em "Sair do Sistema".
   - Invoca `logout()`, descartando credenciais locais e navegando para `/login`.

6. **Esgotamento do Tempo (`00:00`)**:
   - Quando a contagem regressiva chega a zero:
     1. Dispara `logout()`.
     2. Grava no `sessionStorage`:
        `@FarmaUBS:logoutReason = "Sua sessão expirou por inatividade. Faça login novamente para continuar."`.
     3. **Expurgo de Cache Obrigatório**: Executa `queryClient.clear()` para descarregar da memória dados clínicos e de medicamentos.
     4. Redireciona para `/login`, que lê o motivo do storage e exibe o alerta amarelo em destaque.

---

## 3. Estrutura de Arquivos e Componentes (Frontend)

Conforme a Seção 1.2 do [CONTRIBUTING.md](file:///c:/Users/jaohe/projetos/farmaubs/CONTRIBUTING.md):

```text
apps/frontend/src/
├── components/
│   ├── SessionTimeoutModal.tsx             # Modal de aviso e ação (já implementado)
│   └── SessionTimeoutModal.spec.tsx        # Testes de componente Camada D
├── hooks/
│   ├── useSessionTimeout.ts                # Hook de cálculo e contagem regressiva (já implementado)
│   └── useSessionTimeout.spec.ts           # Testes unitários do hook
├── contexts/
│   └── AuthContext.tsx                     # Armazena expiresAt, expõe extendSession() e logout()
└── services/
    └── api.ts                             # authService.renovarSessao() e interceptor de header
```

---

## 3.1 Estratégia de Integração e Independência de Ciclos (Frontend Web ↔ Mobile)

- **Contra-parte no Mobile**: `AC-MOB-07` (Aviso de Timeout de Sessão via Notificação Nativa do SO Android).
- **Contratos Compartilhados (`@farmaubs/shared`)**:
  - Ambos os clientes consomem o mesmo endpoint `POST /api/v1/acesso/renovar` e o cabeçalho `X-Session-Expires-At`.
  - Interface `RenovarSessaoResponse` (`expiresAt`, `ttlSeconds`, `warningSeconds`) em `packages/shared/src/acesso/session.types.ts`.
- **Diferença de Paradigma**:
  - Web: Exibe o modal in-app `SessionTimeoutModal.tsx` enquanto a aba estiver aberta.
  - Mobile: Agenda notificação nativa no SO Android, disparada mesmo se o aplicativo estiver em segundo plano ou tiver sido encerrado.
- **Se o Mobile já implementou AC-MOB-07**:
  - O Frontend Web consome diretamente o contrato `RenovarSessaoResponse` e as constantes de warning (`warningSeconds: 300`) já estabelecidas no shared package.
- **Se o Mobile ainda NÃO implementou AC-MOB-07**:
  - O Frontend Web estende `@farmaubs/shared` com a tipagem da renovação e os helpers de cálculo de expiração (`useSessionTimeout.ts`), deixando as definições canônicas prontas para consumo futuro pelo workspace mobile sem criar acoplamento direto de código.

---

## 4. Critérios de Aceite Detalhados (Frontend)

- [ ] **Captura do Cabeçalho**: Interceptor HTTP captura `X-Session-Expires-At` e atualiza o estado de expiração sem recarregar a página.
- [ ] **Renderização Aos 5 Minutos**: O [`SessionTimeoutModal`](file:///c:/Users/jaohe/projetos/farmaubs/apps/frontend/src/components/SessionTimeoutModal.tsx) aparece no DOM quando restarem `<= 300 segundos`.
- [ ] **Contagem Regressiva Visual**: O contador atualiza a cada 1 segundo em formato tabular `mm:ss` (ex: `04:59`).
- [ ] **Visual de Emergência (< 60s)**: O card do contador e os textos mudam para vermelho quando restarem menos de 60 segundos.
- [ ] **Renovação Funcional**: O botão "Continuar Conectado" chama `authService.renovarSessao()`, fecha o modal e re-agenda o alarme.
- [ ] **Expurgo e Redirecionamento ao Expirar**: Ao atingir `00:00`, executa `queryClient.clear()`, remove chaves do `localStorage`, salva motivo no `sessionStorage` e redireciona para `/login`.
- [ ] **Acessibilidade WCAG 2.1 AA**: Foco inicial automático no botão de renovar, `role="alertdialog"`, descrição audível para tecnologias assistivas.

---

## 5. Cenários de Teste em BDD (Gherkin — Camada D / Vitest)

### Camada D — Teste do Hook (`useSessionTimeout.spec.ts`)
```gherkin
# language: pt
Funcionalidade: Hook de Timeout de Sessão (Camada D)

  Cenário: Ativação do aviso aos 5 minutos
    Dado que a sessão tem expiresAt configurado para daqui a 300 segundos
    Quando o hook useSessionTimeout for avaliado
    Então isWarning deve ser verdadeiro
    E formattedTime deve ser "05:00"

  Cenário: Disparo de callback de timeout ao zerar o tempo
    Dado que a sessão tem expiresAt igual a 1 segundo no futuro
    Quando o cronômetro avançar 1 segundo
    Então a função onTimeout deve ser acionada imediatamente
    E isExpired deve se tornar verdadeiro
```

### Camada D — Teste do Componente (`SessionTimeoutModal.spec.tsx`)
```gherkin
  Cenário: Exibição e interação no modal de aviso
    Dado que o tempo restante da sessão atingiu 4 minutos e 30 segundos
    Então o modal SessionTimeoutModal deve ser visível na tela
    E deve exibir o texto "Sua sessão no FarmaUBS expirará em breve"
    Quando o usuário clicar em "Continuar Conectado"
    Então o método extendSession deve ser chamado
    E o modal deve desaparecer da tela

  Cenário: Logout por inatividade limpa o cache e redireciona
    Dado que o modal está em contagem regressiva
    Quando o tempo restante se esgotar completamente
    Então a mensagem de logout por inatividade deve ser gravada no sessionStorage
    E a navegação para "/login" deve ser acionada
```

---

## 6. Definition of Done (DoD - Frontend)

- [ ] Interceptor de resposta lendo `X-Session-Expires-At` ativo em `api.ts`.
- [ ] Testes unitários do hook `useSessionTimeout.spec.ts` cobrindo cálculo, contagem e callback.
- [ ] Testes de componente `SessionTimeoutModal.spec.tsx` cobrindo renderização, foco, renovação e timeout.
- [ ] `pnpm --filter @farmaubs/frontend test` passando com 100% de sucesso.
- [ ] `pnpm --filter @farmaubs/frontend build` executando sem erros.