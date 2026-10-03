import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const REPO = 'jh-ecomp/farmaubs';
const PROJECT_NUMBER = 1;
const PROJECT_OWNER = 'jh-ecomp';
const MILESTONE = 'Incremento I - Pacote de funcionalidades essenciais';

// Project field IDs & Option IDs discovered from gh project field-list
const PROJECT_ID = 'PVT_kwHOAUWQz84BhUKM';
const FIELDS = {
  status: { id: 'PVTSSF_lAHOAUWQz84BhUKMzhgQU3Q', name: 'Status', backlogOptionId: 'f75ad846' },
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
  6: { start: '2026-12-21', end: '2027-01-08' }
};

// Story mapping: sprint, priority, size, estimate
const STORY_METADATA = {
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

  // Épico 3 - Recebimento
  'RE-01': { sprint: 1, priority: 'P0', size: 'L', estimate: 8 },
  'RE-02': { sprint: 1, priority: 'P1', size: 'M', estimate: 5 },
  'RE-03': { sprint: 2, priority: 'P0', size: 'L', estimate: 8 },
  'RE-04': { sprint: 2, priority: 'P2', size: 'S', estimate: 3 },
  'RE-05': { sprint: 1, priority: 'P1', size: 'M', estimate: 5 },
  'RE-06': { sprint: 2, priority: 'P1', size: 'M', estimate: 5 },
  'RE-07': { sprint: 2, priority: 'P1', size: 'M', estimate: 5 },
  'RE-08': { sprint: 3, priority: 'P2', size: 'S', estimate: 3 },

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

  // Épico 5 - Inventário Mensal
  'IN-01': { sprint: 3, priority: 'P0', size: 'L', estimate: 8 },
  'IN-02': { sprint: 3, priority: 'P1', size: 'M', estimate: 5 },
  'IN-03': { sprint: 4, priority: 'P1', size: 'M', estimate: 5 },
  'IN-04': { sprint: 4, priority: 'P0', size: 'L', estimate: 8 },
  'IN-05': { sprint: 6, priority: 'P1', size: 'M', estimate: 5 },
  'IN-06': { sprint: 6, priority: 'P1', size: 'M', estimate: 5 },
  'IN-07': { sprint: 6, priority: 'P1', size: 'M', estimate: 5 },
  'IN-08': { sprint: 6, priority: 'P2', size: 'M', estimate: 5 }
};

