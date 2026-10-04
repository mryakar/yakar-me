const NAME = '[A-Za-z_][\\w.:-]*';
const ENTITY = '&(?:amp|lt|gt|quot|apos|#\\d+|#x[0-9a-fA-F]+);';
const TEXT = new RegExp(`^(?:[^&<]|${ENTITY})*$`);
const ATTRS = new RegExp(`^(?:\\s+${NAME}\\s*=\\s*"(?:[^"&<]|${ENTITY})*")*\\s*$`);
const TAG = new RegExp(`^<(/?)(${NAME})([^>]*?)(/?)>$`);

export function xmlErrors(xml) {
  const errors = [];
  const body = xml.replace(/^<\?xml\s[^?]*\?>/, '');
  const stack = [];
  let roots = 0;
  for (const [token] of body.matchAll(/<[^>]*>|[^<]+|</g)) {
    if (!token.startsWith('<')) {
      if (!TEXT.test(token)) errors.push(`invalid text: ${token.trim().slice(0, 60)}`);
      else if (!stack.length && token.trim()) errors.push(`text outside the root element: ${token.trim().slice(0, 60)}`);
      continue;
    }
    const tag = TAG.exec(token);
    if (!tag) {
      errors.push(`unsupported or broken markup: ${token.slice(0, 60)}`);
      continue;
    }
    const [, closing, name, attrs, selfClosing] = tag;
    if (closing) {
      if (attrs.trim() || selfClosing) errors.push(`malformed end tag: ${token}`);
      const open = stack.pop();
      if (open !== name) errors.push(`</${name}> closes <${open ?? 'nothing'}>`);
      continue;
    }
    if (!ATTRS.test(attrs)) errors.push(`invalid attributes on <${name}>: ${attrs.trim().slice(0, 60)}`);
    if (!stack.length) roots += 1;
    if (!selfClosing) stack.push(name);
  }
  if (stack.length) errors.push(`unclosed: ${stack.map((n) => `<${n}>`).join(' ')}`);
  if (roots !== 1) errors.push(`${roots} root elements`);
  return errors;
}
