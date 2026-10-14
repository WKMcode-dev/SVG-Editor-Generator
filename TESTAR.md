# Testar a versão 1.8.0

## Web

Execute npm ci e npm run dev:web; abra http://127.0.0.1:8080. A versão publicada no GitHub Pages não exige instalar Node ou Rust.

## Desktop Windows

Instale Node.js 22+, Rust estável MSVC, Visual Studio Build Tools com C++/Windows SDK e WebView2. Execute npm ci, npm test, npm run test:desktop e npm start. Para gerar o instalador, execute npm run dist; ele fica em src-tauri/target/release/bundle/nsis.

## Conferência manual

1. Criar, mover, redimensionar e arredondar uma forma; testar desfazer/refazer.
2. Clicar até 8 px de um ponto com zoom baixo/alto: selecionar só o ponto. No meio da linha, selecionar suas extremidades.
3. Arrastar um ponto de seleção múltipla: mover o grupo. Clicar simplesmente: selecionar somente aquele ponto.
4. Testar grade, botão central, Ctrl+roda e atalhos.
5. Editar SVG/HTML/CSS no Monaco; conferir autocomplete, diagnósticos, prévia e cópia.
6. Salvar JSON, reabrir e exportar SVG/HTML. Cancelar a janela de salvar não deve informar sucesso.
7. Fechar e abrir no mesmo perfil: restaurar formas, grade, fundo e HTML/CSS, inclusive quando vazios.
8. Confirmar que npm start e o instalador carregam a interface no Windows.

## Testes automatizados

npm run typecheck, npm test e npm run test:desktop conferem tipos, domínio, armazenamento e interação em DOM simulado. Os testes Happy DOM fornecem layout/pointer capture simulados; não validam pixels nem o WebView2.

Para cliques reais: npm run build:web, npm run build:tests, npx playwright install chromium e npm run test:ui. O runner abre seu próprio servidor. TEST_BROWSER_CHANNEL pode selecionar msedge; TEST_BROWSER_EXECUTABLE pode selecionar um Chromium instalado.

Para o backend: npm run build:web e cargo test --manifest-path src-tauri/Cargo.toml. O workflow Windows executa essa validação antes de compilar/publicar o instalador.
