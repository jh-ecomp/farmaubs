import * as crypto from 'node:crypto';
import type { PoolClient } from 'pg';

/**
 * Representa um lote em memória durante a simulação cronológica de Setembro a Dezembro.
 */
interface LoteSimulado {
  id: string;
  produtoId: string;
  produtoChave: string;
  fabricanteId: string;
  fabricanteNome: string;
  numeroLote: string;
  dataRecebimento: string; // YYYY-MM-DD
  dataValidade: string; // YYYY-MM-DD
  quantidadeInicial: number;
  saldoAtual: number;
}

/**
 * Representa uma prescrição de uso contínuo vinculada a um paciente crônico.
 */
interface ItemUsoContinuo {
  produtoChave: string;
  quantidadeMensal: number;
  posologia: string;
}

/**
 * Representa um paciente cadastrado na UBS de Parnaíba.
 */
interface PacienteSimulado {
  id: string;
  nomeCompleto: string;
  cpf: string;
  cns: string;
  dataNascimento: string;
  usoContinuo: boolean;
  diaPreferencialRetirada: number; // 1 a 28
  itensContinuos: ItemUsoContinuo[];
}

/**
 * Configuração operacional de cada medicamento da REMUME para recebimento e dispensação.
 */
interface ConfigMedicamentoSeed {
  chave: string;
  antimicrobiano: boolean;
  usoContinuo: boolean;
  qtdRecebimentoMensal: number;
  qtdDispensaPadrao: number;
  posologiaPadrao: string;
}

