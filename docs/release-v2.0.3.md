# SVG Editor Generator 2.0.3

- Zoom pelo canvas aceita pinça Ctrl/Command+wheel e rolagem vertical sem modificador como alternativa para touchpads antigos.
- Shift+rolagem, ferramenta Mão e rolagem horizontal movem o canvas.
- Zoom preserva a posição sob o cursor e limita deltas excessivos.
- Eventos de wheel em captura, sem listener passivo, para controlar o gesto no canvas.
- Gestos WebKit evitam zoom duplicado com wheel e encerram seu estado ao terminar/perder foco.
- Testados eventos simulados em Chromium; validação física do driver do notebook ainda necessária.
