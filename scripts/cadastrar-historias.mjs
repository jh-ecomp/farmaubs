import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const REPO = 'jh-ecomp/farmaubs';
const PROJECT_NUMBER = 1;
const PROJECT_OWNER = 'jh-ecomp';
const MILESTONE_INC_1 = 'Incremento I - Pacote de funcionalidades essenciais';
const MILESTONE_INC_2 = 'Incremento II - Alertas, Notificações e Parâmetros';

// Project field IDs & Option IDs discovered from gh project field-list
const PROJECT_ID = 'PVT_kwHOAUWQz84BhUKM';
const FIELDS = {
  status: {
    id: 'PVTSSF_lAHOAUWQz84BhUKMzhgQU3Q',
    name: 'Status',
    backlogOptionId: 'f75ad846',
    options: {
      Backlog: 'f75ad846',
      Ready: '61e4505c',
      'In progress': '47fc9ee4',
      'In review': 'df73e18b',
      Done: '98236657'
    }
  },
  priority: {
    id: 'PVTSSF_lAHOAUWQz84BhUKMzhgQVSE',
    name: 'Priority',
    options: { P0: '79628723', P1: '0a877460', P2: 'da944a9c' }
  },
  size: {
    id: 'PVTSSF_lAHOAUWQz84BhUKMzhgQVSI',
    name: 'Size',
    options: { XS: '6c6483d2', S: 'f784b110', M: '7515a9f1', L: '817d0097', XL: 'db339eb2' }
  },
  estimate: { id: 'PVTF_lAHOAUWQz84BhUKMzhgQVSM', name: 'Estimate' },
  startDate: { id: 'PVTF_lAHOAUWQz84BhUKMzhgQVSQ', name: 'Start date' },
  targetDate: { id: 'PVTF_lAHOAUWQz84BhUKMzhgQVSU', name: 'Target date' }
};

// Sprint calendar from ROADMAP_SPRINTS.md
const SPRINTS = {
  1: { start: '2026-10-12', end: '2026-10-23' },
  2: { start: '2026-10-26', end: '2026-11-06' },
  3: { start: '2026-11-09', end: '2026-11-20' },
  4: { start: '2026-11-23', end: '2026-12-04' },
  5: { start: '2026-12-07', end: '2026-12-18' },
  6: { start: '2026-12-21', end: '2027-01-08' },
  7: { start: '2027-01-11', end: '2027-01-22' }
};

