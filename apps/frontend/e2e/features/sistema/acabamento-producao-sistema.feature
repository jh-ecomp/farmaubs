# language: pt
Funcionalidade: Acabamento de Produção, Responsividade e Conformidade no Frontend (RL-07)

  Cenário: Documento HTML utiliza idioma pt-BR e título dinâmico por página
    Dado que um visitante não autenticado acessa a tela "/login"
    Então o atributo "lang" da tag "html" deve ser "pt-BR"
    E o título da aba do navegador deve conter "Login" e "FarmaUBS"

  Cenário: Sidebar exibe município dinâmico, oculta módulos futuros e recolhe em viewports menores
    Dado que as APIs da bancada de dispensação da UBS estão operacionais
    Quando o farmacêutico carregar "/dispensas" nos viewports responsivos e acionar o menu móvel
    Então a barra lateral não deve sobrepor o formulário em telas menores e o drawer deve abrir e fechar com acessibilidade
    E os módulos futuros em desenvolvimento não devem aparecer no menu de produção

  Cenário: Páginas públicas de Privacidade e Termos são acessíveis sem login e sem violações WCAG
    Dado que um visitante não autenticado acessa a tela "/login"
    Quando ele navegar para "Política de Privacidade" e "Termos de Uso"
    Então as páginas "/privacidade" e "/termos" devem exibir as diretrizes de LGPD e cookies HttpOnly sem redirecionar para login e sem violações críticas no axe-core