const CONFIG_MEDICAMENTOS: ConfigMedicamentoSeed[] = [
  // Uso contínuo — Anti-hipertensivos, Antidiabéticos, Hipolipemiantes, Broncodilatadores, Saúde Mental, Antiulcerosos
  {
    chave: 'Losartana Potássica 50 mg',
    antimicrobiano: false,
    usoContinuo: true,
    qtdRecebimentoMensal: 2400,
    qtdDispensaPadrao: 60,
    posologiaPadrao: 'Tomar 1 comprimido VO de 12/12h — Uso contínuo (HAS)',
  },
  {
    chave: 'Hidroclorotiazida 25 mg',
    antimicrobiano: false,
    usoContinuo: true,
    qtdRecebimentoMensal: 1800,
    qtdDispensaPadrao: 30,
    posologiaPadrao: 'Tomar 1 comprimido VO pela manhã — Uso contínuo (HAS)',
  },
  {
    chave: 'Enalapril Maleato 10 mg',
    antimicrobiano: false,
    usoContinuo: true,
    qtdRecebimentoMensal: 1500,
    qtdDispensaPadrao: 60,
    posologiaPadrao: 'Tomar 1 comprimido VO de 12/12h — Uso contínuo (HAS)',
  },
  {
    chave: 'Enalapril Maleato 20 mg',
    antimicrobiano: false,
    usoContinuo: true,
    qtdRecebimentoMensal: 1500,
    qtdDispensaPadrao: 30,
    posologiaPadrao: 'Tomar 1 comprimido VO 1x ao dia — Uso contínuo (HAS)',
  },
  {
    chave: 'Captopril 25 mg',
    antimicrobiano: false,
    usoContinuo: true,
    qtdRecebimentoMensal: 1500,
    qtdDispensaPadrao: 60,
    posologiaPadrao: 'Tomar 1 comprimido VO de 12/12h — Uso contínuo (HAS)',
  },
  {
    chave: 'Metformina Cloridrato 500 mg',
    antimicrobiano: false,
    usoContinuo: true,
    qtdRecebimentoMensal: 2100,
    qtdDispensaPadrao: 60,
    posologiaPadrao:
      'Tomar 1 comprimido VO após almoço e jantar — Uso contínuo (DM2)',
  },
  {
    chave: 'Metformina Cloridrato 850 mg',
    antimicrobiano: false,
    usoContinuo: true,
    qtdRecebimentoMensal: 2400,
    qtdDispensaPadrao: 60,
    posologiaPadrao:
      'Tomar 1 comprimido VO de 12/12h junto às refeições — Uso contínuo (DM2)',
  },
  {
    chave: 'Glibenclamida 5 mg',
    antimicrobiano: false,
    usoContinuo: true,
    qtdRecebimentoMensal: 1200,
    qtdDispensaPadrao: 30,
    posologiaPadrao:
      'Tomar 1 comprimido VO antes do café da manhã — Uso contínuo (DM2)',
  },
  {
    chave: 'Insulina Humana NPH 100 UI/mL',
    antimicrobiano: false,
    usoContinuo: true,
    qtdRecebimentoMensal: 180,
    qtdDispensaPadrao: 2,
    posologiaPadrao:
      'Aplicar 20 UI SC pela manhã e 10 UI SC ao deitar — Uso contínuo (DM)',
  },
  {
    chave: 'Insulina Humana Regular 100 UI/mL',
    antimicrobiano: false,
    usoContinuo: true,
    qtdRecebimentoMensal: 140,
    qtdDispensaPadrao: 1,
    posologiaPadrao:
      'Aplicar SC 30 min antes das refeições conforme glicemia capilar — Uso contínuo',
  },
  {
    chave: 'Sinvastatina 20 mg',
    antimicrobiano: false,
    usoContinuo: true,
    qtdRecebimentoMensal: 1800,
    qtdDispensaPadrao: 30,
    posologiaPadrao:
      'Tomar 1 comprimido VO à noite — Uso contínuo (Dislipidemia)',
  },
  {
    chave: 'Omeprazol 20 mg',
    antimicrobiano: false,
    usoContinuo: true,
    qtdRecebimentoMensal: 1800,
    qtdDispensaPadrao: 30,
    posologiaPadrao: 'Tomar 1 cápsula VO em jejum pela manhã — Uso contínuo',
  },
  {
    chave: 'Salbutamol Sulfato 100 mcg/dose',
    antimicrobiano: false,
    usoContinuo: true,
    qtdRecebimentoMensal: 150,
    qtdDispensaPadrao: 1,
    posologiaPadrao:
      'Inalar 2 jatos de 6/6h se crise de broncoespasmo — Uso contínuo (Asma)',
  },
  {
    chave: 'Fluoxetina Cloridrato 20 mg',
    antimicrobiano: false,
    usoContinuo: true,
    qtdRecebimentoMensal: 1200,
    qtdDispensaPadrao: 30,
    posologiaPadrao:
      'Tomar 1 cápsula VO pela manhã — Uso contínuo (Saúde Mental)',
  },
  {
    chave: 'Amitriptilina Cloridrato 25 mg',
    antimicrobiano: false,
    usoContinuo: true,
    qtdRecebimentoMensal: 1200,
    qtdDispensaPadrao: 30,
    posologiaPadrao:
      'Tomar 1 comprimido VO à noite ao deitar — Uso contínuo (Saúde Mental)',
  },
  {
    chave: 'Clonazepam 2 mg',
    antimicrobiano: false,
    usoContinuo: true,
    qtdRecebimentoMensal: 900,
    qtdDispensaPadrao: 30,
    posologiaPadrao:
      'Tomar 1 comprimido VO à noite — Uso contínuo (Controle Especial)',
  },
  {
    chave: 'Diazepam 10 mg',
    antimicrobiano: false,
    usoContinuo: true,
    qtdRecebimentoMensal: 900,
    qtdDispensaPadrao: 30,
    posologiaPadrao:
      'Tomar 1 comprimido VO à noite — Uso contínuo (Controle Especial)',
  },

  // Demanda Aguda — Analgésicos, Anti-inflamatórios, Corticoides e Antimicrobianos
  {
    chave: 'Dipirona Sódica 500 mg',
    antimicrobiano: false,
    usoContinuo: false,
    qtdRecebimentoMensal: 2000,
    qtdDispensaPadrao: 10,
    posologiaPadrao: 'Tomar 1 comprimido VO de 6/6h se dor ou febre por 5 dias',
  },
  {
    chave: 'Dipirona Sódica 500 mg/mL',
    antimicrobiano: false,
    usoContinuo: false,
    qtdRecebimentoMensal: 220,
    qtdDispensaPadrao: 1,
    posologiaPadrao: 'Tomar 30 gotas VO de 6/6h se dor ou febre',
  },
  {
    chave: 'Paracetamol 500 mg',
    antimicrobiano: false,
    usoContinuo: false,
    qtdRecebimentoMensal: 2000,
    qtdDispensaPadrao: 10,
    posologiaPadrao: 'Tomar 1 comprimido VO de 6/6h se dor ou febre por 5 dias',
  },
  {
    chave: 'Paracetamol 200 mg/mL',
    antimicrobiano: false,
    usoContinuo: false,
    qtdRecebimentoMensal: 200,
    qtdDispensaPadrao: 1,
    posologiaPadrao: 'Tomar 1 gota/kg VO de 6/6h se febre ou dor',
  },
  {
    chave: 'Ibuprofeno 600 mg',
    antimicrobiano: false,
    usoContinuo: false,
    qtdRecebimentoMensal: 1500,
    qtdDispensaPadrao: 14,
    posologiaPadrao:
      'Tomar 1 comprimido VO de 8/8h após as refeições por 5 dias',
  },
  {
    chave: 'Ibuprofeno 50 mg/mL',
    antimicrobiano: false,
    usoContinuo: false,
    qtdRecebimentoMensal: 180,
    qtdDispensaPadrao: 1,
    posologiaPadrao: 'Tomar 20 gotas VO de 8/8h por 5 dias',
  },
  {
    chave: 'Prednisona 20 mg',
    antimicrobiano: false,
    usoContinuo: false,
    qtdRecebimentoMensal: 1200,
    qtdDispensaPadrao: 10,
    posologiaPadrao: 'Tomar 1 comprimido VO pela manhã por 5 dias',
  },
  {
    chave: 'Amoxicilina 500 mg',
    antimicrobiano: true,
    usoContinuo: false,
    qtdRecebimentoMensal: 1500,
    qtdDispensaPadrao: 21,
    posologiaPadrao:
      'Tomar 1 cápsula VO de 8/8h por 7 dias (Antimicrobiano RDC 20)',
  },
  {
    chave: 'Amoxicilina 250 mg / 5 mL',
    antimicrobiano: true,
    usoContinuo: false,
    qtdRecebimentoMensal: 180,
    qtdDispensaPadrao: 1,
    posologiaPadrao:
      'Dar 5 mL VO de 8/8h por 7 dias (Antimicrobiano Pediátrico)',
  },
  {
    chave: 'Amoxicilina + Clavulanato de Potássio 500 mg + 125 mg',
    antimicrobiano: true,
    usoContinuo: false,
    qtdRecebimentoMensal: 1200,
    qtdDispensaPadrao: 21,
    posologiaPadrao:
      'Tomar 1 comprimido VO de 8/8h por 7 dias (Antimicrobiano RDC 20)',
  },
  {
    chave: 'Azitromicina 500 mg',
    antimicrobiano: true,
    usoContinuo: false,
    qtdRecebimentoMensal: 900,
    qtdDispensaPadrao: 5,
    posologiaPadrao:
      'Tomar 1 comprimido VO 1x ao dia por 5 dias (Antimicrobiano RDC 20)',
  },
  {
    chave: 'Ciprofloxacino Cloridrato 500 mg',
    antimicrobiano: true,
    usoContinuo: false,
    qtdRecebimentoMensal: 1000,
    qtdDispensaPadrao: 14,
    posologiaPadrao:
      'Tomar 1 comprimido VO de 12/12h por 7 dias (Antimicrobiano RDC 20)',
  },
  {
    chave: 'Cefalexina 500 mg',
    antimicrobiano: true,
    usoContinuo: false,
    qtdRecebimentoMensal: 1200,
    qtdDispensaPadrao: 28,
    posologiaPadrao:
      'Tomar 1 drágea VO de 6/6h por 7 dias (Antimicrobiano RDC 20)',
  },
];

const NOMES_FABRICANTES = [
  'EMS',
  'Eurofarma',
  'Farmanguinhos / Fiocruz',
  'Instituto Butantan',
  'Medley',
  'Prati-Donaduzzi',
  'Neo Química',
  'Aché',
  'Cristália',
  'Teuto',
] as const;

const SIGLAS_FABRICANTES: Record<string, string> = {
  EMS: 'EMS',
  Eurofarma: 'EUR',
  'Farmanguinhos / Fiocruz': 'FMG',
  'Instituto Butantan': 'BUT',
  Medley: 'MED',
  'Prati-Donaduzzi': 'PRT',
  'Neo Química': 'NEO',
  Aché: 'ACH',
  Cristália: 'CRI',
  Teuto: 'TEU',
};