// Story mapping: sprint, priority, size, estimate, status (optional)
const STORY_METADATA = {
  // Épico 1 - Acesso e Autenticação (novas histórias e trilha Mobile)
  'AC-31': { sprint: 4, priority: 'P1', size: 'M', estimate: 5 },
  'AC-MOB-01': { sprint: 1, priority: 'P0', size: 'M', estimate: 5 },
  'AC-MOB-02': { sprint: 1, priority: 'P0', size: 'S', estimate: 3 },
  'AC-MOB-03': { sprint: 1, priority: 'P1', size: 'S', estimate: 3 },
  'AC-MOB-04': { sprint: 2, priority: 'P1', size: 'S', estimate: 3 },
  'AC-MOB-05': { sprint: 2, priority: 'P1', size: 'XS', estimate: 2 },
  'AC-MOB-06': { sprint: 2, priority: 'P2', size: 'XS', estimate: 2 },
  'AC-MOB-07': { sprint: 2, priority: 'P2', size: 'S', estimate: 3 },

  // Épico 2 - Dispensação
  'DI-01': { sprint: 1, priority: 'P0', size: 'L', estimate: 8 },
  'DI-02': { sprint: 1, priority: 'P1', size: 'M', estimate: 5 },
  'DI-03': { sprint: 1, priority: 'P1', size: 'M', estimate: 5 },
  'DI-04': { sprint: 2, priority: 'P0', size: 'L', estimate: 8 },
  'DI-05': { sprint: 2, priority: 'P2', size: 'S', estimate: 3 },
  'DI-06': { sprint: 1, priority: 'P1', size: 'M', estimate: 5 },
  'DI-07': { sprint: 2, priority: 'P1', size: 'M', estimate: 5 },
  'DI-08': { sprint: 3, priority: 'P1', size: 'M', estimate: 5 },
  'DI-09': { sprint: 3, priority: 'P1', size: 'L', estimate: 8 },
  'DI-10': { sprint: 4, priority: 'P2', size: 'S', estimate: 3 },
  'DI-11': { sprint: 4, priority: 'P1', size: 'M', estimate: 5, status: 'In progress' },
  'DI-MOB-01': { sprint: 2, priority: 'P1', size: 'M', estimate: 5 },
  'DI-MOB-02': { sprint: 3, priority: 'P1', size: 'M', estimate: 5 },
  'DI-MOB-03': { sprint: 3, priority: 'P1', size: 'M', estimate: 5 },
  'DI-MOB-04': { sprint: 4, priority: 'P1', size: 'M', estimate: 5 },
  'DI-MOB-05': { sprint: 4, priority: 'P2', size: 'S', estimate: 3 },

  // Épico 3 - Recebimento
  'RE-01': { sprint: 1, priority: 'P0', size: 'L', estimate: 8 },
  'RE-02': { sprint: 1, priority: 'P1', size: 'M', estimate: 5 },
  'RE-03': { sprint: 2, priority: 'P0', size: 'L', estimate: 8 },
  'RE-04': { sprint: 2, priority: 'P2', size: 'S', estimate: 3 },
  'RE-05': { sprint: 1, priority: 'P1', size: 'M', estimate: 5 },
  'RE-06': { sprint: 2, priority: 'P1', size: 'M', estimate: 5 },
  'RE-07': { sprint: 2, priority: 'P1', size: 'M', estimate: 5 },
  'RE-08': { sprint: 3, priority: 'P2', size: 'S', estimate: 3 },
  'RE-09': { sprint: 4, priority: 'P1', size: 'M', estimate: 5 },
  'RE-MOB-01': { sprint: 2, priority: 'P1', size: 'M', estimate: 5 },
  'RE-MOB-02': { sprint: 3, priority: 'P1', size: 'M', estimate: 5 },
  'RE-MOB-03': { sprint: 3, priority: 'P1', size: 'M', estimate: 5 },
  'RE-MOB-04': { sprint: 4, priority: 'P2', size: 'S', estimate: 3 },

  // Épico 4 - Controle de Estoque
  'ES-01': { sprint: 1, priority: 'P1', size: 'M', estimate: 5 },
  'ES-02': { sprint: 1, priority: 'P1', size: 'M', estimate: 5 },
  'ES-03': { sprint: 2, priority: 'P0', size: 'L', estimate: 8 },
  'ES-04': { sprint: 2, priority: 'P2', size: 'S', estimate: 3 },
  'ES-05': { sprint: 3, priority: 'P2', size: 'S', estimate: 3 },
  'ES-06': { sprint: 4, priority: 'P1', size: 'M', estimate: 5 },
  'ES-07': { sprint: 4, priority: 'P1', size: 'M', estimate: 5 },
  'ES-08': { sprint: 5, priority: 'P2', size: 'S', estimate: 3 },
  'ES-09': { sprint: 5, priority: 'P2', size: 'S', estimate: 3 },
  'ES-10': { sprint: 5, priority: 'P2', size: 'S', estimate: 3 },
  'ES-11': { sprint: 5, priority: 'P1', size: 'M', estimate: 5 },
  'ES-MOB-01': { sprint: 3, priority: 'P1', size: 'M', estimate: 5 },
  'ES-MOB-02': { sprint: 4, priority: 'P1', size: 'M', estimate: 5 },
  'ES-MOB-03': { sprint: 4, priority: 'P2', size: 'S', estimate: 3 },
  'ES-MOB-04': { sprint: 5, priority: 'P1', size: 'M', estimate: 5 },
  'ES-MOB-05': { sprint: 5, priority: 'P2', size: 'S', estimate: 3 },

  // Épico 5 - Inventário Mensal
  'IN-01': { sprint: 3, priority: 'P0', size: 'L', estimate: 8 },
  'IN-02': { sprint: 3, priority: 'P1', size: 'M', estimate: 5 },
  'IN-03': { sprint: 4, priority: 'P1', size: 'M', estimate: 5 },
  'IN-04': { sprint: 4, priority: 'P0', size: 'L', estimate: 8 },
  'IN-05': { sprint: 6, priority: 'P1', size: 'M', estimate: 5 },
  'IN-06': { sprint: 6, priority: 'P1', size: 'M', estimate: 5 },
  'IN-07': { sprint: 6, priority: 'P1', size: 'M', estimate: 5 },
  'IN-08': { sprint: 6, priority: 'P2', size: 'M', estimate: 5 },
  'IN-09': { sprint: 6, priority: 'P1', size: 'M', estimate: 5 },
  'IN-MOB-01': { sprint: 5, priority: 'P1', size: 'M', estimate: 5 },
  'IN-MOB-02': { sprint: 5, priority: 'P0', size: 'L', estimate: 8 },
  'IN-MOB-03': { sprint: 6, priority: 'P1', size: 'M', estimate: 5 },
  'IN-MOB-04': { sprint: 6, priority: 'P2', size: 'S', estimate: 3 },

  // Épico 6 - Alertas, Notificações e Parâmetros Operacionais (Incremento II)
  'AL-01': { sprint: 5, priority: 'P0', size: 'L', estimate: 8 },
  'AL-02': { sprint: 5, priority: 'P1', size: 'M', estimate: 5 },
  'AL-03': { sprint: 6, priority: 'P0', size: 'L', estimate: 8 },
  'AL-04': { sprint: 6, priority: 'P1', size: 'M', estimate: 5 },
  'AL-05': { sprint: 7, priority: 'P1', size: 'M', estimate: 5 },
  'AL-06': { sprint: 7, priority: 'P0', size: 'L', estimate: 8 },
  'AL-07': { sprint: 7, priority: 'P1', size: 'M', estimate: 5 },
  'AL-08': { sprint: 7, priority: 'P1', size: 'M', estimate: 5 },
  'AL-09': { sprint: 7, priority: 'P1', size: 'M', estimate: 5 },
  'AL-MOB-01': { sprint: 7, priority: 'P1', size: 'M', estimate: 5 },
  'AL-MOB-02': { sprint: 7, priority: 'P1', size: 'M', estimate: 5 },
  'AL-MOB-03': { sprint: 7, priority: 'P2', size: 'S', estimate: 3 },
  'AL-MOB-04': { sprint: 7, priority: 'P1', size: 'S', estimate: 3 }
};

