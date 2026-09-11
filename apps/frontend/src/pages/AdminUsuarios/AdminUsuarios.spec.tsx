import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route } from "react-router-dom";
import { PerfilCodigo } from "@farmaubs/shared";
import { renderWithProviders } from "../../test/test-utils";
import {
  usuarioService,
  UsuarioApiError,
} from "../../services/usuario.service";
import { AdminUsuarios } from "./index";
import { AccessDenied } from "../AccessDenied";
import { RoleRoute } from "../../components/RoleRoute";

// Mock do serviço HTTP de usuários
vi.mock("../../services/usuario.service", async () => {
  const actual = await vi.importActual<
    typeof import("../../services/usuario.service")
  >("../../services/usuario.service");
  return {
    ...actual,
    usuarioService: {
      listarUsuarios: vi.fn(),
      buscarMunicipios: vi.fn(),
      buscarUnidadesSaude: vi.fn(),
      cadastrarUsuario: vi.fn(),
      alterarStatus: vi.fn(),
    },
  };
});

describe("Gestão de Usuários no Painel Administrativo — Camada D (ADR-030 / #105)", () => {
  const mockUsuarioService = vi.mocked(usuarioService);

  const mockAdminSession = {
    token: "valid-admin-token",
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    ttlSeconds: 3600,
    warningSeconds: 300,
    usuario: {
      id: "admin-123",
      nome: "Dr. Carlos Mendonça",
      email: "carlos.admin@saude.gov.br",
      perfil: [PerfilCodigo.ADMINISTRADOR],
      municipio_id: 1,
      unidade_id: 1,
    },
  };

  const mockFarmaceuticoSession = {
    token: "valid-farm-token",
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    ttlSeconds: 3600,
    warningSeconds: 300,
    usuario: {
      id: "farm-456",
      nome: "Mariana Vasconcelos",
      email: "mariana.farm@saude.gov.br",
      perfil: [PerfilCodigo.FARMACEUTICO_RESPONSAVEL],
      municipio_id: 1,
      unidade_id: 1,
    },
  };

  const mockMunicipios = [
    { id: "mun-parnaiba", nome: "Parnaíba", uf: "PI", ibgeCode: "2207702" },
    { id: "mun-teresina", nome: "Teresina", uf: "PI", ibgeCode: "2211001" },
  ];

  const mockUnidades = [
    {
      id: "ubs-frei-higino",
      municipioId: "mun-parnaiba",
      nome: "UBS Frei Higino",
      endereco: "Rua São Pedro, 120",
      cafLeadTimeDays: 10,
    },
    {
      id: "ubs-ilha-grande",
      municipioId: "mun-parnaiba",
      nome: "UBS Ilha Grande de Santa Isabel",
      endereco: "Av. das Canárias, Km 4",
      cafLeadTimeDays: 12,
    },
  ];

  const mockUsuariosList = [
    {
      id: "admin-123",
      municipioId: "mun-parnaiba",
      municipioNome: "Parnaíba",
      nomeCompleto: "Dr. Carlos Mendonça",
      email: "carlos.admin@saude.gov.br",
      perfilCodigo: PerfilCodigo.ADMINISTRADOR,
      perfilNome: "Administrador Geral",
      unidades: [],
      ativo: true,
      cpf: "111.222.333-44",
      createdAt: new Date().toISOString(),
    },
    {
      id: "user-mariana",
      municipioId: "mun-parnaiba",
      municipioNome: "Parnaíba",
      nomeCompleto: "Dra. Mariana Vasconcelos",
      email: "mariana.vasconcelos@saude.gov.br",
      perfilCodigo: PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
      perfilNome: "Farmacêutico Responsável",
      unidades: [
        { id: "ubs-frei-higino", nome: "UBS Frei Higino", cnes: "2401824" },
      ],
      ativo: true,
      crf: "4821-PI",
      cpf: "222.333.444-55",
      createdAt: new Date().toISOString(),
    },
    {
      id: "user-lucas",
      municipioId: "mun-parnaiba",
      municipioNome: "Parnaíba",
      nomeCompleto: "Lucas Rodrigues da Silva",
      email: "lucas.silva@saude.gov.br",
      perfilCodigo: PerfilCodigo.FARMACEUTICO_RESIDENTE,
      perfilNome: "Farmacêutico Residente",
      unidades: [
        {
          id: "ubs-ilha-grande",
          nome: "UBS Ilha Grande de Santa Isabel",
          cnes: "2401832",
        },
      ],
      ativo: false,
      crf: "5104-PI",
      createdAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();

    mockUsuarioService.buscarMunicipios.mockResolvedValue(mockMunicipios);
    mockUsuarioService.buscarUnidadesSaude.mockResolvedValue(mockUnidades);
    mockUsuarioService.listarUsuarios.mockResolvedValue({
      data: mockUsuariosList,
      total: mockUsuariosList.length,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
  });

  const setupAuthenticatedAdmin = () => {
    localStorage.setItem("@FarmaUBS:token", mockAdminSession.token);
    localStorage.setItem("@FarmaUBS:expiresAt", mockAdminSession.expiresAt);
    localStorage.setItem(
      "@FarmaUBS:usuario",
      JSON.stringify(mockAdminSession.usuario),
    );
  };

  const setupAuthenticatedFarmaceutico = () => {
    localStorage.setItem("@FarmaUBS:token", mockFarmaceuticoSession.token);
    localStorage.setItem(
      "@FarmaUBS:expiresAt",
      mockFarmaceuticoSession.expiresAt,
    );
    localStorage.setItem(
      "@FarmaUBS:usuario",
      JSON.stringify(mockFarmaceuticoSession.usuario),
    );
  };

  // =========================================================================
  // CENÁRIO 1: RBAC / RF025 - Controle de Acesso Restrito ao Administrador
  // =========================================================================
  describe("Cenário 1: Controle de Acesso RBAC (RF025 / Menor Privilégio)", () => {
    it("deve redirecionar usuário não-administrador para /403 e não carregar a listagem", async () => {
      setupAuthenticatedFarmaceutico();

      renderWithProviders(
        <Routes>
          <Route path="/403" element={<AccessDenied />} />
          <Route
            path="/admin/usuarios"
            element={
              <RoleRoute allowedRoles={["ADMINISTRADOR"]}>
                <AdminUsuarios />
              </RoleRoute>
            }
          />
        </Routes>,
        { initialEntries: ["/admin/usuarios"] },
      );

      // Deve estar na tela de Acesso Negado 403
      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /acesso não autorizado/i }),
        ).toBeInTheDocument();
        expect(
          screen.getByText(/erro 403 • acesso negado/i),
        ).toBeInTheDocument();
      });

      // Tabela de usuários não pode ter sido renderizada
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      expect(mockUsuarioService.listarUsuarios).not.toHaveBeenCalled();
    });

    it("deve permitir acesso normal para o perfil ADMINISTRADOR", async () => {
      setupAuthenticatedAdmin();

      renderWithProviders(
        <Routes>
          <Route path="/403" element={<AccessDenied />} />
          <Route
            path="/admin/usuarios"
            element={
              <RoleRoute allowedRoles={["ADMINISTRADOR"]}>
                <AdminUsuarios />
              </RoleRoute>
            }
          />
        </Routes>,
        { initialEntries: ["/admin/usuarios"] },
      );

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /gestão de usuários e perfis/i }),
        ).toBeInTheDocument();
        expect(screen.getByRole("table")).toBeInTheDocument();
      });

      expect(mockUsuarioService.listarUsuarios).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // CENÁRIO 2: Filtro por Município e Busca Textual com Debounce
  // =========================================================================
  describe("Cenário 2: Filtros Combinados e Busca Textual", () => {
    it("deve aplicar debounce na busca textual e atualizar os parâmetros da requisição", async () => {
      const user = userEvent.setup();
      setupAuthenticatedAdmin();

      renderWithProviders(<AdminUsuarios />, {
        initialEntries: ["/admin/usuarios"],
      });

      await waitFor(() => {
        expect(
          screen.getByText("Dra. Mariana Vasconcelos"),
        ).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(
        /buscar por nome, e-mail institucional/i,
      );
      await user.type(searchInput, "Mariana");

      // Aguarda o debounce de 300ms
      await waitFor(
        () => {
          expect(mockUsuarioService.listarUsuarios).toHaveBeenCalledWith(
            expect.objectContaining({
              busca: "Mariana",
            }),
          );
        },
        { timeout: 1000 },
      );
    });

    it("deve disparar requisição filtrada ao alterar o município no dropdown", async () => {
      const user = userEvent.setup();
      setupAuthenticatedAdmin();

      renderWithProviders(<AdminUsuarios />, {
        initialEntries: ["/admin/usuarios"],
      });

      await waitFor(() => {
        expect(
          screen.getByLabelText(/filtrar por município/i),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("option", { name: /parnaíba/i }),
        ).toBeInTheDocument();
      });

      const selectMunicipio = screen.getByLabelText(/filtrar por município/i);
      await user.selectOptions(selectMunicipio, "mun-parnaiba");

      await waitFor(() => {
        expect(mockUsuarioService.listarUsuarios).toHaveBeenCalledWith(
          expect.objectContaining({
            municipioId: "mun-parnaiba",
          }),
        );
      });
    });
  });

  // =========================================================================
  // CENÁRIO 3: Cascata Município ➔ UBSs e Criação de Novo Usuário (RF001, RF026)
  // =========================================================================
  describe("Cenário 3: Seleção em Cascata de UBS por Município e Criação", () => {
    it("deve carregar UBSs dinamicamente após selecionar o município e cadastrar com sucesso", async () => {
      const user = userEvent.setup();
      setupAuthenticatedAdmin();

      mockUsuarioService.cadastrarUsuario.mockResolvedValueOnce({
        id: "novo-user-999",
        municipioId: "mun-parnaiba",
        nomeCompleto: "Dra. Beatriz Santos",
        email: "beatriz.santos@saude.gov.br",
        perfilId: "perfil-farm-resp",
        ativo: true,
        deveTrocarSenha: true,
        ubsIds: ["ubs-frei-higino"],
        criadoEm: new Date().toISOString(),
      });

      renderWithProviders(<AdminUsuarios />, {
        initialEntries: ["/admin/usuarios"],
      });

      // Abre o modal de cadastro
      const btnNovoUsuario = await screen.findByRole("button", {
        name: /\+ novo usuário/i,
      });
      await user.click(btnNovoUsuario);

      const modal = await screen.findByRole("dialog");
      expect(modal).toBeInTheDocument();
      expect(
        within(modal).getByRole("heading", {
          name: /cadastrar novo profissional/i,
        }),
      ).toBeInTheDocument();

      // Antes de selecionar o município, UBSs informam que aguardam seleção
      expect(
        within(modal).getByText(/selecione um município de lotação acima/i),
      ).toBeInTheDocument();

      // Preenche os campos
      await user.type(
        within(modal).getByLabelText(/nome completo/i),
        "Dra. Beatriz Santos",
      );
      await user.type(
        within(modal).getByLabelText(/e-mail institucional/i),
        "beatriz.santos@saude.gov.br",
      );
      await user.type(
        within(modal).getByLabelText(/senha provisória/i),
        "FarmaUBS2026",
      );

      // Aguarda opções de município no modal
      await waitFor(() => {
        expect(
          within(modal).getByRole("option", { name: /parnaíba/i }),
        ).toBeInTheDocument();
      });

      // Seleciona o município (desencadeia a cascata)
      const selectMunicipio =
        within(modal).getByLabelText(/município de lotação/i);
      await user.selectOptions(selectMunicipio, "mun-parnaiba");

      // As UBSs de Parnaíba devem ser carregadas dinamicamente dentro do modal
      await waitFor(() => {
        expect(mockUsuarioService.buscarUnidadesSaude).toHaveBeenCalledWith(
          "mun-parnaiba",
        );
        expect(within(modal).getByText("UBS Frei Higino")).toBeInTheDocument();
      });

      // Seleciona a UBS dentro do modal
      const checkboxUbs = within(modal).getByRole("checkbox", {
        name: /ubs frei higino/i,
      });
      await user.click(checkboxUbs);

      // Submete o formulário
      const btnSubmit = within(modal).getByRole("button", {
        name: /cadastrar usuário/i,
      });
      await user.click(btnSubmit);

      // Valida chamada da API de cadastro com município e ubsIds
      await waitFor(() => {
        expect(mockUsuarioService.cadastrarUsuario).toHaveBeenCalledWith({
          nomeCompleto: "Dra. Beatriz Santos",
          email: "beatriz.santos@saude.gov.br",
          senha: "FarmaUBS2026",
          municipioId: "mun-parnaiba",
          perfil: PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
          ubsIds: ["ubs-frei-higino"],
          cpf: undefined,
          crf: undefined,
          deveTrocarSenha: true,
        });
      });

      // O modal fecha e exibe o toast de sucesso
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent(
          /usuário cadastrado com sucesso/i,
        );
      });
    });
  });

  // =========================================================================
  // CENÁRIO 4: Conflito de E-mail Duplicado (409 Conflict)
  // =========================================================================
  describe("Cenário 4: Tratamento de Erro 409 Conflict (E-mail em Uso)", () => {
    it("deve manter o modal aberto, destacar erro no e-mail e preservar os demais dados preenchidos", async () => {
      const user = userEvent.setup();
      setupAuthenticatedAdmin();

      // Mock da API retornando 409 Conflict
      mockUsuarioService.cadastrarUsuario.mockRejectedValueOnce(
        new UsuarioApiError(
          "Este e-mail já está em uso por outro usuário.",
          409,
        ),
      );

      renderWithProviders(<AdminUsuarios />, {
        initialEntries: ["/admin/usuarios"],
      });

      // Abre o modal
      const btnNovoUsuario = await screen.findByRole("button", {
        name: /\+ novo usuário/i,
      });
      await user.click(btnNovoUsuario);

      const modal = await screen.findByRole("dialog");

      // Preenche os campos
      const inputNome = within(modal).getByLabelText(/nome completo/i);
      const inputEmail = within(modal).getByLabelText(/e-mail institucional/i);
      const inputSenha = within(modal).getByLabelText(/senha provisória/i);
      const selectMunicipio =
        within(modal).getByLabelText(/município de lotação/i);

      await user.type(inputNome, "Dra. Mariana Vasconcelos");
      await user.type(inputEmail, "mariana.vasconcelos@saude.gov.br");
      await user.type(inputSenha, "SenhaForte123");

      await waitFor(() => {
        expect(
          within(modal).getByRole("option", { name: /parnaíba/i }),
        ).toBeInTheDocument();
      });

      await user.selectOptions(selectMunicipio, "mun-parnaiba");

      await waitFor(() => {
        expect(within(modal).getByText("UBS Frei Higino")).toBeInTheDocument();
      });

      const checkboxUbs = within(modal).getByRole("checkbox", {
        name: /ubs frei higino/i,
      });
      await user.click(checkboxUbs);

      // Submete o formulário com e-mail duplicado
      const btnSubmit = within(modal).getByRole("button", {
        name: /cadastrar usuário/i,
      });
      await user.click(btnSubmit);

      // Modal DEVE permanecer aberto
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // Deve exibir mensagem de erro destacada no campo de e-mail
      const msgErro = await within(modal).findByText(
        "Este e-mail já está em uso por outro usuário.",
      );
      expect(msgErro).toBeInTheDocument();

      // Os outros campos preenchidos devem ser integralmente PRESERVADOS
      expect(inputNome).toHaveValue("Dra. Mariana Vasconcelos");
      expect(inputEmail).toHaveValue("mariana.vasconcelos@saude.gov.br");
      expect(inputSenha).toHaveValue("SenhaForte123");
      expect(selectMunicipio).toHaveValue("mun-parnaiba");
    });
  });

  // =========================================================================
  // CENÁRIO 5: Inativação Lógica com Diálogo de Confirmação
  // =========================================================================
  describe("Cenário 5: Inativação Lógica e Diálogo de Confirmação", () => {
    it("deve abrir diálogo acessível de confirmação e enviar PATCH ao confirmar", async () => {
      const user = userEvent.setup();
      setupAuthenticatedAdmin();

      mockUsuarioService.alterarStatus.mockResolvedValueOnce(undefined);

      renderWithProviders(<AdminUsuarios />, {
        initialEntries: ["/admin/usuarios"],
      });

      // Localiza a linha da Mariana (outro usuário ativo)
      await screen.findByText("Dra. Mariana Vasconcelos");

      // Clica no botão de inativar da Mariana
      const btnInativar = screen.getByRole("button", {
        name: /inativar dra\. mariana vasconcelos/i,
      });
      await user.click(btnInativar);

      // Diálogo de confirmação deve aparecer
      const alertDialog = await screen.findByRole("alertdialog");
      expect(alertDialog).toBeInTheDocument();
      expect(
        within(alertDialog).getByRole("heading", { name: /inativar usuário/i }),
      ).toBeInTheDocument();
      expect(
        within(alertDialog).getByText(/imediatamente revogado/i),
      ).toBeInTheDocument();

      // Clica em confirmar
      const btnConfirmar = within(alertDialog).getByRole("button", {
        name: /confirmar inativação/i,
      });
      await user.click(btnConfirmar);

      // Valida chamada do serviço
      await waitFor(() => {
        expect(mockUsuarioService.alterarStatus).toHaveBeenCalledWith(
          "user-mariana",
          false,
        );
      });

      // Diálogo fecha e toast aparece
      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent(
          /usuário inativado/i,
        );
      });
    });
  });

  // =========================================================================
  // CENÁRIO 6: Prevenção de Auto-inativação
  // =========================================================================
  describe("Cenário 6: Prevenção de Auto-inativação do Administrador Logado", () => {
    it("deve desabilitar o botão de inativação na linha do próprio administrador com tooltip explicativo", async () => {
      setupAuthenticatedAdmin();

      renderWithProviders(<AdminUsuarios />, {
        initialEntries: ["/admin/usuarios"],
      });

      // Aguarda tabela renderizar e exibir a tag "Você"
      await waitFor(() => {
        expect(screen.getByText("Você")).toBeInTheDocument();
      });

      // Botão de inativação deve estar desabilitado
      const btnSelfInativar = screen.getByRole("button", {
        name: "Você não pode inativar sua própria conta",
      });

      expect(btnSelfInativar).toBeInTheDocument();
      expect(btnSelfInativar).toBeDisabled();
      expect(btnSelfInativar).toHaveAttribute(
        "title",
        "Você não pode inativar sua própria conta",
      );
    });
  });
});
