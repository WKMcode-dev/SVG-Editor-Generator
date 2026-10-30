# SVG Editor Generator 2.0.0

- Canvas livre e exportação SVG calculada pelos limites do desenho, sem área fixa de 800 × 500.
- Barra inferior flutuante com menu de formas e interface clara de cores neutras.
- Ferramentas de arraste: R retângulo, O elipse, L linha, Shift+L seta; polígono e estrela no menu. Shift restringe proporções/ângulos.
- Um clique seleciona; duplo clique ou Enter entra na edição de pontos; Esc sai.
- Imagens e vídeos por Ctrl+Shift+K, com reprodução de vídeo, redimensionamento e espelhamento. Mídia incorporada ao projeto, até 12 MB por arquivo e cerca de 24 MB no projeto.
- Gestos de pinça para touchpad, WebKit e dois ponteiros touch; redimensionar painéis preserva zoom.
- Camadas com renomeação inline, bloqueio, visibilidade, grupos recolhíveis e presets pessoais locais.
- Inspetor com Posição, Layout, Aparência, Preenchimento, Borda, Efeitos e Exportação; botão de código preservado.
- Autosave de projetos grandes em IndexedDB, com restauração ao iniciar e histórico com limite de memória.
- Sincronização entre código e canvas protege novas edições contra correções pendentes antigas.

As elipses viram polígonos de 96 vértices ao editar pontos; a conversão pode ser desfeita. Vídeos em SVG usam foreignObject e exigem um visualizador compatível; a exportação HTML é indicada para compartilhar a reprodução. Navegador e desktop têm armazenamentos locais independentes.
