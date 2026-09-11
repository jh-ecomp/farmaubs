import type { ReactElement, ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../contexts/AuthContext";

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

interface AllTheProvidersProps {
  children: ReactNode;
  initialEntries?: string[];
  queryClient?: QueryClient;
}

export function AllTheProviders({
  children,
  initialEntries = ["/login"],
  queryClient = createTestQueryClient(),
}: AllTheProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper"> & {
    initialEntries?: string[];
    queryClient?: QueryClient;
  },
) {
  const { initialEntries, queryClient, ...renderOptions } = options || {};
  return {
    ...render(ui, {
      wrapper: ({ children }) => (
        <AllTheProviders
          initialEntries={initialEntries}
          queryClient={queryClient}
        >
          {children}
        </AllTheProviders>
      ),
      ...renderOptions,
    }),
  };
}

export * from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
