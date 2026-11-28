import {
  calcularDiasAteValidade,
  formatarDataCivilBrasil,
  obterIntervaloOntemHoje,
  ordenarLotesPorFEFO,
  validarReceitaAntimicrobiano,
} from "@farmaubs/shared";
import { runBootstrapProd } from "./bootstrap-prod";
import { assertQaSeedAllowed } from "./seed-qa";

describe("Scripts de Runtime e Fuso America/Sao_Paulo (Camada A — RL-02)", () => {
  describe("Fuso horário civil brasileiro entre 21h00 e 23h59 BRT (00h00–02h59 UTC)", () => {
    // 2026-11-24 às 22:30 BRT corresponde a 2026-11-25T01:30:00.000Z em UTC
    const noiteBrt = new Date("2026-11-25T01:30:00.000Z");

    it("mantém o dia civil 2026-11-24 em formatarDataCivilBrasil e obterIntervaloOntemHoje", () => {
      expect(formatarDataCivilBrasil(noiteBrt)).toBe("2026-11-24");
      expect(obterIntervaloOntemHoje(noiteBrt)).toEqual({
        dataInicio: "2026-11-23",
        dataFim: "2026-11-24",
      });
    });

    it("não marca lote com validade hoje (2026-11-24) como vencido às 22h30 BRT", () => {
      const lotes = ordenarLotesPorFEFO(
        [
          {
            id: "lote-hoje",
            numeroLote: "L-HOJE",
            dataValidade: "2026-11-24",
            saldoDisponivel: 20,
          },
        ],
        noiteBrt,
      );

      expect(lotes[0].vencido).toBe(false);
      expect(lotes[0].sugeridoFefo).toBe(true);
      expect(lotes[0].diasParaVencimento).toBe(0);
      expect(calcularDiasAteValidade("2026-11-25", noiteBrt)).toBe(1);
    });

    it("calcula prazo de receita antimicrobiana usando o dia civil brasileiro", () => {
      // Emitida em 2026-11-14 -> em 2026-11-24 (22h30 BRT) tem exatamente 10 dias (válida)
      const res = validarReceitaAntimicrobiano("2026-11-14", true, noiteBrt);
      expect(res.valida).toBe(true);
      expect(res.diasDecorridos).toBe(10);
    });
  });

  describe("Trava de segurança do seed-qa (ADR-025)", () => {
    it("aborta imediatamente quando APP_ENV=production mesmo com ALLOW_QA_SEED=true", () => {
      expect(() =>
        assertQaSeedAllowed({
          APP_ENV: "production",
          ALLOW_QA_SEED: "true",
        }),
      ).toThrow(/proibido quando APP_ENV=production/i);
    });

    it("aborta quando ALLOW_QA_SEED não for 'true' ou APP_ENV diferente de 'hml'", () => {
      expect(() =>
        assertQaSeedAllowed({ APP_ENV: "hml", ALLOW_QA_SEED: "false" }),
      ).toThrow(/ALLOW_QA_SEED=true/i);

      expect(() =>
        assertQaSeedAllowed({ APP_ENV: "development", ALLOW_QA_SEED: "true" }),
      ).toThrow(/APP_ENV=hml/i);
    });

    it("permite execução exclusivamente quando APP_ENV=hml e ALLOW_QA_SEED=true", () => {
      expect(() =>
        assertQaSeedAllowed({ APP_ENV: "hml", ALLOW_QA_SEED: "true" }),
      ).not.toThrow();
    });
  });

  describe("Validação de argumentos do bootstrap-prod", () => {
    it("rejeita e-mail ausente/inválido ou senha curta antes de abrir conexão", async () => {
      await expect(
        runBootstrapProd({
          BOOTSTRAP_ADMIN_EMAIL: "",
          BOOTSTRAP_ADMIN_PASSWORD: "SenhaForte@123",
        }),
      ).rejects.toThrow("BOOTSTRAP_ADMIN_EMAIL");

      await expect(
        runBootstrapProd({
          BOOTSTRAP_ADMIN_EMAIL: "admin@farmaubs.com.br",
          BOOTSTRAP_ADMIN_PASSWORD: "123",
        }),
      ).rejects.toThrow("BOOTSTRAP_ADMIN_PASSWORD");
    });
  });
});
