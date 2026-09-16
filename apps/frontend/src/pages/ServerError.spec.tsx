import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { ServerError } from "./ServerError";
import { renderWithProviders } from "../test/test-utils";

describe("ServerError Component (Página Personalizada de Erro 5xx)", () => {
  it("deve renderizar elementos acessíveis de indisponibilidade e código 500 por padrão", () => {
    renderWithProviders(<ServerError />);

    expect(
      screen.getByRole("heading", {
        name: /serviço temporariamente indisponível/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/erro 500 • instabilidade no servidor/i),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /tentar novamente/i }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /ir para o início/i }),
    ).toBeInTheDocument();
  });

  it("deve exibir o código de status e mensagem customizados quando fornecidos via props", () => {
    renderWithProviders(
      <ServerError
        statusCode={503}
        mensagem="Serviço sob manutenção programada."
      />,
    );

    expect(
      screen.getByText(/erro 503 • instabilidade no servidor/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Serviço sob manutenção programada."),
    ).toBeInTheDocument();
  });
});
