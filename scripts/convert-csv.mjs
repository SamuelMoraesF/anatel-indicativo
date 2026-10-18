import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import zlib from 'node:zlib';
import protobuf from 'protobufjs';
import XLSX from 'xlsx';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const sourcePath = path.join(root, 'Estacoes_Radioamador.csv');
const startedAt = Date.now();

const log = (message) => console.log(`[convert] ${new Date().toISOString()} ${message}`);

if (!fs.existsSync(sourcePath)) {
  throw new Error(`Arquivo de origem não encontrado: ${sourcePath}`);
}

const sourceStats = fs.statSync(sourcePath);
const sourceMd5 = crypto.createHash('md5').update(fs.readFileSync(sourcePath)).digest('hex');
log(`CSV de origem: ${sourceStats.size} bytes; md5=${sourceMd5}`);

const workbook = XLSX.readFile(sourcePath, { cellDates: false });
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {
  header: 1,
  defval: '',
});
const header = rows.shift() ?? [];
log(`Planilha lida: ${rows.length} linhas de dados; ${header.length} colunas`);

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

// Ordem das colunas do CSV da Anatel:
// tipo, documento, entidade, fistel, serviço, indicativo, número,
// UF entidade, COER, estação, tipo estação, frequências, município, UF estação...
const records = rows
  .filter((row) => row.some(Boolean))
  .map((row) => ({
    tipoIdentificacao: normalize(row[0]),
    cnpjOuCpf: normalize(row[1]),
    nomeEntidade: normalize(row[2]),
    fistel: normalize(row[3]),
    servico: normalize(row[4]),
    indicativo: normalize(row[5]),
    numeroEstacao: normalize(row[6]),
    ufEntidade: normalizeUf(row[7]),
    coer: normalize(row[8]),
    nomeEstacao: normalize(row[9]),
    tipoEstacao: normalize(row[10]),
    frequenciasOperacao: normalize(row[11]),
    municipioEstacao: normalize(row[12]),
    ufEstacao: normalizeUf(row[13]),
    dataPrimeiroLicenciamento: normalize(row[14]),
    dataUltimoLicenciamento: normalize(row[15]),
    dataValidadeEstacao: normalize(row[16]),
    statusValidade: normalize(row[17]),
  }));

const binary = Indicativos.encode(Indicativos.create({ records })).finish();
const compressed = zlib.gzipSync(binary, { level: 9 });
fs.writeFileSync(path.join(root, 'public/data/indicativos.pb'), binary);
fs.writeFileSync(path.join(root, 'public/data/indicativos.pb.gz'), compressed);
const version = crypto.createHash('sha256').update(binary).digest('hex').slice(0, 12);
fs.writeFileSync(path.join(root, 'public/version.json'), `${JSON.stringify({ version })}\n`);

log(`Registros protobuf: ${records.length}`);
log(`Protobuf: ${(binary.length / 1024).toFixed(1)} KB`);
log(`Protobuf gzip: ${(compressed.length / 1024).toFixed(1)} KB`);
log(`Versão gerada: ${version}`);
log(`Conversão concluída em ${Date.now() - startedAt} ms`);
