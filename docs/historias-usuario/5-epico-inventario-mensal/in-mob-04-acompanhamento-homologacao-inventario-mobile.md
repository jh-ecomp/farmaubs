# IN-MOB-04: Homologação e Resumo da Ata Oficial de Inventário no Celular

**Épico:** 5 - Inventário Mensal  
**Camada:** `apps/mobile` (Expo React Native)  
**Requisitos Funcionais Relacionados:** RF-013, RF-021, RF-028  
**Requisitos Não Funcionais Relacionados:** RNF-001, RNF-006, RNF-007, RNF-009  
**ADRs Aplicadas:** ADR-006 (Contratos TypeScript via @farmaubs/shared), ADR-007 (TanStack Query), ADR-022 (Expo Mobile), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)  
**História Frontend Irmã:** IN-08 (Modal de Homologação e Ata Oficial: Resumo e Impressão)  
**Complexidade Estimada:** Média  

---

## 1. História de Usuário

**Como** Farmacêutico Responsável Técnico pela UBS com o smartphone,  
**Quero** revisar no celular o balanço executivo das contagens e divergências do inventário, confirmar a homologação definitiva com ajuste atômico dos saldos no sistema e visualizar os dados da Ata Oficial gerada (com número de registro e hash de integridade),  
**Para que** eu possa homologar a conferência mensal diretamente da farmácia e compartilhar o protocolo oficial com a gerência da unidade de maneira imediata.

---

## 2. Regras de Negócio e Casos de Borda Mobile

### 2.1 Tela de Homologação Mobile
- **Controle de Acesso Estrito (RBAC - RNF-009)**:
  - Apenas usuários com perfil `FARMACEUTICO` ou `GERENTE` visualizam o botão de homologação ativa. Usuários com outros papéis visualizam a tela em modo somente-leitura.
- **Resumo Executivo da Apuração**:
  - Total de Itens Catalogados na UBS.
  - Quantidade de Itens 100% Conformes.
  - Total de Sobras (+ unidades) e Total de Faltas (- unidades).
  - Saldo Físico Global Resultante.
- **Trava de Segurança Bloqueante**:
  - O botão de homologação fica rigorosamente desabilitado se houver qualquer item sem contagem física ou se alguma divergência permanecer pendente de justificativa válida (**IN-MOB-03**).
- **Submissão e Feedback**:
  - Ao tocar em `Confirmar Homologação`:
    - Dispara diálogo de confirmação nativo: "Deseja homologar o ciclo 2026/XX? Esta operação atualizará definitivamente os saldos físicos no sistema."
    - Executa mutação para `POST /api/v1/inventario/ciclos/:id/homologar`.
    - Vibração háptica de sucesso (`Haptics.notificationAsync(Success)`).

### 2.2 Visualização e Compartilhamento da Ata Oficial
- Após a homologação bem-sucedida, o app exibe a tela de confirmação oficial:
  - Número da Ata (ex.: `ATA-INV-2026/010`).
  - Hash SHA-256 de integridade do documento.
  - Data, hora e identificação do farmacêutico homologador com respectivo CRF.
  - Lista resumida dos ajustes efetuados.
- **Botão de Compartilhamento Nativo (`Share.share`)**:
  - Permite enviar o protocolo da Ata de Inventário formatado para WhatsApp, e-mail institucional ou salvar nos arquivos do dispositivo.
- **Observação Operacional**:
  - A impressão física formal da Ata completa com cabeçalho municipal e assinaturas em papel com carimbo permanece disponível no terminal desktop (IN-08).

---

## 3. Contratos de Dados e Tipagens (`@farmaubs/shared`)

```typescript
import {
  InventarioAtaOficialDTO,
  homologarInventarioSchema,
  ResumoHomologacaoDTO,
} from '@farmaubs/shared';

export interface UseHomologacaoInventarioMobileReturn {
  resumo: ResumoHomologacaoDTO | undefined;
  ataOficial: InventarioAtaOficialDTO | null;
  isLoading: boolean;
  isHomologando: boolean;
  podeHomologar: boolean;
  executarHomologacao: () => Promise<void>;
  compartilharAta: () => Promise<void>;
}
```

