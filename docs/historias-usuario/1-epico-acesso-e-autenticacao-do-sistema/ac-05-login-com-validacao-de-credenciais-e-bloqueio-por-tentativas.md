# AC-05 Login com validação de credenciais e bloqueio por tentativas (RF002)

## História de Usuário

**Como** usuário do FarmaUBS (qualquer perfil),
**quero** acessar o sistema informando e-mail e senha, com validação das credenciais e bloqueio temporário da conta após tentativas inválidas,
**para que** apenas usuários legítimos iniciem sessão, com a conta protegida contra tentativas de acesso por força bruta (RF002, NF011).

## Critérios de Aceite

- [x] O login aceita e-mail e senha, validando as credenciais contra o hash bcrypt (cost 12) armazenado em `users.senha_hash` (NF011).
- [x] A busca do usuário pelo e-mail respeita a normalização de caixa definida na AC-03 (mesma normalização do cadastro).
- [x] Credenciais inválidas retornam mensagem genérica única (e-mail ou senha incorretos), sem expor se o e-mail existe (RF002/RF003 — anti enumeração).
- [x] A cada tentativa inválida, `failed_login_attempts` é incrementado; ao atingir 5 tentativas (configurável via `LOGIN_MAX_ATTEMPTS`), a conta é bloqueada por 15 minutos (`blocked_until`, configurável via `LOGIN_BLOCK_MINUTES`).
- [x] Tentativa de login durante bloqueio retorna erro informando o tempo restante de bloqueio; nenhuma sessão é criada e o contador não é incrementado.
- [x] Login com sucesso zera `failed_login_attempts` e limpa `blocked_until`.
- [x] Após validação da senha, se o usuário tiver 2FA TOTP habilitado (NF011), um segundo passo exige o código TOTP antes de criar a sessão; código incorreto não cria sessão.
- [x] O usuário é redirecionado ao dashboard da sua UBS padrão após login bem-sucedido (RF002).
- [x] Teste unitário do caso de uso (camada A, ADR-030): sucesso, credenciais inválidas, bloqueio após 5 tentativas, bloqueio ativo, reset do contador e fluxo TOTP.
- [x] Teste de integração do adaptador de repositório (camada B, ADR-030): criação e renovação de sessão no banco real, com `token_hash` único.
- [x] Teste e2e (camada C, ADR-030): caminho feliz de login via API — requisito Essencial (RF002).

## Cenários de Teste (BDD)

Cenários em Gherkin, rastreáveis aos critérios de aceite e executados nas camadas A (unitário de domínio), B (integração de adaptador) e C (e2e via API) do ADR-030.

### Cenário 1 — Login com sucesso
```gherkin
Funcionalidade: Login (RF002)

Cenário: Credenciais válidas iniciam sessão e redirecionam ao dashboard
  Dado que existe um usuário ativo com e-mail "ana.souza@farmaubs.local"
  E que esse usuário está associado à UBS "UBS Parque Ideal"
  Quando eu informar o e-mail "ana.souza@farmaubs.local" e a senha correta
  Então uma sessão é criada na tabela sessions com token_hash único
  E o contador de tentativas inválidas é zerado
  E o usuário é redirecionado ao dashboard da sua UBS padrão
```

### Cenário 2 — Credenciais inválidas
```gherkin
Cenário: Senha incorreta retorna mensagem genérica e incrementa tentativas
  Dado que existe um usuário ativo com o e-mail "ana.souza@farmaubs.local"
  Quando eu informar a senha errada para esse e-mail
  Então o sistema retorna a mensagem genérica de credenciais inválidas
  E o contador failed_login_attempts é incrementado em 1
  E nenhuma sessão é criada
```

### Cenário 3 — Bloqueio após 5 tentativas
```gherkin
Cenário: Quinta tentativa inválida bloqueia a conta por 15 minutos
  Dado que o usuário "ana.souza@farmaubs.local" possui 4 tentativas inválidas registradas
  Quando eu informar a senha errada pela 5ª vez
  Então o sistema bloqueia a conta configurando blocked_until para 15 minutos
  E retorna a mensagem de credenciais inválidas
  E nenhuma sessão é criada
```

### Cenário 4 — Tentativa durante bloqueio
```gherkin
Cenário: Tentativa com conta bloqueada não cria sessão
  Dado que a conta "ana.souza@farmaubs.local" está bloqueada por 15 minutos
  Quando eu tentar logar com credenciais corretas
  Então o sistema retorna erro informando o tempo restante de bloqueio
  E o contador de tentativas não é incrementado
  E nenhuma sessão é criada
```

