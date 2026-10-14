const http = require('node:http'),
  fs = require('node:fs'),
  path = require('node:path');
const root = path.resolve(__dirname, '../dist');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};
function createServer() {
  return http.createServer((request, response) => {
    let decoded;
    try {
      decoded = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    } catch {
      response.writeHead(400).end();
      return;
    }
    const prefix = '/SVG-Editor-Generator';
    if (decoded.startsWith(prefix + '/')) decoded = decoded.slice(prefix.length);
    const file = path.resolve(
      root,
      '.' + (decoded.endsWith('/') ? decoded + 'index.html' : decoded),
    );
    if (!file.startsWith(root + path.sep)) {
      response.writeHead(403).end();
      return;
    }
    fs.readFile(file, (error, data) => {
      if (error) {
        response.writeHead(404).end('Not found');
        return;
      }
      response.writeHead(200, {
        'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
      });
      response.end(data);
    });
  });
}
module.exports = { createServer };
if (require.main === module)
  createServer().listen(Number(process.env.PORT || 8080), '127.0.0.1', () =>
    console.log('Editor: http://127.0.0.1:8080'),
  );
