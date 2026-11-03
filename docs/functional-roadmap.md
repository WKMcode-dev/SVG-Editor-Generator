# Evolução funcional do SVG Editor Generator

Objetivo: comportamento familiar de um editor de design completo, preservando tema e marca próprios e acesso ao código SVG sincronizado. Não há promessa de equivalência completa na versão 2.3.0.

| Área             | Estado atual                                                                                     | Trabalho pendente                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Seleção e grupos | Multisseleção, hierarquia simples, caixa única, movimento, escala, rotação e espelho do conjunto | Grupos aninhados gerais, seleção profunda, transformação em eixos locais e ângulo absoluto persistente |
| Propriedades     | X/Y/W/H do conjunto, proporção, cores sólidas, borda, opacidade, valores mistos                  | Múltiplos preenchimentos, gradientes, traços e efeitos configuráveis                                   |
| Vetores          | Formas, edição de pontos/segmentos, cantos, elipses com quatro pontos, booleanos editáveis       | Caneta, caminhos abertos gerais, alças Bézier, unir/separar nós, contorno de traço                     |
| Estrutura        | Camadas, grupos, arraste para ordenar, bloquear, ocultar e renomear                              | Frames reais, clipping, páginas independentes, constraints e Auto Layout                               |
| Conteúdo         | SVG e mídia importada, presets                                                                   | Texto vetorial editável e tipografia, componentes e instâncias                                         |
| Navegação        | Grade adaptativa, alinhamento, zoom/pan, atalhos, painéis mobile                                 | Réguas, guias arrastáveis e medições de distância                                                      |
| Código e dados   | SVG/HTML/CSS sincronizados, JSON, autosave, histórico                                            | Fidelidade de importação de todos os comandos e atributos SVG                                          |
| Fluxos avançados | Aplicativo local e web                                                                           | Protótipos, colaboração simultânea, histórico compartilhado e plugins                                  |

## Verificação por entrega

Cada entrega deve exercitar o fluxo completo no navegador e no executável Windows, incluindo grupos, histórico e exportação. Testes automatizados de UI devem validar os comportamentos novos. Mobile deve preservar acesso às ferramentas por toque; validação física de drivers de touchpad continua dependente do dispositivo.
