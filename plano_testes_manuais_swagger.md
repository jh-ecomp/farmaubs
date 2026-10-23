# Roteiro de Testes Manuais no Swagger — Módulo de Recebimento (RE-01 a RE-04)

Este roteiro guia passo a passo a validação manual de todas as funcionalidades de **Recebimento de Medicamentos** diretamente na interface interativa do Swagger UI do FarmaUBS.

---

## 🌐 1. Pré-requisitos e Acesso

1. **Serviços Ativos:** Certifique-se de que o backend e o banco de dados estejam em execução:
   ```bash
   # Em um terminal na raiz do projeto:
   docker compose up -d postgres
   pnpm moon run backend:dev
   ```
2. **URL do Swagger UI:** Acesse no seu navegador:
   👉 **`http://localhost:3000/api/v1/docs`**

---

## 🔑 2. Passo 1: Autenticação no Swagger

As rotas de recebimento e catálogo exigem autenticação RBAC via Bearer Token.

1. No Swagger, localize a seção **Acesso** e abra o endpoint:  
   `POST /api/v1/acesso/login`
2. Clique em **Try it out** e utilize as credenciais de desenvolvimento (você pode testar com o Farmacêutico de Parnaíba ou de SP):
   - **Opção A (Parnaíba / PI):**
     ```json
     {
       "email": "farma.parnaiba@farmaubs.dev",
       "senha": "Farma@123456"
     }
     ```
   - **Opção B (São Paulo / SP):**
     ```json
     {
       "email": "farmaceutico.responsavel@farmaubs.dev",
       "senha": "Farma@123456"
     }
     ```
3. Clique em **Execute**.
4. Na resposta (Status **200 OK**), localize o campo `token` no corpo JSON:
   ```json
   {
     "ok": true,
     "token": "09f7fb00ed...",
     "usuario": { ... }
   }
   ```
5. Copie o valor do `token` (sem aspas).
6. Suba até o topo da página do Swagger, clique no botão verde **Authorize 🔓** (canto superior direito), insira o token no campo de valor e clique em **Authorize**. Agora o cadeado ficará fechado 🔒.

---

## 💊 3. Passo 2: Catálogo e Fabricantes (`RE-02`)

### Teste 2.1 — Busca Textual e por CATMAT de Medicamentos (RENAME/REMUME)
- **Endpoint:** `GET /api/v1/catalogo/produtos/busca`
- **Cenário A (Validação de Tamanho Mínimo):**
  - Parâmetro `termo`: `a` (apenas 1 caractere).
  - **Resultado Esperado:** `400 Bad Request` indicando que a busca exige no mínimo 2 caracteres.
- **Cenário B (Busca por Nome ou Princípio Ativo):**
  - Parâmetro `termo`: `Amoxicilina` (ou `Paracetamol`, `Dipirona`, `Losartana`).
  - **Resultado Esperado:** `200 OK` retornando as apresentações com campos enriquecidos da RENAME:
    - `codigoCatmat`: `267890`
    - `codigoAtc`: `J01CA04`
    - `componente`: `BASICO`
    - `antimicrobiano`: `true`
    - `controlado`: `false`
  - 📝 **Anote:** Copie o `id` (UUID) de um dos produtos retornados para usar nos passos de recebimento.
- **Cenário C (Busca por Código CATMAT Oficial do SUS):**
  - Parâmetro `termo`: `267890`
  - **Resultado Esperado:** `200 OK` encontrando diretamente a `Amoxicilina 500 mg Cápsula`.

### Teste 2.2 — Cadastro de Novo Fabricante / Laboratório
- **Endpoint:** `POST /api/v1/catalogo/fabricantes`
- **Body JSON:**
  ```json
  {
    "razaoSocial": "Laboratório Farmacêutico FarmaUBS S/A",
    "nomeFantasia": "FarmaUBS Pharma",
    "cnpj": "12345678000199"
  }
  ```
- **Resultado Esperado:** `201 Created` retornando o fabricante cadastrado com seu `id` (UUID).
- 📝 **Anote:** Copie o `id` do fabricante retornado.
- **Cenário de Conflito:** Clique em **Execute** novamente com o mesmo payload.
  - **Resultado Esperado:** `409 Conflict` informando que o CNPJ já se encontra cadastrado.

### Teste 2.3 — Listagem de Fabricantes Ativos
- **Endpoint:** `GET /api/v1/catalogo/fabricantes`
- **Resultado Esperado:** `200 OK` listando todos os laboratórios cadastrados em ordem alfabética.

---

## 📦 4. Passo 3: Efetivação de Recebimento de Cargas (`RE-03`)

- **Endpoint:** `POST /api/v1/recebimento/entradas`

### Teste 3.1 — Bloqueio Estrito de Medicamento Vencido (Regra Clínica SUS)
Envie uma remessa com a data de validade no passado:
```json
{
  "numeroDocumento": "NF-TESTE-VENCIDA/2026",
  "tipoDocumento": "NOTA_FISCAL",
  "fornecedorOrigem": "CAF Central",
  "itens": [
    {
      "produtoId": "<ID_DO_PRODUTO_COPIADO>",
      "fabricanteId": "<ID_DO_FABRICANTE_COPIADO>",
      "numeroLote": "LOT-VENC-01",
      "dataValidade": "2023-01-15",
      "quantidadeRecebida": 100
    }
  ]
}
```
- **Resultado Esperado:** `400 Bad Request` informando que *"Não é permitido receber lotes já vencidos"*.

