import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import zlib from 'node:zlib';
import protobuf from 'protobufjs';
import XLSX from 'xlsx';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const workbook = XLSX.readFile(path.join(root, 'indicativos.xlsx'), { cellDates: false });
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {
  header: 1,
  defval: '',
});
rows.shift();
const schema = await protobuf.load(path.join(root, 'indicativos.proto'));
const Indicativos = schema.lookupType('Indicativos');
const nullMarkers = new Set(['N/I', 'N/A']);
const normalize = (value) => {
  const text = String(value ?? '').trim();
  return !text || nullMarkers.has(text.toUpperCase()) ? null : text;
};
const normalizeUf = (value) => {
  const text = normalize(value);
  if (!text) return null;
  const aliases = { BAHIA: 'BA', MG: 'MG', PR: 'PR', RJ: 'RJ' };
  return aliases[text.toUpperCase()] ?? text.toUpperCase();
};
const records = rows
  .filter((row) => row.some(Boolean))
  .map((row) => ({
    tipoIdentificacao: normalize(row[0]),
    cnpjOuCpf: normalize(row[1]),
    nomeEntidade: normalize(row[2]),
    fistel: normalize(row[3]),
    servico: normalize(row[4]),
    indicativo: normalize(row[5]),
    coer: normalize(row[6]),
    ufEntidade: normalizeUf(row[7]),
    numeroEstacao: normalize(row[8]),
    nomeEstacao: normalize(row[9]),
    tipoEstacao: normalize(row[10]),
    frequenciasOperacao: normalize(row[11]),
    ufEstacao: normalizeUf(row[12]),
    municipioEstacao: normalize(row[13]),
    statusValidade: normalize(row[17]),
  }));
const binary = Indicativos.encode(Indicativos.create({ records })).finish();
const compressed = zlib.gzipSync(binary, { level: 9 });
fs.writeFileSync(path.join(root, 'public/data/indicativos.pb'), binary);
fs.writeFileSync(path.join(root, 'public/data/indicativos.pb.gz'), compressed);
const version = crypto.createHash('sha256').update(binary).digest('hex').slice(0, 12);
fs.writeFileSync(path.join(root, 'public/version.json'), `${JSON.stringify({ version })}\n`);
console.log(`Protobuf: ${(binary.length / 1024).toFixed(1)} KB`);
console.log(
  `Protobuf gzip: ${(compressed.length / 1024).toFixed(1)} KB (${records.length} registros)`,
);