const NOMES_PACIENTES = [
  'Francisca Maria Oliveira Costa',
  'Raimundo Nonato Souza Santos',
  'Maria das Graças Veras Machado',
  'Antônio Carlos Fontenele Brito',
  'Terezinha de Jesus Araújo Lima',
  'José Ribamar Carvalho Silva',
  'Ana Lúcia Nascimento Rocha',
  'Manoel Messias Ferreira Alves',
  'Rosa Maria Cardoso Pires',
  'Sebastião Rodrigues Cavalcante',
  'Benedita Vieira dos Santos',
  'Domingos Sávio Mendes Correia',
  'Conceição Aparecida Sousa Teles',
  'Francisco das Chagas Aguiar Neto',
  'Josefa Ferreira Lima Melo',
  'João Batista Moreira Cunha',
  'Luzia Helena Martins Bastos',
  'Pedro Henrique Castro Viana',
  'Socorro de Fátima Ramos Duarte',
  'Luís Gonzaga Ribeiro Moura',
  'Margarida Pereira da Paz',
  'Vicente de Paulo Nunes Galvão',
  'Dalva Maria Teixeira Frota',
  'Geraldo Magela Bezerra Filho',
  'Severina Ramos de Alencar',
  'Edmilson Soares Vasconcelos',
  'Fátima Regina Marques Portela',
  'Joaquim Nabuco Torres Sampaio',
  'Cosma Damião Oliveira Neves',
  'Valdir Pereira de Queiroz',
  'Lucas Gabriel Fontenele',
  'Mariana Alves de Holanda',
  'Camila Beatriz Santos Rocha',
  'Rafael Bruno Costa Magalhães',
  'Amanda Carolina Vieira Dias',
  'Thiago Henrique Brito Moraes',
  'Juliana Patrícia Sousa Nogueira',
  'Diego Fernando Martins Castro',
  'Larissa Fernanda Araújo Braga',
  'Rodrigo Otávio Mendes Lira',
  'Aline Cristina Barros Farias',
  'Bruno Leonardo Gomes Peixoto',
  'Natália Cristina Melo Sales',
  'Gustavo Henrique Rocha Dantas',
  'Vanessa Aparecida Silva Paiva',
  'Eduardo Felipe Cavalcante Reis',
  'Bianca Letícia Cunha Prado',
  'Marcelo Augusto Pires Batista',
  'Patrícia Helena Lopes Macedo',
  'Daniela Cristina Matos Saraiva',
  'Fernando César Freitas Meireles',
  'Tatiane Aparecida Correia Lemos',
  'André Luiz Cardoso Seixas',
  'Priscila Raquel Monteiro Assunção',
  'Leandro Marcos Tavares Guedes',
  'Sabrina Kelly Nascimento Bessa',
  'Matheus Vinícius Aguiar Parente',
  'Renata Cristina Viana Linhares',
  'Fábio Júnior Barbosa Muniz',
  'Cláudia Regina Pacheco Valente',
];

/**
 * Gerador pseudoaleatório determinístico (Mulberry32) para reprodutibilidade exata da seed.
 */
function criarPrng(semente: number): () => number {
  let t = semente >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Gera um CPF de 11 dígitos matematicamente válido com dígitos verificadores módulo 11 reais.
 */
function gerarCpfValido(indice: number): string {
  const baseNum = 240815300 + indice * 137;
  const digitos = String(baseNum).padStart(9, '0').split('').map(Number);

  let soma1 = 0;
  for (let i = 0; i < 9; i++) {
    soma1 += digitos[i] * (10 - i);
  }
  let dv1 = (soma1 * 10) % 11;
  if (dv1 === 10 || dv1 === 11) dv1 = 0;
  digitos.push(dv1);

  let soma2 = 0;
  for (let i = 0; i < 10; i++) {
    soma2 += digitos[i] * (11 - i);
  }
  let dv2 = (soma2 * 10) % 11;
  if (dv2 === 10 || dv2 === 11) dv2 = 0;
  digitos.push(dv2);

  return digitos.join('');
}

/**
 * Gera um Cartão Nacional de Saúde (CNS) de 15 dígitos válido pelo algoritmo módulo 11 do SUS.
 */
function gerarCnsValido(indice: number): string {
  let candidato = 700400100000000n + BigInt(indice) * 97n;
  while (true) {
    const str = candidato.toString().padStart(15, '0');
    let soma = 0;
    for (let i = 0; i < 15; i++) {
      soma += Number(str[i]) * (15 - i);
    }
    if (soma % 11 === 0) {
      return str;
    }
    candidato += 1n;
  }
}

/**
 * Soma dias a uma data YYYY-MM-DD em UTC e retorna YYYY-MM-DD.
 */
function somarDiasIso(dataIso: string, dias: number): string {
  const [y, m, d] = dataIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + dias));
  return dt.toISOString().slice(0, 10);
}

/**
 * Gera lista de datas YYYY-MM-DD entre inicio (inclusive) e fim (inclusive).
 */
function listarDatasNoIntervalo(inicioIso: string, fimIso: string): string[] {
  const datas: string[] = [];
  let atual = inicioIso;
  while (atual <= fimIso) {
    datas.push(atual);
    atual = somarDiasIso(atual, 1);
  }
  return datas;
}

/**
 * Executa a seed cronológica completa dos 3 épicos (Recebimento, Dispensação e Estoque)
 * exclusivamente para a UBS de Parnaíba, cobrindo Setembro, Outubro, Novembro e Dezembro de 2026.
 */
