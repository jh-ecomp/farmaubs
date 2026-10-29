# Ciclo de vida do medicamento na Atenção Primária (FarmaUBS)

Este documento descreve o fluxo operacional de ponta a ponta dos medicamentos nas Unidades Básicas de Saúde (UBS) de Parnaíba-PI, conectando as regras de negócio do SUS aos módulos do sistema.

---

## 1. Fluxo operacional integrado

```mermaid
flowchart TD
    A["1. Remessa Externa\n(CAF Central, DLOG/MS ou Doação)"] --> B["2. Chegada da Carga na UBS\n(Conferência física com Guia ou NF)"]
    B --> C{"3. Validação de Validade\n(Regras RF008 e RF024)"}
    
    C -->|Data de validade <= hoje| C1["Bloqueio imediato\n(Rejeição da carga)"]
    C -->|Validade < 6 meses (180 dias)| C2["Alerta de validade curta\n(Exige confirmação do farmacêutico)"]
    C -->|Validade regular| D["4. Efetivação da Entrada\n(Transação ACID com lock pessimista)"]
    C2 --> D

    D --> E["5. Atualização de Estoque na UBS\n- Cria ou incrementa saldo em lotes\n- Registra ENTRADA_RECEBIMENTO no livro-razão"]
    E --> F["6. Disponível para Dispensação"]

    F --> G["7. Atendimento ao Paciente\n(Prescrição médica / Receituário SUS)"]
    G --> H["8. Baixa no Estoque\n- Deduz saldo do lote selecionado\n- Registra SAIDA_DISPENSACAO no livro-razão"]

    D -.->|Se houver divergência física| I["9. Estorno com Justificativa\n- Valida se saldo atual >= recebido\n- Reverte saldo e registra ESTORNO_ENTRADA"]
```

---

## 2. Etapas detalhadas do ciclo

### Etapa 1: Identificação da remessa e documento fiscal
Os medicamentos chegam às UBSs acompanhados de uma guia de remessa da Central de Abastecimento Farmacêutico (CAF), nota fiscal ou guia de transferência do Ministério da Saúde. O farmacêutico ou operador registra no sistema:
- Número do documento de remessa (ex: `GUIA-CAF-2026/104`);
- Origem do fornecimento (CAF Central, Ministério da Saúde / DLOG, SESAPI, compra direta ou doação);
- Data e hora da conferência física.

### Etapa 2: Conferência física por item
Para cada item entregue, são checados:
1. **Produto no catálogo REMUME:** Busca textual pelo nome comercial ou princípio ativo.
2. **Fabricante / Laboratório:** Associação obrigatória ao CNPJ ou razão social do laboratório.
3. **Número do lote e data de validade:** Código gravado na cartela, frasco ou caixa e a data limite de uso.
4. **Quantidade recebida:** Quantidade física de unidades recebidas.

### Etapa 3: Regras de segurança sanitária (RF008 e RF024)
- **Bloqueio de itens vencidos:** O sistema recusa o registro se a data de validade for igual ou anterior à data corrente.
- **Alerta de validade curta:** Quando a validade for inferior a 180 dias (6 meses), o sistema exibe um alerta visual com o aviso `VALIDADE_CURTA`, exigindo confirmação explícita do farmacêutico para autorizar a entrada.

### Etapa 4: Atualização de saldo e rastreabilidade (ADR-008, ADR-017)
Ao confirmar a entrada:
- O lote é localizado ou criado na tabela `lotes` para aquela UBS específica.
- O saldo é atualizado através de transação atômica.
- Um registro imutável do tipo `ENTRADA_RECEBIMENTO` é gravado na tabela `movimentacoes_estoque`, registrando quem recebeu, quando, o saldo anterior e o saldo posterior.

### Etapa 5: Dispensação ao paciente
Durante a consulta ou atendimento na farmácia da UBS:
- O operador seleciona o medicamento prescrito e o lote disponível com melhor data de validade (princípio FEFO: *First Expire, First Out*).
- O sistema deduz a quantidade e grava uma movimentação do tipo `SAIDA_DISPENSACAO`.

### Etapa 6: Estorno e correções operacionais
Se uma carga for registrada incorretamente:
- O farmacêutico pode solicitar o estorno do recebimento informando justificativa textual mínima de 10 caracteres.
- O sistema valida se o saldo atual do lote ainda comporta a reversão (impedindo estornos caso parte do lote já tenha sido dispensada a pacientes).
- O estorno altera o status da entrada para `ESTORNADO` e registra uma movimentação do tipo `ESTORNO_ENTRADA`.
