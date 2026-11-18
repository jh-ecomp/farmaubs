/**
 * [ADR-030 / Camada C & D]: Servidor HTTP full-stack efêmero para execução de testes E2E do Playwright.
 * Expõe exatamente os contratos REST de Acesso (/api/v1/acesso/*) e Dispensação (/api/v1/dispensacao/*, /api/v1/dispensacoes/*)
 * com sessão via cookie HttpOnly (farmaubs_session), algoritmo FEFO, baixa de saldo em memória e exportação XLSX.
 */
import * as http from "node:http";
import * as crypto from "node:crypto";
import {
  PerfilCodigo,
  selecionarLoteSugeridoFEFO,
  type DispensacaoItemListaDto,
  type EfetivarDispensacaoRequest,
  type LoteDisponivelDto,
  type MedicamentoBuscaDto,
  type PacienteDto,
} from "@farmaubs/shared";

interface LoteEmEstoque extends LoteDisponivelDto {
  medicamentoId: string;
}

const PORT = parseInt(process.env.E2E_API_PORT ?? "3000", 10);
const UBS_PARNAIBA_ID = "01950000-0000-7000-8000-000000000001";
const MUNICIPIO_PARNAIBA_ID = "01950000-0000-7000-8000-000000000010";

const USUARIO_FARMACEUTICO = {
  id: "01950000-0000-7000-8000-000000000099",
  nomeCompleto: "Dra. Maria das Graças (Farmacêutica UBS Centro)",
  email: "farma.parnaiba@farmaubs.dev",
  perfilCodigo: PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
  municipioId: MUNICIPIO_PARNAIBA_ID,
  unidadeIds: [UBS_PARNAIBA_ID],
  deveTrocarSenha: false,
};

let catalogoMedicamentos: MedicamentoBuscaDto[] = [];
let lotesEstoque: LoteEmEstoque[] = [];
let pacientesCadastrados: PacienteDto[] = [];
let historicoDispensacoes: DispensacaoItemListaDto[] = [];
let contadorAtendimentos = 100;

let sessaoAutenticadaAtiva = false;

/**
 * [RF010 / RF012]: Restaura o estado inicial do banco em memória da UBS de Parnaíba.
 */
function resetarEstadoInicial(): void {
  sessaoAutenticadaAtiva = false;
  catalogoMedicamentos = [
    {
      id: "01950000-0000-7000-8000-000000000101",
      principioAtivo: "Losartana Potássica",
      nomeComercial: "Losartana",
      apresentacao: "50mg Comprimido",
      categoria: "BASICO",
      antimicrobiano: false,
      saldoTotalUbs: 150,
    },
    {
      id: "01950000-0000-7000-8000-000000000102",
      principioAtivo: "Amoxicilina",
      nomeComercial: "Amoxicilina",
      apresentacao: "500mg Cápsula",
      categoria: "ANTIBIOTICO",
      antimicrobiano: true,
      saldoTotalUbs: 90,
    },
  ];

  lotesEstoque = [
    {
      id: "01950000-0000-7000-8000-000000000201",
      medicamentoId: "01950000-0000-7000-8000-000000000101",
      numeroLote: "LOT-2026-FEFO-A",
      fabricanteNome: "Farmanguinhos / Fiocruz",
      dataValidade: "2027-02-15",
      saldoDisponivel: 100,
      sugeridoFefo: true,
      diasParaVencimento: 90,
      alertaValidadeCurta: false,
      vencido: false,
    },
    {
      id: "01950000-0000-7000-8000-000000000202",
      medicamentoId: "01950000-0000-7000-8000-000000000101",
      numeroLote: "LOT-2027-B",
      fabricanteNome: "EMS",
      dataValidade: "2027-10-20",
      saldoDisponivel: 50,
      sugeridoFefo: false,
      diasParaVencimento: 330,
      alertaValidadeCurta: false,
      vencido: false,
    },
  ];

  pacientesCadastrados = [];
  contadorAtendimentos = 100;

  const hojeIso = new Date().toISOString();
  historicoDispensacoes = [
    {
      id: "01950000-0000-7000-8000-000000000301",
      numeroAtendimento: "ATD-2026-0100",
      dataAtendimento: hojeIso,
      status: "concluida",
      pacienteNome: "Raimundo Nonato Oliveira",
      pacienteCpf: "11144477735",
      pacienteCns: "700001122334455",
      dispensadorNome: USUARIO_FARMACEUTICO.nomeCompleto,
      totalItens: 1,
      medicamentosResumo: "Losartana Potássica - 50mg Comprimido (30)",
    },
  ];
}

resetarEstadoInicial();

/**
 * Lê o corpo JSON de uma requisição HTTP.
 * @param req - Requisição HTTP de entrada.
 * @returns Objeto desserializado.
 */
function lerJsonBody<T>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve((raw ? JSON.parse(raw) : {}) as T);
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

/**
 * Envia resposta JSON padronizada com cabeçalhos CORS e sessão deslizante.
 * @param res - Resposta HTTP.
 * @param status - Código de status HTTP.
 * @param payload - Dados a serializar em JSON.
 */
