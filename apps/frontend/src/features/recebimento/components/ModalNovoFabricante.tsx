import React, { useEffect, useState } from "react";
import type { FabricanteResponseDto } from "@farmaubs/shared";
import { recebimentoService } from "../../../services/recebimento.service";
import { Building, X, Loader2, AlertCircle } from "lucide-react";

export interface ModalNovoFabricanteProps {
  aberto: boolean;
  onFechar: () => void;
  onFabricanteCriado: (fabricante: FabricanteResponseDto) => void;
}

/**
 * Modal rápido para cadastro de novo fabricante/laboratório sem sair da tela de recebimento.
 */
export const ModalNovoFabricante: React.FC<ModalNovoFabricanteProps> = ({
  aberto,
  onFechar,
  onFabricanteCriado,
}) => {
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) {
      setRazaoSocial("");
      setNomeFantasia("");
      setCnpj("");
      setErro(null);
      setSalvando(false);
    }
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !salvando) {
        onFechar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [aberto, salvando, onFechar]);

  if (!aberto) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (razaoSocial.trim().length < 3) {
      setErro("Informe a razão social do laboratório (mínimo de 3 caracteres).");
      return;
    }
    if (nomeFantasia.trim().length < 2) {
      setErro("Informe o nome fantasia do laboratório.");
      return;
    }

    setSalvando(true);
    try {
      const criado = await recebimentoService.cadastrarFabricante({
        razaoSocial: razaoSocial.trim(),
        nomeFantasia: nomeFantasia.trim(),
        cnpj: cnpj.trim() || null,
      });
      onFabricanteCriado(criado);
      onFechar();
    } catch (err) {
      setErro(
        err instanceof Error
          ? err.message
          : "Não foi possível cadastrar o fabricante.",
      );
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-novo-fabricante"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-teal-50 text-teal-700">
              <Building className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3
              id="titulo-modal-novo-fabricante"
              className="text-base font-semibold text-slate-900"
            >
              Cadastrar Novo Fabricante
            </h3>
          </div>
          <button
            type="button"
            onClick={onFechar}
            disabled={salvando}
            aria-label="Fechar modal de fabricante"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {erro && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-xs font-medium text-red-700"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{erro}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="novoFabricanteNomeFantasia"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Nome Fantasia / Laboratório <span className="text-red-600">*</span>
            </label>
            <input
              id="novoFabricanteNomeFantasia"
              type="text"
              autoFocus
              value={nomeFantasia}
              onChange={(e) => {
                setNomeFantasia(e.target.value);
                if (!razaoSocial) {
                  // facilita preenchimento rápido se o usuário digitar apenas o nome fantasia
                }
              }}
              placeholder="Ex: Prati-Donaduzzi"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div>
            <label
              htmlFor="novoFabricanteRazaoSocial"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Razão Social <span className="text-red-600">*</span>
            </label>
            <input
              id="novoFabricanteRazaoSocial"
              type="text"
              value={razaoSocial}
              onChange={(e) => setRazaoSocial(e.target.value)}
              placeholder="Ex: Prati-Donaduzzi & Cia Ltda"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div>
            <label
              htmlFor="novoFabricanteCnpj"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              CNPJ (opcional)
            </label>
            <input
              id="novoFabricanteCnpj"
              type="text"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="Ex: 73.856.593/0001-66"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onFechar}
              disabled={salvando}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
            >
              {salvando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Salvar Fabricante</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
