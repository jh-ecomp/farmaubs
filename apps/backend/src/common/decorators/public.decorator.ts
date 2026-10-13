import { SetMetadata, applyDecorators } from "@nestjs/common";
import { SKIP_AUTH_KEY } from "../guards/skip-auth.decorator";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * [AC-13 / NF009]: Isenta a rota ou controller de autenticação e de guards de autorização.
 * @returns Decorator composto aplicando metadados isPublic e skip_auth.
 */
export const Public = () =>
  applyDecorators(
    SetMetadata(IS_PUBLIC_KEY, true),
    SetMetadata(SKIP_AUTH_KEY, true),
  );

