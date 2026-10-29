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
    codigo: 'GERENTE',
    nome: 'Gerente/Coordenador',
    descricao: 'Gerente ou coordenador da assistência farmacêutica municipal',
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

/** Municípios de teste — chave natural: codigo_ibge (UNIQUE) */
const MUNICIPIOS = [
  { nome: 'São Paulo', uf: 'SP', codigo_ibge: '3550308', ativo: true },
  { nome: 'Rio de Janeiro', uf: 'RJ', codigo_ibge: '3304557', ativo: true },
  { nome: 'Belo Horizonte', uf: 'MG', codigo_ibge: '3106200', ativo: true },
  { nome: 'Parnaíba', uf: 'PI', codigo_ibge: '2207702', ativo: true },
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
  {
    municipio_ibge: '2207702',
    nome: 'UBS Centro - Dr. João Silva Filho',
    endereco: 'Rua Coronel Ribeiro, 200 — Centro, Parnaíba/PI',
    responsavel_tecnico: 'Dra. Maria das Graças',
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
    email: 'gerente@farmaubs.dev',
    nome_completo: 'Gerente São Paulo',
    senha: 'Gerente@123456',
    perfil_codigo: 'GERENTE',
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
    email: 'farma.parnaiba@farmaubs.dev',
    nome_completo: 'Farmacêutico Responsável Parnaíba',
    senha: 'Farma@123456',
    perfil_codigo: 'FARMACEUTICO_RESPONSAVEL',
    municipio_ibge: '2207702',
    ativo: true,
    deve_trocar_senha: false,
  },
  {
    email: 'inativo@farmaubs.dev',
    nome_completo: 'Usuário Inativo Teste',
    senha: 'Inativ@123456',
    perfil_codigo: 'GERENTE',
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
  // Gerente: acesso às UBS do município
  { email: 'gerente@farmaubs.dev', unidade_nome: 'UBS Jardim Primavera' },
  { email: 'gerente@farmaubs.dev', unidade_nome: 'UBS Vila Nova' },
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
  // Farmacêutico de Parnaíba
  {
    email: 'farma.parnaiba@farmaubs.dev',
    unidade_nome: 'UBS Centro - Dr. João Silva Filho',
  },
] as const;

/** Fabricantes e Laboratórios Farmacêuticos oficiais do SUS (ADR-016 / RF008) */
const FABRICANTES = [
  { razao_social: 'EMS S/A', nome_fantasia: 'EMS', cnpj: '57507378000101' },
  { razao_social: 'Eurofarma Laboratórios S.A.', nome_fantasia: 'Eurofarma', cnpj: '61190096000192' },
  { razao_social: 'Fundação Oswaldo Cruz - Fiocruz / Farmanguinhos', nome_fantasia: 'Farmanguinhos / Fiocruz', cnpj: '33781055000135' },
  { razao_social: 'Fundação Instituto Butantan', nome_fantasia: 'Instituto Butantan', cnpj: '61821344000156' },
  { razao_social: 'Medley Farmacêutica Ltda', nome_fantasia: 'Medley', cnpj: '50929710000179' },
  { razao_social: 'Prati, Donaduzzi & Cia Ltda', nome_fantasia: 'Prati-Donaduzzi', cnpj: '73856593000166' },
  { razao_social: 'Brainfarma Indústria Química e Farmacêutica S.A.', nome_fantasia: 'Neo Química', cnpj: '05161069000110' },
  { razao_social: 'Aché Laboratórios Farmacêuticos S.A.', nome_fantasia: 'Aché', cnpj: '60659463000191' },
  { razao_social: 'Cristália Produtos Químicos Farmacêuticos Ltda', nome_fantasia: 'Cristália', cnpj: '44734671000151' },
  { razao_social: 'Laboratório Teuto Brasileiro S/A', nome_fantasia: 'Teuto', cnpj: '17159229000176' },
] as const;

/** Medicamentos essenciais da Atenção Básica (RENAME / REMUME / SUS) */
const PRODUTOS = [
  {
    codigo_catmat: '267890',
    codigo_atc: 'J01CA04',
    principio_ativo: 'Amoxicilina',
    nome_comercial: 'Amoxicilina',
    dosagem: '500 mg',
    forma_farmaceutica: 'Cápsula',
    apresentacao: '500 mg Cápsula',
    unidade_medida: 'Cápsula',
    categoria: 'ANTIBIOTICO',
    componente: 'BASICO',
    antimicrobiano: true,
    controlado: false,
  },
  {
    codigo_catmat: '267891',
    codigo_atc: 'J01CA04',
    principio_ativo: 'Amoxicilina',
    nome_comercial: 'Amoxicilina Suspensão',
    dosagem: '250 mg / 5 mL',
    forma_farmaceutica: 'Pó para suspensão oral',
    apresentacao: '250 mg / 5 mL Frasco 150 mL',
    unidade_medida: 'Frasco',
    categoria: 'ANTIBIOTICO',
    componente: 'BASICO',
    antimicrobiano: true,
    controlado: false,
  },
  {
    codigo_catmat: '267892',
    codigo_atc: 'J01CR02',
    principio_ativo: 'Amoxicilina + Clavulanato de Potássio',
    nome_comercial: 'Amoxicilina + Clavulanato',
    dosagem: '500 mg + 125 mg',
    forma_farmaceutica: 'Comprimido Revestido',
    apresentacao: '500 mg + 125 mg Comprimido',
    unidade_medida: 'Comprimido',
    categoria: 'ANTIBIOTICO',
    componente: 'BASICO',
    antimicrobiano: true,
    controlado: false,
  },
  {
    codigo_catmat: '267568',
    codigo_atc: 'N02BE01',
    principio_ativo: 'Paracetamol',
    nome_comercial: 'Paracetamol',
    dosagem: '500 mg',
    forma_farmaceutica: 'Comprimido',
    apresentacao: '500 mg Comprimido',
    unidade_medida: 'Comprimido',
    categoria: 'ANALGESICO',
    componente: 'BASICO',
    antimicrobiano: false,
    controlado: false,
  },
  {
    codigo_catmat: '267569',
    codigo_atc: 'N02BE01',
    principio_ativo: 'Paracetamol',
    nome_comercial: 'Paracetamol Gotas',
    dosagem: '200 mg/mL',
    forma_farmaceutica: 'Solução oral',
    apresentacao: '200 mg/mL Frasco conta-gotas 15 mL',
    unidade_medida: 'Frasco',
    categoria: 'ANALGESICO',
    componente: 'BASICO',
    antimicrobiano: false,
    controlado: false,
  },
  {
    codigo_catmat: '267885',
    codigo_atc: 'N02BB02',
    principio_ativo: 'Dipirona Sódica',
    nome_comercial: 'Dipirona',
    dosagem: '500 mg',
    forma_farmaceutica: 'Comprimido',
    apresentacao: '500 mg Comprimido',
    unidade_medida: 'Comprimido',
    categoria: 'ANALGESICO',
    componente: 'BASICO',
    antimicrobiano: false,
    controlado: false,
  },
  {
    codigo_catmat: '267886',
    codigo_atc: 'N02BB02',
    principio_ativo: 'Dipirona Sódica',
    nome_comercial: 'Dipirona Gotas',
    dosagem: '500 mg/mL',
    forma_farmaceutica: 'Solução oral',
    apresentacao: '500 mg/mL Frasco 10 mL',
    unidade_medida: 'Frasco',
    categoria: 'ANALGESICO',
    componente: 'BASICO',
    antimicrobiano: false,
    controlado: false,
  },
  {
    codigo_catmat: '268045',
    codigo_atc: 'C09CA01',
    principio_ativo: 'Losartana Potássica',
    nome_comercial: 'Losartana',
    dosagem: '50 mg',
    forma_farmaceutica: 'Comprimido Revestido',
    apresentacao: '50 mg Comprimido',
    unidade_medida: 'Comprimido',
    categoria: 'ANTIHIPERTENSIVO',
    componente: 'BASICO',
    antimicrobiano: false,
    controlado: false,
  },
  {
    codigo_catmat: '267923',
    codigo_atc: 'C03AA03',
    principio_ativo: 'Hidroclorotiazida',
    nome_comercial: 'Hidroclorotiazida',
    dosagem: '25 mg',
    forma_farmaceutica: 'Comprimido',
    apresentacao: '25 mg Comprimido',
    unidade_medida: 'Comprimido',
    categoria: 'ANTIHIPERTENSIVO',
    componente: 'BASICO',
    antimicrobiano: false,
    controlado: false,
  },
  {
    codigo_catmat: '267880',
    codigo_atc: 'C09AA02',
    principio_ativo: 'Enalapril Maleato',
    nome_comercial: 'Enalapril',
    dosagem: '10 mg',
    forma_farmaceutica: 'Comprimido',
    apresentacao: '10 mg Comprimido',
    unidade_medida: 'Comprimido',
    categoria: 'ANTIHIPERTENSIVO',
    componente: 'BASICO',
    antimicrobiano: false,
    controlado: false,
  },
  {
    codigo_catmat: '267881',
    codigo_atc: 'C09AA02',
    principio_ativo: 'Enalapril Maleato',
    nome_comercial: 'Enalapril',
    dosagem: '20 mg',
    forma_farmaceutica: 'Comprimido',
    apresentacao: '20 mg Comprimido',
    unidade_medida: 'Comprimido',
    categoria: 'ANTIHIPERTENSIVO',
    componente: 'BASICO',
    antimicrobiano: false,
    controlado: false,
  },
  {
    codigo_catmat: '268010',
    codigo_atc: 'A10BA02',
    principio_ativo: 'Metformina Cloridrato',
    nome_comercial: 'Metformina',
    dosagem: '500 mg',
    forma_farmaceutica: 'Comprimido Revestido',
    apresentacao: '500 mg Comprimido',
    unidade_medida: 'Comprimido',
    categoria: 'ANTIDIABETICO',
    componente: 'BASICO',
    antimicrobiano: false,
    controlado: false,
  },
  {
    codigo_catmat: '268011',
    codigo_atc: 'A10BA02',
    principio_ativo: 'Metformina Cloridrato',
    nome_comercial: 'Metformina',
    dosagem: '850 mg',
    forma_farmaceutica: 'Comprimido Revestido',
    apresentacao: '850 mg Comprimido',
    unidade_medida: 'Comprimido',
    categoria: 'ANTIDIABETICO',
    componente: 'BASICO',
    antimicrobiano: false,
    controlado: false,
  },
  {
    codigo_catmat: '267915',
    codigo_atc: 'A10BB01',
    principio_ativo: 'Glibenclamida',
    nome_comercial: 'Glibenclamida',
    dosagem: '5 mg',
    forma_farmaceutica: 'Comprimido',
    apresentacao: '5 mg Comprimido',
    unidade_medida: 'Comprimido',
    categoria: 'ANTIDIABETICO',
    componente: 'BASICO',
    antimicrobiano: false,
    controlado: false,
  },
  {
    codigo_catmat: '268150',
    codigo_atc: 'A10AC01',
    principio_ativo: 'Insulina Humana NPH',
    nome_comercial: 'Insulina NPH',
    dosagem: '100 UI/mL',
    forma_farmaceutica: 'Suspensão Injetável',
    apresentacao: '100 UI/mL Frasco 10 mL',
    unidade_medida: 'Frasco',
    categoria: 'ANTIDIABETICO',
    componente: 'BASICO',
    antimicrobiano: false,
    controlado: false,
  },
  {
    codigo_catmat: '268151',
    codigo_atc: 'A10AB01',
    principio_ativo: 'Insulina Humana Regular',
    nome_comercial: 'Insulina Regular',
    dosagem: '100 UI/mL',
    forma_farmaceutica: 'Solução Injetável',
    apresentacao: '100 UI/mL Frasco 10 mL',
    unidade_medida: 'Frasco',
    categoria: 'ANTIDIABETICO',
    componente: 'BASICO',
    antimicrobiano: false,
    controlado: false,
  },
  {
    codigo_catmat: '268075',
    codigo_atc: 'A02BC01',
    principio_ativo: 'Omeprazol',
    nome_comercial: 'Omeprazol',
    dosagem: '20 mg',
    forma_farmaceutica: 'Cápsula',
    apresentacao: '20 mg Cápsula',
    unidade_medida: 'Cápsula',
    categoria: 'ANTIULCEROSO',
    componente: 'BASICO',
    antimicrobiano: false,
    controlado: false,
  },
  {
    codigo_catmat: '267940',
    codigo_atc: 'M01AE01',
    principio_ativo: 'Ibuprofeno',
    nome_comercial: 'Ibuprofeno',
    dosagem: '600 mg',
    forma_farmaceutica: 'Comprimido Revestido',
    apresentacao: '600 mg Comprimido',
    unidade_medida: 'Comprimido',
    categoria: 'ANTIINFLAMATORIO',
    componente: 'BASICO',
    antimicrobiano: false,
    controlado: false,
  },
  {
    codigo_catmat: '267941',
    codigo_atc: 'M01AE01',
    principio_ativo: 'Ibuprofeno',
    nome_comercial: 'Ibuprofeno Gotas',
    dosagem: '50 mg/mL',
    forma_farmaceutica: 'Suspensão oral',
    apresentacao: '50 mg/mL Frasco 30 mL',
    unidade_medida: 'Frasco',
    categoria: 'ANTIINFLAMATORIO',
    componente: 'BASICO',
    antimicrobiano: false,
    controlado: false,
  },
  {
    codigo_catmat: '267850',
    codigo_atc: 'C09AA01',
    principio_ativo: 'Captopril',
    nome_comercial: 'Captopril',
    dosagem: '25 mg',
    forma_farmaceutica: 'Comprimido',
    apresentacao: '25 mg Comprimido',
    unidade_medida: 'Comprimido',
    categoria: 'ANTIHIPERTENSIVO',
    componente: 'BASICO',
    antimicrobiano: false,
    controlado: false,
  },
  {
    codigo_catmat: '268112',
    codigo_atc: 'R03AC02',
    principio_ativo: 'Salbutamol Sulfato',
    nome_comercial: 'Salbutamol Aerossol',
    dosagem: '100 mcg/dose',
    forma_farmaceutica: 'Aerossol oral',
    apresentacao: '100 mcg/dose Frasco 200 doses',
    unidade_medida: 'Frasco',
    categoria: 'BRONCODILATADOR',
    componente: 'BASICO',
    antimicrobiano: false,
    controlado: false,
  },
  {
    codigo_catmat: '268120',
    codigo_atc: 'C10AA01',
    principio_ativo: 'Sinvastatina',
    nome_comercial: 'Sinvastatina',
    dosagem: '20 mg',
    forma_farmaceutica: 'Comprimido Revestido',
    apresentacao: '20 mg Comprimido',
    unidade_medida: 'Comprimido',
    categoria: 'HIPOLIPEMIANTE',
    componente: 'BASICO',
    antimicrobiano: false,
    controlado: false,
  },
  {
    codigo_catmat: '268080',
    codigo_atc: 'H02AB07',
    principio_ativo: 'Prednisona',
    nome_comercial: 'Prednisona',
    dosagem: '20 mg',
    forma_farmaceutica: 'Comprimido',
    apresentacao: '20 mg Comprimido',
    unidade_medida: 'Comprimido',
    categoria: 'CORTICOIDE',
    componente: 'BASICO',
    antimicrobiano: false,
    controlado: false,
  },
  {
    codigo_catmat: '267840',
    codigo_atc: 'J01FA10',
    principio_ativo: 'Azitromicina',
    nome_comercial: 'Azitromicina',
    dosagem: '500 mg',
    forma_farmaceutica: 'Comprimido Revestido',
    apresentacao: '500 mg Comprimido',
    unidade_medida: 'Comprimido',
    categoria: 'ANTIBIOTICO',
    componente: 'BASICO',
    antimicrobiano: true,
    controlado: false,
  },
  {
    codigo_catmat: '267860',
    codigo_atc: 'J01MA02',
    principio_ativo: 'Ciprofloxacino Cloridrato',
    nome_comercial: 'Ciprofloxacino',
    dosagem: '500 mg',
    forma_farmaceutica: 'Comprimido Revestido',
    apresentacao: '500 mg Comprimido',
    unidade_medida: 'Comprimido',
    categoria: 'ANTIBIOTICO',
    componente: 'BASICO',
    antimicrobiano: true,
    controlado: false,
  },
  {
    codigo_catmat: '267855',
    codigo_atc: 'J01DB01',
    principio_ativo: 'Cefalexina',
    nome_comercial: 'Cefalexina',
    dosagem: '500 mg',
    forma_farmaceutica: 'Drágea',
    apresentacao: '500 mg Drágea',
    unidade_medida: 'Drágea',
    categoria: 'ANTIBIOTICO',
    componente: 'BASICO',
    antimicrobiano: true,
    controlado: false,
  },
  {
    codigo_catmat: '267870',
    codigo_atc: 'N05BA01',
    principio_ativo: 'Diazepam',
    nome_comercial: 'Diazepam',
    dosagem: '10 mg',
    forma_farmaceutica: 'Comprimido',
    apresentacao: '10 mg Comprimido',
    unidade_medida: 'Comprimido',
    categoria: 'ANSIOLITICO',
    componente: 'BASICO',
    antimicrobiano: false,
    controlado: true,
  },
  {
    codigo_catmat: '267865',
    codigo_atc: 'N03AE01',
    principio_ativo: 'Clonazepam',
    nome_comercial: 'Clonazepam',
    dosagem: '2 mg',
    forma_farmaceutica: 'Comprimido',
    apresentacao: '2 mg Comprimido',
    unidade_medida: 'Comprimido',
    categoria: 'ANTICONVULSIVANTE',
    componente: 'BASICO',
    antimicrobiano: false,
    controlado: true,
  },
  {
    codigo_catmat: '267905',
    codigo_atc: 'N06AB03',
    principio_ativo: 'Fluoxetina Cloridrato',
    nome_comercial: 'Fluoxetina',
    dosagem: '20 mg',
    forma_farmaceutica: 'Cápsula',
    apresentacao: '20 mg Cápsula',
    unidade_medida: 'Cápsula',
    categoria: 'ANTIDEPRESSIVO',
    componente: 'BASICO',
    antimicrobiano: false,
    controlado: true,
  },
  {
    codigo_catmat: '267830',
    codigo_atc: 'N06AA09',
    principio_ativo: 'Amitriptilina Cloridrato',
    nome_comercial: 'Amitriptilina',
    dosagem: '25 mg',
    forma_farmaceutica: 'Comprimido Revestido',
    apresentacao: '25 mg Comprimido',
    unidade_medida: 'Comprimido',
    categoria: 'ANTIDEPRESSIVO',
    componente: 'BASICO',
    antimicrobiano: false,
    controlado: true,
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

/**
 * [RF001 / RF026]: Popula o catálogo de municípios com as capitais de teste (chave única codigo_ibge).
 * @param client - Conexão PoolClient com o PostgreSQL.
 * @returns Mapa com codigo_ibge -> id UUID gerado para cada município.
 */
async function seedMunicipios(
  client: PoolClient,
): Promise<Map<string, string>> {
  console.log('  → Inserindo municípios...');
  const ids = new Map<string, string>();

  for (const m of MUNICIPIOS) {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO municipios (nome, uf, codigo_ibge, ativo)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (codigo_ibge) DO UPDATE
         SET nome       = EXCLUDED.nome,
             uf         = EXCLUDED.uf,
             ativo      = EXCLUDED.ativo,
             updated_at = now()
        RETURNING id`,
      [m.nome, m.uf, m.codigo_ibge, m.ativo],
    );
    ids.set(m.codigo_ibge, rows[0].id);
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

async function seedFabricantes(client: PoolClient): Promise<Map<string, string>> {
  console.log('  → Inserindo fabricantes farmacêuticos...');
  const ids = new Map<string, string>();

  for (const f of FABRICANTES) {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO fabricantes (razao_social, nome_fantasia, cnpj, ativo)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (cnpj) DO UPDATE
         SET razao_social  = EXCLUDED.razao_social,
             nome_fantasia = EXCLUDED.nome_fantasia,
             updated_at    = now()
       RETURNING id`,
      [f.razao_social, f.nome_fantasia, f.cnpj],
    );
    ids.set(f.nome_fantasia, rows[0].id);
  }
  console.log(`     ✔ ${FABRICANTES.length} fabricantes inseridos/atualizados.`);
  return ids;
}

async function seedProdutos(client: PoolClient): Promise<Map<string, string>> {
  console.log('  → Inserindo medicamentos da RENAME/REMUME...');
  const ids = new Map<string, string>();

  for (const p of PRODUTOS) {
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM produtos WHERE codigo_catmat = $1 LIMIT 1`,
      [p.codigo_catmat],
    );

    let id: string;
    if (existing.rows.length > 0) {
      id = existing.rows[0].id;
      await client.query(
        `UPDATE produtos
         SET codigo_catmat = $1,
             codigo_atc = $2,
             principio_ativo = $3,
             nome_comercial = $4,
             dosagem = $5,
             forma_farmaceutica = $6,
             apresentacao = $7,
             unidade_medida = $8,
             categoria = $9,
             componente = $10,
             antimicrobiano = $11,
             controlado = $12,
             ativo = true,
             updated_at = now()
         WHERE id = $13`,
        [
          p.codigo_catmat,
          p.codigo_atc,
          p.principio_ativo,
          p.nome_comercial,
          p.dosagem,
          p.forma_farmaceutica,
          p.apresentacao,
          p.unidade_medida,
          p.categoria,
          p.componente,
          p.antimicrobiano,
          p.controlado,
          id,
        ],
      );
    } else {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO produtos (
           codigo_catmat, codigo_atc, principio_ativo, nome_comercial,
           dosagem, forma_farmaceutica, apresentacao, unidade_medida,
           categoria, componente, antimicrobiano, controlado, ativo
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)
         RETURNING id`,
        [
          p.codigo_catmat,
          p.codigo_atc,
          p.principio_ativo,
          p.nome_comercial,
          p.dosagem,
          p.forma_farmaceutica,
          p.apresentacao,
          p.unidade_medida,
          p.categoria,
          p.componente,
          p.antimicrobiano,
          p.controlado,
        ],
      );
      id = inserted.rows[0].id;
    }
    ids.set(p.principio_ativo + ' ' + p.dosagem, id);
  }
  console.log(`     ✔ ${PRODUTOS.length} medicamentos da RENAME inseridos/atualizados.`);
  return ids;
}

