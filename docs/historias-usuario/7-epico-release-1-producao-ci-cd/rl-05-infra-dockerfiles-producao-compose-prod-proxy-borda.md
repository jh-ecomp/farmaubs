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

1. **Endurecimento do `apps/backend/Dockerfile`**:
   - Utilizar `pnpm deploy --filter=@farmaubs/backend --prod` (ou instalação filtrada de produção) no estágio final para **não** embarcar `devDependencies` (Jest, Cucumber, ESLint, TypeScript) na imagem de runtime.
   - Garantir que `dist/database/data-source.js`, `dist/database/bootstrap-prod.js` e `packages/shared/dist` estejam presentes na imagem final.
   - Configurar `USER node` (usuário não-root) no estágio `runtime` e definir `ENV TZ=America/Sao_Paulo`.
2. **Preenchimento de `infra/docker-compose.prod.yml`** (hoje vazio):
   - Consumir imagens pré-construídas via variáveis `API_IMAGE` e `FRONTEND_IMAGE` (publicadas no `ghcr.io` pelo `RL-06`), eliminando a necessidade de `docker build` na VPS.
   - **Nunca** expor a porta `5432` do PostgreSQL nem a porta `3000` da API para o host (`0.0.0.0`); apenas o serviço `frontend` expõe uma porta interna em `127.0.0.1:${FRONTEND_HOST_PORT}` (ex.: `8081` para `farmaubs-hml`, `8080` para `farmaubs-prod`) para ser consumida pelo Proxy Reverso de borda da VPS.
   - Configurar `restart: unless-stopped`, limites de memória (`mem_limit`) para evitar que `hml` afete `prod`, e rotação de logs em todos os containers:
     ```yaml
     logging:
       driver: "json-file"
       options:
         max-size: "10m"
         max-file: "5"
     ```
   - Suportar `env_file` parametrizável (`ENV_FILE`, padrão `../.env`) para que a mesma definição sirva a `farmaubs-hml` (`-p farmaubs-hml`) e `farmaubs-prod` (`-p farmaubs-prod`).
3. **Otimização do `infra/nginx/frontend.conf` (Container Frontend)**:
   - Habilitar compressão `gzip on` para HTML, CSS, JS, JSON e SVG.
   - Configurar `Cache-Control: public, max-age=31536000, immutable` para `/assets/` (arquivos com hash do Vite) e `Cache-Control: no-cache` para `/index.html`.
   - Adicionar cabeçalhos de segurança (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Robots-Tag: noindex, nofollow`).
   - Preservar o proxy `/api/` encaminhando `X-Forwarded-For`, `X-Real-IP` e `X-Forwarded-Proto`.
4. **Configuração do Proxy Reverso de Borda da VPS (`infra/proxy/Caddyfile` ou `nginx-edge.conf`)**:
   - Criar template versionado em `infra/proxy/Caddyfile` (ou `infra/proxy/nginx-edge.conf`) que escuta nas portas `80`/`443` da VPS com o Origin Certificate da Cloudflare (ou TLS automático), roteando:
     - `hml.<dominio>` → `127.0.0.1:8081` (`farmaubs-hml`)
     - `app.<dominio>` → `127.0.0.1:8080` (`farmaubs-prod`)

---

## 3. Escopo de arquivos impactados

- `apps/backend/Dockerfile`
- `apps/frontend/Dockerfile` (verificar usuário não-root / build multi-stage limpo)
- `infra/docker-compose.prod.yml`
- `infra/nginx/frontend.conf`
- `infra/proxy/Caddyfile` (ou `infra/proxy/nginx-edge.conf`)

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

- [ ] `docker build -f apps/backend/Dockerfile .` e `docker build -f apps/frontend/Dockerfile .` concluem com sucesso localmente.
- [ ] Container da API roda sob `USER node`, sobe saudável (`/api/v1/health`) e executa `pnpm migration:run:prod` com sucesso.
- [ ] `docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml config` valida sem erros.
- [ ] `infra/nginx/frontend.conf` entrega gzip, cache imutável em `/assets/` e headers de segurança.
- [ ] Template do Proxy Reverso de borda (`infra/proxy/`) documentado e pronto para uso na VPS.
