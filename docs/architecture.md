# Arquitetura

O projeto usa TypeScript em modo estrito e módulos ES. O build transpila e empacota JavaScript para navegador/WebView2; os arquivos gerados ficam em dist e não são editados nem versionados.

| Pasta              | Responsabilidade                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------- |
| src/domain         | Contratos de dados, geometria, operações booleanas, fábrica de formas e reparo de código |
| src/application    | Estado e comandos do editor, estados de arraste, importação e validação de SVG           |
| src/infrastructure | Persistência local e exportação via Tauri ou navegador                                   |
| src/ui             | DOM tipado, renderização SVG, Monaco, sanitização e prévia HTML/CSS                      |
| public             | HTML e CSS estáticos                                                                     |
| src-tauri          | Janela nativa, gravação escolhida pelo usuário e política de navegação                   |
| scripts            | Build, servidor local e execução dos testes                                              |
| tests              | Testes de domínio, integração DOM, persistência, ponte desktop e navegador               |

O domínio não conhece DOM, Tauri ou localStorage. ProjectStorage recebe o armazenamento por injeção e valida a geometria antes de carregar. O renderer recebe um contexto tipado e não grava arquivos. O controlador coordena seleção, comandos, histórico e renderização. SVG importado passa pelo parser e pelo validador antes de substituir o projeto. Conteúdo da prévia é sanitizado e não executa scripts.

Os contratos Point (tupla de duas coordenadas), Shape, Project, GridSettings e Workspace são compartilhados. DragState discrimina arraste de câmera, redimensionamento, seleção de partes, forma inteira e seleção por área. Nenhuma checagem TypeScript foi desativada com ts-ignore, ts-nocheck ou noImplicitAny=false.

Monaco e os workers são empacotados localmente. polygon-clipping é uma dependência importada pelo domínio e incluída no bundle. Window.VectorBridge é a interface tipada entre o controlador e o adaptador Monaco; Window.CodeWorkbench permite os testes de integração do editor. Eles não dão acesso ao sistema de arquivos: o backend Rust grava somente o arquivo escolhido na janela nativa.

npm run typecheck valida os tipos; esbuild sozinho não realiza essa validação. npm run build:web e npm test executam a checagem antes de prosseguir. Testes DOM usam Happy DOM com layout/pointer capture simulados e não substituem os testes de clique real em Playwright nem a validação do WebView2 Windows.

O desktop e a versão web usam o mesmo frontend. O aplicativo instalado usa os recursos internos; npm start permite somente a origem do servidor de desenvolvimento configurada pelo Tauri. A exceção de desenvolvimento não é ativa no aplicativo instalado. Desktop e web têm perfis de salvamento automático independentes.
