import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { GeradorHashSenhaPort } from '../../domain/ports/password-hasher.port';

export const FATOR_CUSTO_MINIMO_BCRYPT = 12;

@Injectable()
export class BcryptPasswordHasherAdapter implements GeradorHashSenhaPort {
  private readonly fatorCusto: number;

  constructor(@Optional() configService?: ConfigService) {
    const custoConfigurado = configService?.get<string | number>('BCRYPT_COST');
    let custoNumerico: number;

    if (typeof custoConfigurado === 'number') {
      custoNumerico = custoConfigurado;
    } else if (typeof custoConfigurado === 'string') {
      custoNumerico = parseInt(custoConfigurado, 10);
    } else {
      custoNumerico = FATOR_CUSTO_MINIMO_BCRYPT;
    }

    // NF011: Fator de custo mínimo 12
    this.fatorCusto =
      Number.isInteger(custoNumerico) &&
      custoNumerico >= FATOR_CUSTO_MINIMO_BCRYPT
        ? custoNumerico
        : FATOR_CUSTO_MINIMO_BCRYPT;
  }

  getFatorCusto(): number {
    return this.fatorCusto;
  }

  async gerarHash(textoPlano: string): Promise<string> {
    return await bcrypt.hash(textoPlano, this.fatorCusto);
  }

  async comparar(textoPlano: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(textoPlano, hash);
    } catch {
      return false;
    }
  }
}

export type BcryptGeradorHashSenhaAdapter = BcryptPasswordHasherAdapter;
