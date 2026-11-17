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
  - **Campo de Busca Inteligente (Combobox)**: Filtro instantâneo com agrupamento por fármaco base e indicação do estoque total consolidado da UBS.
  - **Painel de Informações Sanitárias em 2 Linhas x 2 Colunas**:
    - **Linha 1, Coluna 1 (Lote do Medicamento)**: Seletor minimalista contendo **estritamente o código do lote** (`LT-2026C9`, `LT-2027C3`), acompanhado do único selo do painel (**`FEFO Recomendado`** ou **`Lote Alternativo`**).
    - **Linha 1, Coluna 2 (Data de Vencimento)**: Data de validade simples formatada (`DD/MM/AAAA`) sem contagem de dias, com coloração sanitária automática:
      - 🟢 **Verde** (`.badge-expiry-safe`): para vencimento em **mais de 180 dias**.
      - 🟡 **Amarelo** (`.badge-expiry-warning`): para vencimento de **90 até 180 dias**.
      - 🔴 **Vermelho** (`.badge-expiry-danger`): para vencimento em **menos de 90 dias**.
    - **Linha 2, Coluna 1 (Estoque do Lote)**: Saldo físico disponível do lote ativo selecionado (ex: `35 unid.`).
    - **Linha 2, Coluna 2 (Estoque Total UBS)**: Saldo consolidado somando todos os lotes do medicamento na farmácia da UBS (ex: `170 unid. (2 lotes)`).
  - **Múltiplos Itens por Receita**: Permite adicionar vários medicamentos em uma mesma receita com posologia e baixa simultânea.
  - **Cartão SUS do Paciente**: Campo simplificado e opcional (CNS com máscara e validação).
- **Filtro Avançado por Período**:
  - Filtro por range de datas (`De` e `Até`) para auditoria de dispensações ao longo de setembro e outubro de 2026.
  - Botão de limpeza rápida de filtros.
- **Relatório Oficial de Dispensações Imprimível**:
  - Botão *"Imprimir Relatório"* que gera relatório institucional SUS formatado (`FarmaReport`), com cabeçalho oficial de Parnaíba/PI, cartões de consolidação, agrupamento analítico por medicamento/lote e termo de conferência para assinatura.
- **Últimas Dispensas Realizadas**: Tabela em tempo real com comprovante de dispensação e estorno de atendimento.

### 3. Tela de Recebimento de Medicamentos ([`recebimento.html`](recebimento.html))
- **Métricas em Tempo Real**: Entradas Hoje, Unidades Ingressadas e Lotes Registrados.
- **Ciclo Realista de Abastecimento CAF**:
  - Cargas registradas em **09 de setembro de 2026** e **05 de outubro de 2026** para todos os 8 medicamentos do Rename com quantidades similares e compatíveis com a demanda mensal das UBS.
- **Filtro Avançado por Período**:
  - Filtro por range de datas (`De` e `Até`) para localizar notas e guias de remessa específicas.
- **Relatório Oficial de Recebimento Imprimível**:
  - Botão *"Imprimir Relatório"* que gera espelho detalhado das remessas recebidas da CAF Central, consolidando quantitativos por fármaco e fornecedor.
- **Formulário de Entrada de Estoque**:
  - Registro de Nota Fiscal ou Guia de Remessa da CAF Central / Ministério da Saúde.
  - Seleção do medicamento com busca em tempo real.
  - Cadastro de novo Lote e Data de Validade do fabricante.
  - Quantidade recebida e sincronização instantânea com o catálogo de estoque compartilhado.
- **Últimos Recebimentos de Estoque**:
  - Tabela em tempo real com comprovante oficial *"FarmaUBS diz:"* e impressão do termo de recebimento.
  - Botão de estorno para anular entradas divergentes.

### 4. Tela de Estoque Atual ([`estoque.html`](estoque.html))
- **Métricas de Criticidade**: Total de Medicamentos (fármacos únicos), Total de Unidades (somatório de todos os lotes), Medicamentos em Baixo Estoque e Lotes com Validade Curta (< 90 dias).
- **Regra Sanitária Fundamental (Soma de Lotes)**:
  - Medicamentos divididos em múltiplos lotes (ex: Losartana Potássica com Lote 1 de 35 unid. e Lote 2 de 135 unid.) **só são classificados como Estoque Baixo ou Crítico se a SOMA de todos os seus lotes for menor ou igual ao estoque mínimo**.
  - Evita falsos alertas de desabastecimento quando há frações menores de lotes prestes a vencer e remessas novas já em estoque.
