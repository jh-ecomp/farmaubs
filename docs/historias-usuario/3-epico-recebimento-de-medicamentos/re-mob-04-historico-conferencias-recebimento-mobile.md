# RE-MOB-04 feat(recebimento): Consulta de Histórico de Conferências e Recebimentos no Celular (RF008, RF028)

---

- **Épico**: Recebimento de Medicamentos (RF008, RF028, NF001, NF002, NF007)
- **Camada**: Mobile (`apps/mobile`)
- **Requisitos Funcionais**: RF008 (Registro de Entrada de Medicamentos), RF028 (Consulta de Histórico e Log de Auditoria)
- **Requisitos Não-Funcionais**: NF001 (Interface Intuitiva com Menos Cliques), NF002 (Ergonomia Touch em Campo), NF007 (Download Rápido de Planilha e Resposta Ágil)
- **ADRs Vinculadas**: ADR-006 (RBAC), ADR-007 (API REST), ADR-022 (Monorepo), ADR-034 (Workspace Mobile Expo), ADR-035 (Governança Monorepo)

---

## 1. História de usuário

> **Como** farmacêutico ou atendente de farmácia em deslocamento no almoxarifado da UBS,  
> **quero** consultar pelo aplicativo mobile o histórico dos últimos recebimentos e conferências físicas homologadas na minha unidade,  
> **para que** eu possa verificar rapidamente se uma remessa já foi dada como recebida, conferir a quantidade de volumes e consultar o protocolo da nota/guia sem precisar ir até o terminal desktop (RF008, RF028).

---

## 2. Regras de negócio e casos de borda

1. **Escopo por UBS**:
   - A consulta retorna apenas os recebimentos registrados para a UBS ativa vinculada à sessão do usuário (`user.ubsId`).
2. **Chips de Filtragem Rápida**:
   - Atalhos: "Hoje" (filtro padrão inicial), "Últimos 7 dias", "Últimos 30 dias" e campo de busca rápida por termo (documento ou fornecedor).
3. **Detalhamento da Carga Conferida**:
   - Toque em um card abre Bottom Sheet exibindo a lista completa de medicamentos, fabricantes, lotes, validades e quantidades.
4. **Compartilhamento de Protocolo**:
   - Botão "Compartilhar Protocolo" que formata os dados essenciais e invoca a API nativa de compartilhamento (`Share.share`).
5. **Restrição de Estorno no Mobile**:
   - A operação de estorno com dedução de estoque permanece restrita à aplicação Desktop (RE-08). O app mobile apenas sinaliza com badge visual vermelho `ESTORNADO`.

---

## 3. Contratos de dados e Protocolo HTTP (DTOs / Tipagens)

```typescript
export interface RecebimentoListItemDTO {
  id: string;
  numeroDocumento: string;
  dataRecebimento: string;
  fornecedorOrigem: string;
  totalItens: number;
  totalUnidades: number;
  status: 'CONCLUIDO' | 'ESTORNADO';
  usuarioRecebedorNome: string;
}

export type PeriodoFiltroRecebimento = 'HOJE' | 'SETE_DIAS' | 'TRINTA_DIAS';
```

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-034)

- **Camada**: Mobile (`apps/mobile`).
- **Telas e Componentes**:
  - `apps/mobile/src/screens/recebimento/HistoricoRecebimentosScreen.tsx`.
  - `apps/mobile/src/features/recebimento/components/RecebimentoDetalheSheet.tsx`.
- **Estratégia de Integração e Independência de Ciclos (Mobile ↔ Frontend Web)**:
  - Contra-parte Web: `RE-08`.
  - Contratos compartilhados em `@farmaubs/shared` (`packages/shared/src/recebimento/historico-recebimento.types.ts`).

---

## 5. Cenários de teste em BDD (Gherkin — camada Mobile)

```gherkin
# language: pt
Funcionalidade: Consulta de Histórico de Recebimentos no Celular (RE-MOB-04 / RF008, RF028)

  Contexto:
    Dado que o usuário está autenticado no aplicativo mobile com a UBS "UBS Central" selecionada
    E acessa a aba "Histórico de Recebimentos"

  Cenário: Visualização dos recebimentos do dia
    Quando a tela é carregada
    Então o chip "Hoje" deve estar ativo por padrão
    E a lista deve exibir os recebimentos homologados hoje para a "UBS Central"
    E cada card deve exibir o número do documento, origem e quantidade de itens

  Cenário: Consulta detalhada dos lotes recebidos
    Dado que a lista exibe o recebimento "NF 44921 - Distribuidora Saúde"
    Quando o usuário toca sobre o card do recebimento
    Então uma folha de detalhes deve ser exibida
    E deve listar todos os medicamentos, lotes, validades e quantidades que entraram no estoque
    E deve exibir o botão "Compartilhar Resumo"

  Cenário: Visualização de remessa estornada
    Dado que a remessa "NF 39100" foi cancelada e estornada no painel administrativo web
    Quando o usuário visualiza o card desta remessa no celular
    Então deve ser exibida a etiqueta "ESTORNADO" em destaque
    E os itens devem ser assinalados como cancelados no detalhamento
```

---

## 6. Checklist de DoD e aceitação

- [ ] Componente `HistoricoRecebimentosScreen` implementado no `apps/mobile/src/screens/recebimento/`.
- [ ] Hook `useHistoricoRecebimentos` implementado consumindo client da API compartilhado (`@farmaubs/shared`).
- [ ] Chips de filtro por período com animação e feedback háptico.
- [ ] Bottom Sheet de detalhe do recebimento com lista de lotes e validades.
- [ ] Integração com `Share.share` nativo para compartilhamento de protocolo.
- [ ] Testes de componentes mobile com React Native Testing Library cobrindo renderização, troca de chip e abertura de detalhe.