async function seedRecebimentosIniciais(
  client: PoolClient,
  municipioIds: Map<string, string>,
  unidadeIds: Map<string, string>,
  usuarioIds: Map<string, string>,
  fabricanteIds: Map<string, string>,
  produtoIds: Map<string, string>,
): Promise<void> {
  console.log('  → Inserindo recebimento de carga inicial para testes...');

  const municipioSpId = municipioIds.get('3550308');
  const ubsJardimId = unidadeIds.get('UBS Jardim Primavera');
  const farmaSpId = usuarioIds.get('farmaceutico.responsavel@farmaubs.dev');
  const emsId = fabricanteIds.get('EMS');
  const amoxId = produtoIds.get('Amoxicilina 500 mg');

  if (municipioSpId && ubsJardimId && farmaSpId && emsId && amoxId) {
    await client.query(`SET LOCAL app.municipio_id = '${municipioSpId}'`);

    const docExistente = await client.query<{ id: string }>(
      `SELECT id FROM documentos_entrada WHERE numero_documento = 'NF-10240' AND municipio_id = $1`,
      [municipioSpId],
    );

    if (docExistente.rows.length === 0) {
      const doc = await client.query<{ id: string }>(
        `INSERT INTO documentos_entrada (
           municipio_id, ubs_id, numero_documento, tipo_documento,
           fornecedor_origem, data_recebimento, usuario_recebedor_id,
           status, observacoes
         )
         VALUES ($1, $2, 'NF-10240', 'NOTA_FISCAL', 'EMS S/A', now(), $3, 'CONCLUIDO', 'Carga inicial de antibióticos para assistência básica')
         RETURNING id`,
        [municipioSpId, ubsJardimId, farmaSpId],
      );
      const docId = doc.rows[0].id;

      const lote = await client.query<{ id: string }>(
        `INSERT INTO lotes (
           municipio_id, ubs_id, produto_id, fabricante_id,
           numero_lote, data_validade, saldo_atual, status
         )
         VALUES ($1, $2, $3, $4, 'EMS-2026-X1', CURRENT_DATE + 365, 1000, 'ATIVO')
         RETURNING id`,
        [municipioSpId, ubsJardimId, amoxId, emsId],
      );
      const loteId = lote.rows[0].id;

      await client.query(
        `INSERT INTO recebimento_itens (
           municipio_id, documento_entrada_id, produto_id, fabricante_id, lote_id,
           numero_lote, data_validade, quantidade_recebida, observacoes
         )
         VALUES ($1, $2, $3, $4, $5, 'EMS-2026-X1', CURRENT_DATE + 365, 1000, 'Lote padrão de recebimento')`,
        [municipioSpId, docId, amoxId, emsId, loteId],
      );

      await client.query(
        `INSERT INTO movimentacoes_estoque (
           municipio_id, ubs_id, lote_id, tipo_movimentacao,
           quantidade, saldo_anterior, saldo_posterior,
           documento_referencia_id, tipo_documento_referencia,
           usuario_id, justificativa
         )
         VALUES ($1, $2, $3, 'ENTRADA_RECEBIMENTO', 1000, 0, 1000, $4, 'DOCUMENTO_ENTRADA', $5, 'Recebimento de carga regular via NF-10240')`,
        [municipioSpId, ubsJardimId, loteId, docId, farmaSpId],
      );
    }
  }
  console.log(`     ✔ Recebimento inicial e lote de teste configurados com sucesso.`);
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

    const fabricanteIds = await seedFabricantes(client);
    const produtoIds = await seedProdutos(client);
    await seedRecebimentosIniciais(
      client,
      municipioIds,
      unidadeIds,
      usuarioIds,
      fabricanteIds,
      produtoIds,
    );

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
