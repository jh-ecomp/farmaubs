# AC-24 feat(acesso): fluxo de redefinição administrativa e tela de troca obrigatória de senha

- **Épico**: Autenticação e Controle de Acesso (ADR-006)
- **Requisitos Funcionais**: RF001 (Gestão de Usuários), RF002 (Autenticação), RF003 (Redefinição e Troca Obrigatória)
- **Requisitos Não-Funcionais**: NF002 (Responsividade), NF003 (Idioma pt-BR), NF009 (Menor Privilégio), NF012 (Sessão Segura)
- **ADRs Vinculadas**: ADR-011 (React 19 + Vite), ADR-012 (CSR), ADR-013 (TanStack Query + AuthContext), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes - Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA)

---

## 1. História de Usuário

> **Como** Administrador do FarmaUBS,  
> **quero** poder acionar um modal de "Redefinir Senha" na listagem de usuários e copiar uma senha provisória para entregar ao colaborador, e como **usuário do sistema**,  
> **quero** ser direcionado automaticamente para uma tela de redefinição de senha logo após o login caso minha conta esteja marcada com troca obrigatória,  
> **para que** eu seja guiado de forma clara e acessível na criação da minha nova senha definitiva, sem conseguir desviar para outras telas antes de concluir esse requisito de segurança (RF001, RF003).

---

## 2. Regras de Negócio e Casos de Borda

1. **Ação do Administrador (Modal de Senha Provisória)**:
   - Na tabela de gestão de usuários (`/admin/usuarios`), cada linha de usuário possui a ação "Redefinir Senha" (ícone de chave/cadeado).
   - Ao clicar, abre-se um modal de confirmação onde o Administrador pode:
     - Digitar uma senha provisória válida ou clicar em "Gerar Senha Segura".
     - Ao confirmar, dispara a mutação `POST /api/v1/usuarios/:id/senha-provisoria`.
     - Em caso de sucesso, exibe a senha provisória com botão de **"Copiar Senha"** e aviso explícito: *"Entregue esta senha ao usuário. No próximo acesso, ele será obrigado a cadastrar uma nova senha pessoal."*

2. **Interceptação no Login e Guarda de Rota (`ProtectedRoute`)**:
   - Ao efetuar login com sucesso:
     - Se `resposta.usuario.deveTrocarSenha === true` (ou `redirectUrl === "/trocar-senha"`), o `AuthContext` armazena o estado e o roteador redireciona imediatamente para `/trocar-senha`.
   - **Guarda Anti-Desvio**:
     - O componente `ProtectedRoute` valida: `if (usuario?.deveTrocarSenha && location.pathname !== '/trocar-senha')`.
     - Se o usuário tentar alterar a URL manualmente para `/dashboard`, `/admin/usuarios` ou qualquer outra rota, o sistema força o redirecionamento de volta para `/trocar-senha`.
   - Menus de navegação (Sidebar e Header) ficam ocultos ou desabilitados durante a permanência na tela `/trocar-senha`.

3. **Validação do Formulário na Tela `/trocar-senha`**:
   - Campos:
     - `novaSenha`: campo de senha com botão de alternar visibilidade (olho).
     - `confirmacaoSenha`: campo de confirmação com alternância de visibilidade.
   - **Validação Client-Side com Zod**:
     - Mínimo de 8 caracteres.
     - Pelo menos uma letra maiúscula e uma minúscula.
     - Pelo menos um número e um caractere especial (`@$!%*?&#`).
     - `confirmacaoSenha` deve ser estritamente igual à `novaSenha`.
   - **Indicador Visual de Força da Senha**: Exibe barra de progresso e checklist visual acessível dos requisitos (ex: `✓ Mínimo 8 caracteres`, `✓ Letras e números`).

4. **Tratamento de Abandono do Usuário**:
   - Se o usuário fechar a aba ou o navegador, o token expira naturalmente em 60 minutos (NF012).
   - Ao abrir o sistema novamente e logar com a mesma senha provisória, o frontend continuará forçando a ida para `/trocar-senha`.
   - Botão "Sair / Cancelar" disponível na tela de troca de senha: se o usuário não quiser trocar naquele momento, clicar em "Cancelar" encerra a sessão imediatamente chamando a função de logout e retornando à tela de login.