const EPICS = [
  {
    code: 'EP-01',
    name: 'Acesso e Autenticação do Sistema',
    dir: '1-epico-acesso-e-autenticacao-do-sistema',
    epicFile: '1-epico-acesso-e-autenticacao-do-sistema.md',
    milestone: MILESTONE_INC_1,
    startDate: '2026-09-28',
    targetDate: '2026-12-04',
    priority: 'P0',
    size: 'XL',
    estimate: 13,
    storyFilter: f => f.startsWith('ac-31-') || f.startsWith('ac-mob-')
  },
  {
    code: 'EP-02',
    name: 'Dispensação de Medicamentos',
    dir: '2-epico-dispensacao-de-medicamentos',
    epicFile: '2-epico-dispensacao-de-medicamentos.md',
    milestone: MILESTONE_INC_1,
    startDate: '2026-10-12',
    targetDate: '2026-12-04',
    priority: 'P0',
    size: 'XL',
    estimate: 13
  },
  {
    code: 'EP-03',
    name: 'Recebimento de Medicamentos',
    dir: '3-epico-recebimento-de-medicamentos',
    epicFile: '3-epico-recebimento-de-medicamentos.md',
    milestone: MILESTONE_INC_1,
    startDate: '2026-10-12',
    targetDate: '2026-12-04',
    priority: 'P0',
    size: 'XL',
    estimate: 13
  },
  {
    code: 'EP-04',
    name: 'Controle de Estoque',
    dir: '4-epico-controle-de-estoque',
    epicFile: '4-epico-controle-de-estoque.md',
    milestone: MILESTONE_INC_1,
    startDate: '2026-10-12',
    targetDate: '2026-12-18',
    priority: 'P0',
    size: 'XL',
    estimate: 13
  },
  {
    code: 'EP-05',
    name: 'Inventário Mensal',
    dir: '5-epico-inventario-mensal',
    epicFile: '5-epico-inventario-mensal.md',
    milestone: MILESTONE_INC_1,
    startDate: '2026-11-09',
    targetDate: '2027-01-08',
    priority: 'P0',
    size: 'XL',
    estimate: 13
  },
  {
    code: 'EP-06',
    name: 'Alertas, Notificações e Parâmetros Operacionais',
    dir: '6-epico-alertas-e-notificacoes',
    epicFile: '6-epico-alertas-e-notificacoes.md',
    milestone: MILESTONE_INC_2,
    startDate: '2026-12-07',
    targetDate: '2027-01-22',
    priority: 'P0',
    size: 'XL',
    estimate: 13
  }
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForRateLimit() {
  console.warn(`\n⚠️  [Rate limit detectado] Consultando tempo exato de reset na API do GitHub...`);
  let waitSeconds = 120;
  try {
    const res = spawnSync('gh', ['api', '-i', 'graphql', '-f', 'query=query { viewer { login } }'], { encoding: 'utf-8' });
    const output = (res.stdout || '') + '\n' + (res.stderr || '');
    const match = output.match(/x-ratelimit-reset:\s*(\d+)/i);
    if (match) {
      const resetEpoch = parseInt(match[1], 10);
      const diff = resetEpoch - Math.floor(Date.now() / 1000);
      if (diff > 0) {
        waitSeconds = diff + 15;
      }
    }
  } catch (e) {
    console.error('Erro ao consultar reset via headers:', e.message);
  }

  const resetTarget = new Date(Date.now() + waitSeconds * 1000).toLocaleTimeString('pt-BR');
  console.warn(`⏳ Rate limit atingido. Pausando execução por ${waitSeconds}s (~${Math.ceil(waitSeconds / 60)} min). Retomará às ~${resetTarget}...`);
  await sleep(waitSeconds * 1000);
  console.log('✅ Retomando execução após reset do rate limit...');
}

async function runGh(args, input = null, maxRetries = 15) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = spawnSync('gh', args, {
      input,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024
    });

    if (res.status === 0) {
      return res.stdout.trim();
    }

    const err = (res.stderr || res.stdout || '').toLowerCase();
    const isRateLimit = err.includes('rate limit') ||
                        err.includes('too quickly') ||
                        err.includes('was submitted too quickly');

    if (isRateLimit && attempt < maxRetries) {
      await waitForRateLimit();
      continue;
    }

    throw new Error(`gh ${args.join(' ')} failed:\n${res.stderr || res.stdout}`);
  }
}

