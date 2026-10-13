# AC-MOB-01 Tela de Login Mobile com Validação, Feedback e Gestão de Teclado (RF002)

- **Épico**: Acesso e Autenticação do Sistema
- **Camada**: Mobile (`apps/mobile`)
- **Requisitos Funcionais**: RF002 (Autenticação de Usuários), RF025 (RBAC), RF026 (Topologia de UBS)
- **Requisitos Não-Funcionais**: NF001 (Usabilidade), NF002 (Responsividade e Ergonomia Mobile), NF003 (Idioma pt-BR), NF011 (Criptografia e Segurança), NF012 (Sessão Segura)
- **ADRs Vinculadas**: ADR-006 (Autenticação/Autorização), ADR-007 (API REST), ADR-022 (Monorepo), ADR-034 (Workspace Mobile Expo), ADR-035 (Governança Monorepo)

---

## 1. História de Usuário

> **Como** profissional de saúde, farmacêutico ou gestor em campo com dispositivo móvel,  
> **quero** realizar login no aplicativo móvel FarmaUBS através de uma tela nativa intuitiva com validação ágil, feedback visual imediato de erros ou bloqueios temporários e adaptação ergonômica de teclado,  
> **para que** eu acesse o sistema de forma segura, rápida e sem atritos operacionais no atendimento às UBSs de Parnaíba-PI (RF002, NF001, NF002).

---

## 2. Regras de Negócio e Casos de Borda

1. **Validação Client-side e Ergonomia de Digitação (NF001, NF002, NF003)**:
   - Os campos de **E-mail Institucional** e **Senha** são de preenchimento obrigatório.
   - O e-mail deve obedecer a formato válido antes de qualquer disparo à rede.
   - Configurações nativas de teclado obrigatórias:
     - E-mail: `keyboardType="email-address"`, `autoCapitalize="none"`, `autoCorrect={false}`.
     - Senha: `secureTextEntry={true}`, com suporte a alternância visual (ícone de olho para exibir/ocultar senha).
   - O container da tela deve utilizar `<KeyboardAvoidingView>` (`behavior="padding"` no iOS e `"height"` no Android) e `<ScrollView>` com `keyboardShouldPersistTaps="handled"` para que o teclado não obstrua os campos nem o botão de ação.

2. **Fluxo de Submissão e Estado de Carregamento (Loading State)**:
   - Ao tocar em "Acessar Sistema", o botão entra em estado de carregamento (`<ActivityIndicator>`), o texto do botão é ocultado e a interação de toque é desabilitada para prevenir submissões duplicadas concorrentes.
   - O payload enviado ao endpoint `POST /api/v1/auth/login` segue rigorosamente a interface `LoginRequest` compartilhada de `@farmaubs/shared`.

3. **Tratamento Anti-Enumeração e Respostas de Erro (RF002, NF011)**:
   - **401 Unauthorized / Credenciais Inválidas**: O aplicativo exibe uma mensagem genérica amigável ("E-mail ou senha incorretos.") em uma caixa de alerta visual vermelha com ícone e borda, sem revelar se o e-mail existe no banco de dados.
   - **423 Locked / Conta Bloqueada (5 falhas)**: Caso a conta esteja suspensa temporariamente, a API retorna `minutosRestantes`. O app exibe: *"Conta temporariamente bloqueada. Tente novamente em X minutos."* e impede novas tentativas enquanto o contador estiver ativo.
   - **Indisponibilidade de Conexão (Rede/Offline)**: Em caso de falha de conexão com a API ou timeout, o app exibe: *"Falha de conexão com o servidor da UBS. Verifique sua rede e tente novamente."*.

4. **Persistência de Sessão Segura e Navegação Pós-Login (ADR-034, RF002)**:
   - Ao receber `LoginResponseDto` com sucesso:
     - O token JWT e o objeto `usuario` (`UsuarioAutenticado`) são gravados de forma criptografada na Keystore/Keychain do aparelho via `sessionService` (`expo-secure-store`).
     - Se `usuario.deveTrocarSenha === true`: o aplicativo redireciona compulsoriamente para a tela de **Troca Obrigatória de Senha** (`/trocar-senha`, AC-MOB-04).
     - Se `usuario.deveTrocarSenha === false`: redireciona para a tela inicial operacional (**Dashboard**).

---

## 3. Contratos de Dados e Tipagens (`@farmaubs/shared`)

### 3.1 Rotas Utilizadas
- Endpoint de Autenticação: `POST /api/v1/auth/login`
- Formato de envio: `Content-Type: application/json`

### 3.2 Tipagens Compartilhadas Consumidas

```typescript
// Contrato de Requisição (Request DTO - @farmaubs/shared)
export interface LoginRequest {
  email: string;
  senha: string;
}

// Resposta com Sucesso (Response DTO - @farmaubs/shared)
export interface LoginResponseDto {
  token?: string;
  expiresAt: string;
  ttlSeconds: number;
  warningSeconds: number;
  usuario: UsuarioAutenticado;
  redirectUrl: string;
}

// Objeto de Usuário Autenticado
export interface UsuarioAutenticado {
  id: string;
  nomeCompleto: string;
  email: string;
  perfilCodigo: PerfilCodigo;
  municipioId: string;
  unidadeIds: string[];
  deveTrocarSenha: boolean;
}
```

