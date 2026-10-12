# AC-MOB-06 Detecção de Conectividade e Aviso de Modo Offline no Mobile (ADR-014, NF004)

- **Épico**: Acesso e Autenticação do Sistema
- **Camada**: Mobile (`apps/mobile`)
- **Requisitos Funcionais**: RF002 (Autenticação), RF024 (Rastreabilidade)
- **Requisitos Não-Funcionais**: NF001 (Usabilidade), NF004 (Resiliência Operacional), NF012 (Sessão Segura)
- **ADRs Vinculadas**: ADR-014 (Resiliência Offline e Conexão Instável), ADR-022 (Monorepo), ADR-034 (Workspace Mobile Expo)

---

## 1. História de Usuário

> **Como** profissional de saúde utilizando o aplicativo móvel em áreas da UBS com oscilação ou ausência de sinal de internet (Wi-Fi ou dados móveis),  
> **quero** que o aplicativo detecte a perda de conectividade e exiba um banner informativo e não-obstrutivo em tempo real,  
> **para que** eu saiba prontamente que a comunicação com o servidor está pausada e evite disparar ações repetidas ou imaginar que o sistema travou (ADR-014, NF004).

---

## 2. Regras de Negócio e Casos de Borda

1. **Monitoramento Reativo de Conexão**:
   - O aplicativo mantém um listener ativo de estado de rede via NetInfo nativo.
   - Quando `isConnected === false` ou `isInternetReachable === false`:
     - O estado global de conectividade é alterado para `offline`.
     - Um banner superior amarelo/laranja surge suavemente na tela: *"Modo sem conexão: algumas funcionalidades da UBS requerem internet"*.
   - Quando a conexão for restabelecida (`isConnected === true`):
     - O banner transiciona para a cor verde com a mensagem *"Conexão restabelecida"* por 3 segundos e desaparece com fade-out.

2. **Comportamento Não-Bloqueante**:
   - A perda de sinal **não bloqueia** a leitura de telas locais já carregadas.
   - Botões que disparam ações exclusivamente remotas exibem um aviso contextual ao serem acionados: *"Ação indisponível sem conexão com a internet"*.

---

## 3. Contratos de Dados e Tipagens (`@farmaubs/shared`)

### 3.1 Interface de Estado de Rede
```typescript
export interface ConectividadeState {
  online: boolean;
  tipoConexao?: string; // wifi, cellular, none, unknown
}
```

---

## 3.2 Estratégia de Integração e Independência de Ciclos (Mobile ↔ Frontend Web)

- **Contra-parte no Frontend Web**: Banner de conectividade e status offline do PWA (ADR-014).
- **Contratos Compartilhados (`@farmaubs/shared`)**:
  - `ConectividadeState` em `@farmaubs/shared`.
- **Se o Frontend Web já implementou**:
  - O Mobile reutiliza a mesma convenção de estado de conectividade e textos padronizados em pt-BR de aviso de modo offline.
- **Se o Frontend Web ainda NÃO implementou**:
  - O Mobile utiliza a biblioteca nativa `@react-native-community/netinfo` mantendo a interface `ConectividadeState` compatível com a API padrão do navegador (`navigator.onLine`).

---

## 4. Critérios de Aceite Detalhados

- [ ] Detecção em tempo real de queda e restabelecimento de sinal de rede móvel/Wi-Fi.
- [ ] Exibição de banner discreto no topo da aplicação sem cobrir botões ou elementos vitais de navegação.
- [ ] Transição automática para aviso de sucesso ao reconectar e posterior desaparecimento.
- [ ] Tratamento gracioso de erros de timeout de rede em requisições à API.

---

## 5. Cenários de Teste (BDD)

```gherkin
Funcionalidade: Detecção de Conectividade no Mobile (AC-MOB-06 / ADR-014)

Cenário: 1. Queda de sinal exibe alerta de modo offline
  Dado que o usuário está navegando no aplicativo FarmaUBS conectado
  Quando o sinal de rede cai e o dispositivo perde conectividade
  Então o aplicativo exibe o banner de aviso "Modo sem conexão"
  E as telas já carregadas permanecem consultáveis

Cenário: 2. Restabelecimento de sinal remove o alerta
  Dado que o aplicativo está exibindo o aviso de modo offline
  Quando o sinal de rede volta a operar
  Então o banner exibe "Conexão restabelecida"
  E desaparece automaticamente após alguns segundos
```