async function runGraphql(query, variables = {}, maxRetries = 15) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const payload = JSON.stringify({ query, variables });
    const res = spawnSync('gh', ['api', 'graphql', '--input', '-'], {
      input: payload,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024
    });

    if (res.status !== 0) {
      const err = (res.stderr || res.stdout || '').toLowerCase();
      if (err.includes('rate limit') && attempt < maxRetries) {
        await waitForRateLimit();
        continue;
      }
      throw new Error(`gh api graphql failed:\n${res.stderr || res.stdout}`);
    }

    const data = JSON.parse(res.stdout.trim());
    if (data.errors && data.errors.length > 0) {
      const errMsg = data.errors.map(e => e.message).join('; ');
      if (errMsg.toLowerCase().includes('rate limit') && attempt < maxRetries) {
        await waitForRateLimit();
        continue;
      }
      // Sub-issue may already be linked
      if (errMsg.includes('already a sub-issue')) {
        return data.data;
      }
      throw new Error(`GraphQL Error: ${JSON.stringify(data.errors)}`);
    }
    return data.data;
  }
}

// Global cache of issues to prevent redundant lookups
const issuesCacheByTitle = new Map();
const issuesCacheByCode = new Map();

function extractStoryCode(title) {
  const m = title.trim().match(/^([A-Z]{2}(?:-MOB)?-\d{2})\b/);
  return m ? m[1] : null;
}

