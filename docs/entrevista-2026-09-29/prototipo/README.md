# FarmaUBS - Protótipo de Gestão Farmacêutica (SUS / Atenção Básica)

Protótipo interativo completo do **Incremento 1** desenvolvido em **HTML5**, **Bootstrap 5** e **JavaScript puro (Vanilla)**, com interface fielmente baseada no sistema oficial **FarmaUBS** (`E:\PROJETOS\EXTENSAO\farmaubs`).

---

## 🧭 Menu Lateral Institucional (Sidebar Unificada)

Todas as telas do sistema contam com navegação lateral consistente no padrão FarmaUBS:
- **Identidade Visual**: Logotipo institucional do FarmaUBS, indicação `SMS Parnaíba/PI` e badge `SUS`.
- **Operações da Farmácia**:
  1. [**Dispensação**](dispensacao.html): Saída de medicamentos, baixa de estoque e atendimento de receitas com múltiplos itens.
  2. [**Recebimento**](recebimento.html): Entrada física de carga, conferência de remessas da CAF e registro de lotes e notas fiscais.
- **Controle & Estoque**:
  3. [**Estoque Atual**](estoque.html): Monitoramento analítico de saldos em tempo real, níveis de criticidade e rastreabilidade de lote.
  4. [**Inventário Mensal**](inventario.html): Conferência física cega, conciliação contábil, apuração de divergências e homologação oficial com emissão de Ata.
- **Rodapé da Sidebar**: Selo oficial da Secretaria Municipal de Saúde de Parnaíba/PI.
- **Responsividade**: Menu adaptado para desktop e botão hambúrguer para dispositivos móveis.

---

## 🖥️ Telas do Incremento 1

### 1. Tela de Login ([`login.html`](login.html))
- Baseada diretamente no componente `Login.tsx` do FarmaUBS.
- Logo oficial, cartão elevado, credenciais institucionais e badge `CNES / SUS`.
- Modal acessível *"FarmaUBS diz:"* para recuperação de senha.
- Redireciona diretamente para a tela principal de Dispensação.

### 2. Tela de Dispensação de Medicamentos ([`dispensacao.html`](dispensacao.html)) — *Principal do Incremento 1*
- **Métricas Superiores em Tempo Real**: Dispensas Hoje, Unidades Baixadas e Receitas Atendidas.
- **Hierarquia com Foco no Medicamento**:
  - **Campo de Busca Inteligente (Combobox)**: Filtro instantâneo com realce enquanto o usuário digita.
  - **Painel Sanitário de Lote & Validade**: Exibe Lote, Data de Validade e Estoque Disponível.
  - **Múltiplos Itens por Receita**: Permite adicionar vários medicamentos em uma mesma receita com posologia e baixa simultânea.
  - **Cartão SUS do Paciente**: Campo simplificado e opcional (CNS com máscara e validação).
- **Últimas Dispensas Realizadas**: Tabela em tempo real com comprovante de dispensação e estorno de atendimento.

### 3. Tela de Recebimento de Medicamentos ([`recebimento.html`](recebimento.html))
- **Métricas em Tempo Real**: Entradas Hoje, Unidades Ingressadas e Lotes Registrados.
- **Formulário de Entrada de Estoque**:
  - Registro de Nota Fiscal ou Guia de Remessa da CAF Central / Ministério da Saúde.
  - Seleção do medicamento com busca em tempo real.
  - Cadastro de novo Lote e Data de Validade do fabricante.
  - Quantidade recebida e sincronização instantânea com o catálogo de estoque compartilhado.
- **Últimos Recebimentos de Estoque**:
  - Tabela em tempo real com comprovante oficial *"FarmaUBS diz:"* e impressão do termo de recebimento.
  - Botão de estorno para anular entradas divergentes.

### 4. Tela de Estoque Atual ([`estoque.html`](estoque.html))
- **Métricas de Criticidade**: Total de Medicamentos, Total de Unidades, Itens em Baixo Estoque e Lotes com Validade Curta (< 90 dias).
- **Filtros Avançados**:
  - Busca por nome, lote ou princípio ativo em tempo real.
  - Filtro por Categoria (Analgésicos, Antibióticos, Anti-hipertensivos, Hipoglicemiantes, etc.).
  - Filtro por Status (Normal, Baixo Estoque, Esgotado/Crítico).
- **Tabela de Saldos**:
  - Exibição de lote, validade sanitária com alertas de proximidade e barras de nível de estoque.
  - Botões de ajuste rápido (`+` / `-`) com registro imediato no LocalStorage.
- **Ficha de Rastreabilidade do Lote**: Modal *"FarmaUBS diz:"* com dados do fabricante, localização na farmácia e curva de consumo.

### 5. Tela de Inventário Mensal ([`inventario.html`](inventario.html))
- **Métricas do Ciclo**: Itens Auditados / Total, Divergências Encontradas, Acurácia Global do Estoque (%) e Total Físico Apurado.
- **Lançamento de Contagem Física (Item por Item)**:
  - Seleção por busca em tempo real com pré-carregamento do saldo teórico do sistema.
  - Entrada da quantidade física contada nas prateleiras.
  - **Cálculo de Divergência em Tempo Real**:
    - `0 (Estoque Batendo)`: Destaque verde com conformidade contábil.
    - `+X (Sobra no Estoque)`: Destaque azul/âmbar com obrigatoriedade de justificativa.
    - `-X (Falta no Estoque / Ruptura)`: Destaque vermelho com obrigatoriedade de motivo sanitário.
  - Seletor de Motivo Sanitário (Avaria, Validade Vencida, Erro de Dispensação, Erro de NF, Sobra, etc.).
- **Mapa de Conciliação Físico vs. Contábil**:
  - Tabela completa com status (Conferido / Pendente), badges de divergência e botão de edição de contagem.
  - Filtro dinâmico: Todos os itens, Apenas com Divergência, Apenas Conferidos e Apenas Pendentes.
- **Homologação e Fechamento**:
  - Modal *"FarmaUBS diz:"* de homologação oficial.
  - Ajusta automaticamente o saldo de estoque do sistema para coincidir com a contagem física.
  - Emissão e impressão da **Ata Oficial de Homologação de Inventário SUS** com campos de assinatura do farmacêutico e coordenação.

---

## 🔄 Sincronização de Estoque entre as Telas

Todas as telas do Incremento 1 compartilham o mesmo estado centralizado via `localStorage`:
- **Dispensação** (`dispensacao.html`) deduz unidades do estoque ao concluir atendimentos.
- **Recebimento** (`recebimento.html`) adiciona unidades e registra novos lotes.
- **Estoque Atual** (`estoque.html`) reflete os saldos atualizados e permite ajustes operacionais.
- **Inventário Mensal** (`inventario.html`) concilia os saldos reais e homologa o fechamento do ciclo.

---

## 🚀 Como Executar

Basta abrir qualquer um dos arquivos `.html` diretamente no seu navegador preferido (Google Chrome, Firefox, Edge, etc.):
- Ponto de entrada: [`login.html`](login.html) ou [`index.html`](index.html).
- Acesso direto às telas:
  - [`dispensacao.html`](dispensacao.html)
  - [`recebimento.html`](recebimento.html)
  - [`estoque.html`](estoque.html)
  - [`inventario.html`](inventario.html)
