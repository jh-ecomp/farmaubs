import * as path from 'node:path';
import * as dotenv from 'dotenv';
import { Pool, PoolClient } from 'pg';
import * as bcrypt from 'bcrypt';

// Leitura do arquivo de variáveis de ambiente (raiz do monorepo)
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

// Guard: este seed é exclusivo de desenvolvimento local
// Aborta em qualquer outro ambiente, incluindo homologação.
if (process.env.NODE_ENV !== 'development') {
  throw new Error(
    'Seed de desenvolvimento só pode rodar com NODE_ENV=development',
  );
}

const pool = new Pool({
  host: process.env.DB_HOST ?? 'localhost', // fora do container: localhost
  port: parseInt(process.env.DB_PORT ?? '5434', 10),
  database: process.env.POSTGRES_DB ?? 'farmaubs',
  user: process.env.POSTGRES_USER ?? 'farmaubs_admin',
  password: process.env.POSTGRES_PASSWORD ?? '',
});

// ─────────────────────────────────────────────────────────────────────────────
// VALORES FIXOS / DETERMINÍSTICOS — garante idempotência (ON CONFLICT DO UPDATE)
// ─────────────────────────────────────────────────────────────────────────────

/** Perfis RBAC definidos no ADR-006 */
const PERFIS = [
  {
    id: 'c49a58ba-8da5-4b59-8861-d0f237574bbc',
    codigo: 'ADMINISTRADOR',
    nome: 'Administrador',
    descricao: 'Acesso total ao sistema e configurações globais',
  },
  {
    id: 'f68b8c05-8e96-4c63-9989-ce4b10cd1dda',
    codigo: 'GESTOR',
    nome: 'Gestor/Coordenador',
    descricao: 'Gestor ou coordenador da assistência farmacêutica municipal',
  },
  {
    id: '45f5fca7-6413-4285-916b-cd92284a6693',
    codigo: 'FARMACEUTICO_RESPONSAVEL',
    nome: 'Farmacêutico Responsável',
    descricao: 'Farmacêutico responsável técnico pela farmácia/UBS',
  },
  {
    id: 'a0000001-0000-7000-8000-000000000004',
    codigo: 'FARMACEUTICO_RESIDENTE',
    nome: 'Farmacêutico Residente',
    descricao: 'Farmacêutico residente em atuação na UBS',
  },
] as const;

/** Municípios de teste */
const MUNICIPIOS = [
  {
    id: 'b0000001-0000-7000-8000-000000000001',
    nome: 'São Paulo',
    uf: 'SP',
    ibge_code: '3550308',
  },
  {
    id: 'b0000001-0000-7000-8000-000000000002',
    nome: 'Rio de Janeiro',
    uf: 'RJ',
    ibge_code: '3304557',
  },
  {
    id: 'b0000001-0000-7000-8000-000000000003',
    nome: 'Belo Horizonte',
    uf: 'MG',
    ibge_code: '3106200',
  },
] as const;

/** Unidades de saúde (UBS) de teste */
const UNIDADES_SAUDE = [
  {
    id: 'c0000001-0000-7000-8000-000000000001',
    municipio_id: 'b0000001-0000-7000-8000-000000000001',
    nome: 'UBS Jardim Primavera',
    endereco: 'Rua das Flores, 100 — Jardim Primavera, São Paulo/SP',
    responsavel_tecnico: 'Dra. Ana Paula Silva',
    caf_lead_time_days: 15,
  },
  {
    id: 'c0000001-0000-7000-8000-000000000002',
    municipio_id: 'b0000001-0000-7000-8000-000000000001',
    nome: 'UBS Vila Nova',
    endereco: 'Av. Central, 250 — Vila Nova, São Paulo/SP',
    responsavel_tecnico: 'Dr. Carlos Eduardo Mendes',
    caf_lead_time_days: 15,
  },
  {
    id: 'c0000001-0000-7000-8000-000000000003',
    municipio_id: 'b0000001-0000-7000-8000-000000000002',
    nome: 'UBS Copacabana Sul',
    endereco: 'Rua Bolivar, 30 — Copacabana, Rio de Janeiro/RJ',
    responsavel_tecnico: 'Dra. Mariana Figueiredo',
    caf_lead_time_days: 10,
  },
] as const;

/**
 * Usuários de teste — senhas em texto plano (serão hashed pelo bcrypt).
 * Todos criados com deve_trocar_senha = false para facilitar os testes.
 */
