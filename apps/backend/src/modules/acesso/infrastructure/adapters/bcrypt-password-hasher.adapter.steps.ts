import { defineFeature, loadFeature } from 'jest-cucumber';
import * as path from 'path';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import {
  BcryptPasswordHasherAdapter,
  FATOR_CUSTO_MINIMO_BCRYPT,
} from './bcrypt-password-hasher.adapter';

const feature = loadFeature(
  path.resolve(__dirname, 'bcrypt-password-hasher.adapter.feature'),
);

defineFeature(feature, (test) => {
  let adaptador: BcryptPasswordHasherAdapter;
  let hashGerado: string;
  let resultadoComparacao: boolean;

  const inicializarPadrao = () => {
    adaptador = new BcryptPasswordHasherAdapter();
  };

  test('Geração de hash bcrypt com custo mínimo 12 (NF011)', ({
    given,
    when,
    then,
    and,
  }) => {
    given(
      'que o adaptador BcryptPasswordHasherAdapter está disponível',
      () => {},
    );

    given('que o adaptador é inicializado com a configuração padrão', () => {
      inicializarPadrao();
    });

    when(
      /^eu solicito a geração do hash para a senha "(.*)"$/,
      async (senha: string) => {
        hashGerado = await adaptador.gerarHash(senha);
      },
    );

    then('o hash gerado deve ser uma string bcrypt válida', () => {
      expect(hashGerado).toBeDefined();
      expect(typeof hashGerado).toBe('string');
      expect(hashGerado).toMatch(/^\$2[aby]\$\d{2}\$/);
    });

    and('o fator de custo do hash deve ser de no mínimo 12', () => {
      const rounds = bcrypt.getRounds(hashGerado);
      expect(rounds).toBeGreaterThanOrEqual(FATOR_CUSTO_MINIMO_BCRYPT);
    });

    and('a senha em texto puro não deve estar exposta no hash gerado', () => {
      expect(hashGerado).not.toContain('SenhaForte@2026');
    });
  });

  test('Comparação bem-sucedida de senha correta com o hash', ({
    given,
    when,
    then,
  }) => {
    given(
      'que o adaptador BcryptPasswordHasherAdapter está disponível',
      () => {},
    );

    given(
      /^que uma senha "(.*)" teve seu hash gerado pelo adaptador$/,
      async (senha: string) => {
        inicializarPadrao();
        hashGerado = await adaptador.gerarHash(senha);
      },
    );

    when(
      /^eu comparo a mesma senha "(.*)" com o hash gerado$/,
      async (senha: string) => {
        resultadoComparacao = await adaptador.comparar(senha, hashGerado);
      },
    );

    then('a verificação deve retornar verdadeiro', () => {
      expect(resultadoComparacao).toBe(true);
    });
  });

  test('Rejeição na comparação com senha incorreta', ({
    given,
    when,
    then,
  }) => {
    given(
      'que o adaptador BcryptPasswordHasherAdapter está disponível',
      () => {},
    );

    given(
      /^que uma senha "(.*)" teve seu hash gerado pelo adaptador$/,
      async (senha: string) => {
        inicializarPadrao();
        hashGerado = await adaptador.gerarHash(senha);
      },
    );

    when(
      /^eu comparo a senha incorreta "(.*)" com o hash gerado$/,
      async (senhaIncorreta: string) => {
        resultadoComparacao = await adaptador.comparar(
          senhaIncorreta,
          hashGerado,
        );
      },
    );

    then('a verificação deve retornar falso', () => {
      expect(resultadoComparacao).toBe(false);
    });
  });

  test('Garantia do piso de custo 12 mesmo com configuração inferior (NF011)', ({
    given,
    when,
    then,
  }) => {
    given(
      'que o adaptador BcryptPasswordHasherAdapter está disponível',
      () => {},
    );

    let mockConfigService: Partial<ConfigService>;

    given(
      /^que o serviço de configuração informa um BCRYPT_COST igual a "(.*)"$/,
      (custoInformado: string) => {
        mockConfigService = {
          get: jest.fn().mockReturnValue(custoInformado),
        };
      },
    );

    when('o adaptador é inicializado com esse serviço de configuração', () => {
      adaptador = new BcryptPasswordHasherAdapter(
        mockConfigService as ConfigService,
      );
    });

    then('o fator de custo efetivo do adaptador deve ser 12', () => {
      expect(adaptador.getFatorCusto()).toBe(FATOR_CUSTO_MINIMO_BCRYPT);
    });
  });

  test('Resiliência e retorno falso contra hash inválido ou corrompido', ({
    given,
    when,
    then,
  }) => {
    given(
      'que o adaptador BcryptPasswordHasherAdapter está disponível',
      () => {},
    );

    given('que o adaptador é inicializado com a configuração padrão', () => {
      inicializarPadrao();
    });

    when(
      /^eu comparo uma senha qualquer com o hash inválido "(.*)"$/,
      async (hashInvalido: string) => {
        resultadoComparacao = await adaptador.comparar(
          'QualquerSenha123',
          hashInvalido,
        );
      },
    );

    then('a verificação deve retornar falso sem lançar exceção', () => {
      expect(resultadoComparacao).toBe(false);
    });
  });
});
