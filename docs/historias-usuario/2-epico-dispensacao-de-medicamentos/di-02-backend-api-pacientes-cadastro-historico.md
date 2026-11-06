# DI-02 feat(dispensacao): API de Pacientes: Validação obrigatória (CNS, CPF, Nome, Data Nasc), busca e histórico de consumo

---

- **Épico**: Dispensação de Medicamentos (RF010, RF012, NF009, NF010, NF017)
- **Requisitos Funcionais**: RF010 (Identificação Obrigatória do Paciente), RF012 (Histórico de Consumo por Paciente)
- **Requisitos Não-Funcionais**: NF009 (RBAC para Farmacêuticos), NF010 (Tempo de Resposta < 500ms), NF017 (LGPD e Validação Estrita)
- **ADRs Vinculadas**: ADR-002 (Escopo Multi-tenant), ADR-003 (Arquitetura Hexagonal), ADR-007 (Endpoints REST e Swagger), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camadas A e C), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de usuário

> **Como** farmacêutico autenticado no FarmaUBS,  
> **quero** consultar rapidamente um paciente por CPF, CNS ou nome, cadastrá-lo com validação obrigatória dos 4 campos clínicos (CNS de 15 dígitos, CPF válido, nome completo e data de nascimento) e visualizar seu histórico prévio de dispensas dos últimos 90 dias,  
> **para que** eu possa certificar a elegibilidade do atendimento, evitar dispensações duplicadas ou uso irracional antes do término do ciclo do medicamento (RF010, RF012).

---

## 2. Regras de negócio e casos de borda

1. **Obrigatoriedade e Validação dos 4 Campos do Paciente**:
   - `cns`: Exatamente 15 dígitos numéricos. Validado com algoritmo de Luhn/SUS quando aplicável.
   - `cpf`: 11 dígitos numéricos com validação matemática dos dígitos verificadores (utilizando `validarCPF` de `@farmaubs/shared`).
   - `nomeCompleto`: String com no mínimo 3 e máximo 150 caracteres, sem caracteres de controle.
   - `dataNascimento`: Data válida no formato ISO (`YYYY-MM-DD`). Rejeita datas futuras ou com mais de 130 anos.

2. **Unicidade de Cadastro por Município**:
   - O paciente é cadastrado dentro do município da UBS ativa da sessão.
   - Se já existir um paciente com o mesmo CPF no mesmo município, o sistema retorna o cadastro existente em vez de duplicar (`409 Conflict` ou reutilização idempotente).
   - Se o CPF já estiver cadastrado em outro município, permite o cadastro no município atual garantindo a integridade do isolamento municipal.

3. **Busca Flexível e Paginada de Pacientes (`GET /api/v1/dispensacao/pacientes`)**:
   - Parâmetro `termo`: Aceita CPF (com ou sem pontuação), CNS ou parte do nome (case-insensitive e sem acentos).
   - Retorna até 10 resultados mais recentes para autocompletar na interface.

4. **Histórico de Consumo do Paciente (`GET /api/v1/dispensacao/pacientes/:id/historico`)**:
   - Retorna todas as dispensações realizadas para o paciente nos últimos 90 dias.
   - Agrupado por medicamento, indicando: data da última retirada, quantidade retirada, posologia e dias decorridos desde a última retirada.
   - Alerta visual/semântico caso uma nova dispensa de medicamento de uso contínuo seja tentada antes de decorridos 25 dias da última retirada (ciclo padrão de 30 dias).

---

## 3. Contratos de dados e protocolo HTTP

### Endpoints REST (`PacienteController`)

| Método | Rota | Descrição | Roles Permitidos |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/dispensacao/pacientes` | Cadastra um novo paciente com os 4 campos obrigatórios | `FARMACEUTICO_RESPONSAVEL`, `FARMACEUTICO_RESIDENTE`, `ADMINISTRADOR` |
| `GET` | `/api/v1/dispensacao/pacientes` | Busca pacientes por CPF, CNS ou nome | `FARMACEUTICO_RESPONSAVEL`, `FARMACEUTICO_RESIDENTE`, `GERENTE`, `ADMINISTRADOR` |
| `GET` | `/api/v1/dispensacao/pacientes/:id/historico` | Consulta histórico de dispensas do paciente (últimos 90 dias) | `FARMACEUTICO_RESPONSAVEL`, `FARMACEUTICO_RESIDENTE`, `GERENTE`, `ADMINISTRADOR` |

### Contratos no `@farmaubs/shared` (`packages/shared/src/dispensacao/paciente.types.ts`)

```typescript
export interface CadastrarPacienteRequest {
  cns: string;
  cpf: string;
  nomeCompleto: string;
  dataNascimento: string; // YYYY-MM-DD
}

export interface PacienteDto {
  id: string;
  municipioId: string;
  cns: string;
  cpf: string;
  nomeCompleto: string;
  dataNascimento: string;
  ativo: boolean;
  criadoEm: string | Date;
}