const USUARIOS_PLAIN = [
  {
    id: 'd0000001-0000-7000-8000-000000000001',
    municipio_id: 'b0000001-0000-7000-8000-000000000001',
    nome_completo: 'Admin Sistema',
    email: 'admin@farmaubs.dev',
    senha: 'Admin@123456',
    perfil_id: 'a0000001-0000-7000-8000-000000000001', // ADMINISTRADOR
    ativo: true,
    deve_trocar_senha: false,
  },
  {
    id: 'd0000001-0000-7000-8000-000000000002',
    municipio_id: 'b0000001-0000-7000-8000-000000000001',
    nome_completo: 'Gestor São Paulo',
    email: 'gestor@farmaubs.dev',
    senha: 'Gestor@123456',
    perfil_id: 'a0000001-0000-7000-8000-000000000002', // GESTOR
    ativo: true,
    deve_trocar_senha: false,
  },
  {
    id: 'd0000001-0000-7000-8000-000000000003',
    municipio_id: 'b0000001-0000-7000-8000-000000000001',
    nome_completo: 'Farmacêutico Responsável UBS Jardim Primavera',
    email: 'farmaceutico.responsavel@farmaubs.dev',
    senha: 'Farma@123456',
    perfil_id: 'a0000001-0000-7000-8000-000000000003', // FARMACEUTICO_RESPONSAVEL
    ativo: true,
    deve_trocar_senha: false,
  },
  {
    id: 'd0000001-0000-7000-8000-000000000004',
    municipio_id: 'b0000001-0000-7000-8000-000000000001',
    nome_completo: 'Farmacêutico Residente Teste',
    email: 'farmaceutico.residente@farmaubs.dev',
    senha: 'Reside@123456',
    perfil_id: 'a0000001-0000-7000-8000-000000000004', // FARMACEUTICO_RESIDENTE
    ativo: true,
    deve_trocar_senha: false,
  },
  {
    id: 'd0000001-0000-7000-8000-000000000005',
    municipio_id: 'b0000001-0000-7000-8000-000000000001',
    nome_completo: 'Usuário Inativo Teste',
    email: 'inativo@farmaubs.dev',
    senha: 'Inativ@123456',
    perfil_id: 'a0000001-0000-7000-8000-000000000002', // GESTOR
    ativo: false,
    deve_trocar_senha: false,
  },
] as const;

/**
 * Vínculos usuário ↔ unidade de saúde (user_units).
 * Determinísticos por (usuario_id, unidade_id).
 */
