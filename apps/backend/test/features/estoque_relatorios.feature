# language: pt
Funcionalidade: Relatórios estruturados de estoque em planilha XLSX
  Como farmacêutico responsável ou gerente da UBS
  Quero baixar relatórios de estoque em planilha Excel
  Para conciliar inventários e prestar contas sobre perdas (RF020, RF028)

  Cenário: Relatório de saldos atuais em planilha Excel
    Dado que a UBS "UBS-A" do município "Parnaíba" possui o lote "L1" de "Dipirona" com saldo 40 para o relatório
    Quando o farmacêutico gera o relatório "SALDOS_ATUAIS" da UBS "UBS-A" sem período
    Então o arquivo gerado deve ser uma planilha XLSX com nome iniciado por "relatorio_estoque_SALDOS_ATUAIS_UBS-A_"
    E a planilha deve ter o cabeçalho institucional "Município de Parnaíba - Secretaria Municipal de Saúde"
    E a planilha deve conter as colunas: "Medicamento, Princípio Ativo, Fabricante, Lote, Validade, Saldo, Status"

  Cenário: Relatório de perdas por vencimento com intervalo de datas
    Dado que a UBS "UBS-A" registrou as seguintes perdas para o relatório:
      | data       | medicamento | lote | quantidade | motivo        |
      | 2026-08-10 | Dipirona    | L1   | 100        | VENCIMENTO    |
      | 2026-08-20 | Amoxicilina | L2   | 50         | AVARIA_FISICA |
      | 2026-09-02 | Dipirona    | L1   | 30         | VENCIMENTO    |
    Quando o farmacêutico gera o relatório "PERDAS_VENCIMENTO" da UBS "UBS-A" de "2026-08-01" a "2026-08-31"
    Então o nome do arquivo gerado deve ser "relatorio_estoque_PERDAS_VENCIMENTO_UBS-A_2026-08-01_2026-08-31.xlsx"
    E a planilha deve listar 2 perdas
    E a última linha da planilha deve ser "Total Geral" com 150 unidades
