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

/* ─────────────────────────────────────────────────────────────────────────────
 * DADOS DE SEED — referências por CHAVE NATURAL (nunca por ID fixo)
 * Os IDs reais são resolvidos do banco via RETURNING, porque as migrations
 * geram UUIDs no momento da execução (uuidv7()).
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Perfis RBAC definidos no ADR-006 — chave natural: codigo (UNIQUE) */
const PERFIS = [
  {
    codigo: 'ADMINISTRADOR',
    nome: 'Administrador',
    descricao: 'Acesso total ao sistema e configurações globais',
  },
  {
    codigo: 'GESTOR',
    nome: 'Gestor/Coordenador',
    descricao: 'Gestor ou coordenador da assistência farmacêutica municipal',
  },
  {
    codigo: 'FARMACEUTICO_RESPONSAVEL',
    nome: 'Farmacêutico Responsável',
    descricao: 'Farmacêutico responsável técnico pela farmácia/UBS',
  },
  {
    codigo: 'FARMACEUTICO_RESIDENTE',
    nome: 'Farmacêutico Residente',
    descricao: 'Farmacêutico residente em atuação na UBS',
  },
] as const;

/** Municípios de teste — chave natural: ibge_code (UNIQUE) */
const MUNICIPIOS = [
  { nome: 'São Paulo', uf: 'SP', ibge_code: '3550308' },
  { nome: 'Rio de Janeiro', uf: 'RJ', ibge_code: '3304557' },
  { nome: 'Belo Horizonte', uf: 'MG', ibge_code: '3106200' },
] as const;

/** Unidades de saúde — referenciadas por (municipio_ibge, nome) */
const UNIDADES_SAUDE = [
  {
    municipio_ibge: '3550308',
    nome: 'UBS Jardim Primavera',
    endereco: 'Rua das Flores, 100 — Jardim Primavera, São Paulo/SP',
    responsavel_tecnico: 'Dra. Ana Paula Silva',
    caf_lead_time_days: 15,
  },
  {
    municipio_ibge: '3550308',
    nome: 'UBS Vila Nova',
    endereco: 'Av. Central, 250 — Vila Nova, São Paulo/SP',
    responsavel_tecnico: 'Dr. Carlos Eduardo Mendes',
    caf_lead_time_days: 15,
  },
  {
    municipio_ibge: '3304557',
    nome: 'UBS Copacabana Sul',
    endereco: 'Rua Bolivar, 30 — Copacabana, Rio de Janeiro/RJ',
    responsavel_tecnico: 'Dra. Mariana Figueiredo',
    caf_lead_time_days: 10,
  },
] as const;

/**
 * Usuários de teste — senhas em texto plano (serão hashed pelo bcrypt).
 * Referenciados por email (chave natural) e perfil por codigo.
 * Todos criados com deve_trocar_senha = false para facilitar os testes.
 */
const USUARIOS_PLAIN = [
  {
    email: 'admin@farmaubs.dev',
    nome_completo: 'Admin Sistema',
    senha: 'Admin@123456',
    perfil_codigo: 'ADMINISTRADOR',
    municipio_ibge: '3550308',
    ativo: true,
    deve_trocar_senha: false,
  },
  {
    email: 'gestor@farmaubs.dev',
    nome_completo: 'Gestor São Paulo',
    senha: 'Gestor@123456',
    perfil_codigo: 'GESTOR',
    municipio_ibge: '3550308',
    ativo: true,
    deve_trocar_senha: false,
  },
  {
    email: 'farmaceutico.responsavel@farmaubs.dev',
    nome_completo: 'Farmacêutico Responsável UBS Jardim Primavera',
    senha: 'Farma@123456',
    perfil_codigo: 'FARMACEUTICO_RESPONSAVEL',
    municipio_ibge: '3550308',
    ativo: true,
    deve_trocar_senha: false,
  },
  {
    email: 'farmaceutico.residente@farmaubs.dev',
    nome_completo: 'Farmacêutico Residente Teste',
    senha: 'Reside@123456',
    perfil_codigo: 'FARMACEUTICO_RESIDENTE',
    municipio_ibge: '3550308',
    ativo: true,
    deve_trocar_senha: false,
  },
  {
    email: 'inativo@farmaubs.dev',
    nome_completo: 'Usuário Inativo Teste',
    senha: 'Inativ@123456',
    perfil_codigo: 'GESTOR',
    municipio_ibge: '3550308',
    ativo: false,
    deve_trocar_senha: false,
  },
] as const;

