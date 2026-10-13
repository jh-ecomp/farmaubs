# AC-MOB-03 Seleção e Alternância de UBS Ativa em Dispositivo Móvel (RF002, ADR-002)

- **Épico**: Acesso e Autenticação do Sistema
- **Camada**: Mobile (`apps/mobile`)
- **Requisitos Funcionais**: RF002 (Autenticação e Escopo de Unidade), RF025 (RBAC), RF026 (Topologia de UBS)
- **Requisitos Não-Funcionais**: NF001 (Usabilidade), NF002 (Ergonomia Mobile), NF009 (Menor Privilégio)
- **ADRs Vinculadas**: ADR-002 (Multi-tenancy e RLS), ADR-006 (RBAC), ADR-022 (Monorepo), ADR-034 (Workspace Mobile Expo)

---

## 1. História de Usuário

> **Como** farmacêutico, médico ou operador de saúde vinculado a mais de uma Unidade Básica de Saúde (UBS),  
> **quero** visualizar claramente qual UBS está ativa no topo do aplicativo e poder alternar de unidade através de um seletor nativo,  
> **para que** todas as minhas ações de verificação de estoque, recebimentos e dispensações sejam registradas rigorosamente sob o tenant e unidade física corretos (ADR-002, RF002).

---

## 2. Regras de Negócio e Casos de Borda

1. **Definição Automática da UBS Padrão**:
   - Caso o array `usuario.unidadeIds` contenha **apenas 1 unidade**, essa UBS é selecionada compulsoriamente como a unidade ativa. O seletor superior exibe o nome da unidade de forma estática sem abrir dropdown de troca.
   - Caso contenha **múltiplas unidades**, a primeira unidade da lista (ou a última utilizada salva em preferência local) é definida como ativa na inicialização.

2. **Seletor de Unidade Nativo (BottomSheet / Modal)**:
   - Um toque no cabeçalho ou menu na área "UBS Ativa: [Nome]" abre um seletor modal com a lista de unidades autorizadas pertencentes ao município do usuário.
   - Cada item da lista exibe o nome da UBS e um indicador visual (check) na unidade atualmente em uso.

3. **Invalidação e Limpeza de Estado Reativo**:
   - Ao trocar de UBS ativa:
     - O cabeçalho `x-unidade-id: <uuid>` enviado nas requisições HTTP da API é atualizado imediatamente.
     - Todas as consultas em cache (ex: saldos de estoque da unidade anterior, contagens de inventário em aberto) são invalidadas para evitar vazamento visual de dados de uma UBS para outra no mesmo dispositivo.
     - A interface emite um feedback sutil via `Toast` ou `SnackBar`: *"Unidade alterada para [Nome da UBS]"*.

---

## 3. Contratos de Dados e Tipagens (`@farmaubs/shared`)

### 3.1 Cabeçalho HTTP de Tenant
- Cabeçalho: `x-unidade-id: <UUID>`

### 3.2 Tipagens Consumidas
```typescript
import type { UnidadeSaudeDto, UsuarioAutenticado } from "@farmaubs/shared";

export interface ContextoUnidadeAtiva {
  unidadeAtivaId: string;
  unidadesAutorizadas: UnidadeSaudeDto[];
  alternarUnidade: (unidadeId: string) => void;
}
```

---

## 3.3 Estratégia de Integração e Independência de Ciclos (Mobile ↔ Frontend Web)

- **Contra-parte no Frontend Web**: `AC-19` (Contexto de autenticação: usuário atual, perfil e escopo de tenant).
- **Contratos Compartilhados (`@farmaubs/shared`)**:
  - `UnidadeSaudeDto`, `UsuarioAutenticado` e cabeçalho canônico `x-unidade-id`.
  - Padrão de propagação de escopo multi-tenant em clientes HTTP.
- **Se o Frontend Web já implementou AC-19**:
  - O Mobile reutiliza a mesma tipagem de `UnidadeSaudeDto` e a lógica de persistência da unidade ativa selecionada no cabeçalho `x-unidade-id`.
  - Adota a mesma convenção de invalidação de queries do TanStack Query ao alternar o identificador de UBS.
- **Se o Frontend Web ainda NÃO implementou AC-19**:
  - O time Mobile declara os contratos de alternância de UBS em `@farmaubs/shared`, garantindo que o cabeçalho `x-unidade-id` e a lista de unidades estejam padronizados para o time Web consumir posteriormente.

---

## 4. Critérios de Aceite Detalhados

- [ ] Identificação da UBS ativa presente de forma permanente no topo do layout autenticado do app mobile.
- [ ] Usuários com apenas 1 UBS vinculada visualizam a unidade sem opção de troca.
- [ ] Usuários multi-unidade acessam modal nativo para alternar a UBS em um toque.
- [ ] Invalidação imediata do cache de dados e propagação do novo `unidadeId` no header HTTP.
- [ ] Persistência da última UBS ativa selecionada no dispositivo para reaberturas futuras.

---

## 5. Cenários de Teste (BDD)

```gherkin
Funcionalidade: Seleção e Troca de UBS Ativa no Mobile (AC-MOB-03)

Cenário: 1. Seleção automática para usuário de unidade única
  Dado que o usuário logado possui apenas a unidade "UBS Central" em seu perfil
  Quando a interface principal for carregada
  Então o cabeçalho exibe "UBS Central"
  E nenhum menu de seleção de outras unidades é apresentado

Cenário: 2. Alternância de UBS para usuário multi-unidade
  Dado que o farmacêutico está logado com acesso às UBSs "Centro" e "Bela Vista"
  E a unidade ativa no momento é "Centro"
  Quando o farmacêutico toca no seletor de unidade e escolhe "Bela Vista"
  Então o cabeçalho é atualizado para "UBS Bela Vista"
  E as próximas requisições à API passam a enviar o cabeçalho com o ID de Bela Vista
  E os dados em tela são recarregados para o novo contexto
```
