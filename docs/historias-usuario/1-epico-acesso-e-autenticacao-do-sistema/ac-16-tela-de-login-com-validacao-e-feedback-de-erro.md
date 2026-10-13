# AC-16 Tela de login com validação e feedback de erro (RF002)

## História de Usuário

**Como** usuário do FarmaUBS (qualquer perfil),
**quero** acessar o sistema por uma tela de login que valide e-mail e senha, com feedback claro de erro e indicação de bloqueio temporário,
**para que** eu inicie sessão de forma simples e entenda imediatamente o que corrigir quando as credenciais estiverem inválidas ou a conta estiver bloqueada (RF002, NF001).

## Critérios de Aceite

- [x] A tela de login é a única tela acessível sem autenticação, exibida como SPA client-side (ADR-012), com layout responsivo (NF002) e em Português do Brasil (NF003).
- [x] O formulário contém os campos e-mail e senha, com validação client-side antes do envio: e-mail obrigatório e com formato válido, senha obrigatória (mínimo 8 caracteres), exibindo mensagens de erro por campo.
- [x] O envio é feito via `useMutation` do TanStack Query (ADR-013) para `POST /api/v1/auth/login` (AC-11), com estado de carregamento desabilitando o botão e impedindo duplo envio.
- [x] Credenciais inválidas exibem a mensagem genérica de erro retornada pela API (e-mail ou senha incorretos), sem distinguir se o e-mail existe (RF002, anti enumeração).
- [x] Conta bloqueada exibe mensagem informando o tempo restante de bloqueio, sem criar sessão.
- [x] Login com sucesso armazena o token de sessão e o escopo (perfis, `municipio_id`/`unidade_id`) no contexto de autenticação (ADR-013), e redireciona o usuário ao dashboard da sua UBS padrão (RF002).
- [x] O frontend agenda o aviso de timeout a partir do `expiresAt` retornado pela API (AC-10), exibindo o aviso 5 minutos antes do encerramento (NF012).
- [x] A tela oferece acesso à recuperação de senha (RF003) e, quando aplicável, ao passo de 2FA TOTP (NF011) após a validação de credenciais.
- [x] Acessibilidade: navegação por teclado, indicador de foco visível, labels associados aos campos e mensagens de erro anunciadas a leitores de tela (ADR-032, WCAG 2.1 AA).
- [x] Teste de componente do formulário (camada D, ADR-030): validação de campos, estado de carregamento, exibição de erro e chamada correta da mutação.

---

## Estratégia de Integração e Independência de Ciclos (Frontend Web ↔ Mobile)

- **Contra-parte no Mobile**: `AC-MOB-01` (Tela de Login Mobile com Validação, Feedback e Gestão de Teclado).
- **Contratos Compartilhados (`@farmaubs/shared`)**:
  - `LoginRequest`, `LoginResponseDto` e `UsuarioAutenticado` em `packages/shared/src/acesso/login.types.ts`.
  - Helpers de validação de e-mail e regras de tamanho mínimo de credenciais.
- **Se o Mobile já implementou AC-MOB-01**:
  - O Frontend Web consome diretamente as interfaces e constantes de autenticação consolidadas em `@farmaubs/shared`.
  - Reutiliza os mesmos padrões de mensagens amigáveis de erro (ex.: anti-enumeração e conta bloqueada) para padronizar a experiência do usuário.
- **Se o Mobile ainda NÃO implementou AC-MOB-01**:
  - O Frontend Web publica as definições canônicas de requisição e resposta em `@farmaubs/shared`, garantindo que o time Mobile tenha os contratos prontos para consumo posterior sem retrabalho.

---

## Cenários de Teste (BDD)

Cenários em Gherkin, rastreáveis aos critérios de aceite e executados na camada D (teste de componente com Testing Library) do ADR-030.

