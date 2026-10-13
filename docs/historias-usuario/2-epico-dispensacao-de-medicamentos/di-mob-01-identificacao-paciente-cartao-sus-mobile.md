# DI-MOB-01 Identificação do Paciente por Cartão SUS / CPF no App Mobile (RF010, RF012)

- **Épico**: Dispensação de Medicamentos
- **Camada**: Mobile (`apps/mobile`)
- **Requisitos Funcionais**: RF010 (Identificação Obrigatória do Paciente), RF012 (Histórico de Consumo), RF025 (RBAC), RF026 (Topologia de UBS)
- **Requisitos Não-Funcionais**: NF001 (Usabilidade), NF002 (Responsividade e Ergonomia Mobile), NF003 (Idioma pt-BR), NF011 (Segurança), NF017 (Máscaras de Dados Pessoais)
- **ADRs Vinculadas**: ADR-006 (Autenticação/Autorização), ADR-007 (API REST), ADR-022 (Monorepo), ADR-034 (Workspace Mobile Expo), ADR-035 (Governança Monorepo)

---

## 1. História de Usuário

> **Como** profissional de saúde ou farmacêutico em trânsito com dispositivo móvel na UBS,  
> **quero** identificar rapidamente o paciente através do Cartão Nacional de Saúde (CNS) ou CPF com máscaras automáticas, preenchimento assistido e consulta imediata de retiradas dos últimos 90 dias com destaque para bloqueios de retirada antecipada,  
> **para que** eu confirme a aptidão do usuário do SUS para receber os medicamentos na palma da mão com agilidade e rastreabilidade total (RF010, RF012).

---

## 2. Regras de Negócio e Casos de Borda Mobile

1. **Ergonomia e Máscaras de Digitação Mobile (NF001, NF002, NF017)**:
   - Os 4 campos obrigatórios de identificação:
     - **Cartão SUS (CNS)**: 15 dígitos com máscara `000 0000 0000 0000`, teclado numérico (`keyboardType="number-pad"`).
     - **CPF**: 11 dígitos com máscara `000.000.000-00`, teclado numérico (`keyboardType="number-pad"`).
     - **Nome Completo**: mínimo de 3 caracteres, autocapitalização de palavras (`autoCapitalize="words"`).
     - **Data de Nascimento**: formato `DD/MM/AAAA` com teclado numérico ou seletor de data nativo.
   - O layout utiliza `<KeyboardAvoidingView>` com scroll suave para que o teclado não cubra o botão "Avançar para Medicamentos".

2. **Autocompletação Dinâmica e Consulta à API**:
   - Ao completar 11 dígitos no CPF ou 15 no CNS, dispara consulta com debounce de 300ms para `GET /api/v1/dispensacao/pacientes?termo={query}`.
   - Paciente encontrado: autopreenche Nome e Data de Nascimento, vibrando suavemente o dispositivo (feedback tátil via haptics).
   - Paciente novo: permite cadastrar os dados diretamente pelo formulário mobile.

3. **Gaveta / Card Retrátil de Histórico Clínico Recente**:
   - Exibe as retiradas dos últimos 90 dias em formato de cartões compactos (`<FlatList>`).
   - Se o paciente retirou o mesmo medicamento há menos de 25 dias:
     - Badge âmbar de alerta: `⚠️ Retirada recente há X dias. Tratamento padrão de 30 dias em curso.`

4. **Sessão Segura e Isolamento de UBS Ativa**:
   - A requisição anexa o token seguro obtido via `sessionService` (`expo-secure-store`) e o cabeçalho `X-Tenant-Id` da UBS selecionada.

---

## 3. Contratos de Dados e Tipagens (`@farmaubs/shared`)

### 3.1 Rotas Consumidas
- `GET /api/v1/dispensacao/pacientes?termo={query}`
- `GET /api/v1/dispensacao/pacientes/:id/historico`

### 3.2 Tipagens Compartilhadas (`packages/shared/src/dispensacao/paciente.types.ts`)

