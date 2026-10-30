# SVG Editor Generator 2.1.0

- Zoom por Ctrl/Command+scroll cinco vezes menos sensível, com variação máxima de cerca de 13% por evento. Rolagem simples continua movendo o canvas.
- Guias X/Y para vértices, centros e meios de segmentos, com encaixe antes da grade e indicação rosa nos pontos/segmentos alinhados.
- Operações booleanas criam grupos editáveis e preservam as formas originais. Expanda nas camadas, selecione uma fonte e arraste para atualizar o resultado sem desfazer.
- Translação, dimensões, rotação, espelhamento, duplicação, grupos aninhados, desfazer/refazer, JSON, SVG com metadados, presets e autosave preservam a hierarquia.
- Ctrl+Shift+G desfaz o grupo e recupera as fontes.
- Grupos sem área continuam disponíveis para edição nas camadas.
- Limite de 100 camadas contando grupos e fontes. Mídia e linhas abertas continuam fora das operações booleanas.
