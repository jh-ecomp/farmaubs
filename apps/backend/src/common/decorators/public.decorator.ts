import { SetMetadata, applyDecorators } from "@nestjs/common";
import { SKIP_AUTH_KEY } from "../guards/skip-auth.decorator";

export const IS_PUBLIC_KEY = "isPublic";

export const Public = () =>
  applyDecorators(
    SetMetadata(IS_PUBLIC_KEY, true),
    SetMetadata(SKIP_AUTH_KEY, true),
  );
