# AL-07 feat(alertas): Modal e Painel de Configuração de Parâmetros Operacionais da UBS

---

- **Épico**: Alertas, Notificações e Parâmetros Operacionais (RF026, RF027, RF028, NF001, NF009)
- **Camada**: Frontend Web (`apps/frontend`)
- **Requisitos Funcionais**: RF026 (Tempo médio de entrega da CAF), RF027 (Configurar Parâmetros do Sistema por UBS), RF028 (Auditoria)
- **Requisitos Não-Funcionais**: NF001 (Interface Intuitiva), NF009 (Controle de Acesso RBAC)
- **ADRs Vinculadas**: ADR-006 (RBAC), ADR-011 (React 19 + Tailwind CSS v4), ADR-013 (TanStack Query), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA)

---

## 1. História de usuário

> **Como** farmacêutico responsável ou administrador da UBS,  
> **quero** configurar por interface gráfica os parâmetros operacionais da minha unidade (limiar de alerta de vencimento em dias, estoque de segurança em dias de cobertura, tempo médio de entrega da CAF, janela de histórico de consumo e recebimento de alertas por e-mail), visualizando em tempo real a fórmula do ponto crítico resultante antes de salvar,  
> **para que** o comportamento dos alertas se adapte às particularidades de abastecimento da minha UBS e recalcule todos os indicadores imediatamente após salvar (RF026, RF027).

---

## 2. Regras de negócio e casos de borda

1. **Controle de Visibilidade e Edição por Perfil (RBAC — NF009)**:
   - Usuários com perfil `ADMINISTRADOR` ou `FARMACEUTICO_RESPONSAVEL` podem editar e salvar o formulário.
   - Usuários com perfil `FARMACEUTICO_RESIDENTE` ou `GERENTE` visualizam os parâmetros vigentes em modo somente leitura (`disabled`/`readOnly`) com aviso informativo: `"Apenas o Farmacêutico Responsável ou o Administrador podem alterar os parâmetros operacionais da UBS"`.
2. **Simulador Visual de Cobertura Mínima (Fórmula Explicável)**:
   - À medida que o usuário altera `Tempo Médio de Entrega da CAF (dias)` e `Estoque de Segurança (dias)`, um card dinâmico na tela exibe a equação:
     $$\text{Gatilho de Alerta de Ruptura} = \text{Lead Time CAF} + \text{Estoque de Segurança} = X \text{ dias de cobertura}$$
   - Exibe também a faixa de severidade resultante:
     - Cobertura $\le \text{Lead Time CAF}$ ➔ 🔴 **Crítico (Ruptura Iminente)**
     - Cobertura entre $(\text{Lead Time CAF} + 1)$ e $(\text{Lead Time CAF} + \text{Segurança})$ ➔ 🟡 **Atenção (Risco de Ruptura)**
3. **Feedback Pós-Salvamento**:
   - Ao confirmar `PUT /api/v1/alertas/parametros`, exibe *toast* de sucesso informando o resumo do recálculo retornado pela API (ex.: `"Parâmetros salvos! Alertas recalculados: 2 novos alertas identificados, 1 resolvido."`) e atualiza automaticamente a Central de Alertas e o sino do cabeçalho.

---

## 3. Contratos de dados

Consome `ParametrosOperacionaisUbsDto`, `AtualizarParametrosOperacionaisComando` e `AtualizarParametrosResultadoDto` de `@farmaubs/shared`.

---

## 4. Escopo Técnico da implementação

- **Componente (`apps/frontend/src/pages/Alertas/components/ParametrosOperacionaisModal.tsx`)**:
  - Acionável a partir da Central de Alertas (`/alertas`) e da página de Administração.
  - Validação de formulário utilizando as constantes de limites de `@farmaubs/shared` (`LIMIAR_VENCIMENTO_MIN = 15`, `LIMIAR_VENCIMENTO_MAX = 365`, etc.).
- **Contra-parte Mobile**: `AL-MOB-03`.

---

## 5. Cenários de teste em BDD (Gherkin — camada D)

```gherkin
# language: pt
Funcionalidade: Configuração de Parâmetros Operacionais da UBS na Web (RF027)

  Cenário: Edição bem-sucedida de parâmetros pelo Farmacêutico Responsável com cálculo dinâmico
    Dado que o usuário logado possui perfil "FARMACEUTICO_RESPONSAVEL"
    E abriu o modal "Configurar Parâmetros Operacionais da UBS"
    Quando ele alterar o "Tempo Médio de Entrega da CAF" para "12" dias e o "Estoque de Segurança" para "8" dias
    Então o simulador visual deve exibir imediatamente "Gatilho de Alerta de Ruptura: 20 dias de cobertura"
    E ao clicar em "Salvar Parâmetros", deve enviar PUT para "/api/v1/alertas/parametros" e exibir o resumo de alertas recalculados

  Cenário: Modo somente leitura para Farmacêutico Residente
    Dado que o usuário logado possui perfil "FARMACEUTICO_RESIDENTE"
    Quando ele visualizar os parâmetros operacionais da UBS
    Então os campos numéricos e seletores devem estar desabilitados para edição
    E o botão "Salvar Parâmetros" não deve estar disponível
```

---

## 6. Checklist de DoD e aceitação

- [ ] Formulário com validação instantânea de faixas numéricas e mensagens claras em pt-BR.
- [ ] Card explicativo demonstrando a soma `Lead Time CAF + Estoque de Segurança` em tempo real.
- [ ] Bloqueio RBAC no cliente alinhado à regra do backend.
- [ ] Testes de componente na Camada D validando edição por Admin/RT e bloqueio para Residente/Gerente.
