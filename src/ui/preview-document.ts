export function cleanDocument(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,iframe,object,embed,link,base,meta').forEach((n) => n.remove());
  doc.querySelectorAll('*').forEach((n) =>
    [...n.attributes].forEach((a) => {
      if (
        /^on/i.test(a.name) ||
        ['srcdoc', 'formaction'].includes(a.name) ||
        (['href', 'src', 'xlink:href'].includes(a.name) && !/^data:image\//i.test(a.value))
      )
        n.removeAttribute(a.name);
    }),
  );
  return doc.body.innerHTML;
}
export function exportDocument(html: string, cssText: string) {
  const css = cssText.replace(/<\/style/gi, '<\\/style');
  return `<!doctype html>\n<html lang="pt-BR">\n<head>\n    <meta charset="utf-8">\n    <meta name="viewport" content="width=device-width,initial-scale=1">\n    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:">\n    <title>Meu design SVG</title>\n    <style>\n${css}\n    </style>\n</head>\n<body>\n${cleanDocument(html)}\n</body>\n</html>`;
}
