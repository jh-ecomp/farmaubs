# Progresso — Épico: Acesso e Autenticação do Sistema

Última atualização: 01/10/2026

## Resumo Executivo

| Métrica | Valor |
| --- | --- |
| **Total de Histórias Mapeadas** | 28 |
| **Entregues** | 23 (82%) |
| **Pendentes** | 5 (18%) |

```
Progresso: [████████████████░░░░] 82% (23/28 concluídas)
```

---

## Histórias Entregues ✅ (21)

| Código | Título | Documento / Especificação |
| --- | --- | --- |
| **AC-01** | Migrations do schema de acesso | [ac-01-migrations-do-modulo-de-acesso.md](./ac-01-migrations-do-modulo-de-acesso.md) |
| **AC-02** | Role `farmaubs_app`, RLS, interceptor de transação e harness de integração | [ac-02-politicas-de-rls-e-interceptor-de-propagacao-do-escopo-via-set-local.md](./ac-02-politicas-de-rls-e-interceptor-de-propagacao-do-escopo-via-set-local.md) |
| **AC-03** | Constraints e índices (e-mail único, `user_units` única, índices de sessão/token) | [ac-03-constraints-e-indice-e-mail-unico-unicidade-de-associacao-usuario-ubs-indices-de-sessao-e-token.md](./ac-03-constraints-e-indice-e-mail-unico-unicidade-de-associacao-usuario-ubs-indices-de-sessao-e-token.md) |
| **AC-04** | Cadastrar usuário com hash bcrypt, perfil e UBSs associadas | [ac-04-cadastrar-usuáaio-com-hash-bcrypt-perfil-e-ubss-associadas.md](./ac-04-cadastrar-usuáaio-com-hash-bcrypt-perfil-e-ubss-associadas.md) |
| **AC-05** | Login com validação de credenciais e bloqueio por tentativas | [ac-05-login-com-validacao-de-credenciais-e-bloqueio-por-tentativas.md](./ac-05-login-com-validacao-de-credenciais-e-bloqueio-por-tentativas.md) |
| **AC-06** | Logout com encerramento da sessão | [ac-06-logout-com-encerramento-da-sessao.md](./ac-06-logout-com-encerramento-da-sessao.md) |
| **AC-07** | Recuperação de senha (RF003) | *Documentado no índice do épico* |
| **AC-08** | Gerenciar usuários: editar, inativar/reativar, perfil, UBSs | [ac-08-gerenciar-usuarios-editar-inativar-reativar-alterar-perfil-e-ubss.md](./ac-08-gerenciar-usuarios-editar-inativar-reativar-alterar-perfil-e-ubss.md) |
| **AC-09** | 2FA TOTP opt-in com segredo criptografado em repouso | *Documentado no índice do épico* |
| **AC-10** | Timeout de sessão: expiração deslizante + timestamp absoluto | [ac-10-timeout-de-sessao-expiracao-deslizante-timestamp-absoluto-para-aviso.md](./ac-10-timeout-de-sessao-expiracao-deslizante-timestamp-absoluto-para-aviso.md) |
| **AC-16** | Tela de login com validação e feedback de erro | [ac-16-tela-de-login-com-validacao-e-feedback-de-erro.md](./ac-16-tela-de-login-com-validacao-e-feedback-de-erro.md) |
| **AC-17** | Tela de recuperação de senha | *Documentado no índice do épico* |
| **AC-18** | Gestão de usuários no painel administrativo | [ac-18-gestao-de-usuarios-no-painel-administrativo.md](./ac-18-gestao-de-usuarios-no-painel-administrativo.md) |
| **AC-19** | Contexto de autenticação: usuário atual, perfil e escopo | [ac-19-contexto-de-autenticacao-usuario-atual-perfil-e-escopo-de-tenant.md](./ac-19-contexto-de-autenticacao-usuario-atual-perfil-e-escopo-de-tenant.md) |
| **AC-20** | Aviso de timeout e encerramento de sessão | [ac-20-aviso-de-inatividade-e-renovacao-de-sessao.md](./ac-20-aviso-de-inatividade-e-renovacao-de-sessao.md) |
| **AC-22** | Enriquecer resposta de autenticação e contrato de sessão com perfil RBAC e escopo | [ac-22-feat-acesso-enriquecer-resposta-de-autenticacao-e-contrato-de sessao-com-perfil-rbac-e-escopo.md](./ac-22-feat-acesso-enriquecer-resposta-de-autenticacao-e-contrato-de%20sessao-com-perfil-rbac-e-escopo.md) |
| **AC-23** | Redefinição administrativa e troca obrigatória de senha | [ac-23-feat-acesso-redefinicao-administrativa-e-troca-obrigatoria-de-senha.md](./ac-23-feat-acesso-redefinicao-administrativa-e-troca-obrigatoria-de-senha.md) |
| **AC-24** | Fluxo de redefinição administrativa e tela de troca obrigatória de senha | [ac-24-feat-acesso-fluxo-de-redefinicao-administrativa-e-tela-de-troca-obrigatoria-de-senha.md](./ac-24-feat-acesso-fluxo-de-redefinicao-administrativa-e-tela-de-troca-obrigatoria-de-senha.md) |
| **AC-25** | Encerrar sessão no cliente | [ac-25-feat-acesso-encerrar-sessao-no-cliente.md](./ac-25-feat-acesso-encerrar-sessao-no-cliente.md) |
| **AC-26** | Listagem paginada de usuários com filtros e escopo global | [ac-26-feat-acesso-listagem-paginada-de-usuarios-com-filtros-e-escopo-global.md](./ac-26-feat-acesso-listagem-paginada-de-usuarios-com-filtros-e-escopo-global.md) |
| **AC-27** | Catálogo de administração | [ac-27-feat-administracao-catalogo-de-administracao.md](./ac-27-feat-administracao-catalogo-de-administracao.md) |
| **AC-28** | Idempotência e resiliência na reversão de permissões DML | [ac-28-idempotencia-resiliencia-na-reversao-de-permissoes-dml.md](./ac-28-idempotencia-resiliencia-na-reversao-de-permissoes-dml.md) |
| **AC-29** | Transporte de sessão via cookie seguro `HttpOnly` no backend | [ac-29-feat-acesso-transporte-de-sessao-via-cookie-seguro-httponly-no-backend.md](./ac-29-feat-acesso-transporte-de-sessao-via-cookie-seguro-httponly-no-backend.md) |