```typescript
export interface PacienteDto {
  id: string;
  cns: string;
  cpf: string;
  nomeCompleto: string;
  dataNascimento: string;
}

export interface HistoricoConsumoDto {
  medicamentoId: string;
  nomeMedicamento: string;
  dataDispensacao: string;
  diasDesdeUltimaRetirada: number;
  quantidade: number;
}
```

---

## 3.3 Estratégia de Integração e Independência de Ciclos (Mobile ↔ Frontend Web)

- **Contra-parte no Frontend Web**: `DI-06` (Formulário de identificação do paciente e histórico).
- **Contratos Compartilhados (`@farmaubs/shared`)**:
  - `PacienteDto`, `HistoricoConsumoDto`, `IdentificarPacienteRequest`.
  - Funções puras: `validarCPF(cpf)`, `validarCNS(cns)`, `formatarCPF(cpf)`, `formatarCNS(cns)`.
- **Se o Frontend Web já implementou DI-06**:
  - O Mobile reutiliza diretamente os validadores matemáticos de CPF/CNS e DTOs exportados de `@farmaubs/shared`, sem duplicar regras de negócio nem expressões regulares.
  - Utiliza o mesmo endpoint `GET /api/v1/dispensacao/pacientes?termo=...` e formato de payload.
- **Se o Frontend Web ainda NÃO implementou DI-06**:
  - O desenvolvedor Mobile implementa ou estende as funções puras em `packages/shared/src/dispensacao/paciente.types.ts` e utilitários em `packages/shared/src/utils/`, acompanhadas de testes unitários Jest em `packages/shared`.
  - O aplicativo móvel consome via `@farmaubs/shared` sem qualquer dependência de código de tela do `apps/frontend`.

---

## 4. Critérios de Aceite Detalhados

- [ ] Campo de CNS e CPF com formatação reativa e teclado numérico dedicado.
- [ ] Validação matemática de CPF e CNS via funções puras de `@farmaubs/shared` (`validarCPF` e `validarCNS`).
- [ ] Autocompletação imediata ao localizar paciente existente sem perda de contexto na tela.
- [ ] Histórico de consumo dos últimos 90 dias apresentado em lista com badge de alerta para retiradas em menos de 25 dias.
- [ ] Botão de avanço habilitado apenas com os 4 campos devidamente preenchidos e válidos.

---

## 5. Cenários de Teste (BDD / Gherkin)

```gherkin
# language: pt
Funcionalidade: Identificação do Paciente no Aplicativo Mobile (DI-MOB-01 / RF010)

  Cenário: Preenchimento automático ao digitar CPF cadastrado
    Dado que o farmacêutico está na tela de identificação do paciente no app mobile
    Quando digitar os 11 dígitos de um CPF existente no banco municipal
    Então os campos "Nome Completo" e "Data de Nascimento" devem ser preenchidos automaticamente
    E o histórico de retiradas recentes deve ser exibido em cartões compactos

  Cenário: Bloqueio de avanço para CPF com dígitos verificadores inválidos
    Dado que o farmacêutico digita o CPF "111.222.333-44" inválido
    Quando retirar o foco do campo
    Então uma mensagem de erro "CPF inválido" deve ser exibida abaixo do campo
    E o botão "Avançar" deve permanecer desabilitado

  Cenário: Alerta de retirada recente em menos de 25 dias
    Dado que o paciente identificado retirou "Enalapril 10mg" há 12 dias
    Quando o histórico do paciente for carregado na tela
    Então um card de alerta âmbar deve destacar o intervalo recente de retirada
```

---

## 6. Checklist de DoD e Aceitação

- [ ] Formulário renderizado em React Native utilizando `@farmaubs/shared` para DTOs e validações.
- [ ] Testes de digitação, máscaras e validação estática de tipos (`moon run mobile:typecheck`) aprovados.
- [ ] Integração com `KeyboardAvoidingView` garantindo acessibilidade em telas pequenas (Android e iOS).
