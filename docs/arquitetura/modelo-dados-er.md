# Modelo de dados e diagrama relacional (FarmaUBS)

Este documento apresenta a estrutura unificada das tabelas do banco de dados PostgreSQL do FarmaUBS, incluindo chaves primárias, chaves estrangeiras, restrições de integridade e políticas de Row-Level Security (RLS).

---

## 1. Diagrama de entidade e relacionamento (ER)

```mermaid
erDiagram
    municipios ||--o{ unidades_saude : "possui"
    municipios ||--o{ documentos_entrada : "pertence"
    municipios ||--o{ lotes : "isola"
    municipios ||--o{ movimentacoes_estoque : "audita"

    unidades_saude ||--o{ user_units : "vincula"
    unidades_saude ||--o{ documentos_entrada : "recebe"
    unidades_saude ||--o{ lotes : "armazena"
    unidades_saude ||--o{ movimentacoes_estoque : "movimenta"

    perfis ||--o{ users : "define permissao"

    users ||--o{ user_units : "associado"
    users ||--o{ sessions : "inicia"
    users ||--o{ documentos_entrada : "registra como recebedor"
    users ||--o{ movimentacoes_estoque : "opera"

    produtos ||--o{ lotes : "especifica"
    produtos ||--o{ recebimento_itens : "identifica"

    fabricantes ||--o{ lotes : "produz"
    fabricantes ||--o{ recebimento_itens : "fabricado por"

    documentos_entrada ||--o{ recebimento_itens : "contem linhas"

    lotes ||--o{ recebimento_itens : "incrementa"
    lotes ||--o{ movimentacoes_estoque : "historico de saldo"

    municipios {
        uuid id PK
        varchar nome
        varchar uf
        varchar codigo_ibge UK
        boolean ativo
    }

    unidades_saude {
        uuid id PK
        uuid municipio_id FK
        varchar nome
        varchar cnes
        varchar endereco
        varchar responsavel_tecnico
        int caf_lead_time_days
        boolean ativo
    }

    perfis {
        uuid id PK
        varchar codigo UK
        varchar nome
        text descricao
    }

    users {
        uuid id PK
        uuid perfil_id FK
        varchar email UK
        varchar password_hash
        varchar nome
        varchar cpf UK
        varchar cns
        boolean ativo
        boolean deve_trocar_senha
        timestamptz ultimo_login
    }

    user_units {
        uuid id PK
        uuid user_id FK
        uuid unit_id FK
    }

    sessions {
        uuid id PK
        uuid user_id FK
        varchar token_hash UK
        varchar ip_origem
        varchar user_agent
        varchar status
        timestamptz expira_em
        timestamptz criada_em
        timestamptz revogada_em
    }

    produtos {
        uuid id PK
        varchar nome_comercial
        varchar principio_ativo
        varchar dosagem
        varchar forma_farmaceutica
        varchar apresentacao
        varchar unidade_medida
        varchar categoria
        boolean antimicrobiano
        boolean ativo
    }

    fabricantes {
        uuid id PK
        varchar razao_social
        varchar nome_fantasia
        varchar cnpj UK
        boolean ativo
    }

    documentos_entrada {
        uuid id PK
        uuid municipio_id FK
        uuid ubs_id FK
        uuid usuario_recebedor_id FK
        uuid estornado_por_id FK
        varchar numero_documento
        varchar tipo_documento
        varchar fornecedor_origem
        varchar status
        timestamptz data_recebimento
        timestamptz estornado_em
        text motivo_estorno
    }

    recebimento_itens {
        uuid id PK
        uuid municipio_id FK
        uuid documento_entrada_id FK
        uuid produto_id FK
        uuid fabricante_id FK
        uuid lote_id FK
        varchar numero_lote
        date data_validade
        int quantidade_recebida
        text observacoes
    }

    lotes {
        uuid id PK
        uuid municipio_id FK
        uuid ubs_id FK
        uuid produto_id FK
        uuid fabricante_id FK
        varchar numero_lote
        date data_validade
        int saldo_atual
        varchar status
    }

    movimentacoes_estoque {
        uuid id PK
        uuid municipio_id FK
        uuid ubs_id FK
        uuid lote_id FK
        uuid usuario_id FK
        uuid documento_referencia_id
        varchar tipo_movimentacao
        varchar tipo_documento_referencia
        int quantidade
        int saldo_anterior
        int saldo_posterior
        text justificativa
        timestamptz created_at
    }
```

---

## 2. Tabelas e regras de negócio no banco de dados

### Catálogo e administração
- **`municipios`:** Cidades atendidas pelo sistema. Chave natural `codigo_ibge`.
- **`unidades_saude`:** Unidades Básicas de Saúde (UBSs) vinculadas ao município. Possui CNES e prazo médio de entrega da CAF (`caf_lead_time_days`).
- **`perfis`:** Perfis RBAC do sistema: `ADMINISTRADOR`, `GERENTE`, `FARMACEUTICO_RESPONSAVEL`, `FARMACEUTICO_RESIDENTE`.
- **`users`:** Operadores do sistema com hash bcrypt de senha e flags de segurança (`deve_trocar_senha`).
- **`user_units`:** Associação N:N entre usuários e as UBSs em que possuem autorização de atuação.
- **`sessions`:** Controle de sessão server-side. Armazena hash SHA-256 do token para revogação rápida e expiração deslizante.

### Catálogo farmacêutico e estoque
- **`produtos`:** Medicamentos e insumos da Relação Municipal de Medicamentos Essenciais (REMUME). Índices textuais em `lower(principio_ativo)` e `lower(nome_comercial)`.
- **`fabricantes`:** Laboratórios farmacêuticos fornecedores com CNPJ único e busca em `lower(nome_fantasia)`.
- **`lotes`:** Registro do saldo físico por UBS. Restrição de unicidade composta `uq_lotes_ubs_produto_lote_fabricante` e checagem de saldo não negativo (`saldo_atual >= 0`).

### Recebimento e rastreabilidade
- **`documentos_entrada`:** Cabeçalho da remessa física (Guia CAF ou Nota Fiscal) com origem, número, data de conferência e status (`CONCLUIDO` ou `ESTORNADO`).
- **`recebimento_itens`:** Linhas da guia com quantidade positiva conferida, fabricante, lote e validade.
- **`movimentacoes_estoque`:** Livro-razão imutável de movimentação. Registra `ENTRADA_RECEBIMENTO`, `SAIDA_DISPENSACAO`, `ESTORNO_ENTRADA` e ajustes com saldo anterior e posterior para auditoria.

---

## 3. Políticas de Row-Level Security (RLS)

O isolamento de dados no PostgreSQL (ADR-002, ADR-016) é aplicado por município e por unidade de saúde:

| Tabela | Variável de sessão PostgreSQL | Regra de visibilidade |
| --- | --- | --- |
| `documentos_entrada` | `app.municipio_id` / `app.current_ubs_id` | Visível apenas para o município e a UBS ativa na requisição |
| `recebimento_itens` | `app.municipio_id` | Vinculada ao escopo do município do documento de entrada |
| `lotes` | `app.municipio_id` / `app.current_ubs_id` | Saldo isolado estritamente por UBS |
| `movimentacoes_estoque` | `app.municipio_id` / `app.current_ubs_id` | Livro-razão isolado por UBS |
| `users` | `app.municipio_id` | Administradores municipais enxergam apenas usuários da sua lotação |
