import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import XLSX from 'xlsx';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const workbook = XLSX.readFile(path.join(root, 'indicativos.xlsx'), { cellDates: false });
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {
  header: 1,
  defval: '',
});
const headers = rows.shift();
const dictionary = [];
const ids = new Map();
const intern = (value) => {
  const text = String(value ?? '');
  if (!ids.has(text)) {
    ids.set(text, dictionary.length);
    dictionary.push(text);
  }
  return ids.get(text);
};
const payload = {
  h: headers,
  d: dictionary,
  r: rows.filter((row) => row.some(Boolean)).map((row) => row.map(intern)),
};
const output = zlib.gzipSync(JSON.stringify(payload), { level: 9 });
fs.writeFileSync(path.join(root, 'public/data/indicativos.json.gz'), output);
console.log(`Gerado: ${(output.length / 1024).toFixed(1)} KB (${payload.r.length} registros)`);