async function loadExistingIssues() {
  console.log('Loading existing repository issues into cache...');
  const out = await runGh(['issue', 'list', '-R', REPO, '--state', 'all', '--limit', '500', '--json', 'id,number,title,body,url,projectItems']);
  const list = JSON.parse(out);
  for (const item of list) {
    issuesCacheByTitle.set(item.title.trim().toLowerCase(), item);
    const code = extractStoryCode(item.title);
    if (code) {
      issuesCacheByCode.set(code, item);
    }
  }
  console.log(`Loaded ${list.length} issues into cache.`);
}

function findExistingIssue(title, code = null) {
  const byTitle = issuesCacheByTitle.get(title.trim().toLowerCase());
  if (byTitle) return byTitle;
  if (code && issuesCacheByCode.has(code)) return issuesCacheByCode.get(code);
  return null;
}

function normalizeMarkdown(text) {
  return (text || '').replace(/\r\n/g, '\n').trim();
}

async function addAndConfigureProjectItem({ contentId, statusOptionId, priorityOptionId, sizeOptionId, estimate, startDate, targetDate }) {
  // 1. Add item to ProjectV2 via GraphQL (idempotent: returns existing item ID if already in project)
  const addMutation = `
    mutation AddToProject($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
        item { id }
      }
    }
  `;
  const addData = await runGraphql(addMutation, { projectId: PROJECT_ID, contentId });
  const itemId = addData.addProjectV2ItemById.item.id;
  await sleep(400);

  // 2. Set all 6 project fields in a single batched GraphQL mutation
  const updateMutation = `
    mutation UpdateProjectFields(
      $projectId: ID!,
      $itemId: ID!,
      $statusFieldId: ID!,
      $statusOptionId: String!,
      $priorityFieldId: ID!,
      $priorityOptionId: String!,
      $sizeFieldId: ID!,
      $sizeOptionId: String!,
      $estimateFieldId: ID!,
      $estimate: Float!,
      $startDateFieldId: ID!,
      $startDate: Date!,
      $targetDateFieldId: ID!,
      $targetDate: Date!
    ) {
      fStatus: updateProjectV2ItemFieldValue(input: {
        projectId: $projectId, itemId: $itemId, fieldId: $statusFieldId,
        value: { singleSelectOptionId: $statusOptionId }
      }) { projectV2Item { id } }
      fPriority: updateProjectV2ItemFieldValue(input: {
        projectId: $projectId, itemId: $itemId, fieldId: $priorityFieldId,
        value: { singleSelectOptionId: $priorityOptionId }
      }) { projectV2Item { id } }
      fSize: updateProjectV2ItemFieldValue(input: {
        projectId: $projectId, itemId: $itemId, fieldId: $sizeFieldId,
        value: { singleSelectOptionId: $sizeOptionId }
      }) { projectV2Item { id } }
      fEstimate: updateProjectV2ItemFieldValue(input: {
        projectId: $projectId, itemId: $itemId, fieldId: $estimateFieldId,
        value: { number: $estimate }
      }) { projectV2Item { id } }
      fStart: updateProjectV2ItemFieldValue(input: {
        projectId: $projectId, itemId: $itemId, fieldId: $startDateFieldId,
        value: { date: $startDate }
      }) { projectV2Item { id } }
      fTarget: updateProjectV2ItemFieldValue(input: {
        projectId: $projectId, itemId: $itemId, fieldId: $targetDateFieldId,
        value: { date: $targetDate }
      }) { projectV2Item { id } }
    }
  `;

  await runGraphql(updateMutation, {
    projectId: PROJECT_ID,
    itemId,
    statusFieldId: FIELDS.status.id,
    statusOptionId,
    priorityFieldId: FIELDS.priority.id,
    priorityOptionId,
    sizeFieldId: FIELDS.size.id,
    sizeOptionId,
    estimateFieldId: FIELDS.estimate.id,
    estimate: Number(estimate),
    startDateFieldId: FIELDS.startDate.id,
    startDate,
    targetDateFieldId: FIELDS.targetDate.id,
    targetDate
  });
  await sleep(600);
}