---

## 3.3 Estratégia de Integração e Independência de Ciclos (Mobile ↔ Frontend Web)

- **Contra-parte no Frontend Web**: `IN-08` (Modal de homologação: resumo das diferenças, impressão da Ata Oficial e exportação em XLSX).
- **Contratos Compartilhados (`@farmaubs/shared`)**:
  - `InventarioAtaOficialDTO`, `homologarInventarioSchema`, `ResumoHomologacaoDTO`.
  - Função pura de verificação de pendências para encerramento de ciclo.
- **Se o Frontend Web já implementou IN-08**:
  - O Mobile consome a mesma rota `POST /api/v1/inventario/ciclos/:id/homologar` e o mesmo DTO da Ata Oficial gerada pelo backend, formatando o resumo para visualização vertical e compartilhamento de arquivo via `expo-sharing`.
- **Se o Frontend Web ainda NÃO implementou IN-08**:
  - O desenvolvedor Mobile define os contratos de homologação e resumo da ata em `packages/shared/src/contracts/inventario/`, assegurando que o modal desktop use as mesmas estruturas quando for implementado.

---

## 4. Critérios de Aceite Detalhados

1. **Permissão Restrita**: Apenas farmacêuticos e gerentes podem acionar o botão de homologação no aplicativo.
2. **Bloqueio Automático por Pendências**: Se houver qualquer divergência não justificada, o app deve exibir mensagem de alerta e bloquear o botão de fechamento.
3. **Confirmação Explícita**: A homologação deve exigir confirmação em diálogo de alerta antes de efetivar os ajustes de saldo.
4. **Exibição do Hash e Número da Ata**: Após o fechamento, o aplicativo deve apresentar imediatamente o número oficial e o hash SHA-256 gerados pelo backend.
5. **Compartilhamento Mobile**: O botão de compartilhamento deve acionar a folha nativa do sistema operacional (`Share.share`).

---

## 5. Cenários de Teste em BDD (Gherkin em Português)

```gherkin
Funcionalidade: Homologação e Resumo da Ata Oficial de Inventário no Celular
  Como farmacêutico responsável da UBS
  Quero homologar o inventário mensal no aplicativo móvel
  Para consolidar os acertos de saldo e obter o protocolo oficial da ata

  Contexto:
    Dado que o farmacêutico está logado na UBS "UBS Centro de Saúde"
    E todas as contagens e justificativas do ciclo ativo foram concluídas

  Cenário: Homologação do ciclo com sucesso
    Quando o farmacêutico acessa a tela de homologação
    E o resumo aponta zero pendências de saneamento
    E toca no botão "Confirmar Homologação"
    E confirma o diálogo de aviso
    Então a API deve homologar o inventário e atualizar os saldos
    E a tela deve exibir o número da ata gerada "ATA-INV-2026/012"
    E o hash de segurança do documento

  Cenário: Compartilhamento do resumo oficial da Ata
    Dado que o inventário foi homologado
    Quando o farmacêutico toca no botão "Compartilhar Protocolo da Ata"
    Então o sistema operacional deve abrir a janela nativa de compartilhamento
    E o texto deve conter o número da ata, UBS, responsável técnico e balanço de divergências
```

---

## 6. Checklist de DoD (Definition of Done)

- [ ] Tela `HomologacaoInventarioScreen` implementada no `apps/mobile/src/screens/inventario/`.
- [ ] Verificação de papel RBAC (`FARMACEUTICO` / `GERENTE`) na renderização dos botões de ação.
- [ ] Validação de bloqueio caso haja pendências não saneadas.
- [ ] Mutação de homologação via TanStack Query invalidando caches de estoque e ciclos.
- [ ] Integração com `Share.share` nativo do React Native.
- [ ] Testes automatizados com React Native Testing Library cobrindo fluxo de homologação e bloqueio de pendências.