const EPICS = [
  {
    code: 'EP-02',
    name: 'Dispensação de Medicamentos',
    dir: '2-epico-dispensacao-de-medicamentos',
    epicFile: '2-epico-dispensacao-de-medicamentos.md',
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
    startDate: '2026-10-12',
    targetDate: '2026-11-20',
    priority: 'P0',
    size: 'XL',
    estimate: 13
  },
  {
    code: 'EP-04',
    name: 'Controle de Estoque',
    dir: '4-epico-controle-de-estoque',
    epicFile: '4-epico-controle-de-estoque.md',
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
    startDate: '2026-11-09',
    targetDate: '2027-01-08',
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
const issuesCache = new Map();

async function loadExistingIssues() {
  console.log('Loading existing repository issues into cache...');
  const out = await runGh(['issue', 'list', '-R', REPO, '--state', 'all', '--limit', '500', '--json', 'id,number,title,url,projectItems']);
  const list = JSON.parse(out);
  for (const item of list) {
    issuesCache.set(item.title.trim(), item);
  }
  console.log(`Loaded ${issuesCache.size} issues into cache.`);
}

function findExistingIssue(title) {
  return issuesCache.get(title.trim()) || null;
}

export async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`Starting ${isDryRun ? '[DRY RUN] ' : ''}GitHub import for Epics 2 to 5...`);

  if (!isDryRun) {
    await loadExistingIssues();
  }

  const baseDir = path.resolve('docs/historias-usuario');

  for (const epicConfig of EPICS) {
    const epicDirPath = path.join(baseDir, epicConfig.dir);
    const epicFilePath = path.join(epicDirPath, epicConfig.epicFile);
    const epicContent = fs.readFileSync(epicFilePath, 'utf-8');
    const firstLine = epicContent.split('\n')[0].replace(/^#\s*/, '').trim();

    console.log(`\n============================================================`);
    console.log(`Épico: ${firstLine}`);
    console.log(`Dates: ${epicConfig.startDate} -> ${epicConfig.targetDate}`);

    let epicIssue = null;

    if (!isDryRun) {
      // 1. Create or get Epic issue
      epicIssue = findExistingIssue(firstLine);
      const epicInProject = epicIssue?.projectItems && epicIssue.projectItems.length > 0;

      if (!epicIssue) {
        console.log(`Creating Epic issue...`);
        const createEpicOutput = await runGh([
          'issue', 'create',
          '-R', REPO,
          '--title', firstLine,
          '--body-file', epicFilePath,
          '--label', 'Épico',
          '--milestone', MILESTONE
        ]);
        const epicUrl = createEpicOutput;
        const epicIssueNumber = epicUrl.split('/').pop();
        epicIssue = JSON.parse(await runGh(['issue', 'view', epicIssueNumber, '-R', REPO, '--json', 'id,number,url,projectItems']));
        issuesCache.set(firstLine, epicIssue);
        console.log(`Created Epic issue: #${epicIssue.number} (${epicIssue.url})`);
        await sleep(1500);
      } else {
        console.log(`Found existing Epic issue: #${epicIssue.number} (${epicIssue.url})`);
      }

      if (!epicInProject) {
        // Add Epic to project
        console.log(`Adding Epic to Project 1...`);
        await runGh(['project', 'item-add', String(PROJECT_NUMBER), '--owner', PROJECT_OWNER, '--url', epicIssue.url]);
        await sleep(1000);

        // Set Epic project fields
        console.log(`Updating Epic project fields...`);
        await runGh(['project', 'item-edit', String(PROJECT_NUMBER), '--owner', PROJECT_OWNER, '--url', epicIssue.url, '--field', 'Status', '--single-select-option-id', FIELDS.status.backlogOptionId]);
        await sleep(500);
        await runGh(['project', 'item-edit', String(PROJECT_NUMBER), '--owner', PROJECT_OWNER, '--url', epicIssue.url, '--field', 'Priority', '--single-select-option-id', FIELDS.priority.options[epicConfig.priority]]);
        await sleep(500);
        await runGh(['project', 'item-edit', String(PROJECT_NUMBER), '--owner', PROJECT_OWNER, '--url', epicIssue.url, '--field', 'Size', '--single-select-option-id', FIELDS.size.options[epicConfig.size]]);
        await sleep(500);
        await runGh(['project', 'item-edit', String(PROJECT_NUMBER), '--owner', PROJECT_OWNER, '--url', epicIssue.url, '--field', 'Estimate', '--number', String(epicConfig.estimate)]);
        await sleep(500);
        await runGh(['project', 'item-edit', String(PROJECT_NUMBER), '--owner', PROJECT_OWNER, '--url', epicIssue.url, '--field', 'Start date', '--date', epicConfig.startDate]);
        await sleep(500);
        await runGh(['project', 'item-edit', String(PROJECT_NUMBER), '--owner', PROJECT_OWNER, '--url', epicIssue.url, '--field', 'Target date', '--date', epicConfig.targetDate]);
        await sleep(1500);
      } else {
        console.log(`Epic #${epicIssue.number} already configured in Project 1. Skipping project setup.`);
      }
    } else {
      console.log(`[DRY RUN] Would create or reuse Epic: ${firstLine}`);
    }

    // 2. Scan and create user stories for this Epic
    const files = fs.readdirSync(epicDirPath).filter(f => f.endsWith('.md') && f !== epicConfig.epicFile && f !== 'PROGRESSO.md');
    files.sort();

    for (const storyFile of files) {
      const storyPath = path.join(epicDirPath, storyFile);
      const content = fs.readFileSync(storyPath, 'utf-8');
      const titleLine = content.split('\n')[0].replace(/^#\s*/, '').trim();

      // Extract story code (e.g. DI-01)
      const codeMatch = titleLine.match(/^([A-Z]{2}-\d{2})/);
      const code = codeMatch ? codeMatch[1] : null;
      const meta = code ? STORY_METADATA[code] : null;

      if (!meta) {
        console.warn(`Warning: No metadata found for story code "${code}" in ${storyFile}`);
      }

      const sprintInfo = meta ? SPRINTS[meta.sprint] : { start: epicConfig.startDate, end: epicConfig.targetDate };
      const priority = meta ? meta.priority : 'P1';
      const size = meta ? meta.size : 'M';
      const estimate = meta ? meta.estimate : 5;

      console.log(`  -> Story: [${code}] ${titleLine}`);
      console.log(`     Sprint: ${meta ? meta.sprint : '?'} (${sprintInfo.start} to ${sprintInfo.end}) | ${priority} | ${size} (${estimate} pts)`);

      if (!isDryRun) {
        // Create or get Story Issue
        let storyIssue = findExistingIssue(titleLine);
        const storyInProject = storyIssue?.projectItems && storyIssue.projectItems.length > 0;

        if (!storyIssue) {
          console.log(`     Creating Story issue...`);
          const storyOutput = await runGh([
            'issue', 'create',
            '-R', REPO,
            '--title', titleLine,
            '--body-file', storyPath,
            '--label', 'História de Usuário',
            '--milestone', MILESTONE
          ]);
          const storyUrl = storyOutput;
          const storyNumber = storyUrl.split('/').pop();
          storyIssue = JSON.parse(await runGh(['issue', 'view', storyNumber, '-R', REPO, '--json', 'id,number,url,projectItems']));
          issuesCache.set(titleLine, storyIssue);
          console.log(`     Created Story issue: #${storyIssue.number}`);
          await sleep(1500);
        } else {
          console.log(`     Found existing Story issue: #${storyIssue.number}`);
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
            await sleep(500);
          } catch (e) {
            console.log(`     Notice on sub-issue link: ${e.message.split('\n')[0]}`);
          }

          // Add Story to Project 1
          console.log(`     Adding Story to Project 1...`);
          await runGh(['project', 'item-add', String(PROJECT_NUMBER), '--owner', PROJECT_OWNER, '--url', storyIssue.url]);
          await sleep(800);

          // Set Story project fields
          await runGh(['project', 'item-edit', String(PROJECT_NUMBER), '--owner', PROJECT_OWNER, '--url', storyIssue.url, '--field', 'Status', '--single-select-option-id', FIELDS.status.backlogOptionId]);
          await sleep(500);
          await runGh(['project', 'item-edit', String(PROJECT_NUMBER), '--owner', PROJECT_OWNER, '--url', storyIssue.url, '--field', 'Priority', '--single-select-option-id', FIELDS.priority.options[priority]]);
          await sleep(500);
          await runGh(['project', 'item-edit', String(PROJECT_NUMBER), '--owner', PROJECT_OWNER, '--url', storyIssue.url, '--field', 'Size', '--single-select-option-id', FIELDS.size.options[size]]);
          await sleep(500);
          await runGh(['project', 'item-edit', String(PROJECT_NUMBER), '--owner', PROJECT_OWNER, '--url', storyIssue.url, '--field', 'Estimate', '--number', String(estimate)]);
          await sleep(500);
          await runGh(['project', 'item-edit', String(PROJECT_NUMBER), '--owner', PROJECT_OWNER, '--url', storyIssue.url, '--field', 'Start date', '--date', sprintInfo.start]);
          await sleep(500);
          await runGh(['project', 'item-edit', String(PROJECT_NUMBER), '--owner', PROJECT_OWNER, '--url', storyIssue.url, '--field', 'Target date', '--date', sprintInfo.end]);
          await sleep(1200);
        } else {
          console.log(`     Story #${storyIssue.number} already configured in Project 1. Skipping project setup.`);
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
