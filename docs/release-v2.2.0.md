# SVG Editor Generator 2.2.0

- Habilita o recebimento de pinça no WebView2 do Windows, mantendo o zoom no canvas e a escala da interface constante.
- Teste nativo do executável cobre pinça sintetizada, Ctrl+wheel, rolagem sem zoom e restauração da câmera.
- Skew horizontal e vertical de -80° a 80°, aplicado à geometria e compatível com grupos booleanos, histórico e exportação.
- Cantos com alvos invisíveis de 28 px; na edição de pontos, os alvos de resize saem para evitar conflito.
- Camadas reordenáveis com mouse, alça de toque ou setas na alça. Grupos mantêm sua hierarquia e ordem booleana.
- Ativar/desativar borda preserva cor e espessura, inclusive no JSON e nos metadados do SVG.
- Ícone de corrente substitui o checkbox de proporção.
- Mobile: canvas em largura total, painéis sobrepostos, barra em duas linhas, alças de toque, campos maiores e editor de código em tela cheia.
- Testes de interface em 360 px, 390 px e desktop; a validação física do driver de cada notebook continua dependendo do dispositivo.
