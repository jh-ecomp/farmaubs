# RL-05 feat(infra): Dockerfiles Endurecidos, `docker-compose.prod.yml` e Proxy Reverso de Borda

---

- **Épico**: Release 1 — Prontidão para Produção, CI/CD e Infraestrutura
- **Requisitos Não-Funcionais**: NF004 (Disponibilidade 99,5%), NF007 (Desempenho com compressão e cache de assets), NF010 (Isolamento de rede e cabeçalhos de segurança)
- **ADRs Vinculadas**: ADR-021 (VPS + Docker Compose), ADR-023 (Containerização), ADR-025 (Stacks isoladas `farmaubs-hml` e `farmaubs-prod`), ADR-026 (Rotação de logs Docker)

---

## 1. História de usuário

> **Como** responsável pela implantação do FarmaUBS na VPS,  
> **quero** imagens Docker de produção enxutas e executando sem privilégios de `root`, um arquivo `infra/docker-compose.prod.yml` completo com limites de recursos e rotação de logs, e um proxy reverso de borda único na VPS para rotear HTTPS para os ambientes `hml` e `prod`,  
> **para que** ambos os ambientes convivam com segurança e previsibilidade na mesma máquina sem conflito de portas, sem vazar a porta do PostgreSQL e sem risco de os logs do Docker lotarem o disco.

---

## 2. Regras de negócio e requisitos técnicos

1. **Endurecimento do `apps/backend/Dockerfile` e Alinhamento de Node**:
   - Utilizar `pnpm deploy --filter=@farmaubs/backend --prod` (ou instalação filtrada de produção) no estágio final para **não** embarcar `devDependencies` (Jest, Cucumber, ESLint, TypeScript) na imagem de runtime, alinhando Node 22 LTS entre Dockerfiles e `.moon/toolchain.yml`.
   - Garantir que `dist/database/data-source.js`, `dist/database/bootstrap-prod.js`, `dist/database/seed-qa.js` e `packages/shared/dist` estejam presentes na imagem final, além de diretório `./storage/reports` gravável pelo usuário `node`.
   - Configurar `USER node` (usuário não-root) no estágio `runtime` e definir `ENV TZ=America/Sao_Paulo`.
2. **Ajuste de `infra/docker-compose.yml` e Preenchimento de `infra/docker-compose.prod.yml`**:
   - Em `infra/docker-compose.yml`, substituir `env_file: ../.env` fixo por `env_file: ${ENV_FILE:-../.env}` (pois o Docker Compose concatena listas de `env_file` em overrides e falharia na VPS caso `../.env` não existisse).
   - Em `infra/docker-compose.prod.yml` (hoje vazio), consumir imagens pré-construídas via variáveis `API_IMAGE` e `FRONTEND_IMAGE` (publicadas no `ghcr.io` pelo `RL-06`), eliminando `docker build` na VPS, e manter o bind `./db/init:/docker-entrypoint-initdb.d:ro` para criação automática da role `farmaubs_app` no primeiro boot do volume PostgreSQL.
   - **Regra crítica Docker + UFW:** **nunca** expor `5432` (PostgreSQL) nem `3000` (API) no host, e publicar o `frontend` **estritamente em loopback** `127.0.0.1:${FRONTEND_HOST_PORT:-8080}:80` (`8081` para `farmaubs-hml`, `8080` para `farmaubs-prod`) — jamais `0.0.0.0:PORT`, que contorna o `UFW` via `iptables` do Docker.
   - Configurar `restart: unless-stopped`, limites de memória (`mem_limit`) para evitar que `hml` afete `prod`, e rotação de logs em todos os containers:
     ```yaml
     logging:
       driver: "json-file"
       options:
         max-size: "10m"
         max-file: "5"
     ```
3. **Otimização do `infra/nginx/frontend.conf` (Container Frontend — Preservação de Cabeçalhos Multi-Hop)**:
   - Habilitar compressão `gzip on` para HTML, CSS, JS, JSON e SVG.
   - Configurar `Cache-Control: public, max-age=31536000, immutable` para `/assets/` (arquivos com hash do Vite) e `Cache-Control: no-cache` para `/index.html`.
   - Adicionar cabeçalhos de segurança (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Robots-Tag: noindex, nofollow`).
   - **Correção obrigatória no `location /api/`:** como o Caddy de borda conversa com o container Nginx por HTTP (`127.0.0.1:8080`), **não** usar `proxy_set_header X-Forwarded-Proto $scheme;` puro (que sobrescreveria `https` com `http`); usar `map $http_x_forwarded_proto $forwarded_proto { default $http_x_forwarded_proto; "" $scheme; }` repassando `X-Forwarded-Proto $forwarded_proto`, `X-Forwarded-For $proxy_add_x_forwarded_for` e `CF-Connecting-IP $http_cf_connecting_ip`.
4. **Configuração do Proxy Reverso de Borda da VPS (`infra/proxy/Caddyfile`)**:
   - Criar template versionado em `infra/proxy/Caddyfile` escutando nas portas `80`/`443` da VPS com o Origin Certificate da Cloudflare (`/etc/caddy/certs/origin.pem` e `/etc/caddy/certs/origin.key` com dono `root:caddy` e `chmod 640`, garantindo leitura pelo usuário `caddy` do systemd), roteando:
     - `hml.<dominio>` → `127.0.0.1:8081` (`farmaubs-hml`)
     - `app.<dominio>` → `127.0.0.1:8080` (`farmaubs-prod`)

---

## 3. Escopo de arquivos impactados

- `.moon/toolchain.yml` (alinhar Node 22 LTS com os Dockerfiles)
- `apps/backend/Dockerfile`
- `apps/frontend/Dockerfile` (verificar build multi-stage limpo)
- `infra/docker-compose.yml` (`env_file: ${ENV_FILE:-../.env}`)
- `infra/docker-compose.prod.yml`
- `infra/nginx/frontend.conf`
- `infra/proxy/Caddyfile` (novo)

---

## 4. Cenários de validação técnica (BDD)

```gherkin
# language: pt
Funcionalidade: Containers de Produção Endurecidos e Isolamento de Stacks

  Cenário: Imagem de produção da API executa sem privilégios de root e sem devDependencies
    Dado que a imagem Docker "farmaubs-api" foi construída a partir de "apps/backend/Dockerfile"
    Quando inspecionarmos o usuário do processo ("whoami") dentro do container
    Então o usuário deve ser "node" e o pacote "jest" não deve estar presente em "node_modules"

  Cenário: Stack de produção sobe isolada sem expor porta do PostgreSQL
    Dado que o arquivo "infra/docker-compose.prod.yml" é validado com "docker compose config"
    Quando verificarmos o mapeamento de portas dos serviços "postgres" e "api"
    Então nenhum deles deve publicar portas externas no host
    E todos os serviços devem possuir política "restart: unless-stopped" e driver de log com rotação
```

---

## 5. Checklist de DoD e aceitação

- [x] `docker build -f apps/backend/Dockerfile .` e `docker build -f apps/frontend/Dockerfile .` concluem com sucesso localmente.
- [x] Container da API roda sob `USER node`, sobe saudável (`/api/v1/health`) e executa `node ./node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js` com sucesso sem depender de `pnpm`.
- [x] `docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml config` valida sem erros.
- [x] `infra/nginx/frontend.conf` entrega gzip, cache imutável em `/assets/` e headers de segurança.
- [x] Template do Proxy Reverso de borda (`infra/proxy/`) documentado e pronto para uso na VPS.
