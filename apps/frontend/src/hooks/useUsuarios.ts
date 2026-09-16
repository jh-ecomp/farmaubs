import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CadastrarUsuarioComando,
  ListagemUsuariosFiltros,
} from "@farmaubs/shared";
import { usuarioService } from "../services/usuario.service";

export function useUsuarios(filtros: ListagemUsuariosFiltros = {}) {
  return useQuery({
    queryKey: ["usuarios", filtros],
    queryFn: () => usuarioService.listarUsuarios(filtros),
    staleTime: 1000 * 30, // 30s
  });
}

export function useMunicipios() {
  return useQuery({
    queryKey: ["municipios"],
    queryFn: () => usuarioService.buscarMunicipios(),
    staleTime: 1000 * 60 * 10, // 10 minutos
  });
}

export function useUnidadesSaude(municipioId?: string) {
  return useQuery({
    queryKey: ["unidades-saude", municipioId],
    queryFn: () => usuarioService.buscarUnidadesSaude(municipioId),
    enabled: Boolean(municipioId),
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}

export function useCadastrarUsuario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dados: CadastrarUsuarioComando) =>
      usuarioService.cadastrarUsuario(dados),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    },
  });
}

export function useAlterarStatusUsuario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      usuarioService.alterarStatus(id, ativo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    },
  });
}

export function useAtualizarUsuario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      dados,
    }: {
      id: string;
      dados: Partial<CadastrarUsuarioComando>;
    }) => usuarioService.atualizarUsuario(id, dados),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    },
  });
}

export function useRedefinirSenha() {
  return useMutation({
    mutationFn: (usuarioId: string) => usuarioService.redefinirSenha(usuarioId),
  });
}
