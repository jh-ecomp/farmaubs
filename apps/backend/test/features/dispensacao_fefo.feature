# language: pt
Funcionalidade: Busca Textual e Sugestão FEFO de Medicamentos (RF010)

  Como farmacêutico operando a dispensação na UBS
  Quero buscar medicamentos e receber a indicação automática do lote com vencimento mais próximo (FEFO)
  Para priorizar a saída dos lotes que vencem primeiro e evitar o desperdício de insumos

  Cenário: Busca por fragmento de nome do princípio ativo
    Dado que existem os medicamentos "Dipirona 500mg" e "Amoxicilina 500mg" cadastrados
    Quando o farmacêutico buscar pelo termo "amox"
    Então o resultado deve conter exatamente 1 medicamento
    E o nome retornado deve ser "Amoxicilina 500mg"

  Cenário: Sugestão do lote com vencimento mais próximo (FEFO)
    Dado que a UBS possui o lote "LOTE-A" com vencimento em "2026-12-01" e saldo 100
    E possui o lote "LOTE-B" com vencimento em "2026-10-15" e saldo 50
    Quando o caso de uso ObterSugestaoLotesFefo for executado para o medicamento
    Então o loteSugerido deve ser o "LOTE-B"
    E o lote "LOTE-B" deve ter sugeridoFefo marcado como verdadeiro

  Cenário: Descarte de lotes vencidos da sugestão de saída
    Dado que a UBS possui um lote com data de validade anterior à data de hoje
    Quando a consulta de lotes para dispensação for executada
    Então o lote vencido não deve ser sugerido para a dispensa
    E deve ter a flag vencido como verdadeira
