# DI-06 feat(dispensacao): Componente de Identificação do Paciente: Formulário obrigatório (CNS, CPF, Nome, Data Nasc) e histórico

---

- **Épico**: Dispensação de Medicamentos (RF010, RF012, NF009, NF017)
- **Requisitos Funcionais**: RF010 (Identificação Obrigatória do Paciente), RF012 (Histórico de Consumo)
- **Requisitos Não-Funcionais**: NF001 (Interface sem Flashes), NF017 (Máscaras e Validação de Dados Pessoais na UI)
- **ADRs Vinculadas**: ADR-011 (React 19 + Tailwind CSS), ADR-013 (TanStack Query), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-034 (Workspace Mobile Expo), ADR-035 (Governança e Orquestração com Moonrepo)

---

## 1. História de usuário

> **Como** farmacêutico operando o FarmaUBS na bancada de atendimento,  
> **quero** um formulário de identificação do paciente com preenchimento obrigatório e máscaras automáticas para CNS (15 dígitos), CPF (11 dígitos formatados), nome completo e data de nascimento, integrado a um painel que exibe automaticamente o histórico de retiradas recentes do paciente,  
> **para que** eu possa cadastrar ou localizar o paciente com agilidade e identificar na hora se ele já retirou o medicamento recentemente, coibindo abusos ou tratamentos duplicados (RF010, RF012).

---

## 2. Regras de negócio e casos de borda

1. **Campos Obrigatórios e Máscaras de Entrada**:
   - **Cartão Nacional de Saúde (CNS)**:
     - Máscara visual: `### #### #### ####` (15 dígitos).
     - Validação instantânea: impede caracteres não numéricos e valida tamanho ao perder o foco (`onBlur`).
   - **CPF**:
     - Máscara visual: `###.###.###-##`.
     - Validação instantânea através da função `validarCPF` do `@farmaubs/shared`. Exibe mensagem de erro caso o CPF seja inválido.
   - **Nome Completo**:
     - Campo de texto livre com autocapitalização visual das iniciais.
     - Validação: mínimo de 3 caracteres.
   - **Data de Nascimento**:
     - Seletor de data e input com máscara `DD/MM/AAAA`.
     - Validação: não aceita datas futuras e calcula dinamicamente a idade atual do paciente exibindo um badge discreto (ex.: "42 anos").

2. **Busca e Autocompletação Dinâmica**:
   - Ao digitar no campo de CPF ou CNS, o componente dispara uma busca via TanStack Query (debounce de 300ms).
   - Se o paciente já for localizado no banco de dados da UBS, os demais campos (Nome e Data de Nascimento) são preenchidos automaticamente, habilitando o botão de prosseguir.

3. **Painel de Histórico de Consumo (Alerta de Uso Irracional)**:
   - Uma vez identificado o paciente, o componente exibe um card lateral ou gaveta expansível com as retiradas dos últimos 90 dias.
   - Se o paciente tiver retirado o mesmo medicamento há menos de 25 dias, um banner visual na cor âmbar/laranja alerta:  
     `⚠️ Atenção: Paciente retirou [Medicamento] há X dias. Ciclo padrão de 30 dias ainda em andamento.`

4. **Acessibilidade e Usabilidade (ADR-032)**:
   - Navegação completa por teclado (`Tab`, `Shift+Tab`).
   - Todos os inputs possuem `id`, `name`, `label` associado via `htmlFor` e `aria-invalid` / `aria-describedby` para leitores de tela em caso de erro de validação.

---

## 3. Contratos de dados e protocolo HTTP

### 3.1 Consumo da API no Frontend (`paciente.service.ts`)
- `GET /api/v1/dispensacao/pacientes?termo={query}`: Autocompletar paciente existente.
- `GET /api/v1/dispensacao/pacientes/:id/historico`: Carregar histórico de dispensas dos últimos 90 dias.

### 3.2 Compartilhamento Arquitetural com `@farmaubs/shared` e App Mobile (`apps/mobile` - DI-MOB-01)
- **Contratos e Tipos Exportados em `packages/shared/src/dispensacao/paciente.types.ts`**:
  - `PacienteDto`: Dados cadastrais (`id`, `cns`, `cpf`, `nomeCompleto`, `dataNascimento`).
  - `HistoricoConsumoDto`: Registros de retiradas (`medicamentoId`, `nomeMedicamento`, `dataDispensacao`, `diasDesdeUltimaRetirada`, `quantidade`).
  - `IdentificarPacienteRequest`: Critérios de busca por CPF ou CNS.