function responderJson(
  res: http.ServerResponse,
  status: number,
  payload: unknown,
): void {
  const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "X-Session-Expires-At": expiresAt,
  });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const pathname = url.pathname;
  const method = req.method ?? "GET";

  // Endpoint auxiliar de reset para isolamento entre cenários E2E
  if (method === "POST" && pathname === "/api/v1/test/reset") {
    resetarEstadoInicial();
    responderJson(res, 200, { ok: true });
    return;
  }

  // 1. POST /api/v1/acesso/login
  if (method === "POST" && pathname === "/api/v1/acesso/login") {
    const body = await lerJsonBody<{ email?: string; senha?: string }>(req);
    if (
      body.email === "farma.parnaiba@farmaubs.dev" &&
      body.senha === "Farma@123456"
    ) {
      sessaoAutenticadaAtiva = true;
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
      res.setHeader(
        "Set-Cookie",
        `farmaubs_session=${token}; HttpOnly; Path=/api/v1; Max-Age=3600; SameSite=Lax`,
      );
      res.setHeader("Authorization", `Bearer ${token}`);
      responderJson(res, 200, {
        token,
        usuario: USUARIO_FARMACEUTICO,
        sessao: {
          expiresAt,
          ttlSeconds: 3600,
          warningSeconds: 300,
        },
        redirectUrl: "/dispensas",
      });
      return;
    }

    responderJson(res, 401, { message: "E-mail ou senha incorretos." });
    return;
  }

  // 2. GET /api/v1/acesso/me
  if (method === "GET" && pathname === "/api/v1/acesso/me") {
    const cookieHeader = req.headers.cookie ?? "";
    if (!sessaoAutenticadaAtiva && !cookieHeader.includes("farmaubs_session=")) {
      responderJson(res, 401, { message: "Sessão ausente ou expirada." });
      return;
    }
    const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
    responderJson(res, 200, {
      ...USUARIO_FARMACEUTICO,
      usuarioId: USUARIO_FARMACEUTICO.id,
      expiresAt,
    });
    return;
  }

  // 3. POST /api/v1/acesso/logout
  if (method === "POST" && pathname === "/api/v1/acesso/logout") {
    sessaoAutenticadaAtiva = false;
    responderJson(res, 200, { ok: true });
    return;
  }

  // 4. GET /api/v1/dispensacao/pacientes
  if (method === "GET" && pathname === "/api/v1/dispensacao/pacientes") {
    const termo = (url.searchParams.get("termo") ?? "").toLowerCase();
    const filtrados = pacientesCadastrados.filter(
      (p) =>
        p.cpf.includes(termo) ||
        p.cns.includes(termo) ||
        p.nomeCompleto.toLowerCase().includes(termo),
    );
    responderJson(res, 200, filtrados);
    return;
  }

  // 5. GET /api/v1/dispensacao/medicamentos
  if (method === "GET" && pathname === "/api/v1/dispensacao/medicamentos") {
    const termo = (url.searchParams.get("termo") ?? "").toLowerCase();
    const filtrados = catalogoMedicamentos
      .map((med) => {
        const saldoAtual = lotesEstoque
          .filter((l) => l.medicamentoId === med.id && !l.vencido)
          .reduce((soma, l) => soma + l.saldoDisponivel, 0);
        return { ...med, saldoTotalUbs: saldoAtual };
      })
      .filter(
        (m) =>
          !termo ||
          m.principioAtivo.toLowerCase().includes(termo) ||
          (m.nomeComercial ?? "").toLowerCase().includes(termo) ||
          m.apresentacao.toLowerCase().includes(termo),
      );

    responderJson(res, 200, filtrados);
    return;
  }

  // 6. GET /api/v1/dispensacao/medicamentos/:id/lotes-fefo
  const matchFefo = pathname.match(
    /^\/api\/v1\/dispensacao\/medicamentos\/([^/]+)\/lotes-fefo$/,
  );
  if (method === "GET" && matchFefo) {
    const medId = matchFefo[1];
    const med = catalogoMedicamentos.find((m) => m.id === medId);
    if (!med) {
      responderJson(res, 404, { message: "Medicamento não encontrado." });
      return;
    }

    const lotesDoMed = lotesEstoque.filter((l) => l.medicamentoId === medId);
    const sugerido = selecionarLoteSugeridoFEFO(lotesDoMed);
    const lotesOrdenados = lotesDoMed.map((l) => ({
      ...l,
      sugeridoFefo: sugerido ? l.id === sugerido.id : false,
    }));

    responderJson(res, 200, {
      medicamento: med,
      loteSugerido:
        lotesOrdenados.find((l) => l.sugeridoFefo) ?? lotesOrdenados[0] ?? null,
      lotesDisponiveis: lotesOrdenados,
    });
    return;
  }

  // 7. POST /api/v1/dispensacoes
  if (method === "POST" && pathname === "/api/v1/dispensacoes") {
    const body = await lerJsonBody<EfetivarDispensacaoRequest>(req);

    for (const item of body.itens) {
      const lote = lotesEstoque.find((l) => l.id === item.loteId);
      if (!lote || lote.saldoDisponivel < item.quantidadeDispensada) {
        responderJson(res, 400, {
          message: "Saldo insuficiente no lote selecionado para dispensação.",
        });
        return;
      }
    }

    const itensResultado = body.itens.map((item, idx) => {
      const lote = lotesEstoque.find((l) => l.id === item.loteId)!;
      const med = catalogoMedicamentos.find(
        (m) => m.id === item.medicamentoId,
      )!;
      lote.saldoDisponivel -= item.quantidadeDispensada;
      return {
        itemId: `item-${idx + 1}`,
        medicamentoId: med.id,
        medicamentoNome: `${med.principioAtivo} - ${med.apresentacao}`,
        loteId: lote.id,
        numeroLote: lote.numeroLote,
        quantidadeDispensada: item.quantidadeDispensada,
        saldoRestanteLote: lote.saldoDisponivel,
        posologia: item.posologia,
      };
    });

    contadorAtendimentos += 1;
    const numeroAtendimento = `ATD-2026-0${contadorAtendimentos}`;
    const agoraIso = new Date().toISOString();
    const dispId = crypto.randomUUID();

    const resumoMeds = itensResultado
      .map((i) => `${i.medicamentoNome} (${i.quantidadeDispensada})`)
      .join(", ");

    historicoDispensacoes.unshift({
      id: dispId,
      numeroAtendimento,
      dataAtendimento: agoraIso,
      status: "concluida",
      pacienteNome: body.paciente.nomeCompleto,
      pacienteCpf: body.paciente.cpf,
      pacienteCns: body.paciente.cns,
      dispensadorNome: USUARIO_FARMACEUTICO.nomeCompleto,
      totalItens: itensResultado.length,
      medicamentosResumo: resumoMeds,
    });

    responderJson(res, 201, {
      id: dispId,
      numeroAtendimento,
      dataAtendimento: agoraIso,
      status: "concluida",
      paciente: {
        id: crypto.randomUUID(),
        nomeCompleto: body.paciente.nomeCompleto,
        cpf: body.paciente.cpf,
        cns: body.paciente.cns,
      },
      dispensador: {
        id: USUARIO_FARMACEUTICO.id,
        nomeCompleto: USUARIO_FARMACEUTICO.nomeCompleto,
      },
      itens: itensResultado,
    });
    return;
  }

  // 8. GET /api/v1/dispensacoes/exportar-xlsx
  if (method === "GET" && pathname === "/api/v1/dispensacoes/exportar-xlsx") {
    const dataInicio = url.searchParams.get("dataInicio") ?? "2026-10-01";
    const dataFim = url.searchParams.get("dataFim") ?? "2026-10-02";
    const nomeArquivo = `dispensacoes_ubs_${dataInicio}_${dataFim}.xlsx`;
    // Assinatura mágica PK de um arquivo ZIP/XLSX válido
    const bufferXlsx = Buffer.from("504b0304140000000800", "hex");

    res.writeHead(200, {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
    });
    res.end(bufferXlsx);
    return;
  }

  // 9. POST /api/v1/dispensacoes/:id/estorno
  const matchEstorno = pathname.match(
    /^\/api\/v1\/dispensacoes\/([^/]+)\/estorno$/,
  );
  if (method === "POST" && matchEstorno) {
    const dispId = matchEstorno[1];
    const body = await lerJsonBody<{ motivoEstorno?: string }>(req);
    const registro = historicoDispensacoes.find((d) => d.id === dispId);

    if (!registro) {
      responderJson(res, 404, { message: "Dispensação não encontrada." });
      return;
    }

    registro.status = "estornada";
    responderJson(res, 200, {
      dispensacaoId: dispId,
      status: "estornada",
      motivoEstorno: body.motivoEstorno ?? "",
      estornadoEm: new Date().toISOString(),
      lotesRestituidos: [],
    });
    return;
  }

  // 10. GET /api/v1/dispensacoes
  if (method === "GET" && pathname === "/api/v1/dispensacoes") {
    const hojeIso = new Date().toISOString().slice(0, 10);
    const medTermo = (
      url.searchParams.get("medicamentoTermo") ?? ""
    ).toLowerCase();

    const filtrados = historicoDispensacoes.filter(
      (item) =>
        !medTermo || item.medicamentosResumo.toLowerCase().includes(medTermo),
    );

    responderJson(res, 200, {
      itens: filtrados,
      totalItens: filtrados.length,
      pagina: 1,
      limite: 20,
      totalPaginas: 1,
      dataInicioEfetiva: url.searchParams.get("dataInicio") ?? hojeIso,
      dataFimEfetiva: url.searchParams.get("dataFim") ?? hojeIso,
    });
    return;
  }

  responderJson(res, 404, { message: `Rota não mapeada: ${method} ${pathname}` });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[E2E Backend Server] Escutando em http://127.0.0.1:${PORT}`);
});
