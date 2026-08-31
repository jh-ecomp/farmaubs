import { User } from './user.entity';

describe('User Entity', () => {
  it('deve instanciar uma nova entidade de usuário com os valores atribuídos', () => {
    const now = new Date();
    const user = new User();

    user.id = '018f3a2b-1234-7000-8000-000000000001';
    user.municipio_id = '018f3a2b-1234-7000-8000-000000000002';
    user.nome_completo = 'João da Silva';
    user.email = 'joao.silva@farmaubs.gov.br';
    user.senha_hash = '$2b$10$e839210983210938210938210938210938210938';
    user.perfil_id = '018f3a2b-1234-7000-8000-000000000003';
    user.ativo = true;
    user.deve_trocar_senha = true;
    user.tentativas_login_falhas = 0;
    user.bloqueado_ate = null;
    user.senha_atualizada_em = null;
    user.ultimo_login_em = null;
    user.created_at = now;
    user.updated_at = now;

    expect(user.id).toBe('018f3a2b-1234-7000-8000-000000000001');
    expect(user.municipio_id).toBe('018f3a2b-1234-7000-8000-000000000002');
    expect(user.nome_completo).toBe('João da Silva');
    expect(user.email).toBe('joao.silva@farmaubs.gov.br');
    expect(user.senha_hash).toBeDefined();
    expect(user.perfil_id).toBe('018f3a2b-1234-7000-8000-000000000003');
    expect(user.ativo).toBe(true);
    expect(user.deve_trocar_senha).toBe(true);
    expect(user.tentativas_login_falhas).toBe(0);
    expect(user.bloqueado_ate).toBeNull();
    expect(user.created_at).toBe(now);
  });
});
