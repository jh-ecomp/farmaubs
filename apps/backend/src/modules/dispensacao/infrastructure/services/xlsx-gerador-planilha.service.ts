import { Injectable } from "@nestjs/common";
import { crc32 } from "node:zlib";
import type { LinhaExportacaoDispensacaoDto } from "@farmaubs/shared";
import type { GeradorPlanilhaPort } from "../../domain/ports/gerador-planilha.port";

const CABECALHOS_XLSX = [
  "Data/Hora do Atendimento",
  "Paciente (Nome Completo)",
  "CPF do Paciente",
  "Cartão SUS (CNS)",
  "Medicamento / Apresentação",
  "Categoria",
  "Lote Dispensado",
  "Data de Validade do Lote",
  "Quantidade Dispensada",
  "Posologia",
  "Farmacêutico Dispensador",
  "Status do Atendimento",
] as const;

@Injectable()
export class XlsxGeradorPlanilhaService implements GeradorPlanilhaPort {
  /**
   * Gera um arquivo binário Excel (.xlsx OpenXML) válido com as 12 colunas obrigatórias de auditoria (RF012).
   * @param linhas Registros das dispensações filtradas.
   * @returns Buffer binário pronto para streaming HTTP.
   */
  async gerarXlsx(linhas: LinhaExportacaoDispensacaoDto[]): Promise<Buffer> {
    const todasLinhas: (string | number)[][] = [
      [...CABECALHOS_XLSX],
      ...linhas.map((l) => [
        l.dataHoraAtendimento,
        l.pacienteNome,
        l.pacienteCpfFormatado,
        l.pacienteCns,
        l.medicamentoApresentacao,
        l.categoria,
        l.numeroLote,
        l.dataValidadeLote,
        l.quantidadeDispensada,
        l.posologia,
        l.dispensadorNome,
        l.statusAtendimento,
      ]),
    ];

    const sheetXml = this.montarWorksheetXml(todasLinhas);

    return this.empacotarZipStore([
      {
        nome: "[Content_Types].xml",
        conteudo: Buffer.from(
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
            `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
            `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
            `<Default Extension="xml" ContentType="application/xml"/>` +
            `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
            `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
            `</Types>`,
          "utf8",
        ),
      },
      {
        nome: "_rels/.rels",
        conteudo: Buffer.from(
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
            `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
            `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
            `</Relationships>`,
          "utf8",
        ),
      },
      {
        nome: "xl/workbook.xml",
        conteudo: Buffer.from(
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
            `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
            `<sheets><sheet name="Dispensacoes" sheetId="1" r:id="rId1"/></sheets>` +
            `</workbook>`,
          "utf8",
        ),
      },
      {
        nome: "xl/_rels/workbook.xml.rels",
        conteudo: Buffer.from(
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
            `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
            `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
            `</Relationships>`,
          "utf8",
        ),
      },
      {
        nome: "xl/worksheets/sheet1.xml",
        conteudo: Buffer.from(sheetXml, "utf8"),
      },
    ]);
  }

  private montarWorksheetXml(linhas: (string | number)[][]): string {
    const rowsXml = linhas
      .map((colunas, rowIdx) => {
        const numLinha = rowIdx + 1;
        const cellsXml = colunas
          .map((valor, colIdx) => {
            const refCol = String.fromCharCode(65 + colIdx);
            const refCelula = `${refCol}${numLinha}`;
            if (typeof valor === "number" && Number.isFinite(valor)) {
              return `<c r="${refCelula}" t="n"><v>${valor}</v></c>`;
            }
            const textoEscapado = this.escaparXml(String(valor ?? ""));
            return `<c r="${refCelula}" t="inlineStr"><is><t>${textoEscapado}</t></is></c>`;
          })
          .join("");
        return `<row r="${numLinha}">${cellsXml}</row>`;
      })
      .join("");

    return (
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<sheetData>${rowsXml}</sheetData>` +
      `</worksheet>`
    );
  }

  private escaparXml(texto: string): string {
    return texto
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  private empacotarZipStore(
    arquivos: { nome: string; conteudo: Buffer }[],
  ): Buffer {
    const blocosLocais: Buffer[] = [];
    const blocosCentrais: Buffer[] = [];
    let offsetAtual = 0;

    for (const arq of arquivos) {
      const nomeBuf = Buffer.from(arq.nome, "utf8");
      const dados = arq.conteudo;
      const checksum = crc32(dados) >>> 0;

      const localHeader = Buffer.alloc(30 + nomeBuf.length);
      localHeader.writeUInt32LE(0x04034b50, 0);
      localHeader.writeUInt16LE(20, 4);
      localHeader.writeUInt16LE(0, 6);
      localHeader.writeUInt16LE(0, 8);
      localHeader.writeUInt16LE(0, 10);
      localHeader.writeUInt16LE(0, 12);
      localHeader.writeUInt32LE(checksum, 14);
      localHeader.writeUInt32LE(dados.length, 18);
      localHeader.writeUInt32LE(dados.length, 22);
      localHeader.writeUInt16LE(nomeBuf.length, 26);
      localHeader.writeUInt16LE(0, 28);
      nomeBuf.copy(localHeader, 30);

      const centralHeader = Buffer.alloc(46 + nomeBuf.length);
      centralHeader.writeUInt32LE(0x02014b50, 0);
      centralHeader.writeUInt16LE(20, 4);
      centralHeader.writeUInt16LE(20, 6);
      centralHeader.writeUInt16LE(0, 8);
      centralHeader.writeUInt16LE(0, 10);
      centralHeader.writeUInt16LE(0, 12);
      centralHeader.writeUInt16LE(0, 14);
      centralHeader.writeUInt32LE(checksum, 16);
      centralHeader.writeUInt32LE(dados.length, 20);
      centralHeader.writeUInt32LE(dados.length, 24);
      centralHeader.writeUInt16LE(nomeBuf.length, 28);
      centralHeader.writeUInt16LE(0, 30);
      centralHeader.writeUInt16LE(0, 32);
      centralHeader.writeUInt16LE(0, 34);
      centralHeader.writeUInt16LE(0, 36);
      centralHeader.writeUInt32LE(0, 38);
      centralHeader.writeUInt32LE(offsetAtual, 42);
      nomeBuf.copy(centralHeader, 46);

      blocosLocais.push(localHeader, dados);
      blocosCentrais.push(centralHeader);
      offsetAtual += localHeader.length + dados.length;
    }

    const tamanhoCentral = blocosCentrais.reduce((acc, b) => acc + b.length, 0);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(arquivos.length, 8);
    eocd.writeUInt16LE(arquivos.length, 10);
    eocd.writeUInt32LE(tamanhoCentral, 12);
    eocd.writeUInt32LE(offsetAtual, 16);
    eocd.writeUInt16LE(0, 20);

    return Buffer.concat([...blocosLocais, ...blocosCentrais, eocd]);
  }
}

