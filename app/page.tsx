'use client';
import { useEffect, useMemo, useState } from 'react';
import protobuf from 'protobufjs';

type RecordRow = string[];
type VersionState = { current: string; available: string | null };
const Indicativos = protobuf.Root.fromJSON({
  nested: {
    Indicativos: { fields: { records: { rule: 'repeated', type: 'Registro', id: 1 } } },
    Registro: {
      fields: {
        tipoIdentificacao: { type: 'string', id: 1 },
        cnpjOuCpf: { type: 'string', id: 2 },
        nomeEntidade: { type: 'string', id: 3 },
        fistel: { type: 'string', id: 4 },
        servico: { type: 'string', id: 5 },
        indicativo: { type: 'string', id: 6 },
        coer: { type: 'string', id: 7 },
        ufEntidade: { type: 'string', id: 8 },
        numeroEstacao: { type: 'string', id: 9 },
        nomeEstacao: { type: 'string', id: 10 },
        tipoEstacao: { type: 'string', id: 11 },
        frequenciasOperacao: { type: 'string', id: 12 },
        ufEstacao: { type: 'string', id: 13 },
        municipioEstacao: { type: 'string', id: 14 },
        statusValidade: { type: 'string', id: 18 },
      },
    },
  },
}).lookupType('Indicativos');

export default function Home() {
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState<VersionState>({ current: '', available: null });
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
    }
    fetch('/version.json', { cache: 'no-store' })
      .then((response) => response.json())
      .then(({ version: current }) => setVersion({ current, available: null }));
    const timer = window.setInterval(() => {
      fetch('/version.json', { cache: 'no-store' })
        .then((response) => response.json())
        .then(({ version: available }) =>
          setVersion((state) => ({
            ...state,
            available: state.current && state.current !== available ? available : null,
          })),
        )
        .catch(() => undefined);
    }, 60_000);
    fetch('/data/indicativos.pb.gz')
      .then(async (r) => {
        const stream = r.body?.pipeThrough(new DecompressionStream('gzip'));
        return new Response(stream ?? r.body).arrayBuffer();
      })
      .then((buffer) => {
        const decoded = Indicativos.decode(new Uint8Array(buffer)) as protobuf.Message & {
          records: Array<Record<string, string>>;
        };
        setRecords(
          decoded.records.map((row) => [
            row.tipoIdentificacao,
            row.cnpjOuCpf,
            row.nomeEntidade,
            row.fistel,
            row.servico,
            row.indicativo,
            row.coer,
            row.ufEntidade,
            row.numeroEstacao,
            row.nomeEstacao,
            row.tipoEstacao,
            row.frequenciasOperacao,
            row.ufEstacao,
            row.municipioEstacao,
            row.statusValidade,
          ]),
        );
      })
      .finally(() => setLoading(false));
    return () => window.clearInterval(timer);
  }, []);
  const results = useMemo(() => {
    const q = query.trim().toLocaleUpperCase();
    if (!q) return [];
    const exactMatches = records.filter((row) => row[5]?.toLocaleUpperCase() === q);
    if (exactMatches.length) return exactMatches;
    return records
      .filter((row) => row[5]?.toLocaleUpperCase().startsWith(q))
      .sort((a, b) => a[5].localeCompare(b[5], 'pt-BR'))
      .slice(0, 80);
  }, [query, records]);
  return (
    <main>
      {version.available && (
        <button className="updateNotice" onClick={() => window.location.reload()}>
          Nova versão disponível · atualizar agora ↗
        </button>
      )}
      <div className="orb orbA" />
      <div className="orb orbB" />
      <section className="shell">
        <header>
          <div className="brand">
            <span className="mark">⌁</span>
            <span>
              INDICATIVOS<span className="dot">.</span>
            </span>
          </div>
          <span className="badge">BASE NACIONAL</span>
        </header>
        <div className="hero">
          <p className="eyebrow">DADOS DE ESTAÇÕES</p>
          <h1>
            Encontre um
            <br />
            <em>indicativo.</em>
          </h1>
          <p className="subtitle">
            Pesquise instantaneamente na base de indicativos de radioamador.
          </p>
          <div className="search">
            <span>⌕</span>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Digite o indicativo..."
            />
            <kbd>⌘ K</kbd>
          </div>
          <div className="meta">
            <span className="pulse" />{' '}
            {loading
              ? 'Carregando base...'
              : `${records.length.toLocaleString('pt-BR')} registros disponíveis`}
            <span className="hint">Busca em tempo real</span>
          </div>
        </div>
        {query && (
          <div className="results">
            <div className="resultHead">
              <span>RESULTADOS</span>
              <small>
                {results.length}
                {results.length === 80 ? '+' : ''} encontrados
              </small>
            </div>
            {results.length ? (
              results.map((row, i) => (
                <article className="card" key={`${row[5]}-${i}`}>
                  <div className="call">{row[5]}</div>
                  <div className="details">
                    <div className="nameLine">
                      <strong className="radioName">{row[2]}</strong>
                      {row[6] && (
                        <span className={`classBadge class${row[6].replace('Classe ', '')}`}>
                          {row[6]}
                        </span>
                      )}
                    </div>
                    <span>
                      {row[4]} · {row[0]}
                    </span>
                    <div className="stationInfo">
                      <span>{row[10] || 'N/I'}</span>
                      <span>COER: {row[6] || 'N/I'}</span>
                      <span>
                        {row[13] || 'N/I'} - {row[12] || 'N/I'}
                      </span>
                    </div>
                  </div>
                  <div className="id">{row[1]}</div>
                </article>
              ))
            ) : (
              <div className="empty">
                Nenhum indicativo encontrado para <strong>{query}</strong>.
              </div>
            )}
          </div>
        )}{' '}
        {!query && (
          <div className="welcome">
            <span>↳</span>
            <p>Comece digitando acima para explorar os registros.</p>
          </div>
        )}
        <footer>
          <span>PY3SC · SISTEMA DE CONSULTA</span>
          <span>CLIENT-SIDE / OFFLINE READY</span>
        </footer>
      </section>
    </main>
  );
}