- **Rastreabilidade Sanitária de Validade**:
  - Destaque em vermelho (`< 90d`) para lotes com validade crítica (ex: vencimento em nov/2026, dez/2026 e jan/2027).
  - Destaque em amarelo (`< 180d`) para lotes em atenção sanitária (vencimento entre 90 e 180 dias).
  - Badge verde seguro para lotes com validade superior a 180 dias.
- **Garantia de Saldos Não-Negativos**:
  - Mecanismos de salvaguarda contábil em todas as operações impedem que qualquer medicamento ou lote assuma valores negativos.
- **Filtros Avançados**:
  - Busca por nome, lote ou princípio ativo em tempo real.
  - Filtro por Categoria (Analgésicos, Antibióticos, Anti-hipertensivos, Hipoglicemiantes, etc.).
  - Filtro por Status (Normal, Baixo Estoque, Esgotado/Crítico).
- **Tabela de Saldos**:
  - Exibição de lote, validade sanitária com alertas de proximidade e barras de nível de estoque.
  - Botões de ajuste rápido (`+` / `-`) com registro imediato no LocalStorage.
- **Ficha de Rastreabilidade do Lote**: Modal *"FarmaUBS diz:"* com dados do fabricante, localização na farmácia, saldo do lote e estoque consolidado do fármaco.

### 5. Tela de Inventário Mensal ([`inventario.html`](inventario.html))
- **Ciclo Corrente Ativo**: Sempre configurado no mês corrente (**Outubro / 2026**), com métricas e conciliação em andamento.
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
  - Arquiva o ciclo homologado diretamente na tabela de histórico abaixo.
- **Histórico de Inventários Anteriores / Homologados**:
  - Seção dedicada abaixo do mapa de apuração contendo os ciclos encerrados.
  - **Inventário de 28 de Setembro de 2026**: Pré-carregado e 100% consistente com a linha do tempo de entradas e saídas de estoque.
  - **Tabela Concisa**:
    - `Ciclo`: Identificação do mês e ano.
    - `Data de Homologação`: Timestamp da chancela técnica pelo farmacêutico RT.
    - `Situação`: Selo verde de homologação oficial SUS.
    - `Última Edição`: Indicador de retificação (`—` se intacto, ou badge com data e tooltip do motivo).
    - `Ações`:
      - **Ata / Baixar**: Gera e imprime a Ata Oficial de Inventário do SUS para aquele ciclo com espelho físico/contábil e assinaturas.
      - **Editar / Retificar**: Modal de auditoria para retificar a contagem de qualquer item do inventário homologado.
  - **Rastreabilidade Sanitária (RDC 430/2020)**: Toda e qualquer retificação em ciclo homologado exige **obrigatoriamente motivo padronizado e justificativa técnica detalhada**, ficando arquivada na trilha de auditoria do sistema.

---

## 🔄 Sincronização de Estoque entre as Telas

Todas as telas do Incremento 1 compartilham o mesmo estado centralizado via `localStorage`, gerenciado por [`js/estoque-store.js`](js/estoque-store.js) (saldo, lote e validade de cada medicamento):
- **Dispensação** (`dispensacao.html`) deduz unidades do estoque ao concluir atendimentos.
- **Recebimento** (`recebimento.html`) adiciona unidades e registra novos lotes.
- **Estoque Atual** (`estoque.html`) reflete os saldos atualizados e permite ajustes operacionais.
- **Inventário Mensal** (`inventario.html`) concilia os saldos reais, homologa o fechamento do ciclo e mantém histórico auditável.

---

## 🚀 Como Executar

Basta abrir qualquer um dos arquivos `.html` diretamente no seu navegador preferido (Google Chrome, Firefox, Edge, etc.):
- Ponto de entrada: [`login.html`](login.html) ou [`index.html`](index.html).
- Acesso direto às telas:
  - [`dispensacao.html`](dispensacao.html)
  - [`recebimento.html`](recebimento.html)
  - [`estoque.html`](estoque.html)
  - [`inventario.html`](inventario.html)

