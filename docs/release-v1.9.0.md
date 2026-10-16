# SVG Editor Generator 1.9.0

- Espaço de trabalho com camadas à esquerda, ferramentas no topo, canvas central e inspetor de propriedades à direita.
- Busca por nome, renomeação por duplo clique e ordem de empilhamento das camadas com seleção múltipla.
- Campos X/Y para posicionar a forma inteira sem deformação.
- Seis alinhamentos: à prancheta para uma forma, ou aos limites da seleção para várias formas.
- Enquadramento da seleção e atalhos Shift+1/2, Ctrl+A, R, Ctrl+]/[ e ajuda pelo botão ?.
- Setas movem formas inteiras; seleção explícita de pontos/segmentos continua permitindo edição parcial.
- Inspetor com seções recolhíveis e interface validada a partir de 980 × 700 px.
- Mantidos TypeScript estrito, Tauri/Rust, salvamento automático, operações booleanas, precisão dos pontos e Monaco offline.
- Testes cobrem edição, histórico, persistência, camadas, alinhamentos e layout em navegador real.

O aplicativo Windows e a versão web têm salvamentos locais independentes. O projeto continua sendo um editor vetorial SVG: esta versão não inclui componentes vinculados, Auto Layout, colaboração ou prototipagem de telas.
