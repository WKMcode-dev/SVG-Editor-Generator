# SVG Editor Generator 1.6

Editor visual desktop para Windows com tema SCI-FI alaranjado. Os arquivos iniciais permanecem em `original/`.

## Aplicativo pronto

Baixe **SVG Editor Generator 1.6.1.exe** na página [Releases](../../releases/latest) e abra o arquivo. É portátil, offline e não exige Node.js para usar. Feche a versão anterior antes de trabalhar na nova. O perfil e os projetos anteriores foram preservados.

## Formas, pontos e linhas

- Na primeira abertura, o editor apresenta um retângulo simples, sem recortes. Nas próximas aberturas, restaura o projeto, as dimensões, o fundo, a grade e a última forma usada. Um projeto que você deixou vazio continua vazio.
- Clique numa camada ou no interior da forma para selecionar. Clique fora ou use Esc para ocultar os controles.
- Arraste um vértice para editá-lo. Clique duas vezes numa borda para adicionar um ponto.
- **Linhas (L):** clique em várias bordas para somá-las à seleção, inclusive entre formas diferentes. Arraste qualquer linha selecionada para mover o conjunto livremente em qualquer direção. Um clique sem arraste numa linha já selecionada a remove da seleção nesse modo.
- No modo Selecionar, Shift ou Ctrl + clique também adiciona linhas ou pontos à seleção. Manter a tecla ao começar um arraste não remove a linha selecionada.
- O arraste move somente os vértices selecionados. Os demais ficam fixos; as linhas vizinhas se ajustam nas extremidades compartilhadas. Um vértice compartilhado é movido uma única vez.
- **Seleção por área:** arraste no espaço vazio para desenhar uma caixa e selecionar os pontos dentro dela. Arraste qualquer ponto selecionado para mover o conjunto. Funciona também entre formas, com zoom e deslocamento da câmera. Shift ou Ctrl + arraste acrescenta pontos à seleção existente. Clique no vazio ou use Esc para limpar a seleção; Esc também cancela um arraste em andamento.
- Arraste o interior para mover a forma inteira. Alt + arraste numa borda também move a forma inteira, útil quando ela está sem preenchimento.
- A última forma pode ser excluída. O salvamento automático mantém projetos vazios, mas salvar JSON ou exportar SVG exige pelo menos uma forma.

## Dimensões e aparência

Largura e altura são medidas do contorno completo, inclusive formas com partes separadas ou vazados. Os campos redimensionam a partir do canto superior esquerdo. Ative **Manter proporção** para vincular as duas dimensões.

Cores, preenchimento transparente, espessura, opacidade e junção da borda continuam editáveis. O recorte de cantos é opcional e começa em 0 px; esse controle se aplica a contornos simples. Vazados e múltiplos contornos são editados por vértices, bordas ou código.

**Fundo claro / Fundo escuro** altera somente a área de criação. O tema do aplicativo continua SCI-FI e o SVG exportado continua transparente.

## Combinar formas

Shift ou Ctrl + clique no interior de formas ou nas camadas seleciona várias. O menu **Combinar** oferece:

- **União:** junta todas as áreas selecionadas.
- **Subtrair:** as formas superiores recortam a forma inferior na ordem das camadas.
- **Interseção:** conserva a área comum a todas as selecionadas.
- **Excluir sobreposição:** conserva as áreas que não se sobrepõem em pares.
- **Achatar:** transforma a seleção em um único caminho composto estático, com áreas sobrepostas unificadas.

As operações herdam a aparência da forma inferior, substituem as formas selecionadas e podem ser desfeitas. Resultados sem área removem somente as formas selecionadas, com aviso e opção de desfazer. Vazados e regiões separadas são preservados no mapa, no JSON e no SVG (`fill-rule="evenodd"`).

O seletor **Contorno** permite escolher qual região ou vazado editar. Cores e dimensões individuais são editadas quando uma única forma está selecionada.

## Grade e câmera

O botão de ímã ativa/desativa o ajuste à grade. Em **Ajustar grade**, escolha linhas ou pontos, tamanho da célula, passo horizontal/vertical e origem X/Y. Célula visual e passo são independentes.

As setas movem o vértice ou segmentos selecionados por um passo; Shift multiplica por 10. Com várias formas selecionadas, as setas movem o conjunto. Espaço + arraste, ferramenta Mover ou botão central deslocam a câmera. Roda desloca; Ctrl + roda amplia no cursor.

## Código: Monaco, SVG, HTML e CSS

A área de código usa o Monaco Editor, o núcleo de edição do VS Code, empacotado localmente para funcionar offline. Não inclui o aplicativo VS Code completo, extensões, terminal ou execução de JavaScript.

