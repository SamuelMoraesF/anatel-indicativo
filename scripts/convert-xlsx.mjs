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
const records = rows
  .filter((row) => row.some(Boolean))
  .map((row) => ({
    tipoIdentificacao: String(row[0] ?? ''),
    cnpjOuCpf: String(row[1] ?? ''),
    nomeEntidade: String(row[2] ?? ''),
    fistel: String(row[3] ?? ''),
    servico: String(row[4] ?? ''),
    indicativo: String(row[5] ?? ''),
    coer: String(row[6] ?? ''),
    ufEntidade: String(row[7] ?? ''),
    numeroEstacao: String(row[8] ?? ''),
    nomeEstacao: String(row[9] ?? ''),
    tipoEstacao: String(row[10] ?? ''),
    frequenciasOperacao: String(row[11] ?? ''),
    ufEstacao: String(row[12] ?? ''),
    municipioEstacao: String(row[13] ?? ''),
    statusValidade: String(row[17] ?? ''),
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