---

## 3.3 Estratégia de Integração e Independência de Ciclos (Mobile ↔ Frontend Web)

- **Contra-parte no Frontend Web**: `AC-16` (Tela de login com validação e feedback de erro).
- **Contratos Compartilhados (`@farmaubs/shared`)**:
  - `LoginRequest`, `LoginResponseDto` e `UsuarioAutenticado` em `packages/shared/src/acesso/login.types.ts`.
  - Validador de formato de e-mail institucional e regras de tamanho mínimo de senha.
- **Se o Frontend Web já implementou AC-16**:
  - O Mobile reutiliza diretamente os contratos DTOs de `@farmaubs/shared` e os helpers de validação de e-mail já existentes.
  - Alinha as mensagens de erro (anti-enumeração e conta bloqueada) para garantir que a experiência do usuário seja consistente em ambas as plataformas.
- **Se o Frontend Web ainda NÃO implementou AC-16**:
  - O desenvolvedor Mobile define ou enriquece as tipagens em `packages/shared/src/acesso/login.types.ts` e exporta no `packages/shared/src/index.ts`.
  - O Mobile não depende de nenhum arquivo ou estilo do `apps/frontend`, criando sua própria UI em React Native com as mesmas interfaces de dados.

---

## 4. Critérios de Aceite Detalhados

- [ ] A tela de login é a porta de entrada não autenticada do `apps/mobile`, renderizada com SafeAreaView e layout responsivo nas dimensões de aparelhos móveis comuns (360dp a 430dp de largura).
- [ ] O formulário contém os campos "E-mail institucional" e "Senha", com placeholders informativos e validações client-side em Português do Brasil.
- [ ] O teclado virtual não sobrepõe os campos de entrada nem o botão de login em qualquer densidade de tela.
- [ ] Disparo de mutação de login para `POST /api/v1/auth/login` com tipagem estrita de `LoginRequest`.
- [ ] Exibição de indicador de progresso no botão durante o trânsito da requisição, bloqueando cliques adicionais.
- [ ] Feedback acessível e destacado em caso de credenciais inválidas, bloqueio temporário por tentativas (com minutos restantes) e falhas de rede.
- [ ] Login aprovado salva a sessão via `expo-secure-store` e navega corretamente de acordo com o estado de `deveTrocarSenha`.

---

## 5. Cenários de Teste (BDD)

```gherkin
Funcionalidade: Tela de Login Mobile (AC-MOB-01 / RF002)

Contexto:
  Dado que o aplicativo móvel FarmaUBS está aberto na tela de login
  E a URL base da API está devidamente configurada

Cenário: 1. Login com credenciais válidas e navegação ao Dashboard
  Quando o usuário preencher o e-mail "farmaceutico@ubs.gov.br"
  E preencher a senha "SenhaForte@2026"
  E tocar no botão "Acessar Sistema"
  Então o botão exibe o indicador de carregamento nativo e fica desabilitado
  E a API responde 200 OK com token JWT e dados do usuário
  E os dados de sessão são persistidos de forma segura no SecureStore
  E o aplicativo transiciona para o Dashboard principal da UBS

Cenário: 2. Primeiro acesso com senha temporária redireciona para troca de senha
  Quando o usuário com flag "deveTrocarSenha: true" submeter o login com sucesso
  Então os dados de sessão são gravados no SecureStore
  E o aplicativo redireciona compulsoriamente para o fluxo de Troca de Senha
  E impede a navegação para qualquer outra área do app

Cenário: 3. Submissão com campos obrigatórios vazios (validação client-side)
  Quando o usuário tocar no botão "Acessar Sistema" sem preencher e-mail ou senha
  Então o formulário bloqueia o envio da requisição à rede
  E exibe a mensagem de validação "Informe o e-mail e a senha de acesso."

Cenário: 4. E-mail ou senha incorretos (anti-enumeração)
  Quando o usuário informar credenciais divergentes das cadastradas
  E submeter o formulário
  Então a API retorna status 401 Unauthorized
  E o aplicativo renderiza a mensagem "E-mail ou senha incorretos."
  E os campos permanecem editáveis preservando o e-mail preenchido

Cenário: 5. Bloqueio de conta por exceder tentativas máximas
  Dado que o usuário errou a senha 5 vezes consecutivas
  Quando tentar realizar uma nova submissão
  Então a API retorna status 423 Locked informando 15 minutos restantes
  E o aplicativo exibe o aviso "Conta temporariamente bloqueada. Tente novamente em 15 minutos."
  E nenhuma credencial é salva no dispositivo

Cenário: 6. Falha de rede ou servidor indisponível
  Dado que o dispositivo móvel está sem conexão com a internet
  Quando o usuário tentar realizar o login
  Então o aplicativo exibe "Falha de conexão com o servidor da UBS. Verifique sua rede e tente novamente."
  E o botão de login é reabilitado para nova tentativa
```
