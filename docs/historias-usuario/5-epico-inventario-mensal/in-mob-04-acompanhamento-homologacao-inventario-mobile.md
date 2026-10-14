# IN-MOB-04 feat(inventario): Homologação e Resumo da Ata Oficial de Inventário no Celular (RF013, RF021, RF028)

---

- **Épico**: Inventário Mensal (RF013, RF021, RF028, NF001, NF006, NF007, NF009)
- **Camada**: Mobile (`apps/mobile`)
- **Requisitos Funcionais**: RF013 (Realizar Inventário Mensal), RF021 (Relatório de Inventário Mensal), RF028 (Ata Oficial de Auditoria e Exportação)
- **Requisitos Não-Funcionais**: NF001 (Interface Intuitiva), NF006 (Contraste Visual), NF007 (Resposta Ágil), NF009 (RBAC por Perfil)
- **ADRs Vinculadas**: ADR-006 (RBAC), ADR-007 (API REST), ADR-022 (Monorepo), ADR-034 (Workspace Mobile Expo), ADR-035 (Governança Monorepo)

---

## 1. História de usuário

> **Como** farmacêutico responsável técnico pela UBS com o smartphone,  
> **quero** revisar no celular o balanço executivo das contagens e divergências do inventário, confirmar a homologação definitiva com ajuste atômico dos saldos no sistema e visualizar os dados da Ata Oficial gerada (com número de registro e hash de integridade),  
> **para que** eu possa homologar a conferência mensal diretamente da farmácia e compartilhar o protocolo oficial com a gerência da unidade de maneira imediata (RF013, RF021, RF028).

---

## 2. Regras de negócio e casos de borda

1. **Controle de Acesso Estrito (RBAC)**:
   - Apenas usuários com perfil `FARMACEUTICO` ou `GERENTE` visualizam o botão de homologação ativa.
2. **Resumo Executivo da Apuração**:
   - Total de Itens Catalogados, Conformes, Sobras (+), Faltas (-) e Saldo Físico Global.
3. **Trava de Segurança Bloqueante**:
   - O botão de homologação fica rigorosamente desabilitado se houver qualquer item sem contagem física ou se alguma divergência permanecer pendente de justificativa válida (**IN-MOB-03**).
4. **Visualização e Compartilhamento da Ata Oficial**:
   - Número da Ata (ex.: `ATA-INV-2026/010`), Hash SHA-256 de integridade e farmacêutico com CRF.
   - Botão de compartilhamento nativo (`Share.share`) para canais institucionais.

---

## 3. Contratos de dados e Protocolo HTTP (DTOs / Tipagens)

```typescript
export interface ResumoHomologacaoDTO {
  totalItens: number;
  totalConformes: number;
  totalDivergencias: number;
  totalSobras: number;
  totalFaltas: number;
  saldoFisicoGlobal: number;
  todasDivergenciasSaneadas: boolean;
}

export interface InventarioAtaOficialDTO {
  numeroAta: string;
  dataEmissao: string;
  hashIntegridade: string;
  ubsNome: string;
  farmaceuticoNome: string;
  farmaceuticoCrf: string;
}
```

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-034)

- **Camada**: Mobile (`apps/mobile`).
- **Telas e Componentes**:
  - `apps/mobile/src/screens/inventario/HomologacaoInventarioScreen.tsx`.
  - `apps/mobile/src/features/inventario/components/AtaOficialCard.tsx`.
- **Estratégia de Integração e Independência de Ciclos (Mobile ↔ Frontend Web)**:
  - Contra-parte Web: `IN-08`.
  - Contratos compartilhados em `@farmaubs/shared` (`packages/shared/src/contracts/inventario/`).
  - Utilização do helper puro `verificarProntidaoHomologacao` de `@farmaubs/shared`.

---

## 5. Cenários de teste em BDD (Gherkin — camada Mobile)

```gherkin
# language: pt
Funcionalidade: Homologação e Emissão de Ata no Celular (IN-MOB-04 / RF013, RF028)

  Contexto:
    Dado que o farmacêutico está na tela de homologação do ciclo "2026/10"
    E todos os 100 itens foram contados e as 5 divergências estão justificadas

  Cenário: Homologação bem-sucedida e exibição da Ata
    Quando o usuário toca em "Confirmar Homologação"
    E confirma o diálogo de segurança
    Então a requisição deve ser enviada para a API
    E a tela deve exibir a Ata Oficial com o número "ATA-INV-2026/010"
    E o botão "Compartilhar Protocolo" deve estar visível
```

---

## 6. Checklist de DoD e aceitação

- [ ] Componente `HomologacaoInventarioScreen` com resumo executivo de conciliação.
- [ ] Trava bloqueante ativa caso haja itens não conferidos ou divergências sem justificativa.
- [ ] Integração com `Share.share` nativo para compartilhamento de protocolo.
- [ ] Testes automatizados com React Native Testing Library.
