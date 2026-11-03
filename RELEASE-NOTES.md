# SVG Editor Generator 2.3.0

- Caixa de seleção única com redimensionamento e rotação para grupos e seleções múltiplas.
- X, Y, largura, altura e corrente de proporção operam sobre o conjunto, preservando espaçamentos relativos.
- Rotação e espelhamento usam um pivô compartilhado. Shift ajusta a alça em 15°.
- Preenchimento, borda, espessura, opacidade e junção podem ser alterados em várias formas; o painel indica valores mistos.
- Elipses mantêm seus quatro pontos ao rotacionar, sem conversão em dezenas de vértices.
- Transformações de resultados booleanos continuam propagando às fontes editáveis.
- Histórico, salvamento e código SVG usam a mesma geometria das transformações visuais.

Esta entrega inicia a revisão funcional do editor. Ainda não é equivalência completa: ferramentas de caneta e curvas Bézier gerais, frames, Auto Layout, componentes, texto, gradientes e prototipagem estão pendentes. Consulte docs/functional-roadmap.md.
