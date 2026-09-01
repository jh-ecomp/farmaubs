import * as path from 'node:path';
import * as dotenv from 'dotenv';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

// Leitura do arquivo de variáveis de ambiente
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

// Guard: este seed é exclusivo de desenvolvimento local
// Aborta em qualquer outro ambiente, incluindo homologação.
if (process.env.NODE_ENV !== 'development') {
  throw new Error(
    'Seed de desenvolvimento só pode rodar com NODE_ENV=development',
  );
}

const pool = new Pool({
  host: process.env.DB_HOST ?? 'localhost', // fora do container: localhost:5434
  port: parseInt(process.env.DB_PORT ?? '5434', 10),
  database: process.env.POSTGRES_DB ?? 'farmaubs',
  user: process.env.POSTGRES_USER ?? 'farmaubs_admin',
  password: process.env.POSTGRES_PASSWORD ?? '',
});

interface PerfilSeed {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
}

interface MunicipioSeed {
  id: string;
  nome: string;
  uf: string;
  ibge_code: string;
}

interface UnidadeSaudeSeed {
  id: string;
  municipioIbge: string;
  nome: string;
  endereco: string;
  responsavel_tecnico: string;
  caf_lead_time_days: number;
}

interface UserSeed {
  id: string;
  municipioIbge: string;
  perfilCodigo: string;
  nome_completo: string;
  email: string;
  passwordPlain: string;
}

// ---------------------------------------------------------------------------
// DADOS DETERMINÍSTICOS PARA IDEMPOTÊNCIA
// ---------------------------------------------------------------------------

const PERFIS: PerfilSeed[] = [
  {
    id: '00000000-0000-0000-0001-000000000001',
    codigo: 'ADMINISTRADOR',
    nome: 'Administrador',
    descricao: 'Acesso total ao sistema e configurações globais',
  },
  {
    id: '00000000-0000-0000-0001-000000000002',
    codigo: 'GESTOR',
    nome: 'Gestor/Coordenador',
    descricao: 'Gestor ou coordenador da assistência farmacêutica municipal',
  },
  {
    id: '00000000-0000-0000-0001-000000000003',
    codigo: 'FARMACEUTICO_RESPONSAVEL',
    nome: 'Farmacêutico Responsável',
    descricao: 'Farmacêutico responsável técnico pela farmácia/UBS',
  },
  {
    id: '00000000-0000-0000-0001-000000000004',
    codigo: 'FARMACEUTICO_RESIDENTE',
    nome: 'Farmacêutico Residente',
    descricao: 'Farmacêutico residente em atuação na UBS',
  },
];

const MUNICIPIOS: MunicipioSeed[] = [
  {
    id: '00000000-0000-0000-0002-000000000001',
    nome: 'Parnaíba',
    uf: 'PI',
    ibge_code: '2207702',
  },
  {
    id: '00000000-0000-0000-0002-000000000002',
    nome: 'Luís Correia',
    uf: 'PI',
    ibge_code: '2205706',
  },
];

const UNIDADES_SAUDE: UnidadeSaudeSeed[] = [
  {
    id: '00000000-0000-0000-0003-000000000001',
    municipioIbge: '2207702',
    nome: 'Central de Abastecimento Farmacêutico - CAF Parnaíba',
    endereco: "Rua Conde D'Eu, 450 - Centro, Parnaíba - PI",
    responsavel_tecnico: 'Dra. Camila Fernandes',
    caf_lead_time_days: 15,
  },
  {
    id: '00000000-0000-0000-0003-000000000002',
    municipioIbge: '2207702',
    nome: 'UBS Modular Joaz Souza',
    endereco: 'Av. Pinheiro Machado, 1200 - Joaz Souza, Parnaíba - PI',
    responsavel_tecnico: 'Dr. Rafael Moreira',
    caf_lead_time_days: 15,
  },
  {
    id: '00000000-0000-0000-0003-000000000003',
    municipioIbge: '2207702',
    nome: 'UBS Nossa Senhora de Fátima',
    endereco: 'Rua Caramuru, 890 - Nossa Senhora de Fátima, Parnaíba - PI',
    responsavel_tecnico: 'Dra. Juliana Mendes',
    caf_lead_time_days: 15,
  },
];

const USERS: UserSeed[] = [
  {
    id: '00000000-0000-0000-0004-000000000001',
    municipioIbge: '2207702',
    perfilCodigo: 'ADMINISTRADOR',
    nome_completo: 'Administrador do Sistema',
    email: 'admin@farmaubs.com.br',
    passwordPlain: 'Admin@123',
  },
  {
    id: '00000000-0000-0000-0004-000000000002',
    municipioIbge: '2207702',
    perfilCodigo: 'GESTOR',
    nome_completo: 'Gestor de Assistência Farmacêutica',
    email: 'gestor@farmaubs.com.br',
    passwordPlain: 'Gestor@123',
  },
  {
    id: '00000000-0000-0000-0004-000000000003',
    municipioIbge: '2207702',
    perfilCodigo: 'FARMACEUTICO_RESPONSAVEL',
    nome_completo: 'Farmacêutico Responsável Técnico',
    email: 'farmaceutico@farmaubs.com.br',
    passwordPlain: 'Farma@123',
  },
  {
    id: '00000000-0000-0000-0004-000000000004',
    municipioIbge: '2207702',
    perfilCodigo: 'FARMACEUTICO_RESIDENTE',
    nome_completo: 'Farmacêutico Residente',
    email: 'residente@farmaubs.com.br',
    passwordPlain: 'Residente@123',
  },
];