---

## Histórias Pendentes ⏳ (5)

| Código | Título | Especificação | Prioridade / Foco |
| --- | --- | --- | --- |
| **AC-12** | Endpoints REST `/api/v1/usuarios/*` com DTOs e Swagger | [ac-12-endpoints-rest-usuarios-com-dtos-e-swagger.md](./ac-12-endpoints-rest-usuarios-com-dtos-e-swagger.md) | Backend / API REST |
| **AC-13** | Guards de autorização RBAC por perfil e escopo de tenant | [ac-13-guards-de-autorizacao-rbac-por-perfil-e-escopo-de-tenant.md](./ac-13-guards-de-autorizacao-rbac-por-perfil-e-escopo-de-tenant.md) | Backend / Segurança & RBAC |
| **AC-14** | Porta `AuthProvider` e adaptador de sessão server-side | [ac-14-porta-authprovider-e-adaptador-de-sessao-server-side.md](./ac-14-porta-authprovider-e-adaptador-de-sessao-server-side.md) | Backend / Arquitetura Hexagonal |
| **AC-21** | Proteção de rotas por perfil e logout | [ac-21-protecao-de-rotas-por-perfil-e-logout.md](./ac-21-protecao-de-rotas-por-perfil-e-logout.md) | Frontend / Rotas e RBAC |
| **AC-30** | Migração de sessão para cookie `HttpOnly` e expurgo de tokens do `localStorage` no frontend | [ac-30-feat-acesso-migracao-de-sessao-para-cookie-httponly-e-expurgo-de-tokens-do-localstorage-no-frontend.md](./ac-30-feat-acesso-migracao-de-sessao-para-cookie-httponly-e-expurgo-de-tokens-do-localstorage-no-frontend.md) | Frontend / Segurança & Cookie |

---

## Histórias Mobile 📱 (Épico 1: Acesso e Autenticação)

| Código | Título | Especificação | Status |
| --- | --- | --- | --- |
| **AC-MOB-01** | Tela de Login Mobile com Validação, Feedback e Gestão de Teclado | [ac-mob-01-tela-de-login-mobile-com-validacao-e-feedback.md](./ac-mob-01-tela-de-login-mobile-com-validacao-e-feedback.md) | ⏳ Especificada / Em andamento |
| **AC-MOB-02** | Armazenamento Seguro de Sessão e Token via Hardware Keystore/Keychain | [ac-mob-02-armazenamento-seguro-sessao-keystore-keychain.md](./ac-mob-02-armazenamento-seguro-sessao-keystore-keychain.md) | ⏳ Especificada / Em andamento |
| **AC-MOB-03** | Seleção e Alternância de UBS Ativa em Dispositivo Móvel | [ac-mob-03-selecao-alternancia-ubs-ativa-mobile.md](./ac-mob-03-selecao-alternancia-ubs-ativa-mobile.md) | ⏳ Especificada |
| **AC-MOB-04** | Fluxo de Troca Obrigatória de Senha Provisória no Mobile | [ac-mob-04-troca-obrigatoria-de-senha-mobile.md](./ac-mob-04-troca-obrigatoria-de-senha-mobile.md) | ⏳ Especificada |
| **AC-MOB-05** | Encerramento Seguro de Sessão (Logout) no Aplicativo Móvel | [ac-mob-05-logout-seguro-mobile.md](./ac-mob-05-logout-seguro-mobile.md) | ⏳ Especificada |
| **AC-MOB-06** | Detecção de Conectividade e Aviso de Modo Offline no Mobile | [ac-mob-06-deteccao-conectividade-aviso-offline-mobile.md](./ac-mob-06-deteccao-conectividade-aviso-offline-mobile.md) | ⏳ Especificada |
| **AC-MOB-07** | Aviso de Timeout de Sessão via Notificação Nativa do SO Android | [ac-mob-07-aviso-timeout-sessao-notificacao-so-android.md](./ac-mob-07-aviso-timeout-sessao-notificacao-so-android.md) | ⏳ Especificada |
