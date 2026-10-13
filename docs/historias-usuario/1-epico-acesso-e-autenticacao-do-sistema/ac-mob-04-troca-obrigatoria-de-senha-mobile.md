# AC-MOB-04 Fluxo de Troca Obrigatória de Senha Provisória no Mobile (RF003, NF011)

- **Épico**: Acesso e Autenticação do Sistema
- **Camada**: Mobile (`apps/mobile`)
- **Requisitos Funcionais**: RF003 (Recuperação e Troca de Senha), RF025 (Controle de Acesso RBAC)
- **Requisitos Não-Funcionais**: NF001 (Usabilidade), NF002 (Ergonomia Mobile), NF011 (Complexidade Criptográfica e Segurança)
- **ADRs Vinculadas**: ADR-006 (Autenticação/Autorização), ADR-011 (Frontend), ADR-022 (Monorepo), ADR-034 (Workspace Mobile Expo)

---

## 1. História de Usuário

> **Como** novo usuário do FarmaUBS autenticado pela primeira vez com senha provisória,  
> **quero** ser direcionado compulsoriamente a uma tela mobile de redefinição de senha com checklist visual de segurança em tempo real,  
> **para que** eu cadastre uma senha pessoal forte e definitiva antes de ter acesso a qualquer operação no celular (RF003, NF011).

---

## 2. Regras de Negócio e Casos de Borda

1. **Bloqueio Compulsório de Navegação**:
   - Se o login retornar `deveTrocarSenha: true`, o aplicativo entra no modo de guarda de troca obrigatória.
   - O botão físico ou gesto de "Voltar" do Android (`BackHandler`) e os menus de navegação ficam desabilitados enquanto a senha não for alterada com sucesso.

2. **Requisitos de Complexidade de Senha Forte (NF011)**:
   - Mínimo de 8 caracteres.
   - Pelo menos 1 caractere maiúsculo (`[A-Z]`).
   - Pelo menos 1 caractere minúsculo (`[a-z]`).
   - Pelo menos 1 dígito numérico (`[0-9]`).
   - Pelo menos 1 caractere especial (`[^a-zA-Z0-9]`).

3. **Validação Visual Dinâmica (Checklist de Segurança)**:
   - A tela exibe um painel de critérios abaixo do campo de senha. À medida que o usuário digita, os itens mudam de estado:
     - ⚪ Não atendido (cinza)
     - 🟢 Atendido (verde com ícone de confirmação)
   - Validação de confirmação: o campo "Confirmar nova senha" deve ser exatamente igual ao campo "Nova senha". Caso contrário, exibe o aviso: *"As senhas não coincidem"*.

4. **Submissão e Atualização de Sessão**:
   - Ao submeter para `POST /api/v1/auth/trocar-senha` com o payload `{ novaSenha, confirmacaoSenha }`:
     - O botão entra em loading.
     - A API persiste o novo hash bcrypt (custo 12) e seta `deveTrocarSenha = false`.
     - O app atualiza o objeto salvo no `sessionService`, limpa a flag local e exibe um modal ou toast de parabéns: *"Senha alterada com sucesso!"*.
     - Redireciona o usuário para o Dashboard principal.

---

## 3. Contratos de Dados e Tipagens (`@farmaubs/shared`)

### 3.1 Rotas Utilizadas
- Endpoint: `POST /api/v1/auth/trocar-senha`
- Cabeçalho: `Authorization: Bearer <token>`

### 3.2 Tipagens Compartilhadas
```typescript
import type { TrocarSenhaComando, TrocarSenhaResultado } from "@farmaubs/shared";

export interface TrocarSenhaMobileState {
  novaSenha: string;
  confirmacaoSenha: string;
  submetendo: boolean;
  erro?: string;
}
```

---

## 3.3 Estratégia de Integração e Independência de Ciclos (Mobile ↔ Frontend Web)

- **Contra-parte no Frontend Web**: `AC-24` (Fluxo de redefinição administrativa e tela de troca obrigatória de senha).
- **Contratos Compartilhados (`@farmaubs/shared`)**:
  - `TrocarSenhaComando` e `TrocarSenhaResultado` em `@farmaubs/shared`.
  - Regras comuns de força de senha (mínimo de 8 caracteres, complexidade).
- **Se o Frontend Web já implementou AC-24**:
  - O Mobile reutiliza os mesmos DTOs de comando, endpoint `POST /api/v1/auth/trocar-senha` e regras de validação client-side já consolidados.
- **Se o Frontend Web ainda NÃO implementou AC-24**:
  - O time Mobile exporta a interface `TrocarSenhaComando` e tipos de resposta em `@farmaubs/shared`, garantindo alinhamento prévio do contrato para quando a tela web for construída.

---

## 4. Critérios de Aceite Detalhados

- [ ] Redirecionamento compulsório para `/trocar-senha` sempre que `deveTrocarSenha: true`.
- [ ] Formulário com suporte a visualização de senha (ícone de alternância de texto protegido).
- [ ] Validador de complexidade dinâmico com regras de NF011 em tempo real.
- [ ] Bloqueio de submissão enquanto os requisitos ou confirmação de senha não forem atendidos.
- [ ] Conclusão com sucesso atualiza o status de sessão e libera a navegação irrestrita ao app.

---

## 5. Cenários de Teste (BDD)

```gherkin
Funcionalidade: Troca Obrigatória de Senha no Mobile (AC-MOB-04)

Cenário: 1. Direcionamento compulsório no primeiro acesso
  Dado que o usuário efetuou login e possui "deveTrocarSenha = true"
  Quando o aplicativo processa a resposta
  Então abre a tela de Troca Obrigatória de Senha
  E o botão de voltar do dispositivo é interceptado mantendo o usuário na tela

Cenário: 2. Digitação de senha fraca mantém botão desabilitado
  Dado que o usuário está na tela de troca obrigatória
  Quando digita "senha123" no campo nova senha
  Então o indicador de caractere maiúsculo permanece pendente
  E o indicador de caractere especial permanece pendente
  E o botão de confirmação permanece desabilitado

Cenário: 3. Sucesso na alteração da senha definitiva
  Dado que o usuário digitou uma senha que atende a todos os critérios de NF011
  E confirmou a mesma senha no campo de confirmação
  Quando pressiona "Salvar Nova Senha"
  Então a requisição é enviada com sucesso para a API
  E a flag deveTrocarSenha é atualizada para false
  E o usuário é encaminhado para o Dashboard principal da UBS
```