export async function runSeed(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log('🌱 Iniciando seed de desenvolvimento...');
    await client.query('BEGIN');

    // 1. Perfis
    console.log('  -> Populando perfis...');
    const perfilMap = new Map<string, string>();
    for (const perfil of PERFIS) {
      const res = await client.query<{ id: string }>(
        `INSERT INTO perfis (id, codigo, nome, descricao, ativo)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (codigo) DO UPDATE
           SET nome = EXCLUDED.nome,
               descricao = EXCLUDED.descricao,
               ativo = true,
               updated_at = now()
         RETURNING id;`,
        [perfil.id, perfil.codigo, perfil.nome, perfil.descricao],
      );
      perfilMap.set(perfil.codigo, res.rows[0].id);
    }

    // 2. Municípios
    console.log('  -> Populando municípios...');
    const municipioMap = new Map<string, string>();
    for (const municipio of MUNICIPIOS) {
      const res = await client.query<{ id: string }>(
        `INSERT INTO municipios (id, nome, uf, ibge_code)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (ibge_code) DO UPDATE
           SET nome = EXCLUDED.nome,
               uf = EXCLUDED.uf,
               updated_at = now()
         RETURNING id;`,
        [municipio.id, municipio.nome, municipio.uf, municipio.ibge_code],
      );
      municipioMap.set(municipio.ibge_code, res.rows[0].id);
    }

    // 3. Unidades de Saúde
    console.log('  -> Populando unidades de saúde...');
    for (const unidade of UNIDADES_SAUDE) {
      const municipioId = municipioMap.get(unidade.municipioIbge);
      if (!municipioId) {
        throw new Error(
          `Município com IBGE ${unidade.municipioIbge} não encontrado.`,
        );
      }

      await client.query(
        `INSERT INTO unidades_saude (id, municipio_id, nome, endereco, responsavel_tecnico, caf_lead_time_days)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE
           SET municipio_id = EXCLUDED.municipio_id,
               nome = EXCLUDED.nome,
               endereco = EXCLUDED.endereco,
               responsavel_tecnico = EXCLUDED.responsavel_tecnico,
               caf_lead_time_days = EXCLUDED.caf_lead_time_days,
               updated_at = now();`,
        [
          unidade.id,
          municipioId,
          unidade.nome,
          unidade.endereco,
          unidade.responsavel_tecnico,
          unidade.caf_lead_time_days,
        ],
      );
    }

    // 4. Usuários
    console.log('  -> Populando usuários...');
    const bcryptCost = parseInt(process.env.BCRYPT_COST ?? '10', 10);
    for (const user of USERS) {
      const municipioId = municipioMap.get(user.municipioIbge);
      const perfilId = perfilMap.get(user.perfilCodigo);

      if (!municipioId) {
        throw new Error(
          `Município com IBGE ${user.municipioIbge} não encontrado para usuário ${user.email}.`,
        );
      }
      if (!perfilId) {
        throw new Error(
          `Perfil ${user.perfilCodigo} não encontrado para usuário ${user.email}.`,
        );
      }

      const senhaHash = bcrypt.hashSync(user.passwordPlain, bcryptCost);

      // Limpa usuário pré-existente com o mesmo email se possuir ID diferente
      // para garantir idempotência completa com o índice idx_users_email_lower
      await client.query(
        `DELETE FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2`,
        [user.email, user.id],
      );

      await client.query(
        `INSERT INTO users (
           id,
           municipio_id,
           nome_completo,
           email,
           senha_hash,
           perfil_id,
           ativo,
           deve_trocar_senha,
           tentativas_login_falhas,
           updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, true, false, 0, now())
         ON CONFLICT (id) DO UPDATE
           SET municipio_id = EXCLUDED.municipio_id,
               nome_completo = EXCLUDED.nome_completo,
               email = EXCLUDED.email,
               senha_hash = EXCLUDED.senha_hash,
               perfil_id = EXCLUDED.perfil_id,
               ativo = EXCLUDED.ativo,
               deve_trocar_senha = EXCLUDED.deve_trocar_senha,
               tentativas_login_falhas = EXCLUDED.tentativas_login_falhas,
               updated_at = now();`,
        [
          user.id,
          municipioId,
          user.nome_completo,
          user.email,
          senhaHash,
          perfilId,
        ],
      );
    }

    await client.query('COMMIT');
    console.log('✅ Seed de desenvolvimento executado com sucesso!');
    console.log('\nCredenciais criadas para desenvolvimento:');
    for (const user of USERS) {
      console.log(
        `  • [${user.perfilCodigo}] ${user.email} -> Senha: ${user.passwordPlain}`,
      );
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro durante execução do seed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runSeed().catch((err) => {
    console.error('Falha ao executar seed:', err);
    process.exit(1);
  });
}