export async function seedCicloOperacionalParnaiba(
  client: PoolClient,
  municipioIds: Map<string, string>,
  unidadeIds: Map<string, string>,
  usuarioIds: Map<string, string>,
  fabricanteIds: Map<string, string>,
  produtoIds: Map<string, string>,
): Promise<void> {
  console.log(
    '  → Simulando ciclo operacional de Parnaíba (Set/Out/Nov/Dez 2026 — Recebimento, Dispensação e Estoque)...',
  );

  const municipioParnaibaId = municipioIds.get('2207702');
  const ubsParnaibaId = unidadeIds.get('UBS Centro - Dr. João Silva Filho');
  const farmaParnaibaId = usuarioIds.get('farma.parnaiba@farmaubs.dev');

  if (!municipioParnaibaId || !ubsParnaibaId || !farmaParnaibaId) {
    throw new Error(
      'Dados base de Parnaíba (município, UBS ou farmacêutico) não encontrados para a seed.',
    );
  }

  // Configura contexto RLS da transação para Parnaíba
  await client.query(`SET LOCAL app.municipio_id = '${municipioParnaibaId}'`);
  await client.query(`SET LOCAL app.unidade_id = '${ubsParnaibaId}'`);

  // Limpeza idempotente dos dados operacionais prévios de Parnaíba
  await client.query(`DELETE FROM dispensacao_itens WHERE municipio_id = $1`, [
    municipioParnaibaId,
  ]);
  await client.query(`DELETE FROM dispensacoes WHERE municipio_id = $1`, [
    municipioParnaibaId,
  ]);
  await client.query(
    `DELETE FROM movimentacoes_estoque WHERE municipio_id = $1`,
    [municipioParnaibaId],
  );
  await client.query(`DELETE FROM recebimento_itens WHERE municipio_id = $1`, [
    municipioParnaibaId,
  ]);
  await client.query(`DELETE FROM documentos_entrada WHERE municipio_id = $1`, [
    municipioParnaibaId,
  ]);
  await client.query(`DELETE FROM lotes WHERE municipio_id = $1`, [
    municipioParnaibaId,
  ]);
  await client.query(`DELETE FROM pacientes WHERE municipio_id = $1`, [
    municipioParnaibaId,
  ]);

  const rand = criarPrng(20261104);

  // 1. Criação dos 60 Pacientes de Parnaíba (30 de Uso Contínuo + 30 Agudos)
  const medsUsoContinuo = CONFIG_MEDICAMENTOS.filter((m) => m.usoContinuo);
  const medsAgudos = CONFIG_MEDICAMENTOS.filter((m) => !m.usoContinuo);

  const pacientes: PacienteSimulado[] = [];
  for (let i = 0; i < NOMES_PACIENTES.length; i++) {
    const id = crypto.randomUUID();
    const cpf = gerarCpfValido(i + 1);
    const cns = gerarCnsValido(i + 1);
    const anoNasc = i < 30 ? 1945 + (i % 38) : 1975 + (i % 28);
    const mesNasc = String((i % 12) + 1).padStart(2, '0');
    const diaNasc = String(((i * 3) % 27) + 1).padStart(2, '0');
    const dataNascimento = `${anoNasc}-${mesNasc}-${diaNasc}`;

    const ehUsoContinuo = i < 30;
    const itensContinuos: ItemUsoContinuo[] = [];

    if (ehUsoContinuo) {
      // Cada paciente de uso contínuo faz uso regular de 1 a 2 medicamentos crônicos
      const med1 = medsUsoContinuo[i % medsUsoContinuo.length];
      itensContinuos.push({
        produtoChave: med1.chave,
        quantidadeMensal: med1.qtdDispensaPadrao,
        posologia: med1.posologiaPadrao,
      });

      if (i % 2 === 0) {
        const med2 = medsUsoContinuo[(i + 5) % medsUsoContinuo.length];
        if (med2.chave !== med1.chave) {
          itensContinuos.push({
            produtoChave: med2.chave,
            quantidadeMensal: med2.qtdDispensaPadrao,
            posologia: med2.posologiaPadrao,
          });
        }
      }
    }

    pacientes.push({
      id,
      nomeCompleto: NOMES_PACIENTES[i],
      cpf,
      cns,
      dataNascimento,
      usoContinuo: ehUsoContinuo,
      diaPreferencialRetirada: (i % 24) + 1, // Distribuído ao longo do mês
      itensContinuos,
    });
  }

  // Insere todos os pacientes no banco
  for (const p of pacientes) {
    await client.query(
      `INSERT INTO pacientes (id, municipio_id, cns, cpf, nome_completo, data_nascimento, ativo, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, '2026-09-01T08:00:00-03:00', '2026-09-01T08:00:00-03:00')`,
      [
        p.id,
        municipioParnaibaId,
        p.cns,
        p.cpf,
        p.nomeCompleto,
        p.dataNascimento,
      ],
    );
  }

  // Estruturas acumuladoras para inserção em lote (bulk insert)
  const lotesCriados: LoteSimulado[] = [];
  const documentosEntradaRows: unknown[][] = [];
  const recebimentoItensRows: unknown[][] = [];
  const dispensacoesRows: unknown[][] = [];
  const dispensacaoItensRows: unknown[][] = [];
  const movimentacoesRows: unknown[][] = [];

  // Definição dos 4 ciclos mensais (Setembro, Outubro, Novembro, Dezembro de 2026)
  // Sempre no dia 05 de cada mês ou no próximo dia útil:
  // - Set/2026: 05/09 é Sábado -> 07/09 (Segunda-feira)
  // - Out/2026: 05/10 é Segunda-feira -> 05/10
  // - Nov/2026: 05/11 é Quinta-feira -> 05/11
  // - Dez/2026: 05/12 é Sábado -> 07/12 (Segunda-feira)
  const ciclosMensais = [
    {
      anoMes: '2026-09',
      codigoMes: '2609',
      dataRecebimento: '2026-09-07',
      inicioDispensas: '2026-09-07',
      fimDispensasAntesProximoCiclo: '2026-10-04',
      offsetFabricante: 0,
    },
    {
      anoMes: '2026-10',
      codigoMes: '2610',
      dataRecebimento: '2026-10-05',
      inicioDispensas: '2026-10-05',
      fimDispensasAntesProximoCiclo: '2026-11-04',
      offsetFabricante: 3,
    },
    {
      anoMes: '2026-11',
      codigoMes: '2611',
      dataRecebimento: '2026-11-05',
      inicioDispensas: '2026-11-05',
      fimDispensasAntesProximoCiclo: '2026-12-06',
      offsetFabricante: 6,
    },
    {
      anoMes: '2026-12',
      codigoMes: '2612',
      dataRecebimento: '2026-12-07',
      inicioDispensas: '2026-12-07',
      fimDispensasAntesProximoCiclo: '2026-12-31',
      offsetFabricante: 8,
    },
  ];

  // Offsets de validade (em dias a partir do recebimento) variando entre < 30 dias até > 500 dias
  const offsetsValidadeDias = [
    18, // < 30 dias (vence no próprio mês entre os dias 23 e 25 -> sofrerá ajuste de saída por VENCIMENTO!)
    24, // < 30 dias
    28, // < 30 dias
    42, // Validade curta (alerta laranja < 90d)
    55, // Validade curta (alerta laranja < 90d)
    75, // Validade curta (alerta laranja < 90d)
    120, // Validade regular
    180, // Validade regular
    240, // Validade regular
    330, // Validade regular
    420, // Validade longa
    515, // > 500 dias
    560, // > 500 dias
    610, // > 500 dias
    680, // > 500 dias
  ];

  const pacientesContinuosLista = pacientes.filter((p) => p.usoContinuo);
  let contadorAtendimentoGlobal = 1;

  for (let idxCiclo = 0; idxCiclo < ciclosMensais.length; idxCiclo++) {
    const ciclo = ciclosMensais[idxCiclo];

    // =========================================================================
    // ETAPA A DO MÊS: RECEBIMENTO NO DIA 05 (OU PRÓXIMO DIA ÚTIL)
    // =========================================================================
    const docCafId = crypto.randomUUID();
    const docSesapiId = crypto.randomUUID();
    const tsRecebimentoCaf = `${ciclo.dataRecebimento}T08:15:00-03:00`;
    const tsRecebimentoSesapi = `${ciclo.dataRecebimento}T09:30:00-03:00`;

    documentosEntradaRows.push([
      docCafId,
      municipioParnaibaId,
      ubsParnaibaId,
      `CAF-PHB-${ciclo.anoMes.replace('-', '/')}`,
      'GUIA_CAF',
      'Central de Abastecimento Farmacêutico — CAF Parnaíba/PI',
      tsRecebimentoCaf,
      farmaParnaibaId,
      'CONCLUIDO',
      `Remessa mensal ordinária da Assistência Farmacêutica Básica (${ciclo.anoMes})`,
      tsRecebimentoCaf,
      tsRecebimentoCaf,
    ]);

    documentosEntradaRows.push([
      docSesapiId,
      municipioParnaibaId,
      ubsParnaibaId,
      `NF-SESAPI-${ciclo.codigoMes}`,
      'NOTA_FISCAL',
      'SESAPI — Diretoria de Unidade de Assistência Farmacêutica (DUAF/PI)',
      tsRecebimentoSesapi,
      farmaParnaibaId,
      'CONCLUIDO',
      `Remessa complementar estadual de medicamentos estratégicos e controle especial (${ciclo.anoMes})`,
      tsRecebimentoSesapi,
      tsRecebimentoSesapi,
    ]);

    const lotesVencimentoCurtoDoMes: LoteSimulado[] = [];

    for (let idxMed = 0; idxMed < CONFIG_MEDICAMENTOS.length; idxMed++) {
      const med = CONFIG_MEDICAMENTOS[idxMed];
      const produtoId = produtoIds.get(med.chave);
      if (!produtoId) {
        throw new Error(`Produto '${med.chave}' não encontrado no catálogo.`);
      }

      // Escolhe fabricante diferente a cada mês para o mesmo medicamento
      const nomeFab =
        NOMES_FABRICANTES[
          (idxMed + ciclo.offsetFabricante) % NOMES_FABRICANTES.length
        ];
      const fabricanteId = fabricanteIds.get(nomeFab);
      if (!fabricanteId) {
        throw new Error(`Fabricante '${nomeFab}' não encontrado.`);
      }
      const siglaFab = SIGLAS_FABRICANTES[nomeFab] ?? 'LAB';

      // Offset de validade variando de < 30 dias até > 500 dias
      // Garantimos que os lotes principais de alto giro tenham validade >= 24 dias e criamos lotes dedicados que vencem no dia 25
      const offsetValidade =
        offsetsValidadeDias[(idxMed + idxCiclo * 4) % offsetsValidadeDias.length];
      const dataValidade = somarDiasIso(
        ciclo.dataRecebimento,
        Math.max(28, offsetValidade),
      );

      const numeroLote = `${siglaFab}-${ciclo.codigoMes}-${String(idxMed + 1).padStart(2, '0')}`;
      const loteId = crypto.randomUUID();
      const docEntradaId = idxMed % 4 === 0 ? docSesapiId : docCafId;
      const tsEntrada =
        idxMed % 4 === 0 ? tsRecebimentoSesapi : tsRecebimentoCaf;
      const numDocRef =
        idxMed % 4 === 0
          ? `NF-SESAPI-${ciclo.codigoMes}`
          : `CAF-PHB-${ciclo.anoMes.replace('-', '/')}`;

      const novoLote: LoteSimulado = {
        id: loteId,
        produtoId,
        produtoChave: med.chave,
        fabricanteId,
        fabricanteNome: nomeFab,
        numeroLote,
        dataRecebimento: ciclo.dataRecebimento,
        dataValidade,
        quantidadeInicial: med.qtdRecebimentoMensal,
        saldoAtual: med.qtdRecebimentoMensal,
      };
      lotesCriados.push(novoLote);

      recebimentoItensRows.push([
        crypto.randomUUID(),
        municipioParnaibaId,
        docEntradaId,
        produtoId,
        fabricanteId,
        loteId,
        numeroLote,
        dataValidade,
        med.qtdRecebimentoMensal,
        `Conferência física aprovada (${nomeFab})`,
        tsEntrada,
      ]);

      movimentacoesRows.push([
        crypto.randomUUID(),
        municipioParnaibaId,
        ubsParnaibaId,
        loteId,
        'ENTRADA_RECEBIMENTO',
        med.qtdRecebimentoMensal,
        0,
        med.qtdRecebimentoMensal,
        docEntradaId,
        'DOCUMENTO_ENTRADA',
        farmaParnaibaId,
        `Entrada por recebimento da guia ${numDocRef} — Lote ${numeroLote}`,
        tsEntrada,
      ]);

      // Para os 2 primeiros medicamentos de cada mês, também entra uma pequena fração de lote com validade curtíssima (18 dias)
      // que vencerá por volta do dia 25 do mês e terá o saldo remanescente baixado por VENCIMENTO no ajuste de fim de mês!
      if (idxMed === idxCiclo % 5 || idxMed === (idxCiclo + 2) % 5) {
        const nomeFabCurto =
          NOMES_FABRICANTES[(idxMed + ciclo.offsetFabricante + 5) % NOMES_FABRICANTES.length];
        const fabCurtoId = fabricanteIds.get(nomeFabCurto)!;
        const siglaCurto = SIGLAS_FABRICANTES[nomeFabCurto] ?? 'LAB';
        const validadeCurtissima = somarDiasIso(ciclo.dataRecebimento, 18); // < 30 dias (18 dias)
        const numeroLoteCurto = `${siglaCurto}-${ciclo.codigoMes}-VC${idxMed + 1}`;
        const loteCurtoId = crypto.randomUUID();
        const qtdCurta = 120;

        const loteCurto: LoteSimulado = {
          id: loteCurtoId,
          produtoId,
          produtoChave: med.chave,
          fabricanteId: fabCurtoId,
          fabricanteNome: nomeFabCurto,
          numeroLote: numeroLoteCurto,
          dataRecebimento: ciclo.dataRecebimento,
          dataValidade: validadeCurtissima,
          quantidadeInicial: qtdCurta,
          saldoAtual: qtdCurta,
        };
        lotesCriados.push(loteCurto);
        lotesVencimentoCurtoDoMes.push(loteCurto);

        recebimentoItensRows.push([
          crypto.randomUUID(),
          municipioParnaibaId,
          docCafId,
          produtoId,
          fabCurtoId,
          loteCurtoId,
          numeroLoteCurto,
          validadeCurtissima,
          qtdCurta,
          'Lote recebido com termo de ciência de validade inferior a 30 dias',
          tsRecebimentoCaf,
        ]);

        movimentacoesRows.push([
          crypto.randomUUID(),
          municipioParnaibaId,
          ubsParnaibaId,
          loteCurtoId,
          'ENTRADA_RECEBIMENTO',
          qtdCurta,
          0,
          qtdCurta,
          docCafId,
          'DOCUMENTO_ENTRADA',
          farmaParnaibaId,
          `Entrada de lote com validade curta (< 30 dias) via guia CAF-PHB-${ciclo.anoMes.replace('-', '/')}`,
          tsRecebimentoCaf,
        ]);
      }
    }

    // =========================================================================
    // ETAPA B & C DO MÊS: DISPENSAS DIÁRIAS (~12/DIA) E AJUSTES DE FIM DE MÊS (DIAS 25-30)
    // =========================================================================
    const datasDoCiclo = listarDatasNoIntervalo(
      ciclo.inicioDispensas,
      ciclo.fimDispensasAntesProximoCiclo,
    );

    const pacientesContinuosAtendidosNoMes = new Set<string>();

    for (let idxDia = 0; idxDia < datasDoCiclo.length; idxDia++) {
      const dataDia = datasDoCiclo[idxDia];
      const diaDoMes = Number(dataDia.slice(8, 10));
      const mesDaData = dataDia.slice(0, 7);

      // Média de 12 dispensas por dia: alterna deterministicamente entre 10, 11, 12, 13 e 14 dispensas
      const variacaoDia = (idxDia % 5) - 2; // -2, -1, 0, +1, +2 -> média exata = 0 -> 12 + 0 = 12.0/dia
      const qtdDispensasHoje = 12 + variacaoDia;

      for (let d = 0; d < qtdDispensasHoje; d++) {
        const hora = 8 + Math.floor((d * 9) / qtdDispensasHoje);
        const minuto = (d * 17 + idxDia * 7) % 60;
        const tsDispensa = `${dataDia}T${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}:00-03:00`;

        // Seleciona paciente: prioriza pacientes de uso contínuo que ainda não retiraram no mês
        let pacienteEscolhido: PacienteSimulado;
        const candidatoContinuo = pacientesContinuosLista.find(
          (p) =>
            !pacientesContinuosAtendidosNoMes.has(p.id) &&
            (diaDoMes >= p.diaPreferencialRetirada || idxDia > 18),
        );

        let prescricoesAtendimento: {
          produtoChave: string;
          quantidade: number;
          posologia: string;
          antimicrobiano: boolean;
        }[] = [];

        if (candidatoContinuo && d < 3) {
          pacienteEscolhido = candidatoContinuo;
          pacientesContinuosAtendidosNoMes.add(candidatoContinuo.id);
          prescricoesAtendimento = candidatoContinuo.itensContinuos.map(
            (ic) => ({
              produtoChave: ic.produtoChave,
              quantidade: ic.quantidadeMensal,
              posologia: ic.posologia,
              antimicrobiano: false,
            }),
          );
        } else {
          // Atendimento agudo ou eventual
          const idxPac = Math.floor(rand() * pacientes.length);
          pacienteEscolhido = pacientes[idxPac];

          const medAgudo1 =
            medsAgudos[(idxDia + d * 3) % medsAgudos.length];
          prescricoesAtendimento.push({
            produtoChave: medAgudo1.chave,
            quantidade: medAgudo1.qtdDispensaPadrao,
            posologia: medAgudo1.posologiaPadrao,
            antimicrobiano: medAgudo1.antimicrobiano,
          });

          // 45% dos atendimentos agudos levam um segundo medicamento (ex: sintomático + antibiótico/anti-inflamatório)
          if ((d + idxDia) % 2 === 0) {
            const medAgudo2 =
              medsAgudos[(idxDia + d * 5 + 4) % medsAgudos.length];
            if (medAgudo2.chave !== medAgudo1.chave) {
              prescricoesAtendimento.push({
                produtoChave: medAgudo2.chave,
                quantidade: medAgudo2.qtdDispensaPadrao,
                posologia: medAgudo2.posologiaPadrao,
                antimicrobiano: medAgudo2.antimicrobiano,
              });
            }
          }
        }

        // Verifica compatibilidade com o estoque no momento da dispensa usando FEFO (dataValidade >= dataDia e saldoAtual >= qtd)
        const itensEfetivados: {
          lote: LoteSimulado;
          quantidade: number;
          posologia: string;
          antimicrobiano: boolean;
          saldoAnterior: number;
          saldoPosterior: number;
        }[] = [];

        for (const presc of prescricoesAtendimento) {
          const lotesElegiveisFefo = lotesCriados
            .filter(
              (l) =>
                l.produtoChave === presc.produtoChave &&
                l.dataRecebimento <= dataDia &&
                l.dataValidade >= dataDia &&
                l.saldoAtual >= presc.quantidade,
            )
            .sort((a, b) => a.dataValidade.localeCompare(b.dataValidade));

          if (lotesElegiveisFefo.length > 0) {
            const loteFefo = lotesElegiveisFefo[0];
            const saldoAnterior = loteFefo.saldoAtual;
            const saldoPosterior = saldoAnterior - presc.quantidade;
            loteFefo.saldoAtual = saldoPosterior;

            itensEfetivados.push({
              lote: loteFefo,
              quantidade: presc.quantidade,
              posologia: presc.posologia,
              antimicrobiano: presc.antimicrobiano,
              saldoAnterior,
              saldoPosterior,
            });
          }
        }

        if (itensEfetivados.length === 0) {
          continue;
        }

        const dispensacaoId = crypto.randomUUID();
        const numeroAtendimento = `DISP-${ciclo.codigoMes}-${String(contadorAtendimentoGlobal++).padStart(5, '0')}`;
        const temAntimicrobiano = itensEfetivados.some((i) => i.antimicrobiano);
        const receitaEmissaoEm = temAntimicrobiano
          ? somarDiasIso(dataDia, -((d % 5) + 1)) // Receita emitida entre 1 e 5 dias antes (< 10 dias RDC 20)
          : null;

        dispensacoesRows.push([
          dispensacaoId,
          municipioParnaibaId,
          ubsParnaibaId,
          pacienteEscolhido.id,
          farmaParnaibaId,
          numeroAtendimento,
          'concluida',
          receitaEmissaoEm,
          tsDispensa,
          tsDispensa,
        ]);

        for (const item of itensEfetivados) {
          dispensacaoItensRows.push([
            crypto.randomUUID(),
            municipioParnaibaId,
            dispensacaoId,
            item.lote.produtoId,
            item.lote.id,
            item.quantidade,
            item.posologia,
            tsDispensa,
          ]);

          movimentacoesRows.push([
            crypto.randomUUID(),
            municipioParnaibaId,
            ubsParnaibaId,
            item.lote.id,
            'SAIDA_DISPENSACAO',
            item.quantidade,
            item.saldoAnterior,
            item.saldoPosterior,
            dispensacaoId,
            'DISPENSACAO',
            farmaParnaibaId,
            `Dispensação atendimento ${numeroAtendimento} (${pacienteEscolhido.nomeCompleto})`,
            tsDispensa,
          ]);
        }
      }

      // =======================================================================
      // AJUSTES DE ESTOQUE NO FINAL DE CADA MÊS (ENTRE OS DIAS 25 E 30)
      // =======================================================================
      if (mesDaData === ciclo.anoMes && diaDoMes >= 25 && diaDoMes <= 30) {
        const tsAjuste = `${dataDia}T17:40:00-03:00`;

        // Dia 26: Ajuste de Saída (-) por VENCIMENTO nos lotes que expiraram no dia 25 do mês
        if (diaDoMes === 26) {
          for (const loteVencido of lotesVencimentoCurtoDoMes) {
            if (loteVencido.saldoAtual > 0) {
              const qtdBaixa = loteVencido.saldoAtual;
              const saldoAnt = loteVencido.saldoAtual;
              loteVencido.saldoAtual = 0;

              movimentacoesRows.push([
                crypto.randomUUID(),
                municipioParnaibaId,
                ubsParnaibaId,
                loteVencido.id,
                'AJUSTE_SAIDA',
                qtdBaixa,
                saldoAnt,
                0,
                null,
                'VENCIMENTO',
                farmaParnaibaId,
                `[VENCIMENTO] Baixa técnica para segregação e descarte sanitário de lote com validade expirada em ${loteVencido.dataValidade} (RDC Anvisa nº 222/2018).`,
                tsAjuste,
              ]);
            }
          }
        }

        // Dia 27: Ajuste de Saída (-) por AVARIA_FISICA
        if (diaDoMes === 27) {
          const loteAlvo = lotesCriados.find(
            (l) =>
              l.dataRecebimento === ciclo.dataRecebimento &&
              l.saldoAtual >= 15 &&
              l.dataValidade > dataDia,
          );
          if (loteAlvo) {
            const qtdAvaria = 4;
            const saldoAnt = loteAlvo.saldoAtual;
            loteAlvo.saldoAtual -= qtdAvaria;

            movimentacoesRows.push([
              crypto.randomUUID(),
              municipioParnaibaId,
              ubsParnaibaId,
              loteAlvo.id,
              'AJUSTE_SAIDA',
              qtdAvaria,
              saldoAnt,
              loteAlvo.saldoAtual,
              null,
              'AVARIA_FISICA',
              farmaParnaibaId,
              `[AVARIA_FISICA] Descarte de ${qtdAvaria} unidades por rompimento acidental do blíster primário constatado na inspeção de fim de mês.`,
              tsAjuste,
            ]);
          }
        }

        // Dia 28: Ajuste de Entrada (+) por DEVOLUCAO_PACIENTE
        if (diaDoMes === 28) {
          const loteAlvo = lotesCriados.find(
            (l) =>
              l.dataRecebimento === ciclo.dataRecebimento &&
              l.produtoChave === 'Losartana Potássica 50 mg' &&
              l.dataValidade > dataDia,
          );
          if (loteAlvo) {
            const qtdDevolucao = 30;
            const saldoAnt = loteAlvo.saldoAtual;
            loteAlvo.saldoAtual += qtdDevolucao;

            movimentacoesRows.push([
              crypto.randomUUID(),
              municipioParnaibaId,
              ubsParnaibaId,
              loteAlvo.id,
              'AJUSTE_ENTRADA',
              qtdDevolucao,
              saldoAnt,
              loteAlvo.saldoAtual,
              null,
              'DEVOLUCAO_PACIENTE',
              farmaParnaibaId,
              `[DEVOLUCAO_PACIENTE] Reintegração ao estoque de 30 comprimidos em blísteres lacrados do mesmo lote (${loteAlvo.numeroLote}) devolvidos após substituição terapêutica.`,
              tsAjuste,
            ]);
          }
        }

        // Dia 29: Ajuste de Saída (-) por EXTRAVIO / Perda Operacional
        if (diaDoMes === 29) {
          const loteAlvo = lotesCriados.find(
            (l) =>
              l.dataRecebimento === ciclo.dataRecebimento &&
              l.produtoChave === 'Dipirona Sódica 500 mg' &&
              l.saldoAtual >= 20,
          );
          if (loteAlvo) {
            const qtdExtravio = 10;
            const saldoAnt = loteAlvo.saldoAtual;
            loteAlvo.saldoAtual -= qtdExtravio;

            movimentacoesRows.push([
              crypto.randomUUID(),
              municipioParnaibaId,
              ubsParnaibaId,
              loteAlvo.id,
              'AJUSTE_SAIDA',
              qtdExtravio,
              saldoAnt,
              loteAlvo.saldoAtual,
              null,
              'EXTRAVIO',
              farmaParnaibaId,
              `[EXTRAVIO] Ajuste negativo de ${qtdExtravio} comprimidos para conciliação de divergência física apurada na conferência de prateleira do dia 29.`,
              tsAjuste,
            ]);
          }
        }

        // Dia 30: Ajuste de Entrada (+) por CORRECAO_INVENTARIO
        if (diaDoMes === 30) {
          const loteAlvo = lotesCriados.find(
            (l) =>
              l.dataRecebimento === ciclo.dataRecebimento &&
              l.produtoChave === 'Metformina Cloridrato 850 mg' &&
              l.dataValidade > dataDia,
          );
          if (loteAlvo) {
            const qtdCorrecao = 20;
            const saldoAnt = loteAlvo.saldoAtual;
            loteAlvo.saldoAtual += qtdCorrecao;

            movimentacoesRows.push([
              crypto.randomUUID(),
              municipioParnaibaId,
              ubsParnaibaId,
              loteAlvo.id,
              'AJUSTE_ENTRADA',
              qtdCorrecao,
              saldoAnt,
              loteAlvo.saldoAtual,
              null,
              'CORRECAO_INVENTARIO',
              farmaParnaibaId,
              `[CORRECAO_INVENTARIO] Ajuste positivo de ${qtdCorrecao} comprimidos após recontagem física mensal das bin boxes na farmácia da UBS.`,
              tsAjuste,
            ]);
          }
        }
      }
    }
  }

  // ===========================================================================
  // PERSISTÊNCIA EM LOTE (BULK INSERT) NO POSTGRESQL
  // ===========================================================================

  // 1. Documentos de Entrada
  for (const row of documentosEntradaRows) {
    await client.query(
      `INSERT INTO documentos_entrada (
         id, municipio_id, ubs_id, numero_documento, tipo_documento,
         fornecedor_origem, data_recebimento, usuario_recebedor_id,
         status, observacoes, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      row,
    );
  }

  // 2. Lotes (com o saldo_atual final conciliado após todas as entradas, dispensas e ajustes)
  for (const l of lotesCriados) {
    const tsCriacao = `${l.dataRecebimento}T08:15:00-03:00`;
    await client.query(
      `INSERT INTO lotes (
         id, municipio_id, ubs_id, produto_id, fabricante_id,
         numero_lote, data_validade, saldo_atual, status, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ATIVO', $9, $9)`,
      [
        l.id,
        municipioParnaibaId,
        ubsParnaibaId,
        l.produtoId,
        l.fabricanteId,
        l.numeroLote,
        l.dataValidade,
        l.saldoAtual,
        tsCriacao,
      ],
    );
  }

  // 3. Itens de Recebimento
  await executarBulkInsert(
    client,
    'recebimento_itens',
    [
      'id',
      'municipio_id',
      'documento_entrada_id',
      'produto_id',
      'fabricante_id',
      'lote_id',
      'numero_lote',
      'data_validade',
      'quantidade_recebida',
      'observacoes',
      'created_at',
    ],
    recebimentoItensRows,
  );

  // 4. Dispensações (Cabeçalhos)
  await executarBulkInsert(
    client,
    'dispensacoes',
    [
      'id',
      'municipio_id',
      'unidade_id',
      'paciente_id',
      'dispensador_id',
      'numero_atendimento',
      'status',
      'receita_emissao_em',
      'created_at',
      'updated_at',
    ],
    dispensacoesRows,
  );

  // 5. Itens de Dispensação
  await executarBulkInsert(
    client,
    'dispensacao_itens',
    [
      'id',
      'municipio_id',
      'dispensacao_id',
      'medicamento_id',
      'lote_id',
      'quantidade_dispensada',
      'posologia',
      'created_at',
    ],
    dispensacaoItensRows,
  );

  // 6. Livro-Razão de Movimentações de Estoque
  await executarBulkInsert(
    client,
    'movimentacoes_estoque',
    [
      'id',
      'municipio_id',
      'ubs_id',
      'lote_id',
      'tipo_movimentacao',
      'quantidade',
      'saldo_anterior',
      'saldo_posterior',
      'documento_referencia_id',
      'tipo_documento_referencia',
      'usuario_id',
      'justificativa',
      'created_at',
    ],
    movimentacoesRows,
  );

  console.log(
    `     ✔ Parnaíba populada: ${pacientes.length} pacientes (${pacientesContinuosLista.length} uso contínuo), ` +
      `${documentosEntradaRows.length} guias de recebimento, ${lotesCriados.length} lotes, ` +
      `${dispensacoesRows.length} dispensas (~12/dia de Set a Dez) e ${movimentacoesRows.length} movimentações auditadas.`,
  );
}

/**
 * Utilitário para inserção multi-row em batches de 250 linhas por query.
 */
async function executarBulkInsert(
  client: PoolClient,
  tabela: string,
  colunas: string[],
  linhas: unknown[][],
  tamanhoBatch = 250,
): Promise<void> {
  if (linhas.length === 0) return;

  const numCols = colunas.length;
  for (let i = 0; i < linhas.length; i += tamanhoBatch) {
    const fatia = linhas.slice(i, i + tamanhoBatch);
    const valoresParametros: unknown[] = [];
    const clausulasValues: string[] = [];

    fatia.forEach((linha, idxLinha) => {
      const placeholders: string[] = [];
      for (let c = 0; c < numCols; c++) {
        valoresParametros.push(linha[c]);
        placeholders.push(`$${idxLinha * numCols + c + 1}`);
      }
      clausulasValues.push(`(${placeholders.join(', ')})`);
    });

    const sql = `INSERT INTO ${tabela} (${colunas.join(', ')}) VALUES ${clausulasValues.join(', ')}`;
    await client.query(sql, valoresParametros);
  }
}