### Cenário 1 — Login com sucesso
```gherkin
Funcionalidade: Tela de login (RF002)

Cenário: Credenciais válidas iniciam sessão e redirecionam ao dashboard
  Dado que estou na tela de login
  Quando eu preencher e-mail "ana.souza@farmaubs.local" e a senha correta
  E submeter o formulário
  Então o botão exibe estado de carregamento durante o envio
  E a sessão é armazenada no contexto de autenticação
  E sou redirecionado ao dashboard da minha UBS padrão
```

### Cenário 2 — E-mail inválido (validação client-side)
```gherkin
Cenário: E-mail com formato inválido não é enviado
  Dado que estou na tela de login
  Quando eu preencher o e-mail "ana.souza" e uma senha qualquer
  E submeter o formulário
  Então o formulário exibe erro de e-mail inválido
  E nenhuma requisição de login é enviada
```

### Cenário 3 — Campos obrigatórios ausentes
```gherkin
Cenário: Envio sem preencher os campos exibe erros de validação
  Dado que estou na tela de login
  Quando eu submeter o formulário vazio
  Então o formulário exibe erro de e-mail obrigatório
  E exibe erro de senha obrigatória
  E nenhuma requisição de login é enviada
```

### Cenário 4 — Credenciais inválidas
```gherkin
Cenário: Senha incorreta exibe mensagem genérica de erro
  Dado que estou na tela de login
  Quando eu preencher e-mail e senha incorretos
  E submeter o formulário
  Então a API retorna 401 com mensagem genérica de credenciais inválidas
  E a tela exibe a mensagem de erro para o usuário
  E nenhuma sessão é criada
```

### Cenário 5 — Conta bloqueada
```gherkin
Cenário: Conta bloqueada exibe tempo restante de bloqueio
  Dado que a conta "ana.souza@farmaubs.local" está bloqueada por 15 minutos
  Quando eu tentar logar com credenciais corretas
  Então a API retorna erro de conta bloqueada
  E a tela exibe a mensagem informando o tempo restante de bloqueio
  E nenhuma sessão é criada
```

### Cenário 6 — Erro de rede
```gherkin
Cenário: Falha de conexão exibe erro tratável com nova tentativa
  Dado que estou na tela de login
  E que a conexão com a API está indisponível
  Quando eu submeter o formulário com credenciais válidas
  Então a tela exibe mensagem de erro de conexão
  E o formulário permanece preenchido para nova tentativa manual
```

### Cenário 7 — Acesso à recuperação de senha
```gherkin
Cenário: Link de recuperação de senha é acessível
  Dado que estou na tela de login
  Quando eu clicar no link "Esqueci minha senha"
  Então sou direcionado à tela de recuperação de senha (RF003)
```

### Cenário 8 — Passo 2FA (quando habilitado)
```gherkin
Cenário: Usuário com 2FA habilitado conclui login com código TOTP
  Dado que estou na tela de login
  E que o usuário "ana.souza@farmaubs.local" tem 2FA TOTP habilitado
  Quando eu informar e-mail e senha corretos
  Então a tela exibe o campo de código TOTP
  E ao informar o código válido, a sessão é criada e sou redirecionado ao dashboard
```

### Cenário 9 — Acessibilidade (navegação por teclado)
```gherkin
Cenário: Formulário é navegável por teclado com foco visível
  Dado que estou na tela de login
  Quando eu navegar pelos campos com a tecla Tab
  Então o foco segue a ordem lógica (e-mail, senha, botão, link de recuperação)
  E o indicador de foco é visível em cada elemento
  E mensagens de erro são anunciadas a leitores de tela (ADR-032)
```

## DoD (Definition of Done) — Pré-requisitos para Iniciar

### Dependências já concluídas