5. **Finalização com Sucesso**:
   - Submissão via `useMutation` chamando `authService.trocarSenha({ novaSenha, confirmacaoSenha })`.
   - Botão exibe estado de carregamento e fica desabilitado para evitar clique duplo.
   - Em caso de erro 400 (ex: nova senha igual à provisória): exibe alerta em destaque no topo do formulário.
   - Em caso de sucesso:
     - Atualiza o `AuthContext` (`deveTrocarSenha = false`).
     - Exibe notificação toast de sucesso: *"Senha redefinida com sucesso!"*.
     - Redireciona para o `/dashboard`.

---

## 2.1 Estratégia de Integração e Independência de Ciclos (Frontend Web ↔ Mobile)

- **Contra-parte no Mobile**: `AC-MOB-04` (Fluxo de Troca Obrigatória de Senha Provisória no Mobile).
- **Contratos Compartilhados (`@farmaubs/shared`)**:
  - `TrocarSenhaComando` e `TrocarSenhaResultado` em `@farmaubs/shared`.
  - Critérios de validação de complexidade de senha (mínimo de 8 caracteres).
- **Se o Mobile já implementou AC-MOB-04**:
  - O Frontend Web consome diretamente o endpoint `POST /api/v1/auth/trocar-senha` e os DTOs consolidados em `@farmaubs/shared`.
  - Reutiliza as mesmas regras de validação client-side e feedback de erro 400.
- **Se o Mobile ainda NÃO implementou**:
  - O Frontend Web disponibiliza as interfaces e tipos em `@farmaubs/shared`, garantindo que a tela móvel possa ser criada sem divergências contratuais.

---

## 3. Estrutura de Arquivos e Componentes (Frontend)

