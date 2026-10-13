# AC-04 Cadastrar usuário com hash bcrypt, perfil e UBSs associadas (RF001)

## História de Usuário

**Como** Administrador do FarmaUBS,
**quero** cadastrar novos usuários associando cada um a um perfil de acesso e a uma ou mais UBSs, com a senha armazenada como hash bcrypt,
**para que** o acesso ao sistema seja concedido de forma controlada, com a senha protegida em repouso e o escopo de unidades corretamente vinculado ao usuário.

## Critérios de Aceite

- [x] O cadastro de usuário é restrito ao perfil Administrador, autenticado (RF001).
- [x] O caso de uso recebe nome completo, e-mail institucional, senha, perfil de acesso e a lista de UBS(s) associada(s), validando todos os campos obrigatórios (RF001).
- [x] A senha é armazenada exclusivamente como hash bcrypt com fator de custo mínimo 12 (NF011); o texto puro nunca é persistido nem registrado em log.
- [x] O e-mail é validado quanto ao formato e à unicidade; e-mail já cadastrado retorna erro detalhado (RF001), respeitando a normalização de caixa definida na AC-03.
- [x] O perfil de acesso é atribuído a partir do catálogo de perfis (Farmacêutico Responsável, Farmacêutico Residente, Gerente/Coordenador, Administrador — ADR-006), referenciando o catálogo existente, sem recriá-lo.
- [x] O usuário é associado a uma ou mais UBSs via `user_units`, com unicidade de associação garantida pela constraint da AC-03.
- [x] O usuário nasce com status ativo e sem campos de bloqueio (RF002), prontos para uso no fluxo de login.
- [x] E-mail de confirmação de cadastro é disparado ao endereço informado (RF001), via mecanismo de e-mail transacional.
- [x] Teste unitário do caso de uso (camada A, ADR-030): cadastro com sucesso, e-mail duplicado rejeitado, perfil inválido rejeitado e hash bcrypt aplicado.
- [x] Teste de integração do adaptador de repositório (camada B, ADR-030): persistência do usuário, do hash e da associação `user_units` contra o banco real.

## Cenários de Teste (BDD)

Cenários em Gherkin, rastreáveis aos critérios de aceite e executados nas camadas A (unitário de domínio) e B (integração de adaptador) do ADR-030.

### Cenário 1 — Cadastro com sucesso
```gherkin
Funcionalidade: Cadastrar usuário (RF001)

Cenário: Cadastro válido com perfil e UBSs associadas
  Dado que sou um Administrador autenticado no sistema
  E que o catálogo de perfis contém o perfil "Farmacêutico Responsável"
  E que a UBS "UBS Parque Ideal" está cadastrada
  Quando eu cadastrar um usuário com:
    | nome   | Ana Souza                |
    | email  | ana.souza@farmaubs.local |
    | senha  | SenhaForte@2026          |
    | perfil | Farmacêutico Responsável |
    | ubs    | UBS Parque Ideal         |
  Então o usuário é criado com status "ativo"
  E a senha é armazenada como hash bcrypt com cost 12
  E o texto puro da senha não é persistido nem registrado em log
  E a associação usuario-UBS é criada em user_units
  E um e-mail de confirmação é enviado para ana.souza@farmaubs.local
```

### Cenário 2 — E-mail já cadastrado
```gherkin
Cenário: E-mail já existente no sistema
  Dado que sou um Administrador autenticado no sistema
  E que já existe um usuário com o e-mail "ana.souza@farmaubs.local"
  Quando eu tentar cadastrar um usuário com o mesmo e-mail
  Então o sistema retorna erro detalhado de e-mail já cadastrado
  E nenhum novo usuário é criado
  E nenhuma associação user_units é criada
```

### Cenário 3 — E-mail com variação de caixa (normalização AC-03)
```gherkin
Cenário: E-mail com caixa diferente do cadastro existente
  Dado que sou um Administrador autenticado no sistema
  E que já existe um usuário com o e-mail "ana.souza@farmaubs.local"
  Quando eu tentar cadastrar um usuário com o e-mail "ANA.SOUZA@FARMAUBS.

LOCAL"
  Então o sistema rejeita o cadastro por unicidade de e-mail
  E a mensagem de erro é a mesma do e-mail já cadastrado
```

### Cenário 4 — Perfil inválido
```gherkin
Cenário: Perfil de acesso inexistente no catálogo
  Dado que sou um Administrador autenticado no sistema
  Quando eu cadastrar um usuário com o perfil "Técnico de Farmácia"
  Então o sistema rejeita o cadastro com erro de perfil inválido
  E nenhum usuário é criado
```

### Cenário 5 — Campos obrigatórios ausentes
```gherkin
Cenário: Cadastro sem campos obrigatórios
  Dado que sou um Administrador autenticado no sistema
  Quando eu cadastrar um usuário sem informar a senha
  Então o sistema rejeita o cadastro com erro de validação de campos
  E nenhum usuário é criado
```

### Cenário 6 — Usuário não autorizado (RBAC)
```gherkin
Cenário: Usuário sem perfil Administrador tenta cadastrar
  Dado que sou um usuário autenticado com perfil "Farmacêutico Responsável"
  Quando eu tentar acessar o cadastro de usuários
  Então o sistema bloqueia a operação por falta de autorização (NF009)
  E nenhum usuário é criado
```

### Cenário 7 — Associação usuário-UBS duplicada (camada B)
```gherkin
Cenário: Associação repetida à mesma UBS
  Dado que sou um Administrador autenticado no sistema
  E que o usuário "Ana Souza" já está associado à "UBS Parque Ideal"
  Quando eu tentar associar o mesmo usuário à mesma UBS novamente
  Então o banco rejeita a inserção por violação de UNIQUE (AC-03)
  E a associação permanece única
```

## DoD (Definition of Done) — Pré-requisitos para Iniciar

### Dependências já concluídas

- [x] AC-01 concluída: migrations das tabelas `municipios`, `unidades_saude`, `users`, `profiles`, `user_units`, `sessions`, `password_reset_tokens`, `totp_secrets` aplicadas no banco.
- [x] AC-02 concluída: role `farmaubs_app` criada, RLS e interceptor de transação operacionais, harness de teste de integração (camada B) recriado e funcionando.
- [x] AC-03 concluída: constraint `UNIQUE` em `users.email` (com normalização de caixa), `UNIQUE (usuario_id, unidade_id)` em `user_units`.
- [x] Catálogo de perfis seedado no banco (Farmacêutico Responsável, Farmacêutico Residente, Gerente/Coordenador, Administrador), conforme ADR-006.
- [x] UBS de teste cadastrada (seed de desenvolvimento — TAREFA-12) para uso nos cenários BDD.

### Ambiente e variáveis

- [x] `.env` com `BCRYPT_COST=12` (NF011).
- [x] `.env` com credenciais SMTP da seção 4 (ADR-028) ou, na ausência de SMTP real, transport de desenvolvimento que registre o e-mail em log/console — nunca disparo real para endereços aleatórios.
- [x] Banco de desenvolvimento acessível via `localhost` (CLI e testes fora do container) e credenciais de `farmaubs_app` funcionando.

## Subtarefas

- [ ] Implementar o adaptador de repositório de usuários, persistindo users e a associação user_units com o perfil atribuído.
- [ ] Integrar a geração do hash bcrypt como porta de infraestrutura (NF011), isolada do domínio.
- [ ] Disparar o e-mail de confirmação de cadastro via mecanismo de e-mail transacional (RF001).
- [ ] Escrever o teste unitário do caso de uso (camada A).
- [ ] Escrever o teste de integração do adaptador de repositório (camada B).