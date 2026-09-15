import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import type { Request, Response } from "express";

@Injectable()
export class SessionHeaderInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    return next.handle().pipe(
      tap(() => {
        const sessao = (req as any).sessao ?? (req as any).session;
        if (sessao?.expiraEm) {
          const expiraEmDate =
            sessao.expiraEm instanceof Date
              ? sessao.expiraEm
              : new Date(sessao.expiraEm);
          res.setHeader("X-Session-Expires-At", expiraEmDate.toISOString());
        }
      }),
    );
  }
}
