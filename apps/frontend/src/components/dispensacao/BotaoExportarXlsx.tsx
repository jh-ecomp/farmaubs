import { useState } from "react";
import type { ListarDispensacoesQuery } from "@farmaubs/shared";
import { dispensacaoService } from "../../services/dispensacao.service";

export interface BotaoExportarXlsxProps {
  filtros: ListarDispensacoesQuery;
  onErroExportacao?: (mensagem: string) => void;
}

/**
 * [RF012 / NF010]: Botão de exportação em planilha Excel (.xlsx) que envia os mesmos filtros ativos da tabela
 * e dispara o download binário automático via URL.createObjectURL(blob).
 */
export function BotaoExportarXlsx({
  filtros,
  onErroExportacao,
}: BotaoExportarXlsxProps) {
  const [exportando, setExportando] = useState(false);

  const handleExportar = async () => {
    if (exportando) return;
    setExportando(true);
    try {
      const { blob, nomeArquivo } =
        await dispensacaoService.exportarDispensacoesXlsx(filtros);

      const objectUrl =
        typeof URL.createObjectURL === "function"
          ? URL.createObjectURL(blob)
          : "";

      if (objectUrl) {
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = nomeArquivo;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        if (typeof URL.revokeObjectURL === "function") {
          URL.revokeObjectURL(objectUrl);
        }
      }
    } catch (err) {
      onErroExportacao?.(
        err instanceof Error
          ? err.message
          : "Erro ao exportar planilha Excel (.xlsx).",
      );
    } finally {
      setExportando(false);
    }
  };

  return (
    <button
      type="button"
      disabled={exportando}
      onClick={handleExportar}
      data-testid="botao-exportar-xlsx"
      className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span aria-hidden="true">📥</span>
      <span>{exportando ? "Gerando planilha..." : "Baixar Planilha"}</span>
    </button>
  );
}

export default BotaoExportarXlsx;
