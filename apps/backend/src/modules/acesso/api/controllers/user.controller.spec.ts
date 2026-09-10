import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UserController } from './user.controller';
import { CadastrarUsuarioUseCase } from '../../application/use-cases/register-user.use-case';
import { CadastrarUsuarioDto } from '../dto/create-user.dto';
import {
  DadosUsuarioInvalidosException,
  PerfilNaoEncontradoException,
  UnidadeSaudeInvalidaException,
  UsuarioEmailJaExisteException,
} from '../../domain/errors/user-registration.errors';

describe('UserController', () => {
  let controller: UserController;
  let useCaseMock: jest.Mocked<CadastrarUsuarioUseCase>;

  const dtoValido: CadastrarUsuarioDto = {
    municipioId: '01919a77-3e15-7000-8000-000000000001',
    nomeCompleto: 'Carlos Eduardo da Silva',
    email: 'carlos.silva@ubs.gov.br',
    senha: 'SenhaForte#2026',
    perfil: 'FARMACEUTICO',
    ubsIds: ['01919a77-3e15-7000-8000-000000000010'],
  };

  beforeEach(async () => {
    useCaseMock = {
      executar: jest.fn(),
    } as unknown as jest.Mocked<CadastrarUsuarioUseCase>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: CadastrarUsuarioUseCase,
          useValue: useCaseMock,
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  it('deve cadastrar usuário com sucesso retornando status 201 e dados do usuário', async () => {
    const dataCriacao = new Date('2026-09-10T12:00:00.000Z');
    const mockResultado = {
      id: '01919a77-3e15-7000-8000-000000000020',
      municipioId: dtoValido.municipioId,
      nomeCompleto: dtoValido.nomeCompleto,
      email: dtoValido.email,
      perfilId: '01919a77-3e15-7000-8000-000000000005',
      ativo: true,
      deveTrocarSenha: true,
      ubsIds: dtoValido.ubsIds,
      criadoEm: dataCriacao,
      createdAt: dataCriacao,
    };

    useCaseMock.executar.mockResolvedValue(mockResultado);

    const resultado = await controller.cadastrar(dtoValido);

    expect(useCaseMock.executar).toHaveBeenCalledWith(dtoValido);
    expect(resultado).toEqual(mockResultado);
  });

  it('deve converter UsuarioEmailJaExisteException em ConflictException (409)', async () => {
    useCaseMock.executar.mockRejectedValue(
      new UsuarioEmailJaExisteException(dtoValido.email),
    );

    await expect(controller.cadastrar(dtoValido)).rejects.toThrow(
      ConflictException,
    );
  });

  it('deve converter PerfilNaoEncontradoException em NotFoundException (404)', async () => {
    useCaseMock.executar.mockRejectedValue(
      new PerfilNaoEncontradoException('INEXISTENTE'),
    );

    await expect(controller.cadastrar(dtoValido)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('deve converter UnidadeSaudeInvalidaException em BadRequestException (400)', async () => {
    useCaseMock.executar.mockRejectedValue(
      new UnidadeSaudeInvalidaException('UBS inválida'),
    );

    await expect(controller.cadastrar(dtoValido)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('deve converter DadosUsuarioInvalidosException em BadRequestException (400)', async () => {
    useCaseMock.executar.mockRejectedValue(
      new DadosUsuarioInvalidosException('Nome obrigatório'),
    );

    await expect(controller.cadastrar(dtoValido)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('deve propagar erros inesperados sem mascarar', async () => {
    useCaseMock.executar.mockRejectedValue(new Error('Erro de banco de dados'));

    await expect(controller.cadastrar(dtoValido)).rejects.toThrow(
      'Erro de banco de dados',
    );
  });
});