const USER_UNITS = [
  // Admin: acesso a todas as UBS de SP
  {
    usuario_id: 'd0000001-0000-7000-8000-000000000001',
    unidade_id: 'c0000001-0000-7000-8000-000000000001',
  },
  {
    usuario_id: 'd0000001-0000-7000-8000-000000000001',
    unidade_id: 'c0000001-0000-7000-8000-000000000002',
  },
  // Gestor: acesso às UBS do município
  {
    usuario_id: 'd0000001-0000-7000-8000-000000000002',
    unidade_id: 'c0000001-0000-7000-8000-000000000001',
  },
  {
    usuario_id: 'd0000001-0000-7000-8000-000000000002',
    unidade_id: 'c0000001-0000-7000-8000-000000000002',
  },
  // Farmacêutico Responsável: apenas sua UBS
  {
    usuario_id: 'd0000001-0000-7000-8000-000000000003',
    unidade_id: 'c0000001-0000-7000-8000-000000000001',
  },
  // Residente: apenas sua UBS
  {
    usuario_id: 'd0000001-0000-7000-8000-000000000004',
    unidade_id: 'c0000001-0000-7000-8000-000000000001',
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// FUNÇÕES DE SEED
// ─────────────────────────────────────────────────────────────────────────────

async function seedPerfis(client: PoolClient) {
  console.log('  → Inserindo perfis...');
  for (const p of PERFIS) {
    await client.query(
      `INSERT INTO perfis (id, codigo, nome, descricao, ativo)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (codigo) DO UPDATE
         SET nome       = EXCLUDED.nome,
             descricao  = EXCLUDED.descricao,
             updated_at = now()`,
      [p.id, p.codigo, p.nome, p.descricao],
    );
  }
  console.log(`     ✔ ${PERFIS.length} perfis inseridos/atualizados.`);
}

async function seedMunicipios(client: PoolClient) {
  console.log('  → Inserindo municípios...');
  for (const m of MUNICIPIOS) {
    await client.query(
      `INSERT INTO municipios (id, nome, uf, ibge_code)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (ibge_code) DO UPDATE
         SET nome       = EXCLUDED.nome,
             uf         = EXCLUDED.uf,
             updated_at = now()`,
      [m.id, m.nome, m.uf, m.ibge_code],
    );
  }
  console.log(`     ✔ ${MUNICIPIOS.length} municípios inseridos/atualizados.`);
}

async function seedUnidadesSaude(
  client: PoolClient,
) {
  console.log('  → Inserindo unidades de saúde...');
  for (const u of UNIDADES_SAUDE) {
    await client.query(
      `INSERT INTO unidades_saude
         (id, municipio_id, nome, endereco, responsavel_tecnico, caf_lead_time_days)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE
         SET nome                = EXCLUDED.nome,
             endereco            = EXCLUDED.endereco,
             responsavel_tecnico = EXCLUDED.responsavel_tecnico,
             caf_lead_time_days  = EXCLUDED.caf_lead_time_days,
             updated_at          = now()`,
      [
        u.id,
        u.municipio_id,
        u.nome,
        u.endereco,
        u.responsavel_tecnico,
        u.caf_lead_time_days,
      ],
    );
  }
  console.log(
    `     ✔ ${UNIDADES_SAUDE.length} unidades de saúde inseridas/atualizadas.`,
  );
}

async function seedUsuarios(client: PoolClient) {
  console.log('  → Inserindo usuários (bcrypt cost=10)...');
  const bcryptCost = 10; // custo reduzido para seed rápido em dev

  for (const u of USUARIOS_PLAIN) {
    const senha_hash = await bcrypt.hash(u.senha, bcryptCost);
    await client.query(
      `INSERT INTO users
         (id, municipio_id, nome_completo, email, senha_hash,
          perfil_id, ativo, deve_trocar_senha,
          tentativas_login_falhas, bloqueado_ate,
          senha_atualizada_em, ultimo_login_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, NULL, now(), NULL)
       ON CONFLICT (id) DO UPDATE
         SET nome_completo           = EXCLUDED.nome_completo,
             email                   = EXCLUDED.email,
             senha_hash              = EXCLUDED.senha_hash,
             perfil_id               = EXCLUDED.perfil_id,
             ativo                   = EXCLUDED.ativo,
             deve_trocar_senha       = EXCLUDED.deve_trocar_senha,
             tentativas_login_falhas = 0,
             bloqueado_ate           = NULL,
             updated_at              = now()`,
      [
        u.id,
        u.municipio_id,
        u.nome_completo,
        u.email,
        senha_hash,
        u.perfil_id,
        u.ativo,
        u.deve_trocar_senha,
      ],
    );
  }
  console.log(
    `     ✔ ${USUARIOS_PLAIN.length} usuários inseridos/atualizados.`,
  );
}

async function seedUserUnits(client: PoolClient) {
  console.log('  → Inserindo vínculos user_units...');
  for (const uu of USER_UNITS) {
    await client.query(
      `INSERT INTO user_units (usuario_id, unidade_id, ativo)
       VALUES ($1, $2, true)
       ON CONFLICT (usuario_id, unidade_id) DO UPDATE
         SET ativo      = true,
             updated_at = now()`,
      [uu.usuario_id, uu.unidade_id],
    );
  }
  console.log(
    `     ✔ ${USER_UNITS.length} vínculos user_units inseridos/atualizados.`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n🌱 FarmaUBS — Seed de Desenvolvimento');
  console.log('   Ambiente : development');
  console.log(
    `   Banco     : ${process.env.POSTGRES_DB ?? 'farmaubs'} @ ${process.env.DB_HOST ?? 'localhost'}:${process.env.DB_PORT ?? '5434'}\n`,
  );

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await seedPerfis(client);
    await seedMunicipios(client);
    await seedUnidadesSaude(client);
    await seedUsuarios(client);
    await seedUserUnits(client);

    await client.query('COMMIT');

    console.log('\n✅ Seed concluído com sucesso!\n');
    console.log('── Credenciais de acesso ──────────────────────────────────');
    for (const u of USUARIOS_PLAIN) {
      const perfil = PERFIS.find((p) => p.id === u.perfil_id);
      console.log(
        `   [${perfil?.codigo ?? '?'}]`.padEnd(32) +
          `${u.email}  /  ${u.senha}`,
      );
    }
    console.log('───────────────────────────────────────────────────────────\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Seed falhou — ROLLBACK executado.');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
