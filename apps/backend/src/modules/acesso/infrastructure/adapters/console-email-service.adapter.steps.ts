import { defineFeature, loadFeature } from 'jest-cucumber';
import * as path from 'path';
import { ConsoleEmailServiceAdapter } from './console-email-service.adapter';

const feature = loadFeature(
  path.resolve(__dirname, 'console-email-service.adapter.feature'),
);

defineFeature(feature, (test) => {
  let adaptador: ConsoleEmailServiceAdapter;
  let consoleSpy: jest.SpyInstance;
  let emailSolicitado: string;
  let nomeSolicitado: string;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  const inicializarAdaptador = () => {
    adaptador = new ConsoleEmailServiceAdapter();
  };

  test('Disparo de e-mail de confirmação emitindo log no console com sucesso', ({
    given,
    when,
    then,
    and,
  }) => {
    given(
      'que o adaptador ConsoleEmailServiceAdapter está instanciado',
      inicializarAdaptador,
    );

    given(
      /^que recebo a solicitação de envio para o usuário "(.*)" com e-mail "(.*)"$/,
      (nome: string, email: string) => {
        nomeSolicitado = nome;
        emailSolicitado = email;
      },
    );

    when('eu invoco o método enviarConfirmacaoCadastro', async () => {
      await adaptador.enviarConfirmacaoCadastro(
        emailSolicitado,
        nomeSolicitado,
      );
    });

    then(
      'a notificação deve ser emitida no console informando o sucesso do envio',
      () => {
        expect(consoleSpy).toHaveBeenCalled();
      },
    );

    and(
      /^a mensagem deve conter o identificador de serviço "(.*)"$/,
      (identificador: string) => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining(identificador),
        );
      },
    );
  });

  test('Garantia de formatação legível contendo nome completo e e-mail institucional', ({
    given,
    when,
    then,
    and,
  }) => {
    given(
      'que o adaptador ConsoleEmailServiceAdapter está instanciado',
      inicializarAdaptador,
    );

    given(
      /^que recebo a solicitação de envio para o usuário "(.*)" com e-mail "(.*)"$/,
      (nome: string, email: string) => {
        nomeSolicitado = nome;
        emailSolicitado = email;
      },
    );

    when('eu invoco o método enviarConfirmacaoCadastro', async () => {
      await adaptador.enviarConfirmacaoCadastro(
        emailSolicitado,
        nomeSolicitado,
      );
    });

    then(
      /^a mensagem emitida deve conter o nome "(.*)"$/,
      (nomeEsperado: string) => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining(nomeEsperado),
        );
      },
    );

    and(
      /^a mensagem emitida deve conter o e-mail "(.*)"$/,
      (emailEsperado: string) => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining(emailEsperado),
        );
      },
    );
  });

  test('Normalização e limpeza de espaços extras ao enviar notificação', ({
    given,
    when,
    then,
    and,
  }) => {
    given(
      'que o adaptador ConsoleEmailServiceAdapter está instanciado',
      inicializarAdaptador,
    );

    given(
      /^que recebo a solicitação com espaços extras no nome "(.*)" e e-mail "(.*)"$/,
      (nomeComEspacos: string, emailComEspacos: string) => {
        nomeSolicitado = nomeComEspacos;
        emailSolicitado = emailComEspacos;
      },
    );

    when('eu invoco o método enviarConfirmacaoCadastro', async () => {
      await adaptador.enviarConfirmacaoCadastro(
        emailSolicitado,
        nomeSolicitado,
      );
    });

    then(
      /^o nome deve ser impresso sem espaços desnecessários "(.*)"$/,
      (nomeEsperado: string) => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining(nomeEsperado),
        );
      },
    );

    and(
      /^o e-mail deve ser impresso em minúsculas e sem espaços "(.*)"$/,
      (emailEsperado: string) => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining(`<${emailEsperado}>`),
        );
      },
    );
  });
});
