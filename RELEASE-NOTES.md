# SVG Editor Generator 1.8.0

- Código da aplicação migrado para TypeScript com checagem estrita.
- Módulos de domínio, aplicação, infraestrutura e UI separados; contratos de dados e estados de arraste tipados.
- Renderer, parser SVG, persistência e ponte desktop testáveis independentemente.
- Build único para desktop e web; Monaco, workers e operações booleanas empacotados localmente.
- Tauri 2 + Rust substituem Electron; instalador Windows x64 com WebView2.
- Salvamento automático preservado, inclusive projetos vazios e HTML/CSS vazios.
- Clique próximo do ponto prioriza o vértice; seleção múltipla, arraste e histórico preservados.
- Tela preta em npm start corrigida: libera somente a origem de desenvolvimento configurada.
- Testes de tipos, geometria, persistência, interação DOM, ponte desktop e navegador integrados à validação.
- Campos em edição são preservados quando o layout é atualizado.
- Fluxo Windows verifica o carregamento real do executável no WebView2 antes de liberar o instalador.
- Distribuição web pelo GitHub Pages e release com instalador, código fonte e pacote web.

O instalador requer Windows x64 e WebView2. Não tem assinatura digital nem atualização automática. O aplicativo instalado e cada navegador/origem têm salvamentos automáticos independentes; dados antigos do Electron não são transferidos.