- **Validações Puras Reutilizáveis**:
  - `validarCPF(cpf: string): boolean`: Função matemática pura compartilhada sem dependência de DOM.
  - `validarCNS(cns: string): boolean`: Validação dos algoritmos de CNS definitivos (iniciados com 1 ou 2) e provisórios (iniciados com 7, 8 ou 9).
  - `formatarCPF(cpf: string): string` e `formatarCNS(cns: string): string`.
- **Paridade com Mobile**:
  - A interface Web (`apps/frontend`) implementa a busca com inputs HTML/Tailwind, enquanto o aplicativo nativo (`apps/mobile` - história `DI-MOB-01`) consome os mesmos DTOs e funções utilitárias através de componentes nativos (`<TextInput>`, `<KeyboardAvoidingView>`).
- **Diretrizes para Ciclos Independentes de Desenvolvimento**:
  - *Cenário A (Mobile já implementou DI-MOB-01)*: O Frontend Web importa diretamente `PacienteDto`, `validarCPF`, `validarCNS` e `formatarCPF` de `@farmaubs/shared`, garantindo testes imediatos e paridade de validação.
  - *Cenário B (Mobile ainda NÃO implementou DI-MOB-01)*: O Frontend Web cria ou exporta essas funções e interfaces puras em `packages/shared/src/dispensacao/paciente.types.ts` com testes unitários em `packages/shared`, deixando o contrato pronto para o time Mobile sem criar acoplamento cruzado entre apps.

---

## 4. Escopo Técnico da implementação

### Frontend (`apps/frontend/src/`)
- **`components/dispensacao/IdentificacaoPacienteForm.tsx`**:
  - Formulário com `react-hook-form` e schema `zod` com os 4 campos obrigatórios.
  - Máscaras integradas para CPF (`000.000.000-00`), CNS (`000 0000 0000 0000`) e Data (`DD/MM/AAAA`).
- **`components/dispensacao/HistoricoConsumoPacienteCard.tsx`**:
  - Tabela ou lista compacta com as últimas retiradas e badges de intervalo de dias.
- **`hooks/usePacienteDispensacao.ts`**:
  - Hook customizado gerenciando busca com debounce, cache via TanStack Query e estado do paciente selecionado.
- **Testes da Camada D**:
  - `components/dispensacao/IdentificacaoPacienteForm.spec.tsx`: Validação de preenchimento obrigatório dos 4 campos, acionamento das máscaras e renderização acessível de mensagens de erro.

---

## 5. Cenários de teste em BDD (Gherkin — camada D)

```gherkin
# language: pt
Funcionalidade: Formulário de Identificação do Paciente na UI (Camada D)

  Cenário: Bloqueio de avanço quando campos obrigatórios estão incompletos
    Dado que o farmacêutico preenche apenas o nome do paciente na tela
    Quando tentar avançar para a seleção de medicamentos
    Então o sistema deve exibir mensagens de erro para CNS, CPF e Data de Nascimento
    E o formulário deve impedir a submissão

  Cenário: Autocompletação de paciente ao digitar CPF cadastrado
    Dado que o paciente com CPF "123.456.789-09" já existe no município
    Quando o farmacêutico digitar o CPF completo no campo
    Então os campos "Nome Completo" e "Data de Nascimento" devem ser preenchidos automaticamente
    E o histórico de consumo do paciente deve ser renderizado

  Cenário: Alerta visual de medicamento de uso contínuo retirado recentemente
    Dado que o paciente selecionado retirou "Losartana 50mg" há 10 dias
    Quando o painel de histórico de consumo for carregado
    Então deve ser exibido um alerta em destaque informando a retirada recente
```

---

## 6. Checklist de DoD e aceitação

- [ ] Os 4 campos (CNS, CPF, Nome e Data de Nascimento) são estritamente validados antes de permitir o avanço.
- [ ] Máscaras de entrada aplicadas de forma reativa sem travar a digitação.
- [ ] Painel de histórico dos últimos 90 dias renderizado com destaque para possíveis retiradas antecipadas.
- [ ] Conformidade com acessibilidade WCAG 2.1 AA (foco, labels e tags aria).
- [ ] Testes da Camada D (Vitest + React Testing Library) aprovados.
