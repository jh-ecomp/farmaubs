# ADR-025 — Estratégia de Ambientes

Criado por: João Henrique

## Status
🟢 Decidido e documentado — 23/07/2026

## Contexto

O FarmaUBS, mesmo em fase de piloto gratuito, atende farmácias reais de UBSs parceiras, operando sobre dados reais de estoque de medicamentos e, potencialmente, dados de pacientes (RF010, identificador via CNS/CPF opcional). Isso exige tratamento de ambiente mais cauteloso do que um projeto sem uso real, mesmo estando ainda em fase pré-receita.

Ao mesmo tempo, a restrição de custo mínimo já estabelecida no ADR-021 (hospedagem em VPS única) pesa contra a criação de infraestrutura adicional dedicada a ambientes intermediários. O ADR-023 já resolveu o ambiente de desenvolvimento local de cada desenvolvedor via `docker-compose.dev.yml`. Este ADR decide o que existe além do ambiente de desenvolvimento local: se há um ambiente de homologação formal, e como ele se relaciona com produção em termos de infraestrutura e custo.

Restrição adicional relevante: qualquer ambiente de homologação não pode utilizar dados reais de pacientes (CNS/CPF), exigência decorrente diretamente do NF010 do documento de requisitos original (proteção de dados pessoais conforme LGPD), não apenas uma boa prática de engenharia.

### Opções avaliadas

**A — Apenas ambiente de desenvolvimento local e produção, sem homologação formal**

Vantagens: nenhum custo ou complexidade adicional além do já decidido.

Desvantagens: toda mudança avança diretamente do ambiente local de um desenvolvedor júnior para o ambiente utilizado por farmacêuticos reais, operando sobre estoque real de medicamentos — risco desproporcional ao ganho de simplicidade, dado que o sistema já está em uso real por UBSs parceiras. Rejeitada por risco operacional, não por custo.

**B — Ambientes de homologação e produção como stacks Docker Compose isolados, compartilhando a mesma VPS**

Vantagens: mitiga o risco de mudanças não validadas alcançarem diretamente farmacêuticos reais, sem exigir uma segunda máquina. Cada ambiente (homologação e produção) roda como uma stack Docker Compose independente (nome de projeto distinto, ex. `farmaubs-hml` e `farmaubs-prod`), cada uma com seu próprio banco PostgreSQL, container de API e frontend, isoladas por rede Docker, ainda que compartilhando os mesmos recursos físicos da VPS. Estabelece um caminho de deploy com amortecedor real: mudanças são validadas em homologação antes de promovidas a produção, sem custo de infraestrutura adicional.

Desvantagens: sem isolamento de falha física entre os ambientes — uma falha da VPS (hardware, disco cheio) afeta homologação e produção simultaneamente; este risco já existia independentemente da existência de homologação, sendo o mesmo identificado no ADR-021, não um risco novo introduzido por esta decisão. Recursos de CPU/RAM da VPS são compartilhados entre os dois ambientes — suficiente para a volumetria atual, mas um gatilho de revisão explícito caso a VPS fique com recursos insuficientes.

**C — Ambientes de homologação e produção em VPS fisicamente separadas**

Vantagens: isolamento de falha completo entre ambientes.

Desvantagens: dobra o custo de infraestrutura da fase pré-receita para mitigar um risco que a opção B já resolve suficientemente bem no estágio atual do produto (poucas UBSs parceiras, baixa frequência de deploy). Desproporcional ao momento atual, na mesma linha de raciocínio que já levou à rejeição de opções mais custosas em ADRs anteriores (ADR-001, ADR-021).

## Decisão

Adotar a seguinte estratégia de ambientes:

1. **Desenvolvimento local**: já resolvido pelo ADR-023, individual por desenvolvedor, via `docker-compose.dev.yml`.
2. **Homologação**: stack Docker Compose isolada (`farmaubs-hml`), rodando na mesma VPS de produção definida no ADR-021, com banco de dados, API e frontend próprios, isolados por rede Docker da stack de produção. O ambiente de homologação utiliza exclusivamente **dados sintéticos ou anonimizados** — nunca dados reais de pacientes (CNS/CPF), reforçando a exigência do NF010.
3. **Produção**: stack Docker Compose isolada (`farmaubs-prod`), na mesma VPS, operando sobre dados reais das UBSs parceiras.
4. **Promoção entre ambientes**: a promoção de uma mudança de homologação para produção é **manual** nesta fase — uma pessoa da equipe valida o comportamento em homologação e decide explicitamente promover para produção. A automação desse fluxo é deliberadamente adiada para o ADR-024 (pipeline de CI/CD), ainda não priorizado no primeiro backlog, evitando antecipar uma decisão que pertence a outro ADR.

## Consequências

**Positivas**
- Reduz significativamente o risco de mudanças não validadas afetarem diretamente farmacêuticos reais operando sobre estoque real de medicamentos.
- Nenhum custo de infraestrutura adicional em relação ao já decidido no ADR-021 — homologação e produção compartilham a mesma VPS.
- Conformidade reforçada com o NF010 ao proibir explicitamente dados reais de paciente em homologação.

**Negativas / trade-offs assumidos**
- Ausência de isolamento de falha física entre homologação e produção — risco já existente desde o ADR-021, não agravado por esta decisão, mas também não mitigado por ela.
- Recursos de CPU/RAM compartilhados entre os dois ambientes na mesma VPS — a ser monitorado como gatilho de revisão.
- Promoção manual exige disciplina da equipe para efetivamente validar em homologação antes de promover — sem automação, o processo depende de comportamento consistente da equipe, a ser reforçado quando o ADR-024 for tratado.

## Revisão

Esta decisão deve ser revisitada caso:
- A VPS única apresente contenção de recursos mensurável entre homologação e produção, justificando a separação física em VPS distintas (opção C).
- O produto passe a gerar receita, viabilizando orçamento para infraestrutura de homologação fisicamente isolada.
- O ADR-024 (pipeline de CI/CD) seja priorizado, momento em que a promoção manual entre ambientes deve ser reavaliada para possível automação parcial ou total.

## Decisões relacionadas
- ADR-021 — Provedor de nuvem e topologia de hospedagem (VPS única, base desta decisão)
- ADR-023 — Containerização e orquestração (Docker Compose, estrutura de arquivos reaproveitada para homologação/produção)
- ADR-024 — Pipeline de CI/CD (ainda não priorizado; automação futura da promoção entre ambientes)
