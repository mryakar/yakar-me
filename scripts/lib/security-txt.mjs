const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export function securityTxtErrors(text, now = new Date()) {
  const errors = [];
  const fields = [];
  for (const line of text.split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const field = /^([A-Za-z-]+): (\S.*)$/.exec(line);
    if (field) fields.push({ name: field[1].toLowerCase(), value: field[2] });
    else errors.push(`malformed line: ${line.slice(0, 60)}`);
  }
  const values = (name) => fields.filter((f) => f.name === name).map((f) => f.value);
  if (!values('contact').length) errors.push('no Contact field');
  const expires = values('expires');
  if (expires.length !== 1) {
    errors.push(`${expires.length} Expires fields, exactly one is required`);
    return errors;
  }
  const date = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(expires[0]) ? new Date(expires[0]) : null;
  if (!date || Number.isNaN(date.valueOf())) errors.push(`Expires is not an RFC 3339 date-time: ${expires[0]}`);
  else if (date <= now) errors.push(`Expires has passed: ${expires[0]}`);
  else if (date.valueOf() - now.valueOf() > YEAR_MS) errors.push(`Expires is more than a year away: ${expires[0]}`);
  return errors;
}
