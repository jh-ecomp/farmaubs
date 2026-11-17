# AL-02 feat(alertas): API de Parâmetros Operacionais da UBS com Validação, Auditoria e Recálculo Imediato

---

- **Épico**: Alertas, Notificações e Parâmetros Operacionais (RF022, RF023, RF026, RF027, RF028, NF007, NF009, NF015, NF018)
- **Requisitos Funcionais**: RF026 (Gerenciar UBSs — tempo médio de entrega da CAF), RF027 (Configurar Parâmetros do Sistema), RF028 (Consultar Log de Auditoria)
- **Requisitos Não-Funcionais**: NF007 (Tempo de Resposta < 2s), NF009 (Controle de Acesso RBAC), NF015 (Isolamento por UBS), NF018 (Auditabilidade Imutável)
- **ADRs Vinculadas**: ADR-003 / ADR-033 (Clean Architecture Pura), ADR-006 (RBAC), ADR-007 (API REST + Swagger), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camadas A e C)

---

## 1. História de usuário

> **Como** farmacêutico responsável ou administrador autenticado na UBS,  
> **quero** consultar e atualizar os parâmetros operacionais da minha unidade (limiar de alerta de vencimento em dias, margem de estoque de segurança em dias, tempo médio de entrega da CAF e flags de notificação por e-mail),  
> **para que** os cálculos de cobertura de estoque e os alertas de vencimento e ruptura reflitam imediatamente a realidade logística da minha farmácia com registro completo em trilha de auditoria (RF026, RF027, RF028).

---

## 2. Regras de negócio e casos de borda

1. **Controle de Acesso por Perfil (RBAC — NF009)**:
   - **Leitura (`GET /api/v1/alertas/parametros`)**: permitida para todos os perfis autenticados com vínculo na UBS ativa (`FARMACEUTICO_RESPONSAVEL`, `FARMACEUTICO_RESIDENTE`, `GERENTE`, `ADMINISTRADOR`).
   - **Escrita (`PUT /api/v1/alertas/parametros`)**: permitida **exclusivamente** para `FARMACEUTICO_RESPONSAVEL` e `ADMINISTRADOR`. Tentativas por `FARMACEUTICO_RESIDENTE` ou `GERENTE` retornam `403 Forbidden`.
2. **Faixas de Validação de Domínio**:
   - `limiarVencimentoDias`: inteiro entre `15` e `365` dias (padrão `90`);
   - `estoqueSegurancaDias`: inteiro entre `0` e `90` dias (padrão `7`);
   - `cafLeadTimeDays`: inteiro entre `1` e `60` dias (padrão `15`);
   - `janelaConsumoDias`: inteiro pertencente a `{30, 60, 90, 180, 365}` (padrão `90`).
3. **Sincronização e Recálculo Imediato (RF027)**:
   - A atualização de `cafLeadTimeDays` atualiza tanto `parametros_operacionais_ubs.caf_lead_time_days` quanto `unidades_saude.caf_lead_time_days` na mesma transação.
   - Imediatamente após persistir os novos parâmetros, o caso de uso aciona a porta do motor de avaliação de alertas para recalcular os alertas da UBS ativa (ex.: se o limiar de vencimento subiu de 60 para 90 dias, lotes que vencem em 75 dias entram imediatamente em alerta; se reduziu de 90 para 45 dias, alertas de lotes com 75 dias são automaticamente resolvidos).
4. **Registro Imutável em Log de Auditoria (RF028, NF018)**:
   - Grava evento `ATUALIZACAO_PARAMETROS_UBS` na tabela de auditoria contendo o JSON com os valores anteriores (`before`) e os novos valores (`after`), ID do usuário e *timestamp*.

---

## 3. Contratos de dados e Protocolo HTTP (`@farmaubs/shared`)