export async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`Starting ${isDryRun ? '[DRY RUN] ' : ''}GitHub sync for Epics 1 to 6...`);

  await loadExistingIssues();

  const baseDir = path.resolve('docs/historias-usuario');

  for (const epicConfig of EPICS) {
    const epicDirPath = path.join(baseDir, epicConfig.dir);
    const epicFilePath = path.join(epicDirPath, epicConfig.epicFile);
    const epicContent = fs.readFileSync(epicFilePath, 'utf-8');
    const firstLine = epicContent.split(/\r?\n/)[0].replace(/^#\s*/, '').trim();
    const epicMilestone = epicConfig.milestone || MILESTONE_INC_1;

    console.log(`\n============================================================`);
    console.log(`Épico [${epicConfig.code}]: ${firstLine}`);
    console.log(`Milestone: ${epicMilestone} | Dates: ${epicConfig.startDate} -> ${epicConfig.targetDate}`);

    let epicIssue = findExistingIssue(firstLine);
    const epicInProject = epicIssue?.projectItems && epicIssue.projectItems.length > 0;

    if (!isDryRun) {
      // 1. Create or update Epic issue
      if (!epicIssue) {
        console.log(`Creating Epic issue...`);
        const createEpicOutput = await runGh([
          'issue', 'create',
          '-R', REPO,
          '--title', firstLine,
          '--body-file', epicFilePath,
          '--label', 'Épico',
          '--milestone', epicMilestone
        ]);
        const epicUrl = createEpicOutput;
        const epicIssueNumber = epicUrl.split('/').pop();
        epicIssue = JSON.parse(await runGh(['issue', 'view', epicIssueNumber, '-R', REPO, '--json', 'id,number,title,body,url,projectItems']));
        issuesCacheByTitle.set(firstLine.toLowerCase(), epicIssue);
        console.log(`Created Epic issue: #${epicIssue.number} (${epicIssue.url})`);
        await sleep(1000);
      } else {
        console.log(`Found existing Epic issue: #${epicIssue.number} (${epicIssue.url})`);
        if (normalizeMarkdown(epicContent) !== normalizeMarkdown(epicIssue.body)) {
          console.log(`Updating body of Epic #${epicIssue.number} (content changed)...`);
          await runGh(['issue', 'edit', String(epicIssue.number), '-R', REPO, '--body-file', epicFilePath]);
          epicIssue.body = epicContent;
          await sleep(600);
        }
      }

      if (!epicInProject) {
        console.log(`Adding Epic #${epicIssue.number} to Project 1 and setting fields...`);
        await addAndConfigureProjectItem({
          contentId: epicIssue.id,
          statusOptionId: FIELDS.status.backlogOptionId,
          priorityOptionId: FIELDS.priority.options[epicConfig.priority],
          sizeOptionId: FIELDS.size.options[epicConfig.size],
          estimate: epicConfig.estimate,
          startDate: epicConfig.startDate,
          targetDate: epicConfig.targetDate
        });
      } else {
        console.log(`Epic #${epicIssue.number} already configured in Project 1.`);
      }
    } else {
      if (!epicIssue) {
        console.log(`[DRY RUN] Would CREATE Epic: ${firstLine}`);
      } else {
        const bodyChanged = normalizeMarkdown(epicContent) !== normalizeMarkdown(epicIssue.body);
        console.log(`[DRY RUN] Found Epic #${epicIssue.number} (bodyChanged: ${bodyChanged}, inProject: ${Boolean(epicInProject)})`);
      }
    }

    // 2. Scan and create/update user stories for this Epic
    let files = fs.readdirSync(epicDirPath).filter(f => f.endsWith('.md') && f !== epicConfig.epicFile && f !== 'PROGRESSO.md');
    if (epicConfig.storyFilter) {
      files = files.filter(epicConfig.storyFilter);
    }
    files.sort();

    for (const storyFile of files) {
      const storyPath = path.join(epicDirPath, storyFile);
      const content = fs.readFileSync(storyPath, 'utf-8');
      const titleLine = content.split(/\r?\n/)[0].replace(/^#\s*/, '').trim();

      // Extract story code (e.g. DI-01, AL-MOB-01)
      const code = extractStoryCode(titleLine);
      const meta = code ? STORY_METADATA[code] : null;

      if (!meta) {
        console.warn(`Warning: No metadata found for story code "${code}" in ${storyFile}`);
      }

      const sprintInfo = meta ? SPRINTS[meta.sprint] : { start: epicConfig.startDate, end: epicConfig.targetDate };
      const priority = meta ? meta.priority : 'P1';
      const size = meta ? meta.size : 'M';
      const estimate = meta ? meta.estimate : 5;
      const statusName = meta?.status || 'Backlog';
      const statusOptionId = FIELDS.status.options[statusName] || FIELDS.status.backlogOptionId;

      let storyIssue = findExistingIssue(titleLine, code);
      const storyInProject = storyIssue?.projectItems && storyIssue.projectItems.length > 0;

      console.log(`  -> Story: [${code}] ${titleLine}`);
      console.log(`     Sprint: ${meta ? meta.sprint : '?'} (${sprintInfo.start} to ${sprintInfo.end}) | ${priority} | ${size} (${estimate} pts) | ${statusName}`);

      if (!isDryRun) {
        if (!storyIssue) {
          console.log(`     Creating Story issue...`);
          const storyOutput = await runGh([
            'issue', 'create',
            '-R', REPO,
            '--title', titleLine,
            '--body-file', storyPath,
            '--label', 'História de Usuário',
            '--milestone', epicMilestone
          ]);
          const storyUrl = storyOutput;
          const storyNumber = storyUrl.split('/').pop();
          storyIssue = JSON.parse(await runGh(['issue', 'view', storyNumber, '-R', REPO, '--json', 'id,number,title,body,url,projectItems']));
          issuesCacheByTitle.set(titleLine.toLowerCase(), storyIssue);
          if (code) issuesCacheByCode.set(code, storyIssue);
          console.log(`     Created Story issue: #${storyIssue.number}`);
          await sleep(800);
        } else {
          console.log(`     Found existing Story issue: #${storyIssue.number}`);
          if (normalizeMarkdown(content) !== normalizeMarkdown(storyIssue.body)) {
            console.log(`     Updating body of Story #${storyIssue.number} (content changed)...`);
            await runGh(['issue', 'edit', String(storyIssue.number), '-R', REPO, '--body-file', storyPath]);
            storyIssue.body = content;
            await sleep(500);
          }
        }

        if (!storyInProject) {
          // Add story as sub-issue to Epic via GraphQL
          try {
            console.log(`     Linking as sub-issue to Epic #${epicIssue.number}...`);
            const addSubIssueMutation = `
              mutation AddSubIssue($issueId: ID!, $subIssueId: ID!) {
                addSubIssue(input: { issueId: $issueId, subIssueId: $subIssueId }) {
                  issue { id number }
                  subIssue { id number }
                }
              }
            `;
            await runGraphql(addSubIssueMutation, {
              issueId: epicIssue.id,
              subIssueId: storyIssue.id
            });
            await sleep(400);
          } catch (e) {
            console.log(`     Notice on sub-issue link: ${e.message.split('\n')[0]}`);
          }

          // Add Story to Project 1 and set all fields in 1 GraphQL batch
          console.log(`     Adding Story #${storyIssue.number} to Project 1 and setting fields...`);
          await addAndConfigureProjectItem({
            contentId: storyIssue.id,
            statusOptionId,
            priorityOptionId: FIELDS.priority.options[priority],
            sizeOptionId: FIELDS.size.options[size],
            estimate,
            startDate: sprintInfo.start,
            targetDate: sprintInfo.end
          });
        } else {
          console.log(`     Story #${storyIssue.number} already configured in Project 1.`);
        }
      } else {
        if (!storyIssue) {
          console.log(`     [DRY RUN] Would CREATE Story: ${titleLine}`);
        } else {
          const bodyChanged = normalizeMarkdown(content) !== normalizeMarkdown(storyIssue.body);
          console.log(`     [DRY RUN] Found Story #${storyIssue.number} (bodyChanged: ${bodyChanged}, inProject: ${Boolean(storyInProject)})`);
        }
      }
    }
  }

  console.log(`\n🎉 Finished ${isDryRun ? '[DRY RUN] ' : ''}process successfully! All epics, user stories, sub-issues and project fields updated.`);
}

main().catch(err => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