export interface ItemHistoricoConsumoDto {
  dispensacaoId: string;
  dataDispensacao: string | Date;
  medicamentoId: string;
  medicamentoNome: string;
  quantidadeDispensada: number;
  posologia?: string;
  diasDesdeUltimaRetirada: number;
  possivelUsoIrracional: boolean;
}

export interface HistoricoPacienteResultado {
  paciente: PacienteDto;
  itensConsumo: ItemHistoricoConsumoDto[];
}
```

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-034)

### 1. Pacote Compartilhado (`@farmaubs/shared`)
- **`src/contracts/dispensacao/paciente.types.ts`**: Declarar interfaces de Request/Response DTOs e schema Zod `cadastrarPacienteSchema`.
- **`src/domain/validacoes/`**: Algoritmo puro de validação de CPF (`validarCPF`) e validação de formato/Luhn de CNS (`validarCNS`), compartilhados com backend, frontend e mobile.

### 2. Camada de Aplicação (`apps/backend/src/modules/dispensacao/application/`)
- **Use Cases** (Orquestradores de regras desacoplados de HTTP/ORM com método `execute()`):
  - `cadastrar-paciente.use-case.ts`: Executa validação de unicidade de CPF por município e orquestra persistência via `PacienteRepositoryPort`.
  - `buscar-pacientes.use-case.ts`: Busca textual rápida com limite de 10 registros para autocomplete.
  - `consultar-historico-paciente.use-case.ts`: Agregação dos últimos 90 dias de retiradas com cálculo de dias decorridos e flag de possível uso irracional.

### 3. Camada de Domínio (`apps/backend/src/modules/dispensacao/domain/`)
- **Entidades de Domínio**: `Paciente` (classe pura com regras de integridade e immutabilidade).
- **Portas (Interfaces)**:
  - `paciente.repository.port.ts`: Contrato de persistência (`buscarPorId`, `buscarPorCpfOuCns`, `salvar`, `buscarHistorico90Dias`).
- **Erros de Domínio**: `CpfInvalidoException`, `CnsInvalidoException`, `PacienteJaCadastradoException`.

### 4. Camada de Infraestrutura (`apps/backend/src/modules/dispensacao/infrastructure/`)
- **Adaptadores de Banco (`adapters/`)**:
  - `typeorm-paciente.repository.ts`: Implementa `PacienteRepositoryPort` executando queries parametrizadas com RLS municipal (`app.municipio_id`).
- **Adaptadores de Entrada HTTP (`controllers/`)**:
  - `paciente.controller.ts`: Endpoints REST (`POST /`, `GET /`, `GET /:id/historico`) recebendo DTOs validados via Pipes/Zod e delegando para os use cases.

---

## 5. Cenários de teste em BDD (Gherkin — camada A)

```gherkin
# language: pt
Funcionalidade: Gestão e Validação de Pacientes na Dispensação (Camada A)

  Cenário: Cadastro de paciente com sucesso com os 4 dados obrigatórios
    Dado que o farmacêutico informa CNS "123456789012345", CPF "12345678909", nome "Maria Souza" e data de nascimento "1985-04-12"
    Quando o caso de uso CadastrarPacienteUseCase for executado
    Então o paciente deve ser persistido com sucesso vinculado ao município da sessão
    E o identificador UUID deve ser retornado

  Cenário: Rejeição de cadastro com CPF inválido
    Dado que o farmacêutico informa um CPF com dígitos verificadores matematicamente incorretos
    Quando o caso de uso CadastrarPacienteUseCase for executado
    Então uma exceção CpfInvalidoException deve ser lançada
    E nenhum registro deve ser gravado no banco

  Cenário: Alerta de dispensação antecipada no histórico de consumo
    Dado que o paciente "João da Silva" retirou "Losartana 50mg" há 12 dias
    Quando o farmacêutico consultar o histórico de consumo do paciente
    Então o item "Losartana 50mg" deve constar com diasDesdeUltimaRetirada igual a 12
    E a flag possivelUsoIrracional deve ser retornada como verdadeira
```

---

## 6. Checklist de DoD e aceitação

- [x] Interfaces exportadas exclusivamente em `packages/shared/src/dispensacao/paciente.types.ts`.
- [x] DTOs validam rigorosamente CNS (15 dígitos), CPF (11 dígitos e cálculo de dígito), Nome e Data de Nascimento.
- [x] Endpoint `/api/v1/dispensacao/pacientes/:id/historico` calcula corretamente o intervalo de consumo.
- [x] Micro-TSDoc incluído em todas as funções públicas e use cases.
- [x] Testes unitários BDD (Camada A) cobrindo fluxo feliz e rejeições por validação.
- [x] Swagger documentado com exemplos representativos e códigos HTTP 200, 201, 400, 401, 403 e 409.
