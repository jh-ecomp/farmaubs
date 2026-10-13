# AC-03 Constraints e índices: e-mail único, unicidade de associação usuário/UBS, índices de sessão e token

## História de Usuário

**Como** Administrador do FarmaUBS,
**quero** que a integridade dos dados de acesso seja garantida no nível do banco de dados por constraints e índices (e-mail único, associação usuário/UBS única, índices de sessão e token),
**para que** cadastros duplicados e associações inválidas sejam rejeitados pelo banco, independentemente da camada de aplicação, e as consultas de autenticação e sessão sejam eficientes.

## Critérios de Aceite

- [x] `users.email` possui constraint `UNIQUE`, com decisão explícita de normalização de caixa (índice funcional em `lower(email)` ou extensão `citext`), de modo que variações de caixa (`EMAIL@x.com` vs `email@x.com`) não criem cadastros duplicados (RF001).
- [x] `user_units` possui constraint `UNIQUE (usuario_id, unidade_id)`, garantindo que um usuário não seja associado duas vezes à mesma UBS (RF001).
- [x] `sessions` possui índice único sobre o hash do token (`token_hash UNIQUE`) e índices sobre `usuario_id` e `expires_at`, otimizando a validação de sessão e o expurgo de sessões expiradas (ADR-006, NF012).
- [x] `password_reset_tokens` possui índice único sobre o hash do token (`token_hash UNIQUE`) e índices sobre `usuario_id` e `expires_at`, otimizando a validação do link e o expurgo de tokens vencidos (RF003).
- [x] `totp_secrets` possui índice único sobre `usuario_id`, garantindo um único segredo TOTP ativo por usuário (NF011).
- [x] Teste de integração (camada B, ADR-030) verifica que inserções duplicadas são rejeitadas pelo banco real: e-mail repetido e associação usuário/UBS repetida.
- [x] As constraints e índices são criados em migrations (up/down), com `down()` removendo os objetos na ordem correta.

## Subtarefas

- [ ] Escrever a migration da constraint UNIQUE em users.email (com decisão de normalização de caixa: citext ou índice funcional em lower(email))
- [ ] Escrever a migration da constraint UNIQUE (usuario_id, unidade_id) em user_units
- [ ] Escrever a migration dos índices de sessions (token_hash único, usuario_id, expires_at)
- [ ] Escrever a migration dos índices de password_reset_tokens (token_hash único, usuario_id, expires_at)
- [ ] Escrever a migration do índice único de totp_secrets (usuario_id)
- [ ] Escrever o teste de integração de constraints (camada B): rejeição de e-mail duplicado e de associação usuário/UBS duplicada