### 3.1 Tipagens Compartilhadas (`packages/shared/src/alertas/parametros.types.ts`)
```typescript
export type JanelaConsumoPermitida = 30 | 60 | 90 | 180 | 365;

export interface ParametrosOperacionaisUbsDto {
  ubsId: string;
  ubsNome: string;
  limiarVencimentoDias: number;
  estoqueSegurancaDias: number;
  cafLeadTimeDays: number;
  pontoPedidoDias: number; // cafLeadTimeDays + estoqueSegurancaDias
  janelaConsumoDias: JanelaConsumoPermitida;
  notificarEmailVencimento: boolean;
  notificarEmailRuptura: boolean;
  atualizadoEm: string;
  atualizadoPorNome: string | null;
}

export interface AtualizarParametrosOperacionaisComando {
  limiarVencimentoDias: number;
  estoqueSegurancaDias: number;
  cafLeadTimeDays: number;
  janelaConsumoDias: JanelaConsumoPermitida;
  notificarEmailVencimento: boolean;
  notificarEmailRuptura: boolean;
}

export interface AtualizarParametrosResultadoDto {
  parametros: ParametrosOperacionaisUbsDto;
  resumoRecalculo: {
    alertasAbertos: number;
    alertasResolvidos: number;
    totalAtivos: number;
  };
}
```

### 3.2 Endpoints REST
- **`GET /api/v1/alertas/parametros`**
  - Cabeçalho obrigatório: `x-unidade-id` (ou escopo padrão da sessão).
  - Resposta `200 OK`: `ParametrosOperacionaisUbsDto`.
- **`PUT /api/v1/alertas/parametros`**
  - Cabeçalho obrigatório: `x-unidade-id`.
  - Corpo: `AtualizarParametrosOperacionaisComando`.
  - Resposta `200 OK`: `AtualizarParametrosResultadoDto`.
  - Erros: `400 Bad Request` (valores fora das faixas permitidas), `403 Forbidden` (perfil sem permissão de configuração).

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-033)

- **Domínio Puro (`apps/backend/src/modules/alertas/domain/`)**:
  - Entidade/Value Object `ParametrosOperacionaisUbs` com validação invariante pura (zero dependências externas).
  - Porta `RepositorioParametrosOperacionaisPort`.
- **Aplicação (`apps/backend/src/modules/alertas/application/use-cases/`)**:
  - `ObterParametrosOperacionaisUseCase`
  - `AtualizarParametrosOperacionaisUseCase` (coordena atualização, auditoria e disparo do recálculo).
- **Borda HTTP (`apps/backend/src/modules/alertas/api/controllers/`)**:
  - `ParametrosAlertasController` protegido por `SessionAuthGuard` e `RolesGuard`.

---

## 5. Cenários de teste em BDD (Gherkin — camadas A e C)

```gherkin
# language: pt
Funcionalidade: Configuração de Parâmetros Operacionais por UBS (RF027)

  Cenário: Farmacêutico Responsável atualiza limiar de vencimento e estoque de segurança com recálculo imediato
    Dado que a UBS "UBS Centro - Dr. João Silva Filho" possui limiar de vencimento de 90 dias e estoque de segurança de 7 dias
    E existe um lote de "Losartana 50 mg" que vence em 110 dias sem alerta ativo
    Quando o Farmacêutico Responsável alterar o limiar de vencimento para 120 dias e o estoque de segurança para 10 dias
    Então a API deve responder com status 200 e ponto de pedido de 25 dias (15 CAF + 10 segurança)
    E o lote de "Losartana 50 mg" deve passar imediatamente a ter um alerta ativo de "VENCIMENTO_PROXIMO"
    E um registro de auditoria deve ser gravado com os valores anteriores e novos

  Cenário: Bloqueio de alteração de parâmetros por Farmacêutico Residente
    Dado que o usuário autenticado possui perfil "FARMACEUTICO_RESIDENTE"
    Quando ele enviar uma requisição PUT para "/api/v1/alertas/parametros"
    Então a API deve rejeitar a operação com status 403 Forbidden
    E os parâmetros da UBS devem permanecer inalterados

  Cenário: Rejeição de parâmetros fora dos limites sanitários permitidos
    Dado que o usuário autenticado possui perfil "ADMINISTRADOR"
    Quando ele tentar configurar "limiarVencimentoDias" com valor 5 ou "cafLeadTimeDays" com valor 0
    Então a API deve retornar status 400 Bad Request detalhando as faixas válidas
```

---

## 6. Checklist de DoD e aceitação

- [ ] Contratos e função validadora pura exportados em `@farmaubs/shared`.
- [ ] Testes unitários de domínio (Camada A) cobrindo limites de borda dos parâmetros.
- [ ] Endpoints documentados no Swagger com `@ApiTags('Alertas e Parâmetros')`.
- [ ] Testes E2E/Contrato (Camada C) validando RBAC (`403` para Residente/Gerente, `200` para Farmacêutico Responsável/Admin), recálculo de alertas e gravação no log de auditoria.
