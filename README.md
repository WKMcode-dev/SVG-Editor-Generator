# SVG Editor Generator 2.0.0

Editor visual de SVG em **TypeScript + Tauri 2/Rust**, com pontos arrastáveis, cantos arredondados, operações booleanas e edição SVG/HTML/CSS no Monaco.

- [Versão web](https://wkmcode-dev.github.io/SVG-Editor-Generator/)
- [Downloads desktop e código fonte](https://github.com/WKMcode-dev/SVG-Editor-Generator/releases)
- [Arquitetura](docs/architecture.md)
- [Como testar](TESTAR.md)

## Usar

A versão web funciona no navegador. No Windows x64, baixe o instalador NSIS da release. O aplicativo usa WebView2: caso o runtime não esteja instalado, a instalação pode precisar de internet. Depois disso, o editor desktop funciona offline. O instalador não tem assinatura digital e o Windows pode apresentar um aviso.

As formas, a grade, o fundo, o HTML/CSS e as preferências do Monaco têm salvamento automático local. Não é necessário apertar Ctrl+S para isso. Cada navegador/origem e o aplicativo instalado têm perfis independentes. Não apague os dados do navegador/perfil se quiser preservar o salvamento automático. Salvar projeto gera um JSON para transportar ou fazer backup do projeto editável.

## Espaço de trabalho 2.0

Canvas livre, sem moldura ou prancheta fixa de 800 × 500. O SVG é exportado com viewBox calculado pelos limites das camadas visíveis, incluindo a borda. Os painéis usam uma paleta clara e neutra e a seleção usa azul; novas formas têm preenchimento e contorno cinza. As cores de projetos existentes são preservadas.

A barra flutuante fica centralizada na parte inferior do canvas. O menu de formas oferece retângulo, elipse, linha, seta, polígono e estrela. Escolha uma ferramenta e arraste; Shift restringe retângulos e elipses a quadrados e círculos, e linhas a ângulos de 45°. Os presets ficam na aba Recursos, com formas prontas e presets pessoais salvos neste navegador.

Um clique seleciona a forma para mover e redimensionar. Duplo clique ou Enter abre a edição de pontos; Esc retorna à seleção normal. A ferramenta de segmentos usa Shift+V. Elipses começam com quatro pontos suaves (topo, direita, base e esquerda), mantidos durante a edição. Formas criadas por clique usam proporções naturais; arrastar permite escolher largura e altura. Shift+clique adiciona/remove formas da seleção; arrastar uma caixa inclui as formas tocadas.

O painel esquerdo permite buscar, renomear por duplo clique no nome, agrupar/desagrupar, recolher grupos, mudar empilhamento, ocultar e bloquear camadas. Camadas bloqueadas ficam protegidas contra arraste, setas, exclusão e operações booleanas; o controle de cadeado permite desbloqueá-las. Os controles de visibilidade e bloqueio também funcionam no grupo inteiro.

O inspetor organiza Posição, Layout, Aparência, Preenchimento, Borda, Efeitos e Exportação. Inclui X/Y da forma, dimensões e proporção, seis alinhamentos, rotação incremental de vetores, espelhamento, opacidade, raio, sombra suave e edição de vértices. Rotação de mídia está desativada; espelhamento e redimensionamento estão disponíveis. Uma forma é alinhada ao canvas visível; várias são alinhadas aos limites da seleção. O botão Ver código SVG permanece na seção Exportação.

## Imagens e vídeos

Ctrl+Shift+K ou o menu de formas abre o seletor de mídia. Aceita PNG, JPEG, WebP, GIF, AVIF, MP4, WebM e OGG, até 12 MB por arquivo e cerca de 24 MB de mídia no projeto. Vídeos possuem reprodução/pausa no inspetor e controles nativos. A reprodução depende dos codecs suportados pelo navegador/WebView2.

Os arquivos são incorporados ao projeto. Salvamentos maiores usam IndexedDB; os menores continuam em localStorage. O indicador confirma o término do salvamento. O histórico limita sua memória quando há mídia grande. Não apague os dados do navegador ou do aplicativo se quiser preservar projetos e presets. Salvar projeto gera um JSON transportável; o navegador e o desktop têm perfis independentes.

Imagens são exportadas como elementos image com dados incorporados. Vídeos usam foreignObject no SVG e funcionam em navegadores compatíveis; para compartilhar a reprodução, prefira Exportar HTML. Visualizadores de imagens SVG que não implementam foreignObject podem não exibir vídeo. A prévia HTML não executa scripts nem permite buscar recursos externos.

## Navegação e atalhos

- V: seleção; H ou Espaço + arraste: mover câmera; Enter/duplo clique: editar pontos; Esc: sair da edição.
- R: retângulo; O: elipse; L: linha; Shift+L: seta; Ctrl+Shift+K: inserir mídia.
- Ctrl+A: selecionar camadas desbloqueadas e visíveis; Ctrl+D: duplicar.
- Ctrl+G / Ctrl+Shift+G: agrupar/desagrupar; Ctrl+Shift+L: bloquear/desbloquear; Ctrl+Shift+H: ocultar/mostrar.
- Ctrl+] / Ctrl+[: subir/descer; Ctrl+Z / Ctrl+Shift+Z: desfazer/refazer; Delete: excluir; Ctrl+S: salvar JSON.
- Shift+1 / Shift+2: enquadrar tudo/seleção; M: ímã; Shift+V: selecionar segmentos; ?: ajuda.
- A pinça do touchpad usa Ctrl+wheel; gestos WebKit e dois ponteiros touch também são tratados. Roda com Ctrl ou Cmd amplia no cursor; rolagem de dois dedos move o canvas. Botão central também move a câmera. Redimensionar a janela ou os painéis preserva o zoom.

As operações booleanas União, Subtrair, Interseção, Excluir sobreposição e Achatar trabalham com formas vetoriais fechadas. Linhas, setas e mídia ficam fora dessas operações. A precisão de clique prioriza o ponto mais próximo em 8 px de tela durante a edição.

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

O workflow de validação confere tipos, testes e build web. O workflow Windows executa os testes Rust, gera o instalador e abre o executável no WebView2 para verificar a interface e o Monaco. GitHub Pages publica dist ao atualizar main. Uma tag correspondente à versão, como v2.0.0, ou uma nova nota docs/release-v\*.md em main inicia a release: os arquivos só são publicados depois de passar pelos testes e pela compilação Windows.

## Atalhos

- Ctrl+Z: desfazer; Ctrl+Y/Ctrl+Shift+Z: refazer; Ctrl+D: duplicar; Delete: excluir; Ctrl+S: exportar projeto JSON.
- Ctrl+A: selecionar todas; R: inserir retângulo; Shift+1/2: enquadrar prancheta/seleção; Ctrl+]/[: subir/descer camada; ?: atalhos.
- V: selecionar; L: linhas; H: câmera; M: ímã; Esc: cancelar/deselecionar.
- Alt+Shift+U/S/I/E/F: operações booleanas.

## Limitações

Até 100 camadas e 1.000 vértices por forma, com coordenadas entre −100.000 e 100.000. Curvas livres importadas não são convertidas em vértices editáveis. Não há atualização automática. O perfil antigo do Electron não é migrado.

## Licenças

Código sob MIT. Monaco e polygon-clipping são dependências empacotadas; suas licenças são incluídas em dist/licenses. Referência inicial de interação: [Painel-Ping-Network](https://github.com/WKMcode-dev/Painel-Ping-Network).

### Grade e alinhamento

O botão **⚙ Grade** no rodapé ajusta célula base, estilo, origem e passos do ímã. A grade ganha subdivisões conforme o zoom aumenta, até 1 px, sem alterar o passo escolhido. Ao arrastar pontos, segmentos ou formas, guias rosas e marcadores indicam alinhamento com os demais pontos visíveis. A tolerância é de 6 pixels de tela em qualquer zoom. Segure Alt para ignorar as guias durante o movimento.

### Touchpad

Use pinça ou Ctrl/Command+rolagem para zoom. Deslizar dois dedos em qualquer direção move o canvas sem alterar o zoom. Painéis laterais mantêm sua rolagem normal.