- Abas design.svg, index.html, style.css e Prévia.
- Temas VS Dark, VS Light, Papel suave, Laranja noturno e Alto contraste, com preferência salva.
- Autocomplete de HTML e CSS (Ctrl+Espaço), sugestões de SVG, numeração, realce, hover, formatação, busca e desfazer do texto.
- Diagnósticos para o SVG, tags HTML e CSS. Código SVG inválido mantém a última geometria válida.
- Correções automáticas opcionais após uma pausa na digitação: erros conhecidos como stoke/stroke e colr/color, aspas de atributos, fechamento de contornos simples, tags ou chaves. O botão Corrigir aplica essas correções explicitamente. Não adivinha a intenção de código complexo; use os diagnósticos para corrigir esses casos. Ctrl+Z desfaz a correção sem reaplicá-la imediatamente.
- HTML/CSS têm prévia estática isolada. A aparência de paths/rect/polygon presentes no SVG do HTML pode atualizar preenchimento, borda e opacidade no mapa. Layout e texto HTML são vistos na Prévia.
- Exportar HTML gera um arquivo independente com CSS incorporado. Projetos JSON preservam HTML, CSS e preferências, além da geometria. O SVG gerado continua editável, formatado e transparente.

Corner radius arredonda os cantos com arcos circulares reais. Escolha px (0–10.000) ou % (0–50% da menor dimensão). O raio é limitado pela metade dos lados adjacentes para evitar sobreposição. Os vértices originais continuam editáveis; o arredondamento acompanha o projeto, histórico, duplicação, HTML e SVG. Operações booleanas aproximam os arcos por segmentos pequenos e incorporam o arredondamento ao resultado.

No SVG arredondado, data-corner-radius, data-radius-unit e data-vertices preservam os controles para reedição; é possível alterar esses atributos no editor de código. Curvas arbitrárias e transformações podem aparecer na prévia HTML, mas não são convertidas para pontos no mapa. Contornos lineares M, L, H, V e Z, polygon e rect continuam aceitos na prancheta 800 × 500. Recursos externos e scripts não são carregados na prévia.

O fundo claro usa cinzas quentes e tons de papel inspirados no Notion; o laranja permanece como destaque, sem branco intenso no mapa.

## Atalhos

- Ctrl+Z: desfazer; Ctrl+Y/Ctrl+Shift+Z: refazer; Ctrl+D: duplicar seleção; Delete: excluir seleção; Ctrl+S: salvar projeto.
- V: selecionar; L: seleção de linhas; H: mover câmera; M: ímã; Esc: cancelar/deselecionar.
- Alt+Shift+U/S/I/E/F: união, subtração, interseção, exclusão, achatar.

## Desenvolvimento e testes

`npm install` instala dependências; `npm start` abre o aplicativo; `npm run dist` gera o portátil; `npm run build:editor` recompila o Monaco; `npm test` executa os testes de geometria, validação, arraste, dimensões e operações.

Validação da interface: duplo clique real, arraste de segmentos sem mover os outros vértices, dimensões, tema, última forma, operações, vazados, histórico e edição de código. Verificações também em Electron com perfil temporário separado do projeto do usuário.

Operações geométricas: polygon-clipping (MIT; licença em `vendor/`). Referência inicial de interação: https://github.com/WKMcode-dev/Painel-Ping-Network.

Licenças do Monaco e dos componentes incluídos: vendor/ide/Monaco-LICENSE.txt e vendor/ide/ThirdPartyNotices.txt.

Corner radius atua nos vértices selecionados (ou no vértice ativo). Extremidades das linhas selecionadas também podem receber raio. Arraste a borda dos quadrados nos cantos para redimensionar; Shift preserva a proporção, inclusive nos campos de largura/altura. Junção configura stroke-linejoin, visível nos encontros da borda em cantos sem raio.

## Compilar a partir do código

Requisitos: Windows x64, Node.js 22 ou superior, npm e Git.

```powershell
npm ci
npm run build:editor
npm start
npm test
npm run dist
```

O executável é gerado em `release/1.6.1/`. O editor funciona offline; instalação das dependências e compilação inicial podem exigir internet.

## Estrutura

- `app.js`: interface, seleção, histórico e salvamento.
- `geometry.js`: formas, arredondamento e exportação.
- `editor-workbench.js`: integração Monaco e prévia HTML/CSS.
- `desktop.cjs`: janela Electron e isolamento.
- `tests/`: testes de geometria e interface.
- `vendor/`: componentes offline e respectivas licenças.

## Dados e backup

O salvamento automático usa o perfil local do aplicativo (`%APPDATA%/sci-fi-svg-lab`). Use **Salvar projeto** para criar um JSON que possa transportar e restaurar em **Abrir projeto**. SVG e HTML são exportações; o JSON é o formato de backup recomendado.

## Contribuir e reportar problemas

Abra uma issue com passos para reproduzir, versão do aplicativo, versão do Windows e, se possível, um projeto de exemplo sem dados pessoais. Para contribuir, crie uma branch, execute `npm test` e abra um pull request descrevendo o comportamento e sua validação.

Os testes de interface atuais usam caminhos do Playwright da máquina de desenvolvimento; adapte o import para sua instalação local de Playwright. Os testes `npm test` não dependem desses caminhos.

## Limitações

Prancheta fixa de 800 × 500; até 100 formas e 1.000 vértices por forma. Curvas livres importadas não são convertidas em pontos editáveis. A versão portátil não tem atualização automática.