/** Vínculos usuário ↔ unidade — referenciados por (email, unidade_nome) */
const USER_UNITS = [
  // Admin: acesso a todas as UBS de SP
  { email: 'admin@farmaubs.dev', unidade_nome: 'UBS Jardim Primavera' },
  { email: 'admin@farmaubs.dev', unidade_nome: 'UBS Vila Nova' },
  // Gestor: acesso às UBS do município
  { email: 'gestor@farmaubs.dev', unidade_nome: 'UBS Jardim Primavera' },
  { email: 'gestor@farmaubs.dev', unidade_nome: 'UBS Vila Nova' },
  // Farmacêutico Responsável: apenas sua UBS
  {
    email: 'farmaceutico.responsavel@farmaubs.dev',
    unidade_nome: 'UBS Jardim Primavera',
  },
  // Residente: apenas sua UBS
  {
    email: 'farmaceutico.residente@farmaubs.dev',
    unidade_nome: 'UBS Jardim Primavera',
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// FUNÇÕES DE SEED
// ─────────────────────────────────────────────────────────────────────────────

async function seedPerfis(client: PoolClient): Promise<Map<string, string>> {
  console.log('  → Inserindo perfis...');
  const ids = new Map<string, string>();

  for (const p of PERFIS) {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO perfis (codigo, nome, descricao, ativo)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (codigo) DO UPDATE
         SET nome       = EXCLUDED.nome,
             descricao  = EXCLUDED.descricao,
             updated_at = now()
        RETURNING id`,
      [p.codigo, p.nome, p.descricao],
    );
    ids.set(p.codigo, rows[0].id);
  }
  console.log(`     ✔ ${PERFIS.length} perfis inseridos/atualizados.`);
  return ids;
}

async function seedMunicipios(
  client: PoolClient,
): Promise<Map<string, string>> {
  console.log('  → Inserindo municípios...');
  const ids = new Map<string, string>();

  for (const m of MUNICIPIOS) {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO municipios (nome, uf, ibge_code)
       VALUES ($1, $2, $3)
       ON CONFLICT (ibge_code) DO UPDATE
         SET nome       = EXCLUDED.nome,
             uf         = EXCLUDED.uf,
             updated_at = now()
        RETURNING id`,
      [m.nome, m.uf, m.ibge_code],
    );
    ids.set(m.ibge_code, rows[0].id);
  }
  console.log(`     ✔ ${MUNICIPIOS.length} municípios inseridos/atualizados.`);
  return ids;
}

async function seedUnidadesSaude(
  client: PoolClient,
  municipioIds: Map<string, string>,
): Promise<Map<string, string>> {
  console.log('  → Inserindo unidades de saúde...');
  const ids = new Map<string, string>();
  for (const u of UNIDADES_SAUDE) {
    const municipio_id = municipioIds.get(u.municipio_ibge);
    if (!municipio_id) {
      throw new Error(`Município ${u.municipio_ibge} não encontrado no seed`);
    }
    // Idempotência por chave natural (municipio_id, nome) — sem ID fixo.
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM unidades_saude WHERE municipio_id = $1 AND nome = $2`,
      [municipio_id, u.nome],
    );
    let id: string;
    if (existing.rowCount && existing.rowCount > 0) {
      id = existing.rows[0].id;
      await client.query(
        `UPDATE unidades_saude
         SET endereco            = $1,
             responsavel_tecnico = $2,
             caf_lead_time_days  = $3,
             updated_at          = now()
         WHERE id = $4`,
        [u.endereco, u.responsavel_tecnico, u.caf_lead_time_days, id],
      );
    } else {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO unidades_saude
           (municipio_id, nome, endereco, responsavel_tecnico, caf_lead_time_days)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          municipio_id,
          u.nome,
          u.endereco,
          u.responsavel_tecnico,
          u.caf_lead_time_days,
        ],
      );
      id = rows[0].id;
    }
    ids.set(u.nome, id);
  }
  console.log(
    `     ✔ ${UNIDADES_SAUDE.length} unidades de saúde inseridas/atualizadas.`,
  );
  return ids;
}

async function seedUsuarios(
  client: PoolClient,
  perfilIds: Map<string, string>,
  municipioIds: Map<string, string>,
): Promise<Map<string, string>> {
  console.log('  → Inserindo usuários (bcrypt cost=10)...');
  const bcryptCost = 10; // custo reduzido para seed rápido em dev (produção usa cost>=12, NF011)
  const ids = new Map<string, string>();
  for (const u of USUARIOS_PLAIN) {
    const perfil_id = perfilIds.get(u.perfil_codigo);
    const municipio_id = municipioIds.get(u.municipio_ibge);
    if (!perfil_id) {
      throw new Error(`Perfil ${u.perfil_codigo} não encontrado no seed`);
    }
    if (!municipio_id) {
      throw new Error(`Município ${u.municipio_ibge} não encontrado no seed`);
    }
    const senha_hash = await bcrypt.hash(u.senha, bcryptCost);
    // Idempotência por email (chave natural) — sem ID fixo.
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE email = $1`,
      [u.email],
    );
    let id: string;
    if (existing.rowCount && existing.rowCount > 0) {
      id = existing.rows[0].id;
      await client.query(
        `UPDATE users
         SET nome_completo           = $1,
             senha_hash              = $2,
             perfil_id               = $3,
             ativo                   = $4,
             deve_trocar_senha       = $5,
             tentativas_login_falhas = 0,
             bloqueado_ate           = NULL,
             updated_at              = now()
         WHERE id = $6`,
        [
          u.nome_completo,
          senha_hash,
          perfil_id,
          u.ativo,
          u.deve_trocar_senha,
          id,
        ],
      );
    } else {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO users
           (municipio_id, nome_completo, email, senha_hash,
            perfil_id, ativo, deve_trocar_senha,
            tentativas_login_falhas, bloqueado_ate,
            senha_atualizada_em, ultimo_login_em)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 0, NULL, now(), NULL)
         RETURNING id`,
        [
          municipio_id,
          u.nome_completo,
          u.email,
          senha_hash,
          perfil_id,
          u.ativo,
          u.deve_trocar_senha,
        ],
      );
      id = rows[0].id;
    }
    ids.set(u.email, id);
  }
  console.log(
    `     ✔ ${USUARIOS_PLAIN.length} usuários inseridos/atualizados.`,
  );
  return ids;
}

async function seedUserUnits(
  client: PoolClient,
  usuarioIds: Map<string, string>,
  unidadeIds: Map<string, string>,
) {
  console.log('  → Inserindo vínculos user_units...');
  for (const uu of USER_UNITS) {
    const usuario_id = usuarioIds.get(uu.email);
    const unidade_id = unidadeIds.get(uu.unidade_nome);
    if (!usuario_id) {
      throw new Error(`Usuário ${uu.email} não encontrado no seed`);
    }
    if (!unidade_id) {
      throw new Error(`Unidade ${uu.unidade_nome} não encontrada no seed`);
    }
    await client.query(
      `INSERT INTO user_units (usuario_id, unidade_id, ativo)
       VALUES ($1, $2, true)
       ON CONFLICT (usuario_id, unidade_id) DO UPDATE
         SET ativo      = true,
             updated_at = now()`,
      [usuario_id, unidade_id],
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

    const perfilIds = await seedPerfis(client);
    const municipioIds = await seedMunicipios(client);
    const unidadeIds = await seedUnidadesSaude(client, municipioIds);
    const usuarioIds = await seedUsuarios(client, perfilIds, municipioIds);
    await seedUserUnits(client, usuarioIds, unidadeIds);

    await client.query('COMMIT');

    console.log('\n✅ Seed concluído com sucesso!\n');
    console.log('── Credenciais de acesso ──────────────────────────────────');
    for (const u of USUARIOS_PLAIN) {
      console.log(
        `   [${u.perfil_codigo}]`.padEnd(32) + `${u.email}  /  ${u.senha}`,
      );
    }
    console.log(
      '───────────────────────────────────────────────────────────\n',
    );
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