---

### Teste 3.2 — Alerta de Validade Curta (< 180 dias)
Envie um lote com validade próxima (ex: daqui a 60 dias):
```json
{
  "numeroDocumento": "GUIA-CAF-CURTA/001",
  "tipoDocumento": "GUIA_CAF",
  "fornecedorOrigem": "CAF Central",
  "itens": [
    {
      "produtoId": "<ID_DO_PRODUTO_COPIADO>",
      "fabricanteId": "<ID_DO_FABRICANTE_COPIADO>",
      "numeroLote": "LOT-ALERTA-60D",
      "dataValidade": "2026-12-20",
      "quantidadeRecebida": 150
    }
  ]
}
```
- **Resultado Esperado:** `201 Created`
  - A carga é aceita no estoque com sucesso.
  - O array `avisos` retorna:
    ```json
    "avisos": [
      {
        "tipo": "VALIDADE_CURTA",
        "lote": "LOT-ALERTA-60D",
        "mensagem": "Lote LOT-ALERTA-60D vence em menos de 6 meses..."
      }
    ]
    ```

---

### Teste 3.3 — Recebimento Completo Normal (Carga Regular)
Envie uma nota com validade superior a 180 dias:
```json
{
  "numeroDocumento": "NF-REGULAR-8899",
  "tipoDocumento": "NOTA_FISCAL",
  "fornecedorOrigem": "Distribuidora Nacional de Medicamentos",
  "itens": [
    {
      "produtoId": "<ID_DO_PRODUTO_COPIADO>",
      "fabricanteId": "<ID_DO_FABRICANTE_COPIADO>",
      "numeroLote": "LOT-REG-2026",
      "dataValidade": "2028-06-30",
      "quantidadeRecebida": 500,
      "observacoes": "Caixas lacradas e armazenadas em temperatura ambiente"
    }
  ]
}
```
- **Resultado Esperado:** `201 Created`
  - Retorna o documento gravado com status `CONCLUIDO`.
  - Saldo final do lote: `500`.
  - Livro-razão registrado atomicamente em `movimentacoes_estoque` (`tipo: ENTRADA_RECEBIMENTO`).
  - 📝 **Anote:** Copie o `id` (UUID) desta entrada gerada para os testes do Passo 4 e 5!

### Teste 3.4 — Idempotência e Bloqueio de Duplicidade
Repita a execução exatamente do mesmo payload anterior (`NF-REGULAR-8899`).
- **Resultado Esperado:** `409 Conflict` informando que já existe um documento com o mesmo número cadastrado para esta UBS.

---

## 📜 5. Passo 4: Histórico e Consulta de Comprovante (`RE-04`)

### Teste 4.1 — Listar Histórico do Dia (`periodo: HOJE`)
- **Endpoint:** `GET /api/v1/recebimento/historico`
- **Parâmetros:**
  - `periodo`: `HOJE`
  - `pagina`: `1`
  - `limite`: `20`
- **Resultado Esperado:** `200 OK`
  - Lista paginada contendo as guias `GUIA-CAF-CURTA/001` e `NF-REGULAR-8899`.
  - Campo `podeEstornar: true` para ambas as entradas.

### Teste 4.2 — Detalhes e Termo de Recebimento
- **Endpoint:** `GET /api/v1/recebimento/entradas/{id}`
- **Parâmetro `id`:** Informe o UUID copiado no Teste 3.3.
- **Resultado Esperado:** `200 OK`
  - Retorna cabeçalho do documento, informações do fornecedor, data física, itens detalhados com medicamento, lote, fabricante, validade e saldo atual do estoque.

---

## 🔄 6. Passo 5: Estorno Atômico e Auditoria (`RE-04`)

- **Endpoint:** `POST /api/v1/recebimento/entradas/{id}/estorno`
- **Parâmetro `id`:** Informe o UUID copiado no Teste 3.3.

### Teste 5.1 — Validação de Justificativa Curta
- **Body JSON:**
  ```json
  {
    "motivo": "Erro"
  }
  ```
- **Resultado Esperado:** `400 Bad Request` informando que a justificativa deve conter no mínimo 10 caracteres.

### Teste 5.2 — Execução do Estorno com Sucesso
- **Body JSON:**
  ```json
  {
    "motivo": "Carga lançada com lote incorreto pelo operador na conferência"
  }
  ```
- **Resultado Esperado:** `200 OK`
  - Resposta confirma `status: "ESTORNADO"`.
  - Saldo do lote decrementado no banco (revertido de 500 para 0).
  - Lançamento compensatório registrado em `movimentacoes_estoque` com `tipo_movimentacao: "ESTORNO_RECEBIMENTO"`.

### Teste 5.3 — Bloqueio de Reestorno
Repita a execução de estorno para o mesmo documento.
- **Resultado Esperado:** `409 Conflict` com a mensagem *"O documento NF-REGULAR-8899 já se encontra estornado no sistema"*.

### Teste 5.4 — Conferência do Histórico Pós-Estorno
- **Endpoint:** `GET /api/v1/recebimento/entradas/{id}`
- **Resultado Esperado:** `200 OK`
  - O documento agora exibe `status: "ESTORNADO"`.
  - O campo `podeEstornar` mudou para `false`.
  - `motivoEstorno` exibe a justificativa informada.
