# AL-MOB-03 feat(alertas): Configuração Rápida de Parâmetros Operacionais da UBS no Celular (RF027)

---

- **Épico**: Alertas, Notificações e Parâmetros Operacionais (RF026, RF027, RF028, NF009, ADR-034)
- **Camada**: Mobile (`apps/mobile`)
- **Requisitos Funcionais**: RF026 (Tempo médio de entrega da CAF), RF027 (Configurar Parâmetros do Sistema por UBS)
- **Requisitos Não-Funcionais**: NF001 (Usabilidade Mobile), NF009 (Controle de Acesso RBAC)
- **ADRs Vinculadas**: ADR-006 (RBAC), ADR-022 (`@farmaubs/shared`), ADR-034 (Workspace Mobile Expo)

---

## 1. História de usuário

> **Como** farmacêutico responsável ou administrador utilizando o aplicativo móvel,  
> **quero** consultar e ajustar pelo celular o limiar de alerta de vencimento, o estoque de segurança e o tempo médio de entrega da CAF da minha UBS ativa,  
> **para que** eu possa calibrar rapidamente os alertas durante reuniões de coordenação ou conferências nas estantes, com recálculo imediato dos alertas da unidade (RF026, RF027).

---

## 2. Regras de negócio e casos de borda

1. **Controle de Permissão por Perfil (RBAC — NF009)**:
   - Apenas `ADMINISTRADOR` e `FARMACEUTICO_RESPONSAVEL` têm os controles habilitados para salvar alterações (`PUT /api/v1/alertas/parametros`).
   - Perfis `FARMACEUTICO_RESIDENTE` e `GERENTE` visualizam os parâmetros da UBS ativa em modo de consulta com aviso claro de permissão.
2. **Ergonomia Mobile e Validação**:
   - Campos numéricos com teclado numérico nativo (`keyboardType="number-pad"`), botões de ajuste rápido (`-` / `+`) e seletores por pílula para a janela de consumo (`30d`, `60d`, `90d`, `180d`, `365d`).
   - Exibe o resumo da soma `Ponto de Pedido = Lead Time CAF + Estoque de Segurança (em dias)` antes de confirmar.
   - Bloqueia submissão caso o aparelho esteja sem conexão (`semConexao`), exibindo a mensagem padronizada de ação indisponível offline (`AC-MOB-06`).

---

## 3. Contratos de dados (`@farmaubs/shared`)

Compartilha `ParametrosOperacionaisUbsDto`, `AtualizarParametrosOperacionaisComando` e a função de validação `validarParametrosOperacionais` de `@farmaubs/shared`.

---

## 4. Escopo Técnico da implementação (ADR-034)

- **Tela / Modal (`apps/mobile/src/screens/alertas/ParametrosUbsScreen.tsx`)**:
  - Acessível a partir do cabeçalho da Central de Alertas Mobile (**AL-MOB-01**).
- **Contra-parte Web**: `AL-07`.

---

## 5. Cenários de teste em BDD (Gherkin — camada Mobile)

```gherkin
# language: pt
Funcionalidade: Configuração de Parâmetros Operacionais da UBS no Celular (AL-MOB-03)

  Cenário: Farmacêutico Responsável altera o limiar de vencimento pelo celular
    Dado que o usuário autenticado no celular possui perfil "FARMACEUTICO_RESPONSAVEL"
    Quando ele abrir a tela de Parâmetros da UBS, alterar o limiar de vencimento para "60" dias e tocar em "Salvar"
    Então o aplicativo deve enviar PUT para "/api/v1/alertas/parametros"
    E exibir aviso de confirmação com o total de alertas ativos recalculados

  Cenário: Bloqueio de edição para perfil sem permissão
    Dado que o usuário autenticado no celular possui perfil "FARMACEUTICO_RESIDENTE"
    Quando ele abrir a tela de Parâmetros da UBS
    Então os campos devem ser exibidos apenas para leitura e o botão "Salvar" deve estar oculto
```

---

## 6. Checklist de DoD e aceitação

- [ ] Tela `ParametrosUbsScreen` implementada com `KeyboardAvoidingView` (`behavior="padding"`).
- [ ] Reutilização da validação pura de `@farmaubs/shared`.
- [ ] Respeito estrito ao RBAC (`ADMINISTRADOR` e `FARMACEUTICO_RESPONSAVEL`) e ao bloqueio offline (`AC-MOB-06`).
- [ ] Testes unitários (`*.check.ts`) aprovados.
