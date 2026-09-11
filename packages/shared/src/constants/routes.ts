export const API_ROUTES = {
  BASE_PREFIX: "/api/v1",
  HEALTH: "/api/v1/health",
  ACESSO: {
    LOGIN: "/api/v1/acesso/login",
    ME: "/api/v1/acesso/me",
    LOGOUT: "/api/v1/acesso/logout",
  },
  ADMINISTRACAO: {
    MUNICIPIOS: "/api/v1/administracao/municipios",
    UNIDADES: "/api/v1/administracao/unidades-saude",
    USUARIOS: "/api/v1/administracao/usuarios",
  },
} as const;

export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
} as const;
