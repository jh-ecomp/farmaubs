set. 29, 2026

## **Reunião em 29 de set. de 2026 às 16:00 GMT-03:00**

Registros da reunião [Transcrição](https://docs.google.com/document/d/132KIIWVBuljJAhw_M6yyFlFnkc6IMjJShQX64s9Ssa4/edit?usp=drive_web&tab=t.9aotlre03kll) [Gravação](https://drive.google.com/file/d/1SXtKQ4m18ryIOauvMUP5Q3ttv1Pm7wjk/view?usp=drive_web) 

### **Resumo**

Reunião discutiu protótipo para farmácias com testes e funcionalidades validadas.

**Apresentação e Protótipo Inicial**  
Demonstração focou em substituir planilhas manuais. Identificou-se necessidade de rastreio de pacientes para uso contínuo.

**Gestão e Estoque**  
Validou-se recebimento de insumos e relatórios mensais. Decidiu-se obrigar identificação do paciente para medicamentos contínuos.

### **Decisões**

## **Precisa de mais conversa**

* **Viabilidade da leitura por código de barras** A implementação da leitura por código de barras (bip) para dispensação e recebimento ficou condicionada à validação de viabilidade técnica e escopo do projeto.  
* **Alertas para medicamentos de índice terapêutico curto** A inclusão de alertas para medicamentos de índice terapêutico curto ficou pendente do fornecimento de uma lista específica pelos farmacêuticos.

## **Alinhada**

* **Obrigatoriedade de dados do paciente e histórico** O sistema deve registrar o histórico de consumo por paciente e tornar os campos de identificação obrigatórios para medicamentos de uso contínuo.  
* **Sugestão e seleção de lotes na dispensação** O sistema deve sugerir o lote com vencimento mais próximo na dispensação, permitindo ao usuário alterá-lo ou selecioná-lo a partir de uma lista.  
* **Tratamento individualizado das entradas de estoque** O módulo de recebimento deve registrar cada medicamento e fabricante de forma individualizada, contendo campos para apresentação, lote, validade e número de guia estruturado.  
* **Exportação de dados de estoque por período** O sistema deve implementar a funcionalidade de exportação de relatórios de entradas, saídas e estoque atual baseada em um intervalo de datas definido pelo usuário.  
* **Inclusão de categoria 'outro' para divergências** O sistema incluirá uma opção de justificativa "outro" com campo descritivo livre para registro de divergências no inventário mensal.  
* **Registro de data de emissão para antimicrobianos** O sistema registrará a data de emissão da receita para medicamentos antimicrobianos a fim de controlar o prazo de validade.  
* **Escopo do sistema focado na atenção básica** O escopo inicial do sistema foi definido para a atenção básica (UBS), dispensando numeração para receitas brancas.

### **Próximas etapas**

- [ ] \[A equipe de desenvolvimento\] Implementar histórico do paciente: Desenvolver a funcionalidade de histórico de pacientes permitindo a pesquisa por nome, CPF ou cartão do SUS para identificar o consumo e evitar o uso irracional de medicamentos.  
- [ ] \[A equipe de desenvolvimento\] Obrigatoriedade de dados: Configurar os campos de identificação do paciente como obrigatórios para dispensações de medicamentos de uso contínuo.  
- [ ] \[A equipe de desenvolvimento\] Adicionar campos e leitor de barras: Incluir o campo de fabricante nas telas de recebimento e adicionar a possibilidade de leitura de código de barras para agilizar a entrada e a dispensação de itens.  
- [ ] \[A equipe de desenvolvimento\] Exportar relatórios: Desenvolver filtros para exportação de dados baseados em intervalos de datas e princípios ativos para apoiar o planejamento do pedido mensal das unidades.  
- [ ] \[O grupo\] Fornecer exemplos de guias: Enviar exemplos reais do formato utilizado em guias e notas fiscais para permitir a validação e padronização dos campos no sistema.  
- [ ] \[A equipe de desenvolvimento\] Permitir edição de lote: Implementar uma lista de seleção que permita ao farmacêutico confirmar ou alterar manualmente o lote sugerido pelo sistema durante o processo de dispensação.  
- [ ] \[João Henrique\] Adicionar Filtro de Validade: Adicionar um campo de filtro para validade de medicamentos na tela de estoque, permitindo a visualização dos itens que vencem no mês corrente.  
- [ ] \[João Henrique\] Adicionar Justificativa: Adicionar uma opção de justificativa chamada Outros com um campo de texto descritivo para casos de divergência no inventário mensal.  
- [ ] \[João Henrique\] Registrar Receita: Incluir o registro da data de emissão da receita no sistema para medicamentos antimicrobianos.  
- [ ] \[Bruno Santana\] Listar Medicamentos Críticos: Fornecer uma lista de medicamentos que exigem cuidado redobrado do farmacêutico para implementação de alertas no sistema.

### **Detalhes**

* **Apresentação do Projeto Farm UBS e Objetivo do Teste**: João Henrique explicou que o Farm UBS é um projeto de extensão do Instituto Federal iniciado no semestre passado para substituir as planilhas manuais usadas nas farmácias das Unidades Básicas de Saúde (UBS) ([00:00:04](#00:00:04)). O objetivo da reunião atual foi coletar feedback prático da equipe de saúde sobre um protótipo funcional desenvolvido, verificando se atende às necessidades operacionais e se a interface é intuitiva ([00:01:17](#00:01:17)).  
* **Acesso ao Protótipo e Exploração Inicial**: Kauan almeida enviou um arquivo compactado contendo o protótipo via link no chat, instruindo os participantes a extraí-lo e abri-lo através do arquivo \`login.html\` no navegador ([00:02:38](#00:02:38)). Diante de dificuldades técnicas de Bruno Santana com o computador, FRANCISCA BEATRIZ DE MELO SOUSA compartilhou a tela para realizar uma exploração livre do sistema sem instruções prévias, avaliando visualmente as funcionalidades disponíveis ([00:04:31](#00:04:31)).  
* **Navegação pela Dispensação, Inventário e Estoque**: FRANCISCA BEATRIZ DE MELO SOUSA explorou a tela inicial de dispensação, o inventário físico (onde é possível visualizar itens com avaria ou falta e editar contagens) e o recebimento de estoque ([00:12:11](#00:12:11)) ([00:21:37](#00:21:37)). FRANCISCA apontou a falta de um mecanismo para retenção de receitas, e Guilherme (via chat) junto com Bruno Santana comentou sobre a importância de rastrear o histórico de dispensação por usuário ([00:20:26](#00:20:26)) ([00:32:54](#00:32:54)).  
* **Visão Geral e Alinhamento do Layout Principal**: João Henrique apresentou a interface principal do sistema após o login, destacando que as credenciais e redefinições de senha devem ser solicitadas exclusivamente à administração ([00:27:01](#00:27:01)). A tela centraliza as operações diárias — dispensação, recebimento, estoque atual e inventário mensal — com a meta de substituir o Excel e o Google Sheets por uma ferramenta personalizada para o farmacêutico ([00:28:02](#00:28:02)).  
* **Fluxo e Detalhes da Tela de Dispensação**: João Henrique demonstrou o processo de dispensação, onde o sistema sugere automaticamente o lote com vencimento mais próximo, registrando a quantidade em comprimidos, posologia opcional e cartão do SUS opcional ([00:30:25](#00:30:25)). Foram simuladas dispensações de medicamentos como paracetamol, amoxicilina e losartana, cujos registros aparecem imediatamente na lista de últimas dispensas realizadas ([00:31:29](#00:31:29)).  
* **Histórico do Paciente e Obrigatoriedade de Dados**: Bruno Santana e João Pedro Carvalho argumentaram que consultar o histórico do paciente por nome, CPF ou cartão do SUS é essencial para evitar o uso irracional de medicamentos antes de completar o ciclo de 30 dias ([00:32:54](#00:32:54)). Concluiu-se que, para medicamentos de uso contínuo, os campos de identificação do paciente deixarão de ser opcionais e passarão a ser obrigatórios para garantir o rastreio ([00:35:28](#00:35:28)).  
* **Gerenciamento de Lotes e Quantidades por Embalagem**: João Henrique questionou sobre a flexibilidade de alterar o lote sugerido pelo sistema caso haja algum lote aberto prioritário, o que Bruno Santana confirmou ser vantajoso ([00:38:27](#00:38:27)). Sobre as quantidades, Bruno explicou que os profissionais dispensam blisters inteiros (cartelas) em vez de cortar embalagens (exceto para antibióticos mais rigorosos), registrando a quantidade exata de comprimidos conforme a apresentação do fabricante ([00:41:16](#00:41:16)).  
* **Implementação de Leitor de Código de Barras**: Bruno Santana sugeriu a utilização de um leitor de código de barras para agilizar o processo e controlar fabricantes e lotes diferentes ([00:44:04](#00:44:04)). João Henrique confirmou que a equipe validará a viabilidade de integrar a leitura por código de barras tanto na dispensação quanto no recebimento de insumos para identificar automaticamente o medicamento e sua apresentação padrão ([00:45:19](#00:45:19)).  
* **Ajustes na Tela de Recebimento de Medicamentos**: João Henrique apresentou a tela de recebimento e discutiu com Bruno Santana a necessidade de incluir campos específicos para o fabricante, a apresentação completa (quantidade por blister/frasco), número do lote, validade e quantidade recebida ([00:47:56](#00:47:56)). Concordou-se que cada medicamento deve entrar individualmente associado ao número da nota fiscal ou guia de entrega (no formato de módulo e mês, sugerido por Bruno como \`mod 06 2908 2026\`) ([00:50:31](#00:50:31)).  
* **Relatórios de Saída e Períodos para Pedido Mensal**: Bruno Santana e João Pedro Carvalho destacaram que, além do controle básico de entradas e saídas, o sistema precisa permitir a seleção de intervalos de datas específicos (por exemplo, do dia 25 do mês anterior ao dia 25 do atual) para gerar relatórios de consumo essenciais para o envio do pedido mensal ([00:54:43](#00:54:43)). João Henrique reconheceu a demanda e confirmou que a exportação desses dados baseados em limites de datas, pacientes ou princípios ativos será implementada ([00:56:01](#00:56:01)).  
* **Visão geral do estoque e alertas de nível baixo**: João Henrique apresentou uma tela de visualização geral do estado do estoque da farmácia. O problema abordado foi a necessidade de monitorar se o nível de estoque está saudável para a operação. Foi discutido que o sistema calcula automaticamente os dados e emite alertas quando o estoque está baixo e distante de uma nova remessa. kauan almeida solicitou a inclusão de um ícone de informação na interface e abriu espaço para o feedback do grupo ([00:58:54](#00:58:54)).  
* **Filtro de validade e identificação visual de vencimento**: Após transicionar para a próxima tela com a colaboração de Ivo Bruno Araujo, João Henrique sugeriu a implementação de um filtro de validade para consultar os medicamentos que vencem no mês corrente. kauan almeida propôs como melhoria visual que os itens mais próximos do vencimento sejam destacados na cor laranja em vez do verde padrão ([01:01:12](#01:01:12)).  
* **Conferência mensal de inventário e registro de divergências**: João Henrique apresentou a tela de conferência mensal do estoque real com o sistema ([01:01:12](#01:01:12)). Usando como exemplo o medicamento atenol — onde o sistema registrava 90 unidades e a conferência física revelou 30 —, elus demonstraram que uma divergência de 60 unidades exige obrigatoriamente a seleção de uma justificativa, como "validade vencida" ([01:03:20](#01:03:20)). Bruno Santana e kauan almeida participaram da discussão sobre os procedimentos aplicáveis a esses casos ([01:05:02](#01:05:02)).  
* **Detalhes de lotes e registro de divergências por entregas externas**: Bruno Santana solicitou a inclusão de uma opção "outro" com um campo de descrição livre nas justificativas de divergência ([01:05:02](#01:05:02)). Bruno Santana explicou que ocorrem divergências quando os entregadores deixam os pedidos mensais sem aguardar a conferência física, gerando discrepâncias entre a nota fiscal e o registro do sistema ([01:06:32](#01:06:32)). João Henrique confirmou que é possível selecionar lotes e fabricantes específicos, e que o código de barras abrangerá as diferentes apresentações dos medicamentos ([01:05:02](#01:05:02)).  
* **Rascunho, homologação do inventário e planejamento futuro**: O processo de inventário é registrado item a item em um rascunho, permitindo que a pessoa usuária faça a homologação e a impressão do inventário mensal após a conferência de todos os medicamentos. João Henrique esclareceu que as funções de exportação de dispensação e recebimento, bem como o planejamento, serão entregues apenas no próximo semestre ([01:08:05](#01:08:05)).  
* **Data de emissão da receita para antimicrobianos**: Bruno Santana sugeriu a inclusão obrigatória da data de emissão da receita para medicamentos antimicrobianos, argumentando que a receita perde a validade após o prazo de 10 dias ([01:08:05](#01:08:05)). João Henrique anotou a necessidade de registrar a data de emissão ao selecionar o medicamento específico ([01:09:36](#01:09:36)).  
* **Escopo do sistema para atenção básica e receitas brancas**: Bruno Santana questionou se o programa era destinado apenas à atenção básica, e João Henrique confirmou que o foco atual é a operação das Unidades Básicas de Saúde (UBS). Bruno Santana concordou que não há problemas operacionais com a ausência de numeração nas receitas, pois o sistema utiliza apenas receitas brancas e não psicotrópicos, embora João Henrique tenha mencionado uma possível expansão futura para UPAs e hospitais ([01:09:36](#01:09:36)).  
* **Alertas para medicamentos de índice terapêutico curto**: Bruno Santana apontou a necessidade de avisos para medicamentos de índice terapêutico curto (autovigilância), que possuem tarja vermelha em ambientes hospitalares, para que a equipe farmacêutica verifique a dosagem correta. João Henrique afirmou que esse alerta é de fácil implementação, especialmente com a leitura por código de barras, desde que recebam uma lista com os medicamentos que exigem esse cuidado redobrado ([01:10:52](#01:10:52)).  
* **Previsão de entrega, substituição de planilhas e versão móvel**: João Henrique concluiu que essas funcionalidades compõem a primeira entrega prevista para o final do semestre, com a qual elus acreditam ser possível substituir as planilhas atuais ([01:10:52](#01:10:52)). Elus também mencionaram que estão avaliando uma versão do sistema para celular — onde a leitura de código de barras poderá funcionar exclusivamente — e planejam continuar coletando feedback sobre a usabilidade durante o desenvolvimento ([01:12:10](#01:12:10)).

*Revise as anotações do Gemini para checar se estão corretas. [Confira dicas e saiba como o Gemini faz anotações](https://support.google.com/meet/answer/14754931)*

*Como está a qualidade de **destas observações?** [Responda a uma breve pesquisa](https://google.qualtrics.com/jfe/form/SV_5bXzKQfylMIhSXc?confid=Z2Fk8IBDYtNmzeAc5IExDxIQOBEQAjIGCIoCIAAYBQg&detailLevel=standard&hasImages=False&entryPoint=footerMain&isGoogler=False) para nos dar seu feedback, incluindo o quanto as observações foram úteis para o que você precisa.*

set. 29, 2026

## **Reunião em 29 de set. de 2026 às 16:00 GMT-03:00 \- Transcrição**

### **00:00:04** {#00:00:04}

**João Henrique:** Certo? Boa tarde, pessoal. Eh, eu me chamo João Henrique, faço parte da equipe de desenvolvimento do Farma UBS, juntamente aqui com o kauane com o Ivo.O projeto ele é um projeto da da disciplina de extensão do Instituto Federal, né, que a gente iniciou o processo de coleta de requisitos e funcionalidades no ano,

**kauan almeida:** 

**João Henrique:** no semestre passado. A gente teve algumas conversas, acredito que com quase todas. Eu lembro da Bruna, eu lembro acho que do do Bruno Alencar também, do Israel, é um nome que me parece familiar. Eu não lembro agora do Guilherme, nem da não, talvez a FRANCISCA BEATRIZestivesse com a gente também na reunião, não tenho certeza. Então, a gente fez algumas rodadas de reunião para fazer alguma algumas coletas de requisitos, né, para tentar entender a necessidade eh de vocês no que tange a operação da farmácia. a gente sabe que hoje eh não existe nenhum dispositivo tecnológico que vocês eh é direcionado para isso, né, voltado para para lidar com a operação diária ali da farmácia, que muitos de vocês acabam recorrendo a algumas planilhas que vocês mesmos têm que montar.

### **00:01:17** {#00:01:17}

**João Henrique:** A a parte de inteligência, ela acaba ficando um pouquinho mais limitada por conta disso. O controle, disponibilidade da informação também acaba sendo prejudicada. E nisso nasce o Farm UBS, né? A ideia do Farm BS é justamente entrar nessa posição, né, eh, nesse nicho de mercado, onde a gente tem o a operação de uma farmácia pública, né, uma farmácia das UBSs e, e eventualmente até de pr socorros ou roupas, alguma coisa e eh a gente pode acabar expandido o projeto futuramente. E aí hoje o que a gente queria, que a gente tá querendo fazer na verdade é coletar de vocês ah, um feedback um pouco mais direcionado. Nas primeiras conversas, a gente fez algumas coletas de funcionalidades, a gente conseguiu implementar aqui num num projetinho menor, digamos assim, que já tem alguma função. E a gente gostaria de entender se o que tem, digamos assim, atenderia, seria capaz de substituir as planilhas de vocês, eh, se falta informação que vocês precisam inserir, se tem informação demais, se quando quando vocês eh tão realizando uma determinada operação, um outro gatilho precisa ser acionado, ah, se a posição das coisas na tela tá interessante.

### **00:02:38** {#00:02:38}

**João Henrique:** Então, é esse tipo de informação que a gente gostaria de coletar de vocês, certo? E aí, para isso, eh, o Kauan acabou de mandar um arquivinho aqui, tá num num zip. Eu gostaria que vocês eh descompactas o arquivo. Aí vai ter uma pastinha com vários outros arquivos dentro. E aí eu gostaria que vocês, deixa eu até mostrar a minha tela também,

**kauan almeida:** Tem que abrir

**João Henrique:** só para isso. Deixa eu só mostrar minha tela aqui rapidinho. Certo? Então, na prática, vocês vão ter um arquivo assim, zip, aí extrai, né? Ele vai abrir uma pasta e aí vocês entram no arquivo de login, login. HTML, certo? E aí ele vai abrir no navegador de vocês, certo? Era isso que eu gostaria que vocês fizessem. E aí, quem quem for conseguindo realizar essa operação, por favor, me confirme.

**Bruno Santana:** Repete aí novamente. É entrar no na pasta. Clicar onde?

**João Henrique:** no arquivo chamado login. login. Ou ele vai tá login ou vai tá login.

### **00:04:31** {#00:04:31}

**João Henrique:** HTML.

**kauan almeida:** Tem

**João Henrique:** Deu certo aí?

**Bruno Santana:** Tem que baixar o arquivo na própria nuvem. Eu consigo fazer isso?

**João Henrique:** Não, tem que baixar o o arquivo.

**kauan almeida:** que baixar.

**João Henrique:** Eu

**kauan almeida:** Eu mandei o link no da chavada. Aí vai pro drive.

**Bruno Santana:** Beleza.

**João Henrique:** posso passar aqui por todo o processo se alguém tiver tendo dificuldade. né? Então, entra aqui no link, ele vai para essa pasta, pode baixar aqui. Tem um botãozinho para baixar. Aí aqui eu vou colocar á de trabalho. Vou extrair e dentro arquivo login.

**Bruno Santana:** Beleza, não deu certo. .

**João Henrique:** Certo. Ah,

**FRANCISCA BEATRIZ DE MELO SOUSA:** também consegui.

**João Henrique:** eu vou pedir então para você. Ótimo. Excelente, Bruno. Eu vou pedir para você então para, se possível, né, você poder compartilhar a sua tela com a gente, que aí na gravação a gente consegue ver o que que você tá tentando fazer, tá? E aí, o que eu vou pedir para todos é o seguinte, eh, não, por enquanto não precisa falar nada.

### **00:06:58**

**João Henrique:** Eh, tentem operar o sistema, digamos que o sistema já está plantado. E eu queria ver, gostaria de ver como é que vocês operam o sistema, digamos assim. A ideia é realmente vocês não receberem instrução nenhuma pra gente tentar entender se visualmente vocês conseguirem identificar as funções que o sistema oferece, tá certo? que e no caso, se não, se a gente se vocês não conseguirem identificar, né, a gente já percebe que já tem algumas barreiras e isso se torna um problema pro sistema. E aí, Bruno, só pra gente ter a resposta visual aqui na gravação, eh se você puder compartilhar a sua tela e mostrar pra gente, né, você realizando as operações, eh, seria interessante. E aí, depois disso a gente faz uma rodada de coleta de de informação mais refinada.

**Bruno Santana:** É que eu tô no no computador e no celular, mas vou espera um momento se a professora conseguir compartilhar. Tá.

**kauan almeida:** Você

**João Henrique:** E e os demais, Israel, Guilherme, João Pedro conseguiram Amen.

**kauan almeida:** consegue compartilhar a tela? .A alguém está na chamada pelo computador que aí Aí se alguém tiver pelo computador é mais fácil.

### **00:09:02**

**kauan almeida:** Se todo mundo tiver para celular e a gente acab que recebeu o feedback só falar.

**João Henrique:** Deu certo aí do seu lado, Bruno. M.

**Bruno Santana:** Cara, eu não tô conseguindo compartilhar aqui, não tô conseguindo entrar com o notebook tá travando, mas eu tô dando uma olhada aqui no sistema.

**João Henrique:** Conseguimos aqui um compartilhamento aí. A Francisca, né, Francisca Beatriztá compartilhando. Eh, se você puder,

**FRANCISCA BEATRIZ DE MELO SOUSA:** É, mas diga

**João Henrique:** não, é só para, né, quando você abrir o deixar ele em tela cheia, que aí fica mais fácil pra gente eh visualizar aqui.

**FRANCISCA BEATRIZ DE MELO SOUSA:** pronto.

**João Henrique:** Aí a instrução que eu dou para vocês é tentarem operar,

**FRANCISCA BEATRIZ DE MELO SOUSA:** Ah.

**João Henrique:** verificar se o que tem, né, o que que estaria, o que que tem de funcionalidades, o que que tá faltando, campos que precisam ser preenchidos e aí depois a gente vai passando por alguma rodada de pergunta, tá? Mas por enquanto é mais para vocês explorarem mesmo o sistema.

**FRANCISCA BEATRIZ DE MELO SOUSA:** É o que tem.

### **00:12:11** {#00:12:11}

**FRANCISCA BEATRIZ DE MELO SOUSA:** na no estoque

**João Henrique:** Se você subir mais um pouquinho.

**FRANCISCA BEATRIZ DE MELO SOUSA:** medicamento forma últimas dispensas

**João Henrique:** É, é isso. Essa é a lista das últimas dispensas realizadas.

**FRANCISCA BEATRIZ DE MELO SOUSA:** nesse login aqui, né, que a gente acessou todo mundo o mesmo login, não foi?

**João Henrique:** Isso. Todo mundo o mesmo login.

**FRANCISCA BEATRIZ DE MELO SOUSA:** Uhum.

**Bruno Santana:** Eu não tava na na outra reunião,

**FRANCISCA BEATRIZ DE MELO SOUSA:** Aqui

**Bruno Santana:** uma dúvida que na hora de eu dispensar eu consigo bipar, usar um código de barra, alguma coisa assim. É possível fazer isso,

**João Henrique:** Não, não foi escopo da primeira das primeiras reuniões, tá?

**Bruno Santana:** tá?

**João Henrique:** Eh, quando a gente for para rodar de perguntas, a gente pode tratar disso, Bruno.

**Bruno Santana:** Beleza.

**João Henrique:** Aí, João,você pode realmente operar, tá? Tentar fazer uma dispensa aí, OK?

**kauan almeida:** verificar cada a esquerda ali tem as opções de estoque em retal também. Vocês todos esses dados são sintéticos, tá? É só uma bosta com algumas coisas para poder vocês terem a noção de como é que ficaria.

### **00:13:51**

**kauan almeida:** Yeah.

**FRANCISCA BEATRIZ DE MELO SOUSA:** \!?Então esse layout aqui mesmo é da é inicial já é da para dispensar.

**João Henrique:** Isso. Por enquanto a tela principal, né, após o o login seria a tela de dispensação.

**FRANCISCA BEATRIZ DE MELO SOUSA:** Já para fazer é preciso do cartão do sujo do paciente, mas é opcional, né?

**João Henrique:** Isso. gente fazer uma dispensação aí para você ver como é que esse sistema funciona. M.

**FRANCISCA BEATRIZ DE MELO SOUSA:** Aí posso selecionar do estoque, né? Aí ele diz qual é o lotecimento, quantidade posologia aqui. Aí eu tô colocando esses micamentos da receita atuando.

**João Henrique:** A

**FRANCISCA BEATRIZ DE MELO SOUSA:** Esses medicamentos a receita é mais outro a dispensar.

**kauan almeida:** Eh,

**João Henrique:** a ideia é justamente que você opere para você verificar o que acontece. Se a gente ficar intervindo muito,

**kauan almeida:** iso

**João Henrique:** a gente perde o sentido do da ideia do do que a gente tá tendo fazer, do teste.

### **00:16:25**

**FRANCISCA BEATRIZ DE MELO SOUSA:** Aí eu posso adicionar outro, né? Oxilha. Ja. Ah, já entrou aqui, né, no medicamento forma. Fiz um pedido. Hum. Fiz uma dispensação. Na verdade, que é esse inventário? inventário físico que é apuração.

**João Henrique:** بس

**FRANCISCA BEATRIZ DE MELO SOUSA:** medicamente oxicine nem falta. Esse inventário aqui, eu tô olhando, tem uma boxicilina aqui com avaria e falta três frasades de de pirão. Eu possoeditar aqui tá aqui a quantidade de contar um pouquinho gente. Você pode alterar aqui, né, no inventário. que seria essas unidades baixadas.

**João Henrique:** seria seria ali é no caso seria a contagem total de unidades, né? Se fosse para contar quantas cápsulas, quantas comprimidos, quantos frascos, daria um total ali de 172 com os que a gente tem ali, né?

### **00:20:26** {#00:20:26}

**João Henrique:** já informados no sistema.

**FRANCISCA BEATRIZ DE MELO SOUSA:** E a receita, deixa eu ver aqui minha A receita eu não entendi não. A receita é só aqui o que eu o que eu adiciono, né?

**João Henrique:** Isso basicamente seria, se a gente fosse pensar, seria o a quantidade de pessoas atendidas, né? sendo que cada pessoa pode acabar.

**FRANCISCA BEATRIZ DE MELO SOUSA:** Mas não Não é a receita na íntegra.

**João Henrique:** mais de um. Isso não é a receita,

**kauan almeida:** Ok.

**João Henrique:** não necessariamente a receita na íntegra. Isso é uma das coisas que a gente vai perguntar para vocês também, né? A necessidade da de retenção, esse tipo de coisa.

**FRANCISCA BEATRIZ DE MELO SOUSA:** É porque tem medicamento que vai ter que reter a receita.

**João Henrique:** Aí tá, a gente tá passando aqui pela dispensação, passou ali pelo inventário. Ah,

**FRANCISCA BEATRIZ DE MELO SOUSA:** Uhum.

**João Henrique:** vamos tentar passar ali rapidinho ali só no estoque atual e na parte de recebimento. Só tentar operar um pouquinho pra gente conseguir coletar o máximo de evidência possível.

### **00:21:37** {#00:21:37}

**FRANCISCA BEATRIZ DE MELO SOUSA:** Usar tá baixa Вот так. No. Nem o medicamento encontrei. Los artana que tá baixo mesmo. M. Se eu aí, se eu quiser adicionar o stock, eu tenho que ir no inventário, né?

**João Henrique:** No no caso você vai lá no recebimento

**FRANCISCA BEATRIZ DE MELO SOUSA:** Assim. Op. Aí o pode acionar o estoque, né? É. Entendi. Confirmar a entrada no stock. É, não parece ser tão difícil não depois que a gente começar a mexer. Угу.

**João Henrique:** Isso. A ideia mais é pegar, né, para ver se eh eh se vocês realmente sentir falta de algo, né? Eh, se a operação tá fluida, se visualmente falando, né, vocês não se perderiam na operação, sabe?

**kauan almeida:** você tem alguma informação que podia ser eh mais visível na tela? assim, ah, eu acho que essa informação aqui mais importante ser mais fácil de visualizar do que essa informação.

### **00:25:28**

**kauan almeida:** Isso é importante também na hora de ficar mais tranquilo.

**FRANCISCA BEATRIZ DE MELO SOUSA:** É, eu acho que tá faltando essa questão da da receita mesmo, da retenção da receita. dos que precisarem, né? Mas assim, eu queria saber a opinião dos meninos, porque eu sou a professora deles de núcleo, né? Coordenadora do núcleo, mas eu não trabalho, não estou nas UBS como eles estão. Eu queria saber um pouco da opinião deles também. Eu não tô escutando nada. Que minha conexão?

**João Henrique:** Alô. Tá. Eh, tô levendo, Cisco. Muito obrigado, tá, pela pelo compartilhamento. Aí eu vou compartilhar aqui também e vou tentando fazer um pente fino com todo mundo. Pode ser.

**FRANCISCA BEATRIZ DE MELO SOUSA:** Certo. .

**João Henrique:** Então, a primeira tela que foi acessada foi essa daqui, né? a tela de login. A gente já tem aqui um login padrão, mas aí na prática cada um receberia o seu, certo?

### **00:27:01** {#00:27:01}

**João Henrique:** A a possibilidade inclusive de verificar se a senha tá correta. Vocês podem ver aqui, ã, vocês não conseguem se cadastrar por si só, né? Eh, você precisa sempre solicitar o cadastro junto à coordenação. A, se você esquecer a sua senha, a mesma coisa, você precisa eh pedir ao ao administrador do sistema, né, para que resete a sua senha, tá certo? Então esse não é um sistema de acesso ao público, né, João?Um sistema de acesso direcional. Então, ao entrar, a gente é jogado nessa tela. Eh, eu vou perguntar para vocês, tá pequeno demais? Aqui a minha tela é muito grande, ela às vezes deixa as coisas pequenas demais.

**Bruno Santana:** tá um pouco pequeno.

**João Henrique:** Pô, pequeno. Deixa eu tentar dar um zoomzinho aqui então. Eu aqui já tô acostumado, mas aí, né, na na transmissão realmente pode ficar pequena. Melhorou?

**kauan almeida:** Mais um.

**João Henrique:** Mais uma.

**kauan almeida:** Isso aí.

**João Henrique:** Sim.

**kauan almeida:** Pronto. Aí. Ah.

**João Henrique:** Perfeito. Certo.

### **00:28:02** {#00:28:02}

**João Henrique:** Então aqui nessa tela, por enquanto, tá, a ideia é que ela seja a nossa tela principal, porque afinal a maior parte das coisas que vocês vão fazendo, a maior parte da operação tá na dispensa, né, de medicamentos. Então, por enquanto, ela é a tela principal. eventualmente a gente consegue substituir ela por um por um outro tipo de tela, mas aí você vai ter informações aqui, por exemplo, de qual unidade você está alocado, algum código, né? Qual é o seu tipo de perfil, por exemplo, se você é o farmacêutico responsável, se você é o gerente da unidade, eh aqui vai ser o seu nome, né, com o e-mail que você vai estar logado, possibilidade de colocar um avatar aqui, tá? E sair do sistema. Logo ao lado a gente tem as operações que tem disponíveis e essas também são as operações que a gente tem no momento, tá? Pra gente entregar um produto que funcione para vocês o mais rápido possível. Então, dispensação, recebimento, ah, a visualização do estaque atual, o inventário mensal, que eu acredito que é o o, digamos assim, o grosso da operação de vocês, né?

### **00:29:10**

**João Henrique:** Ah, aqui ainda não tá disponível o módulo de planejar o pedido, que é algo que vocês também fazem, também tá na operação de vocês, mas a gente planeja inserir essa funcionalidade no futuro. A ideia é que a gente conseguisse com esse sistema substituir as planilhas eh de Excel, né, de Google, Google Sheets o mais rápido possível. Então a gente conseguiu concentrar essas funcionalidades aqui, entendeu que não. Se a gente entrega essas funcionalidades, a gente basicamente substituir esse que eles têm hoje. E aí a gente já entrega um sistema que já é muito mais, ele é personalizado para operação do do farmacêutico e não uma planilha genérica que ele precisa se se adaptar para operar. Deu para entender? M.

**Bruno Santana:** Sim.

**João Henrique:** Perfeito. Então, o sistema já veio meio que pré-preenchido, né? A ideia era justamente pegar o carro andando para entender de vocês. Então, na tela aqui de dispensação, a gente tentou criar uma hierarquia, né? Eh, a dispensação em si de medicamentos e um um breve relatório do que que tem acontecido no dia, tá certo?

### **00:30:25** {#00:30:25}

**João Henrique:** Ah, a gente ainda consegue ajustar isso se fosse o caso, por exemplo, nessa lista, vi aqui para baixo, tá? Se for o caso, mas aí vocês o que vão dizer, né? Ou se ela aqui de lado tá legal, só que ela tá ela tá chamando muita atenção e acaba perdendo um pouco do foco da dispensação em si, que é o a operação principal. Isso é tudo que eu queria entender de vocês. Então, que para dispensar um medicamento, né? Ah, a gente tá inserindo aqui, selecionando, por exemplo, para sedamol. Eh, aqui ele já entrega o lote, tá? Esse lote que ele vai entregar, ele já é considerando, por exemplo, caso hajam vários lotes diferentes dentro do estoque, ele entrega o que tem a data de vencimento mais recente, tá? Que vai chegar mais cedo, né? e ele diz qual é o estoque atual, né, para esse lote. E aqui a gente consegue colocar a quantidade, tá? No caso, seriam em comprimidos aí a pusologia, que é opcional e o cartão do suí aqui do paciente, que também é opcional.

### **00:31:29** {#00:31:29}

**João Henrique:** A gente deixou essa isso como opcional, eh, porque a gente coletou nas primeiras reuniões que a a dispensação de de medicamentos de uso contínuo acaba indo para um outro sistema, né? E aí o cartão do SUS ou o CPF seriam as informações que seriam utilizadas para fazer essa inserção no outro sistema. E aqui a gente consegue adicionar a receita, né, o medicamento. E a gente tem um medicamento na receita. Então a gente pode, por exemplo, concluir a nossa dispensação aqui e ele já apareceria aqui de de cara, né, na listinha das últimas dispensas realizadas, tá? A gente pode pensar aqui em realizar mais uma receita, como por exemplo, a moxicilina, deixa essas 30 unidades mesmo. E deixa eu pegar aqui se ovastanino aqui com em vez de 30, vamos botar 60 unidades. Só para título de do teste aqui mesmo. Então, com duas com dois medicamentos na receita tal, a gente conseguiria fazer a conclusão da receita, certo? E elas vêm para cá o tempo inteiro, certo? Então, dessas informações aqui, eh, existe algo que estaria faltando ou como o Bruno tava sugeriu mais cedo, né?

### **00:32:54** {#00:32:54}

**João Henrique:** a possibilidade de fazer um bip. Eu gostaria um pouco de entender um pouco como é que funciona na operação de vocês, né?

**FRANCISCA BEATRIZ DE MELO SOUSA:** Guilherme colocou no chat o um histórico de cada usuário.

**João Henrique:** histórico de cada usuário. Eh, você consegue

**kauan almeida:** É tipo assim, eh, digamos que eu vou pegar um remédio e aí cada vez que eu for pegar ir pro meu histórico, entendeu?

**João Henrique:** você como paciente

**kauan almeida:** Eu acho que eles

**FRANCISCA BEATRIZ DE MELO SOUSA:** Não, acho que não. É como paciente, Guilherme.

**Bruno Santana:** Eu acho que ele tá falando no sentido assim de porque às vezes tem paciente que vai na UBS e com a receita ele consegue pegar medicação, mas muitos pegam do mês, nem terminam o mês pegam de novo. Isso é uma prática que a gente vê muito nas UBS, né? Aí se ficar seu histórico comprovado lá que o paciente receber, ó, você já recebeu esse mês, aí agora esperar o próximo mês, já que a dispensação é feita para 30 dias. Yeah.

### **00:34:26**

**João Henrique:** Ah, então, por exemplo, aqui no caso, eh, além de fazer a busca, por exemplo, se eu fizesse a busca aqui, ó, por um cartão do SUS específico, ele me trazer todos daquele, seria isso.

**Bruno Santana:** Sim,

**João Henrique:** A gente já a gente já já tá para ver.

**Bruno Santana:** no paciente. O histórico do paciente, né? Ah.

**João Henrique:** Perfeito. Então a gente consegue fazer sim, tá? Aqui. Ah, se eu não estou, se eu não estou enganado, se a gente deixasse virar o dia, ele não iria trazer, porque se eu traz o o teria dispensa no mesmo dia. Mas ah, eu acho que a gente consegue deixar isso aqui um pouco mais claro, né? Que a gente pode pesquisar por medicamento, como pode pesquisar pelo cartão do SUS. esse tipo de coisa,

**kauan almeida:** Ja.

**João Henrique:** certo? Mas aí sim, perfeito, tá? Consegue sim fazer a pesquisa que aí a gente conseguiria ver, né? Por exemplo, a gente insere aqui 1 2 3 1 2 3 4 1 2 3 4 1 2 3 4

### **00:35:28** {#00:35:28}

**Bruno Santana:** O que a gente usa, que é o pack, o prontuário eletrônico, a gente consegue fazer a pesquisa tanto pelo nome, cartão do SU, CPF, data de nascimento. Ne.

**kauan almeida:** Ah.

**João Henrique:** Ele consegue trazer só o cartão do SUS aqui nesse caso. Então, como informações opções opcionais do paciente, a inserir o CPF ou e o nome também, C deve funcionar, tá? Eh,

**kauan almeida:** Так.

**João Henrique:** mas aí todos com como opcional, né? Não, não são nenhuma informação obrigatória.

**kauan almeida:** Okay.

**João Henrique:** A me veio, me veio uma questão aqui. Eh, eh, nesse caso, se, por exemplo, é um é um medicamento de uso contínuo, já deveria, em vez de ser opcional, ser obrigatório a informação do do paciente? para vocês.

**Bruno Santana:** Cara, eu acho que sim.

**kauan almeida:** อ

**Bruno Santana:** Tipo assim, tu eh não entendi muito bem, mas tipo, seria eh opcional, no caso, botou o nome aí para eu dispensar para aquele paciente já ficaria o histórico. Seria isso, né?

**João Henrique:** É, digamos assim, porque, por exemplo, um paracetamol, talvez não vha a pena ficar eh registrando, né, de forma obrigatória o qual é o paciente.

### **00:37:13**

**Bruno Santana:** Uhum.

**João Henrique:** Mas se for algo de uso contínuo, né, que a gente já espera que o paciente vá voltar todos os meses, aí ele mudaria de opcional para obrigatório. Faz sentido isso?

**João Pedro Carvalho:** Não,

**Bruno Santana:** Ah. Yeah.

**João Pedro Carvalho:** eu acho que fica mais interessante mesmo a gente saber, entendeu, o histórico do que que o paciente anda consumindo, até para ele não tá fazendo uso irracional, entendeu? Senão não faz sentido ter só um e não ter outro. M.

**Bruno Santana:** ficaria no caso como opcional, mas você colocaria que realmente às vezes tem essa dispensação aula, né?

**kauan almeida:** อ

**Bruno Santana:** Mas via de regra você marcaria e colocaria o nome do paciente para até o histórico, de preferência desse jeito do paciente.

**João Henrique:** Certo? Então, no caso, o as informações do paciente deixam de ser opcionais, né? Elas são realmente obrigatórias.

**kauan almeida:** Aí, deixa eu perguntar uma coisa só o cartão dos o número do cartão do S resolve. Vocês preferem que tenha o nome da pessoa?

**João Henrique:** Lá no pack, deixa, deixa, deixa eu, deixa eu melhorar.

### **00:38:27** {#00:38:27}

**João Henrique:** Calma. lá no pack vocês para fazer a a inserção, basta o CPF, por exemplo,

**kauan almeida:** Ja.

**João Henrique:** ele já conseguiria linkar para saber qual é a pessoa, porque a gente consegue ver a possibilidade de fazer uma integração.

**Bruno Santana:** ou nome, CPF, cartão do luz ou data de nascimento, tudo você consegue fazer a busca do paciente.

**João Henrique:** Certo. A gente insere esses quatro campos aqui.

**kauan almeida:** Ja.

**João Henrique:** Aqui uma outra coisa que me viu a cabeça, por exemplo, no nosso no nosso protótipo, ele já entrega um lote para você, né, fazendo aquele cálculo de qual é o lote que tem o vencimento mais próximo. Mas sei lá, por algum motivo tem um outro lote que tá aberto e vocês querem, vocês gostariam de dar preferência de esvaziar, né, esse lote que já está aberto, porque um lote aberto, sei lá, e eh tem algum pode dar algum problema se ele não for dispensado logo, alguma coisa do tipo assim. Então ele trazer o lote, digamos assim, como o sugerido e você poder confirmar, né, ou alterar o lote que você tá dispensando, é vantajoso aqui nesse caso.

### **00:39:50**

**Bruno Santana:** Eu acho que sim, até porque às vezes vem lo diferente. E é, eu acho que é importante

**João Henrique:** Ah, tá? Então, por exemplo, seria seria um um quadradinho aqui, né, que ele já vem preenchido o lote que ele sugere, mas aí você ou preenche ou uma listazinha como essa que aparece, digamos assim, apareceria uma listazinha com os lotes que tem, você seleciona,

**Bruno Santana:** Pode ser. M.

**João Henrique:** cria melhor, então, né? E aí, ó, matar. Uma outra coisa aqui, por exemplo, é sobre as quantidades. Como a gente não tinha uma ideia clara, né, de como é que é imperação, a gente colocou algumas quantidades aqui no no no protótipo assim do do que veio da nossa cabeça, né? Mas, por exemplo, o paracetamol de 500 mg aqui comprimido, eh, quando vocês fazem a dispensa, vocês não fazem a dispensa de uma unidade, né? Vocês fazem a dispensa de, sei lá, de uma cartela, que a essa cartela tem, sei lá, 10 unidades, alguma coisa tipo assim. Eh, e aí no sistema, vocês fariam a dispensa de um ou farip dos 10?

### **00:41:16** {#00:41:16}

**Bruno Santana:** A gente, pelo menos eu dispenso o blister inteiro, né, que é para pro paciente completar o tratamento e a gente não corta o blister porque não são embalagem hospitalar que quando tem a validade, né? Se a gente cortar e vai ficar uma parte que vai ter a validade, a outra vai ficar assim. Aí a gente pode perder a medicação. Já para antibiótico é mais rigoroso, né? que a prescrição tem que ser dispensado mais corretinha quantidade mais MIP, assim como paracetamol de pirona, o paciente vai fazer o de cinco, tem um blister com 10, paciente leva os 10 eh comprimentos. Yeah.

**kauan almeida:** E aí, na hora de anotar o onde você já anota, você anota que foi uma cartela ou que foram 10 comprimentos.

**Bruno Santana:** 10 comprimido, porque cada fabricante tem uma apresentação. Por exemplo, tem um fabricante que tem a caixa com um blister com 10, outro vai ser com 20, depende do fabricante.

**kauan almeida:** Ah, ok.

**João Henrique:** Entendi. Entendi. Ah, então talvez isso seja isso seja material, como é que eu posso dizer?

### **00:42:33**

**João Henrique:** Até para uma outra parte, para parte do recebimento, porque digamos assim, ó, digamos que você tem dois paracetamol, você tem dois paracetamol no no estoque. Um, os dois são de 500 mg, mas um um uma cartelinha, né, vem com 10 e outra cartelinha vem com 20\. Ele poderia aparecer diferente aqui já, né, já aparecer as duas opções de paracetamol. Ah, e aí o lote, né, disponível para cada um, esse esse tipo de coisa. Mas aí no caso, independente disso, a quantidade, por exemplo, se se na cartelinha tem 10, você anotaria que foram 10 que saíram. Se foi o o de 20, anotaria que teriam sido 20\. Seria isso?

**Bruno Santana:** Sim, é a quantidade que supra o a o tratamento do paciente. A gente não corta listo se não foi uma embalagem hospitalar por causa da validade que a gente corta, aí vai perder a validade da parte que ficou ou o paciente levou. Yeah.

**João Henrique:** Certo? Deu para entender. OK. Então a gente consegue já aqui mesmo no protótipo, né, fazer essa essa pesquisa básica aqui de que, no caso tá só pelo cartão do SUS, mas a gente vai conseguir trazer aí ou por nome ou por por o CPF, tá?

### **00:44:04** {#00:44:04}

**João Henrique:** Eu imagino que a gente consiga trazer isso também. E aí, deixa eu ir para cá, paraa parte de recebimento. Ah, não. Pronto. Deixa, antes de de deixa eu voltar aqui na parte de dispensação. Como funcionaria a parte aqui do do bip? Ah,

**kauan almeida:** M.

**João Henrique:** Bruno, eu não entendi muito bem. vocês o o os lotes eles vêm com com um um pote de barras e aí você já tem um equipamento hoje para bipar essas coisas.

**Bruno Santana:** Não, a gente a gente não tem,

**João Henrique:** Como é?

**Bruno Santana:** mas tipo assim, eh, cada fabricante vai vir um código de barra. Essa questão do lote é é controle interno mesmo. Você tem que ir olhando que cada lote vai ter uma validade diferente. Mas tipo, fabricante A tem determinado código, aí você vê lá que deu saído daquele lote eh ou daquela determinado fabricante. Aí paciente B tem a mesma medicação, mas um código de barra completamente diferente.

**João Henrique:** E aí, como é que isso ajuda na operação do dia a dia na hora de dispensar?

### **00:45:19** {#00:45:19}

**Bruno Santana:** Eu acho que agiliza a questão da fica mais rápido, né? E eu consigo ter o controle, pá. Chegou lá, não sei, Losartana de eh da Eurofarma e da Mle. Aí eu batendo lá, eu já vou saber até por se acontecer alguma intercorrência. paciente. Ah, levei tal coisa,

**João Henrique:** О.

**Bruno Santana:** mas eu acho importante ter o lote ainda. Aí você botar lá porque você digitar manualmente o acho que a agiliza mais no bip.

**João Henrique:** Então, seria, digamos assim, pensando na operação, né? Eh, eu tenho uma maquininha que faz a leitura do cartão de do do código de barras. E aí eu, ao passar o código de barras em frente à maquininha ou apontar a maquininha pro código de barras, ele já traria aqui para você qual era o medicamento, né? O lote para você selecionar. E aí você só para gerir a quantidade, né? Ou no caso, talvez pelo código de barra já até dê para saber qual é a apresentação que vem, a apresentação padrão, né? Digamos 10 ou 20 comprimidos.

### **00:46:33**

**João Henrique:** E aí

**Bruno Santana:** Isso já vai a apresentação já vai cada apresentação é é um código diferente.

**João Henrique:** um código de barra carente. E aí você só viria aqui para selecionar qual é o lote e adicionaria ele à receita e iria pro próximo. Ser,

**Bruno Santana:** Isso.

**João Henrique:** tá? A gente consegue a gente consegue validar, tá? essa operação, se o quanto a gente conseguiria entregar disso, porque pensando aqui, a a ideia do sistema, eu não tenho certeza o quanto o quanto a gente consegue entrar nessa parte, tá? Por causa dos nossos compos, mas a gente consegue verificar aqui, tá? Tá certo? Então, então eu imagino que esse processo funcionaria muito bem também, por exemplo, pro recebimento, né? Porque aí em vez de ficar escolhendo um a um, eu também conseguiria fazer a leitura eh direto pelo código de barras, né? Então, essa parte a gente consegue entender que que é facilitaria de fato. Eh, mas aí, por exemplo, da do recebimento, né? Digamos que a gente recebeu aqui uma guia CAF.

### **00:47:56** {#00:47:56}

**João Henrique:** Deixa eu pegar aqui aqui só de exemplo aqui a carta cent, tá? Essa nomenclatura, gente, toda ela ela tá da nossa cabeça, tá? Eh, então são vocês que vão dizer pra gente que tipo de campo que vocês preencheriam. Por exemplo, qual é a em qual nota ou guia que veio, qual é o o fornecedor que entregou, né, que fez a entrega do do medicamento. Aí o medicamento a receber, por exemplo, colocar aqui o amoxicilina. Aí esse tá em cápsula. Vocês já falaram que tem, por exemplo, fabricantes, né? Então, fabricantes é um é um campo pra gente inserir aqui. Ah, e aqui já deveria vir a apresentação completa, né? Não só cápsula, mas quantas cápsulas vem num num pastilha,

**kauan almeida:** Ja.

**João Henrique:** né? Ou quantos comprimidos vem na mesma cartelinha. Eh, ou se é um frasco. Deixa eu ver se tem algum que é frasco aqui. Deixa eu ver. H, de promula sódica, por exemplo, aqui não tem aqui é 500 mg por ml, mas não diz quantos ml tem no frasco, né?

### **00:49:06**

**João Henrique:** Eh, então talvez isso aqui é o tipo de informação que a gente consiga inserir em cada medicamento. Então, o a mesma dipirona sódica de 500 mg por ml eh, de frascos diferentes seriam eh entradas diferentes aqui na nossa lista. Faz sentido isso?

**Bruno Santana:** Sim, tem que ser melhor desse jeito.

**João Henrique:** Perfeito. Então, deixa aqui a de piranosa, tá? E aí o lote recebido, né? Ele precisa ser inserido de qualquer forma, né? Não, não pega o porque o o o mesmo lá o código de barra só conseguiria pegar o o medicamento e a apresentação. Então o lote precisa ser inserido, a data de validade também, certo? Botar aqui de 28 e a quantidade de recebida, né? Quantos frascos seriam? Sei lá. Eh, vocês anotam isso mesmo? a a quantidade da, por exemplo, tantas cartelas, tantos frascos, ou vocês anotam, por exemplo, uma caixa e aí na caixa sabe-se que tem tantos frascos, tem tantas blisters, né, que você falou

**Bruno Santana:** Eh, a gente pede comprimido por unidade mesmo e frasco também.

### **00:50:31** {#00:50:31}

**Bruno Santana:** Cada frascozinho a gente solicita individualmente. No.

**João Henrique:** individualmente. Entendi. Então, seria isso mesmo. Tinha botar aqui 200 frascos aqui de dipirômetro. Então aqui estaria faltando a informação do fabricante, né? Qual seria o fabricante? Ah, e a possibilidade de fazer a leitura do do código

**kauan almeida:** Па.

**João Henrique:** de barras, né? Deu para entender? entender. E aqui, por exemplo,

**kauan almeida:** อ

**João Henrique:** eu eu aqui do jeito que tá operando o o protótipo, cada, né, eh medicamento, ele vira uma linha, tá? Faz mais sentido dessa forma ou faria mais sentido, por exemplo, igual fica aqui na dispensação, ele vai acumulando uma listazinha, né? E quando tiver tudo OK, ele entra, ele entraria como um pedido só para vocês fazerem a verificação. Que que vocês me dizem? E aí, por exemplo, ao clicar num botão, por exemplo, como esse, ele dá todas as informações, né? Eh, eh, medicamento é medicamento.

**Bruno Santana:** Eh, no caso seria nas entradas tratar individualmente cada um ou não entendi muito bem.

### **00:51:59**

**João Henrique:** Isso. Em vez de em vez de ser, digamos assim, uma entrada de um um pedidão, né, como se fosse vários medicamentos juntos que vão vir,

**Bruno Santana:** Eu

**João Henrique:** cada medicamento, né, vem e ele entra aqui como uma entrada diferente,

**Bruno Santana:** acho que cada um entrar diferente, eu acho que fica melhor.

**João Henrique:** fica melhor, porque aí eu consigo, por exemplo, buscar pela guia, então todas as entradas da mesma guia apareceriam, né?

**Bruno Santana:** apareceria uma lista com com a quantidade de todos e nome do princípio.

**João Henrique:** Isso. Ó, por exemplo, aqui, deixa eu botar a mesma guia para botar receber um outro medicamento paraetamol e unidades aqui, ó. Tá vendo? Se eu filtrar pela mesma guia, digamos assim, ele ele aparece,

**Bruno Santana:** Não, acho que desse jeito tá OK.

**João Henrique:** tá? OK.

**Bruno Santana:** que dá assim.

**João Henrique:** Aí o o só para só pra gente ter eh qual o formato que vem, tipo o número da nota fiscal ou o número da guia. É esse formato aqui mesmo? Assim, tipo um CAF 2026 100\. É alguma coisa do tipo assim?

### **00:53:13**

**Bruno Santana:** é o módulo que as UBS que são divididas em módulo e o mês. Então vem isso.

**João Henrique:** Se seria, por exemplo, o seu módulo seria o quê? O o 7, oito, o seis,

**Bruno Santana:** É, é numerado. Pode ser módulo seis. seria referente a ao módulo.

**João Henrique:** tipo mod 06 2908 2026\. Assim, algo assim.

**Bruno Santana:** Isso. Isso.

**João Henrique:** assim. Perfeito. Como esse aqui é texto, né, um texto aberto, a gente pode eh a gente não precisa validar ele com tanto com tanto rigor, mas eventualmente a gente vai precisar, né, pedir para vocês de fato um um exemplo, né, uma foto ou alguma coisa do tipo, eh, com as informações que podem ser compartilhadas pra gente conseguir ter uma ideia de qual é o formato, tá? Porque isso ajuda a gente a, por exemplo, ah, se você não inseriu o número, ele dá um avisazinho, olha, confira se não tá faltando alguma coisa, esse tipo de coisa, entendeu? Ah, o formato da data não tá correto ou você esqueceu o módulo, enfim.

### **00:54:43** {#00:54:43}

**João Henrique:** Eh, se a gente conseguir ter uma ideia, né, de qual é o formato real do dado, a gente consegue trabalhar para fazer algumas validações, pra gente não ficar inserindo dados sujos no sistema. Certo.

**Bruno Santana:** E eu consigo ter o feedback aí de, sei lá, o intervalo, eu selecionar o intervalo de tempo e ver o que foi que saiu do meu estoque.

**João Henrique:** Saída, né? Eh, é, é uma boa. A gente não tem esse, esse filtro ainda.

**Bruno Santana:** Porque assim, pelo pro pedido mensal a gente tem como base a gente seleciona o período, né, no caso,

**João Henrique:** Uhum.

**Bruno Santana:** e consegue fazer se ter uma ideia do que saiu, da entrada e saída no e do total do mês. Sei lá, a gente na farmácia usa muito algumas ferramentas de gestão, né, tipo eh, Eh,

**João Pedro Carvalho:** Sabe porque tipo assim, tem que ter pelo menos o básico, né? Ter entrada e saída aí depois o restante. É tipo, não adianta nada você ficar perguntando pra gente sobre esses filtros se não tiver o básico, né?

### **00:56:01** {#00:56:01}

**João Pedro Carvalho:** O quanto entra, o quanto sai, que é o que principalmente a gente tem que calcular, né? M.

**Bruno Santana:** Aí a gente adota algumas metodologias como eh curva A, B, C, né, que vai usar, é um exemplo só, né, que usa a regra de pareto, né, aí ele conseguiria sinalizar de acordo com o valor ali, no caso, isso seria maior importância para para cá. né? Mas para nós só a quantidade basta assim no que que é mais consumido ali na na nossa UBS. Yes.

**João Henrique:** É, então a gente conseguir, por exemplo, exportar, né, eh, baseado em uma em uma datas limites ou baseado no no paciente ou até baseado só no principio ativo, né? Те a possibilidade. de fazer essa essa filtragem e exportar essa relação. Não é isso que você tá querendo dizer?

**Bruno Santana:** Isso, ó. Vamos supor, nosso pedido tem que ser enviado até dia 25 de cada mês. Aí pegando, eu consigo selecionar lá data do dia 25 eh do mês anterior até o dia 25 do mês atual.

### **00:57:17**

**Bruno Santana:** Eu tenho uma relação de medicamento, eu vejo que eu tenho um estoque de tudo e o que saiu durante esse período.

**João Henrique:** Entendi, entendi. Então, é uma das é uma das implementações que a gente tem que trazer, Cal a essa a possibilidade de fazer essa exportação.

**kauan almeida:** Так.

**João Henrique:** Perfeito. Então, tanto para dispensa quanto para recebimento, certo? E aí aqui é uma nessa tela eu vou seguir, tá, gente? E Charl, se tiver mais alguma coisa aqui sobre sobre essa tela que você queira comentar, dispensação recebimento. Não, né? Então vou entender que não. Vou vou seguir aqui pra próxima tela. A próxima tela que é a tela de estoque, ela é uma tela mais de visualização mesmo, né? Mais para você conseguir verificar o estoque, o estado atual do estoque, né? Então, ah, você vai ter toda a lista de medicamentos que que tem no estoque, eh, separados por por principativo, qual é a apresentação ou no caso qual a categoria, qual o lote, a validade que aquele lote tem, a quantidade de estoque, né?

### **00:58:54** {#00:58:54}

**João Henrique:** um digamos assim um uma espécie de alerta para saber se o nível de de estoque tá tá saudável para paraa operação da da farmácia ou não, se ele tá baixo, tá? Esse aqui, por exemplo, ele tudo seria calculado. Então ele se por acaso o a cidade tá muito baixa e tá muito distante de ter uma nova remessa, né, ele acaba metindo alerta. Então é é mais uma, eu se conseguiria fazer um relatório, né? Seria mais uma visualização geral de como tá o estado do estoque, tá? Não tem muita inteligência envolvida nessa tela, mas a possibilidade de fazer a consulta, a gente acredita que é importante entregar para vocês já do dia um, porque afinal vocês conseguem fazer isso com as planilhas que vocês têm hoje, correto? que eu perdi vocês

**kauan almeida:** Não tô eh João, clica bem nesse i de informaçãozinha lá no no depois da só para eu lembrar aqui é só para eu lembrar, beleza? A informação do do E onde é que tá, por exemplo, localizada alguma coisa assim? Sim. E aí, pessoal, qual o feedback para essa tela?

### **01:01:12** {#01:01:12}

**kauan almeida:** Eu acho que tu passa pra próxima tela, então

**Bruno Santana:** tá projetando alguma coisa aí, não? Tá?

**kauan almeida:** eu acho que ele tá A aqui. Вот.

**Ivo Bruno Araujo:** Tá montado, João.

**João Henrique:** Pronto. Pronto. Bem, o que eu tava falando aqui, acho que a única coisa que eu eu visualizei aqui é seria a possibilidade, talvez de um filtro paraa validade, que aí eu conseguiria, por exemplo,

**kauan almeida:** Tá,

**João Henrique:** colocar a validade desse mês, né? E aí viria todos os medicamentos que estão para vencer esse mês, por exemplo.

**kauan almeida:** sim. E deixar, por exemplo, ao invés de tudo verdinho, o que tiver mais perto de vencer ficar laranja ou alguma coisa assim. Mas isso eu vejo depois.

**João Henrique:** Perfeito. Eh, e aí sobre a parte do estoque do inventário mensal, né? Eh, nas nossas conversas, né? Uma das operações que vocês fazem é uma conferência mensal do estoque real com o que tá no sistema de vocês, correto? E aí a gente tentou aqui, né, da da forma melhor forma como que a gente poôde trazer algo como se, por exemplo, já tivesse em andamento, né,

### **01:03:20** {#01:03:20}

**kauan almeida:** Não.

**João Henrique:** uma parte do do inventário já estivesse sendo feita. E aí, por exemplo, aqui a gente tá com três medicamentos para fazer que tá pendente, né, de fazer a verificação. Então, por exemplo, eu vou colocar eles aqui como se estivesse todos OK, tá? Só pra gente eh conseguir mostrar a alteração. Então, no sistema tá ali informando que tem 200, 240, por exemplo. E aí a última aqui, o atenol, vamos dizer que das 90 só sobraram 30\. Que tal? existe uma divergência, então, de 60 unidades e aí de forma obrigatória seria preciso selecionar uma uma justificativa, né, para abrir essa divergência. E aí a gente trouxe algumas eh aqui possíveis e aí vocês vão dizer pra gente se isso já é suficiente, se existe outras justificativas, se um campo com, por exemplo, uma opção outra e um campo para você descrever seria melhor, esse tipo de coisa. Então, por exemplo, aqui eu vou colocar como se fosse validade vencida. E aí salva bem aqui. Então, para essa operação de fazer a conferência, eh, estariam faltando informações.

### **01:05:02** {#01:05:02}

**João Henrique:** Eh, existem, por exemplo, no caso de validade vencida, existe um outro outro procedimento que precisa ser feito?

**kauan almeida:** Ja.

**João Henrique:** Eh,

**Bruno Santana:** Aí eu consigo selecionar o fabricante l conferência.

**João Henrique:** conseguiria sim, conseguiria sim, tá? Que no caso é porque como só tem um lote de cada de cada medicamento, ele já traz, né, daquele lote específico,

**Bruno Santana:** Beleza.

**João Henrique:** mas conseguiria assim, tá? Então, se tivesse dois lotes diferentes de paracetamol, você poderia selecionar qual dos lotes que você tem, né?

**kauan almeida:** M.

**João Henrique:** E aí, por exemplo, nesse caso que que a gente tá, quando há uma divergência, existe um operações a mais precisam ser feitas quando é validade vencida, Да. faz um determinado procedimento, quando é algum quando há, por exemplo, perda ou ou desvio, eh, faz um outro procedimento, como é que é o cenário de vocês? Quando sobra também, tipo, e sobrar também é meio esquisito, né? Estranho. Então, existem procedimentos que vocês realizam?

**Bruno Santana:** Eu acho que essas opções aí já dá para abarcar muita coisa, mas se tivesse um outro lá para você fazer uma breve descrição também seria importante.

### **01:06:32** {#01:06:32}

**João Henrique:** adicionar adicionar um um outro aqui, né? E aí vem uma uma descrição que vocês sériem, não é isso?

**Bruno Santana:** É porque às vezes assim chega um lote pra gente, isso acontece muito lá um pedido mensal, a gente recebe uma lista, mas o entregador não não espera a conferência nossa, né? só entrega e sai. Aí às vezes há uma divergência em que consta em nota e e o que a gente fez a conferência real lá e às vezes registrou no sistema que tava na nota e teve esse desvio aí.

**João Henrique:** Entendi. Entendi. É. Ah, mas assim, em termos de de além das informações aqui, né, que a mais que você tava comentando sobre qual é o lote, qual é o fabricante, tem alguma outra informação que tá faltando? Угуm.

**Bruno Santana:** Acho que tá OK essa parte aí, porque se, como você falou que vai avaliar a parte do código, parte do código já conseguiria abarcar a apresentação, né? Cada apresentação, mesmo sendo o mesmo fabricante com com 20, 15, 30, vai ter um código diferente.

### **01:08:05** {#01:08:05}

**João Henrique:** Perfeito. Então assim, eh eh pensando aqui no inventário, né, você vai fazendo esse registro item a item, né, e ele vem aqui para um um rascunho, né, rascunho do do da apuração que foi feito. E aí, uma vez que todos os os medicamentos foram conferidos, né, você consegue fazer a homologação do seu inventário mensal, certo? E aí ele confirma aqui, homologa,

**kauan almeida:** Так.

**João Henrique:** certo? E ele vai eh fica salvo no sistema, né? Todo. E aí você vai poder imprimir esse tipo de coisa, certo? O seu do seu inventário. E aí a partir daqui funcionaria a parte de, né? Você vem pro exporta o que que seria a o que que foi feito de dispensação, exporta o que que foi feito de recebimento. e vai pra parte de planejamento e a gente espera entregar para vocês só no próximo

**kauan almeida:** Eh

**João Henrique:** semestre, tá? Então, por enquanto ele ainda não faz essa parte. Tem, temos mais algum?

**Bruno Santana:** Talvez, talvez na parte de microbianos, né, que são medicamentos que t retenção de receita, seja importante também registrar a data de emissão da receita, porque receita de antimicrobiano tem validade, né?

### **01:09:36** {#01:09:36}

**Bruno Santana:** não passou no prazo lá de 10 dias, aí a receita já deixa de valer.

**João Henrique:** Hum, entendi. Então, eh eh por exemplo, quando eu selecionar um medicamento específico, ele, né, eu precisaria ter a data da receita aqui, que seria a data da receita, né?

**Bruno Santana:** Isso ali a missão. Não.

**João Henrique:** da missão da receita, tá? Tá anotado. Então aí a o ato de de da receita em si, por exemplo, existe um existe um número de receita que precisa ser registrado ou não?

**Bruno Santana:** Esse esse programa de vocês, vocês estão pensando só para atenção básica ou para só para atenção?

**João Henrique:** Sim.

**Bruno Santana:** É, então não tem problema não. A gente só usa receita branca e geralmente não tem numeração, não.

**João Henrique:** É, por enquanto,

**Bruno Santana:** não é psicotrópico.

**João Henrique:** essa é uma receita básica eventualmente no futuro talvez ele sirva para UPAs e para hospitais, né? Mas é possibilidade por enquanto é é a é a UBS mesmo o nosso nosso foco, a cooperação da UBS, da atenção básica.

**Bruno Santana:** Beleza, porque realmente as outras tem algumas diferençasinha.

### **01:10:52** {#01:10:52}

**Bruno Santana:** Ah, tem algum medicamento lá que tem um índice terapeuta muito curto, que é um medicamento de autovigilância. Aí na própria, no meio hospitalar já seria ele é tajado de vermelho, né? Aí eu acho que seria legal vir um aviso aqui para você fazer essa checagem se realmente é é a medicação, né? Tá certinho a dose

**João Henrique:** Entendi. É, esse tipo de alerta, né? É, é relativamente fácil de implementar, tá? Quando a gente seleciona um medicamento ou quando se eventualmente a gente conseguisse fazer a partir de um de um de um bip de código de barras, né? Ele vim com as informações, olha, presta atenção, né? Tome cuidado, confira as informações. Isso é relativamente fácil de fazer, tá? E aí, se a gente conseguir uma listinha, né, certinho do que de que tipo de medicamento a gente precisaria precisaria ter esse cuidado redobrado do farmacêutico. Ah. a gente conseguiria implementar isso aí. O, então, no geral, esse é o funcionamento dessa, digamos assim, a primeira entrega que a gente quer fazer até o final desse semestre.

### **01:12:10** {#01:12:10}

**João Henrique:** Talvez tenha uma outra algum outro cosmético aqui a mais até o final do semestre, mas de forma geral seria seria essas funções, tá? Eh, com isso, eh, vocês acreditam que conseguiriam substituir as planilhas que vocês utilizam hoje? M. consegue, né? Perfeito. Ah, então pessoal, vou agradeço aí a colaboração de vocês. A gente espera poder conversar mais com vocês, tá? À medida que a que a gente for avançando no desenvolvimento do sistema real, a gente vai tentando conversar com vocês para entender realmente se a operação tá OK, né? se a manusabilidade do sistema tá OK, se se tem todas as informações que vocês precisam, se é fácil de operar o sistema, que é a parte que a gente acredita ser uma das mais importantes, né? Ser fácil de operar o sistema. Eh, possivelmente a gente também tá vai ter uma versão para celular, tá? Então, talvez até a parte aí do do da leitura do código funcione talvez só na versão pro celular, né? Não, não na versão pro computador. Ah, mas a gente vai vai tá trabalhando com isso, tá certo? Então, muito gostaria de dizer, né, mais uma vez muito obrigado e eu espero que a gente consiga se falar eh com mais vezes. Tá.

### **A transcrição foi encerrada após 01:14:21**

*Esta transcrição editável foi gerada por computador e pode conter erros. As pessoas também podem alterar o texto depois que ele for criado.*