- [x] AC-11 concluída: endpoint `POST /api/v1/auth/login` funcional, com DTOs, validação e Swagger (ADR-007), retornando token, `expiresAt`, `ttlSeconds`, `warningSeconds` e escopo do usuário (AC-10).
- [x] AC-05 concluída: caso de uso de login implementado no backend, com bloqueio por tentativas e passo 2FA (RF002, NF011).
- [x] AC-10 concluída: timestamps absolutos de sessão (`expiresAt`, `ttlSeconds`, `warningSeconds`) definidos no contrato da API (NF012).
- [x] ADR-011 concluída: React + Vite configurado como framework de frontend.
- [x] ADR-012 concluída: SPA client-side (CSR) como estratégia de renderização.
- [x] ADR-013 concluída: TanStack Query configurado (estado de servidor) e Context API para autenticação (estado de cliente/UI).
- [x] ADR-032 concluída: padrão de acessibilidade WCAG 2.1 AA definido, com `eslint-plugin-jsx-a11y` e `axe-core` integrados.
- [x] Biblioteca de componentes acessíveis (Radix UI/shadcn-ui, conforme ADR-011) instalada e com primitivos de formulário disponíveis.
- [x] Tipos compartilhados do monorepo (`packages/shared`) com os DTOs de login (ADR-022), consumidos pelo frontend.

### Definição de campos e tipos (contrato do frontend)

**Formulário de login**

| Campo | Tipo | Regra |
| --- | --- | --- |
| email | string | `@IsEmail`, obrigatório, normalização de caixa (AC-03) |
| senha | string | obrigatória, mínimo 8 caracteres |

**Resposta do login (consumida pelo frontend — AC-10)**

| Campo | Tipo | Regra |
| --- | --- | --- |
| token | string | Token de sessão, armazenado no contexto de autenticação |
| expiresAt | string (ISO 8601) | Base do timer de timeout (NF012) |
| ttlSeconds | integer | `SESSION_TTL_MINUTES * 60` |
| warningSeconds | integer | `SESSION_WARNING_MINUTES * 60` (300) |
| usuario | object | nome, email, perfil(is) e escopo `municipio_id`/`unidade_id` (ADR-006) |

### Layout e comportamento

- [x] Tela única acessível sem autenticação, com layout responsivo (NF002): funcional em desktop (1280×720+) e tablet (768px de largura mínima).
- [x] Textos, mensagens de erro e alertas em Português do Brasil (NF003), usando o vocabulário do farmacêutico (ex.: "Entrar", "Esqueci minha senha").
- [x] Estado de carregamento no botão durante o envio (impede duplo clique).
- [x] Mensagens de erro exibidas junto ao campo correspondente e de forma anunciável a leitores de tela (ADR-032).
- [x] Link "Esqueci minha senha" acessível (RF003) e, quando aplicável, campo de código TOTP (NF011).
- [x] Transporte do token de sessão idêntico ao definido na AC-11 (cabeçalho `Authorization: Bearer` ou cookie HttpOnly), consistente com o contexto de autenticação.

### Ambiente e variáveis

- [x] Backend em execução local (via `docker-compose.dev.yml`, ADR-023) com o endpoint de login acessível.
- [x] Seed de desenvolvimento (TAREFA-12): usuário administrador com senha conhecida para testar o login.
- [x] Banco de desenvolvimento acessível e migrations aplicadas (AC-01 a AC-03).

## Subtarefas

- [ ] Implementar a tela de login como rota pública da SPA, com layout responsivo e acessível (ADR-011, ADR-012, ADR-032)
- [ ] Implementar o formulário de login com validação client-side (e-mail e senha) e mensagens de erro por campo
- [ ] Implementar a mutação de login via TanStack Query (useMutation) consumindo POST /api/v1/auth/login (AC-11), com estado de carregamento e tratamento de erro
- [ ] Implementar o contexto de autenticação (ADR-013): armazenar token, escopo e timestamps de sessão após login bem-sucedido
- [ ] Implementar o redirecionamento ao dashboard da UBS padrão após login com sucesso (RF002)
- [ ] Implementar o timer de aviso de timeout a partir do expiresAt (AC-10), exibindo o aviso 5 minutos antes (NF012)
- [ ] Escrever o teste de componente do formulário de login (camada D, ADR-030): validação, carregamento, erro e chamada da mutação