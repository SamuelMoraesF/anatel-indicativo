import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const sourcePath = path.join(root, 'Estacoes_Radioamador.csv');
const zipUrl =
  'https://www.anatel.gov.br/dadosabertos/paineis_de_dados/outorga_e_licenciamento/estacoes_licenciadas.zip';
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'indicativos-update-'));
const zipPath = path.join(tempDir, 'estacoes_licenciadas.zip');
const extractedPath = path.join(tempDir, 'Estacoes_Radioamador.csv');
const startedAt = Date.now();

const log = (message) => console.log(`[update] ${new Date().toISOString()} ${message}`);
const md5 = (filePath) => crypto.createHash('md5').update(fs.readFileSync(filePath)).digest('hex');
const formatBytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

const cleanup = () => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  log(`Temporários removidos: ${tempDir}`);
};
process.on('exit', cleanup);

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} falhou com código ${result.status}: ${result.stderr}`);
  }
  return result.stdout;
};

try {
  log(`Início; origem=${zipUrl}`);
  log(`Destino versionado=${sourcePath}`);

  log('Baixando ZIP da Anatel...');
  const download = run('curl', [
    '--fail',
    '--location',
    '--retry',
    '3',
    '--connect-timeout',
    '30',
    '--max-time',
    '300',
    '--silent',
    '--show-error',
    zipUrl,
    '--output',
    zipPath,
  ]);
  if (download) process.stdout.write(download);
  log(`ZIP baixado: ${formatBytes(fs.statSync(zipPath).size)}`);

  const entries = run('unzip', ['-Z1', zipPath])
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const csvEntry = entries.find(
    (entry) => path.basename(entry).toLowerCase() === 'estacoes_radioamador.csv',
  );
  if (!csvEntry) {
    throw new Error(`CSV Estacoes_Radioamador.csv não encontrado. Arquivos: ${entries.join(', ')}`);
  }
  log(`CSV encontrado no ZIP: ${csvEntry}`);

  const csvBuffer = execFileSync('unzip', ['-p', zipPath, csvEntry], {
    maxBuffer: 50 * 1024 * 1024,
  });
  fs.writeFileSync(extractedPath, csvBuffer);
  log(`CSV extraído: ${formatBytes(csvBuffer.length)}; md5=${md5(extractedPath)}`);

  const oldMd5 = fs.existsSync(sourcePath) ? md5(sourcePath) : null;
  const newMd5 = md5(extractedPath);
  log(`MD5 versionado: ${oldMd5 ?? '(não existe)'}`);
  log(`MD5 baixado:    ${newMd5}`);

  if (oldMd5 === newMd5) {
    log('Nenhuma alteração detectada; conversão e escrita ignoradas.');
    log(`Fim sem mudanças em ${Date.now() - startedAt} ms`);
    process.exitCode = 0;
  } else {
    log(
      oldMd5
        ? 'Alteração detectada; substituindo CSV versionado.'
        : 'CSV ainda não versionado; criando arquivo.',
    );
    fs.copyFileSync(extractedPath, sourcePath);
    log(`CSV salvo: ${formatBytes(fs.statSync(sourcePath).size)}; md5=${md5(sourcePath)}`);

    log('Importando CSV e regenerando Protobuf...');
    const conversion = run(process.execPath, [path.join(root, 'scripts/convert-csv.mjs')], {
      cwd: root,
    });
    process.stdout.write(conversion);
    log('Importação concluída; arquivos derivados atualizados.');
    log(`Fim com mudanças em ${Date.now() - startedAt} ms`);
  }
} catch (error) {
  console.error(`[update] ${new Date().toISOString()} ERRO: ${error.message}`);
  process.exitCode = 1;
}