### Cenário 5 — E-mail inexistente (anti enumeração)
```gherkin
Cenário: E-mail não cadastrado recebe a mesma mensagem genérica
  Dado que não existe usuário com o e-mail "nao.cadastrado@farmaubs.local"
  Quando eu tentar logar com esse e-mail e qualquer senha
  Então o sistema retorna a mesma mensagem genérica de credenciais inválidas
  E nenhuma sessão é criada
```

### Cenário 6 — Sucesso zera contador
```gherkin
Cenário: Login válido após tentativas inválidas zera o contador
  Dado que o usuário "ana.souza@farmaubs.local" possui 2 tentativas inválidas registradas
  Quando eu logar com a senha correta
  Então a sessão é criada com sucesso
  E o contador failed_login_attempts é zerado
  E o campo blocked_until é limpo
```

### Cenário 7 — 2FA habilitado: código correto
```gherkin
Cenário: Usuário com 2FA habilitado conclui login com código TOTP
  Dado que o usuário "ana.souza@farmaubs.local" tem 2FA TOTP habilitado
  Quando eu informar e-mail e senha corretos
  Então o sistema solicita o código TOTP
  E ao informar o código TOTP válido, a sessão é criada
```

### Cenário 8 — 2FA habilitado: código incorreto
```gherkin
Cenário: Código TOTP inválido não cria sessão
  Dado que o usuário "ana.souza@farmaubs.local" tem 2FA TOTP habilitado
  E que eu já informei e-mail e senha corretos
  Quando eu informar um código TOTP inválido
  Então o sistema rejeita o login com erro de código inválido
  E nenhuma sessão é criada
```

### Cenário 9 — Sessão expirada
```gherkin
Cenário: Sessão inativa por 60 minutos é encerrada
  Dado que o usuário "ana.souza@farmaubs.local" possui uma sessão ativa
  Quando a sessão permanecer inativa por 60 minutos (NF012)
  Então a sessão expira e o acesso é recusado
  E o sistema exige novo login
```

## DoD (Definition of Done) — Pré-requisitos para Iniciar

### Dependências já concluídas

- [x] AC-01 concluída: migrations das tabelas `users`, `sessions`, `totp_secrets`, `user_units` e `profiles` aplicadas no banco.
- [x] AC-02 concluída: role `farmaubs_app` criada, RLS e interceptor de transação operacionais, harness de teste de integração (camada B) recriado e funcionando.
- [x] AC-03 concluída: constraint `UNIQUE` em `users.email` (com normalização de caixa).
- [x] AC-04 concluída: cadastro de usuário com hash bcrypt (cost 12), campos de bloqueio (`failed_login_attempts`, `blocked_until`) presentes no schema.
- [x] Seed de desenvolvimento (TAREFA-12): usuário administrador com senha conhecida disponível no banco local para os cenários BDD.
- [x] `sessions` é tabela global (sem RLS), criada na AC-01 — o login ocorre antes de existir contexto de tenant; RLS nela quebraria a autenticação.

### Ambiente e variáveis

- [x] `.env` com `SESSION_SECRET` único por ambiente (ADR-027), nunca compartilhado entre dev/hml/prod.
- [x] `.env` com `SESSION_TTL_MINUTES=60` e `SESSION_WARNING_MINUTES=5` (NF012).
- [x] `.env` com `LOGIN_MAX_ATTEMPTS=5` e `LOGIN_BLOCK_MINUTES=15` (RF002).
- [x] `.env` com `BCRYPT_COST=12` (NF011).
- [x] Banco de desenvolvimento acessível via `localhost` (CLI e testes fora do container) e credenciais de `farmaubs_app` funcionando.

## Subtarefas

- [ ] Implementar o adaptador de repositório de sessões: criação com token_hash único, expires_at e last_activity_at, renovação deslizante e lookup por hash.
- [ ] Implementar a verificação TOTP como porta de infraestrutura (NF011), com segredo criptografado em repouso (AES-256).
- [ ] Implementar a captura do escopo da sessão (perfis e municipio_id/unidade_id via user_units) para alimentar o Guard de autorização (ADR-006).
- [ ] Escrever o teste unitário do caso de uso de login (camada A).
- [ ] Escrever o teste de integração do adaptador de sessões (camada B).
- [ ] Escrever o teste e2e do caminho feliz de login via API (camada C — RF002 Essencial).