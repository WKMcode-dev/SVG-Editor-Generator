# SVG Editor Generator 1.8.0

Editor visual de SVG em **TypeScript + Tauri 2/Rust**, com pontos arrastáveis, cantos arredondados, operações booleanas e edição SVG/HTML/CSS no Monaco.

- [Versão web](https://wkmcode-dev.github.io/SVG-Editor-Generator/)
- [Downloads desktop e código fonte](https://github.com/WKMcode-dev/SVG-Editor-Generator/releases)
- [Arquitetura](docs/architecture.md)
- [Como testar](TESTAR.md)

## Usar

A versão web funciona no navegador. No Windows x64, baixe o instalador NSIS da release. O aplicativo usa WebView2: caso o runtime não esteja instalado, a instalação pode precisar de internet. Depois disso, o editor desktop funciona offline. O instalador não tem assinatura digital e o Windows pode apresentar um aviso.

As formas, a grade, o fundo, o HTML/CSS e as preferências do Monaco têm salvamento automático local. Não é necessário apertar Ctrl+S para isso. Cada navegador/origem e o aplicativo instalado têm perfis independentes. Não apague os dados do navegador/perfil se quiser preservar o salvamento automático. Salvar projeto gera um JSON para transportar ou fazer backup do projeto editável.

## Ferramentas

Clique na forma ou camada para selecionar. Arraste os pontos ou a forma. Clique duas vezes na borda para inserir um ponto. Pontos visíveis têm prioridade num raio de 8 px na tela; clique simples seleciona só o ponto mais próximo, e arrastar um ponto já selecionado preserva o grupo. Duplo clique junto a um ponto existente não cria outro.

Use Shift/Ctrl para selecionar vários pontos, linhas ou formas. O modo Linhas permite adicionar segmentos sem segurar a tecla. Arraste no vazio para selecionar por área. As operações União, Subtrair, Interseção, Excluir sobreposição e Achatar preservam vazados/regiões separadas e podem ser desfeitas.

Largura, altura, proporção, preenchimento, borda, opacidade e raio dos cantos são editáveis. O raio pode ser aplicado a vértices específicos, em px ou %. O ímã tem passo X/Y e origem independentes da célula visual da grade. Espaço + arraste ou botão central move a câmera; Ctrl + roda amplia no cursor.

O Monaco oferece abas SVG, HTML, CSS e Prévia, temas, autocomplete, diagnósticos, busca, formatação e correções conservadoras. A prévia não executa scripts nem carrega recursos externos. Exportar SVG preserva transparência; exportar HTML incorpora o CSS em um arquivo independente.

## Desenvolvimento

Requisitos desktop Windows: Node.js 22+, Rust estável com MSVC, Visual Studio Build Tools com **Desenvolvimento para desktop com C++**, Windows SDK e WebView2.

```powershell
npm ci
npm test
npm run test:desktop
npm start
```

npm start prepara os recursos e usa o servidor local interno do Tauri. O filtro de navegação permite sua origem configurada, evitando a tela preta das versões 1.7.0/1.7.1. O identificador do aplicativo permanece dev.wkmcode.scifisvglab.

Para trabalhar somente na web, sem Rust:

```powershell
npm ci
npm run dev:web
```

Abra http://127.0.0.1:8080. Não abra public/index.html por duplo clique: os bundles precisam ser gerados e servidos por HTTP.

| Comando              | Resultado                                             |
| -------------------- | ----------------------------------------------------- |
| npm run typecheck    | Verificação estrita de tipos                          |
| npm run format       | Formatação consistente com Prettier                   |
| npm run format:check | Confere formatação                                    |
| npm test             | Domínio, armazenamento e controlador com DOM simulado |
| npm run test:desktop | Ponte de salvar/copiar e fallback web                 |
| npm run test:ui      | Testes reais de navegador com Playwright              |
| npm run build:web    | Frontend e Monaco em dist                             |
| npm run dist         | Instalador Windows NSIS                               |

Para os testes de navegador, execute npm run build:web, npm run build:tests e npx playwright install chromium antes de npm run test:ui. Os testes Rust de navegação são executados com cargo test --manifest-path src-tauri/Cargo.toml após gerar dist.

## Publicação

O workflow de validação confere tipos, testes e build web. O workflow Windows executa os testes Rust, gera o instalador e abre o executável no WebView2 para verificar a interface e o Monaco. GitHub Pages publica dist ao atualizar main. Uma tag correspondente à versão, como v1.8.0, inicia a release: os arquivos só são publicados depois de passar pelos testes e pela compilação Windows.

## Atalhos

- Ctrl+Z: desfazer; Ctrl+Y/Ctrl+Shift+Z: refazer; Ctrl+D: duplicar; Delete: excluir; Ctrl+S: exportar projeto JSON.
- V: selecionar; L: linhas; H: câmera; M: ímã; Esc: cancelar/deselecionar.
- Alt+Shift+U/S/I/E/F: operações booleanas.

## Limitações

Prancheta de 800 × 500, até 100 formas e 1.000 vértices por forma. Curvas livres importadas não são convertidas em vértices editáveis. Não há atualização automática. O perfil antigo do Electron não é migrado.

## Licenças

Código sob MIT. Monaco e polygon-clipping são dependências empacotadas; suas licenças são incluídas em dist/licenses. Referência inicial de interação: [Painel-Ping-Network](https://github.com/WKMcode-dev/Painel-Ping-Network).
