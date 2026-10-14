function repair(text: string, language: string) {
  let value =
    language === 'css'
      ? text
      : text.replace(/<[^>]*>/g, (tag) => tag.replace(/[“”]/g, '"').replace(/[‘’]/g, "'"));
  const fixes: Record<string, string> = {
    stoke: 'stroke',
    'stroke-wdith': 'stroke-width',
    'stroke-witdh': 'stroke-width',
    'backgroud-color': 'background-color',
    backgroud: 'background',
    colr: 'color',
  };
  if (language === 'css')
    value = value.replace(
      /\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|(?:^|[;{])\s*([\w-]+)(?=\s*:)/gm,
      (all, property) =>
        property && fixes[property] ? all.replace(property, fixes[property]) : all,
    );
  else
    value = value.replace(/<[^>]*>/g, (tag) => {
      Object.entries(fixes).forEach(([bad, good]) => {
        tag = tag.replace(new RegExp('\\b' + bad + '(?=\\s*=)', 'g'), good);
      });
      return tag;
    });
  if (language === 'svg') {
    value = value.replace(/\bd\s*=\s*(["'])([^"']+)\1/g, (all, quote, d) =>
      /^[\s\d.,+\-eEMmLlHhVv]+$/.test(d) && /^\s*[mM]/.test(d)
        ? `d=${quote}${d.trim()} Z${quote}`
        : all,
    );
    value = value.replace(
      /<(path|rect|polygon)\b([^<>]*?)(?<!\/)>(?![\s\S]*?<\/\1\s*>)/g,
      '<$1$2/>',
    );
    if (/<svg\b/.test(value) && !/<\/svg\s*>/.test(value)) value += '\n</svg>';
  } else if (language === 'css') {
    const clean = value.replace(/\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '');
    const depth = [...clean].reduce((n, c) => n + (c === '{' ? 1 : c === '}' ? -1 : 0), 0);
    if (depth > 0 && depth < 20) value += '\n' + '}\n'.repeat(depth);
  } else if (language === 'html') {
    const stack: string[] = [],
      voids = new Set([
        'area',
        'base',
        'br',
        'col',
        'embed',
        'hr',
        'img',
        'input',
        'link',
        'meta',
        'param',
        'source',
        'track',
        'wbr',
      ]);
    const tokens = value.replace(/<!--[\s\S]*?-->/g, '').match(/<\/?[a-zA-Z][^<>]*>/g) || [];
    for (const token of tokens) {
      const name = token.match(/^<\/?([\w-]+)/)![1].toLowerCase();
      if (voids.has(name) || /\/\s*>$/.test(token)) continue;
      if (/^<\//.test(token)) {
        if (stack.at(-1) === name) stack.pop();
        else return value;
      } else stack.push(name);
    }
    if (stack.length > 0 && stack.length < 30)
      value +=
        '\n' +
        stack
          .reverse()
          .map((t) => `</${t}>`)
          .join('\n');
  }
  return value;
}
function inspectHTML(text: string) {
  const stack: { name: string; line: number }[] = [],
    voids = new Set([
      'area',
      'base',
      'br',
      'col',
      'embed',
      'hr',
      'img',
      'input',
      'link',
      'meta',
      'param',
      'source',
      'track',
      'wbr',
    ]),
    optional = new Set([
      'html',
      'head',
      'body',
      'p',
      'li',
      'dt',
      'dd',
      'thead',
      'tbody',
      'tfoot',
      'tr',
      'td',
      'th',
      'option',
    ]);
  const tokens = text.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<\/?([a-zA-Z][\w:-]*)\b[^<>]*>/g);
  for (const match of tokens) {
    const token = match[0],
      name = match[1].toLowerCase();
    if (voids.has(name) || optional.has(name) || /\/\s*>$/.test(token)) continue;
    if (/^<\//.test(token)) {
      if (stack.at(-1)?.name === name) stack.pop();
      else
        return {
          message: `Fechamento </${name}> sem abertura correspondente.`,
          line: text.slice(0, match.index).split('\n').length,
        };
    } else stack.push({ name, line: text.slice(0, match.index).split('\n').length });
  }
  if (stack.length) {
    const item = stack.at(-1)!;
    return { message: `Falta fechar <${item.name}> com </${item.name}>.`, line: item.line };
  }
  return null;
}

export { repair, inspectHTML };
export default { repair, inspectHTML };