Conforme a Seção 1.2 do [CONTRIBUTING.md](file:///c:/Users/jaohe/projetos/farmaubs/CONTRIBUTING.md):

```text
apps/frontend/src/
├── pages/
│   ├── TrocarSenha/
│   │   ├── index.tsx                   # Tela focada de redefinição obrigatória
│   │   ├── TrocarSenha.spec.tsx        # Testes de componente e acessibilidade (Camada D)
│   │   └── components/
│   │       └── IndicadorForcaSenha.tsx # Medidor visual dos requisitos de segurança
│   └── AdminUsuarios/
│       └── components/
│           └── RedefinirSenhaModal.tsx # Modal do Admin para gerar senha provisória
├── components/
│   └── ProtectedRoute.tsx              # Guarda atualizada com checagem de deveTrocarSenha
├── services/
│   └── api.ts                          # Funções redefinirSenhaProvisoria() e trocarSenha()
└── contexts/
    └── AuthContext.tsx                 # Atualização de estado pós-troca de senha
```

---

## 4. Critérios de Aceite Detalhados (Frontend)

- [x] **Modal de Redefinição no Painel Admin**:
  - Modal acessível acionado na tabela de usuários.
  - Permite digitar ou gerar senha provisória e copiar para a área de transferência com feedback visual de "Copiado!".
  - Invalida queries de usuários após emissão.
- [x] **Bloqueio e Redirecionamento Mandatório**:
  - Usuário com `deveTrocarSenha === true` é redirecionado para `/trocar-senha` logo após o login.
  - Qualquer tentativa de navegar para `/dashboard` ou outra URL protegida é interceptada por `ProtectedRoute`, mantendo o usuário em `/trocar-senha`.
- [x] **Formulário Acessível de Nova Senha**:
  - Campos de "Nova Senha" e "Confirmar Nova Senha" com validação Zod em tempo real.
  - Indicador de requisitos de senha anunciado a leitores de tela (`aria-live="polite"`).
  - Botão de alternar visibilidade da senha acessível por teclado com `aria-label`.
- [x] **Ação de Cancelar / Sair**:
  - Permite ao usuário desistir do processo; ao clicar em "Sair", executa logout completo (limpa local storage e cache) e retorna a `/login`.
- [x] **Tratamento de Erros da API**:
  - Se a API retornar erro de senha idêntica à provisória, o erro é destacado sem limpar os campos de forma destrutiva.
- [x] **Conclusão e Desbloqueio**:
  - Sucesso na mutação atualiza o `AuthContext` removendo a flag de troca obrigatória e navega para `/dashboard`.
- [x] **Acessibilidade WCAG 2.1 AA**:
  - Navegação fluida por `Tab`, contraste adequado, foco inicial no primeiro campo e mensagens de erro descritas por `aria-describedby`.

---

## 5. Cenários de Teste em BDD (Gherkin — Camada D / Vitest)

### Camada D — Teste de Componente (`TrocarSenha.spec.tsx` e `ProtectedRoute.spec.tsx`)

```gherkin
# language: pt
Funcionalidade: Fluxo de Troca Obrigatória de Senha no Frontend (Camada D)

  Cenário: Usuário com troca obrigatória é impedido de acessar o dashboard
    Dado que o usuário está autenticado com "deveTrocarSenha: true"
    Quando ele tentar acessar a rota "/dashboard"
    Então o ProtectedRoute deve interceptar a navegação
    E o usuário deve ser redirecionado para "/trocar-senha"
    E a tela exibe o aviso "Defina sua nova senha pessoal para continuar"

  Cenário: Validação de força de senha no formulário
    Dado que estou na tela de troca obrigatória de senha
    Quando eu digitar uma senha fraca "12345"
    Então o formulário deve exibir erro indicando que a senha precisa de no mínimo 8 caracteres
    E o botão de salvar deve permanecer desabilitado

  Cenário: Confirmação de senha divergente
    Dado que estou na tela de troca de senha
    Quando eu preencher "NovaSenha@2026" no primeiro campo
    E "OutraSenha@2026" no campo de confirmação
    Então uma mensagem de erro "As senhas não coincidem" deve ser anunciada
    E o formulário não deve ser submetido

  Cenário: Troca de senha realizada com sucesso
    Dado que estou na tela de troca de senha
    Quando eu preencher "NovaSenhaForte@2026" nos dois campos
    E clicar em "Confirmar Nova Senha"
    Então o botão deve exibir estado de carregamento
    E a mutação da API deve ser chamada com os dados
    E o estado do AuthContext deve ter "deveTrocarSenha" atualizado para falso
    E o usuário deve ser redirecionado para o "/dashboard"

  Cenário: Usuário clica em cancelar e faz logout
    Dado que o usuário está na tela de troca de senha e não deseja prosseguir
    Quando ele clicar no botão "Cancelar e Sair"
    Então o serviço de logout deve ser acionado
    E os tokens locais devem ser limpos
    E a navegação deve retornar para a tela "/login"
```

### Camada D — Modal de Redefinição no Admin (`RedefinirSenhaModal.spec.tsx`)

```gherkin
  Cenário: Administrador gera senha provisória com sucesso
    Dado que o Administrador está na gestão de usuários
    Quando ele clica em "Redefinir Senha" para o usuário "Carlos Silva"
    E confirma a geração da senha provisória
    Então a API deve receber a solicitação
    E o modal deve exibir a senha gerada com a opção "Copiar Senha"
```

---

## 6. Definition of Done (DoD - Frontend)

- [x] Tela `/trocar-senha` implementada com Tailwind CSS, React Hook Form e Zod.
- [x] `ProtectedRoute.tsx` atualizado para conter a trava estrita de `deveTrocarSenha`.
- [x] `RedefinirSenhaModal.tsx` integrado à tabela de gestão de usuários no painel administrativo.
- [x] Métodos integrados ao `api.ts` e orquestrados com TanStack Query.
- [x] 100% dos testes da Camada D (`TrocarSenha.spec.tsx` e `ProtectedRoute.spec.tsx`) passando no Vitest.
- [x] `pnpm --filter @farmaubs/frontend test` e `pnpm --filter @farmaubs/frontend build` passando com zero avisos.