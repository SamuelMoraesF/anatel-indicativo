'use client';
import { useEffect, useMemo, useState } from 'react';
import protobuf from 'protobufjs';

type RecordRow = {
  tipoIdentificacao?: string;
  cnpjOuCpf?: string;
  nomeEntidade?: string;
  fistel?: string;
  servico?: string;
  indicativo?: string;
  coer?: string;
  ufEntidade?: string;
  numeroEstacao?: string;
  nomeEstacao?: string;
  tipoEstacao?: string;
  frequenciasOperacao?: string;
  ufEstacao?: string;
  municipioEstacao?: string;
  statusValidade?: string;
};
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
  const [selectedRecord, setSelectedRecord] = useState<RecordRow | null>(null);
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
          records: RecordRow[];
        };
        setRecords(decoded.records);
      })
      .finally(() => setLoading(false));
    return () => window.clearInterval(timer);
  }, []);
  const results = useMemo(() => {
    const q = query.trim().toLocaleUpperCase();
    if (!q) return [];
    const exactMatches = records.filter((row) => row.indicativo?.toLocaleUpperCase() === q);
    if (exactMatches.length) return exactMatches.slice(0, 10);
    return records
      .filter((row) => row.indicativo?.toLocaleUpperCase().startsWith(q))
      .sort((a, b) => (a.indicativo ?? '').localeCompare(b.indicativo ?? '', 'pt-BR'))
      .slice(0, 10);
  }, [query, records]);
  useEffect(() => {
    if (!selectedRecord) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedRecord(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedRecord]);
  const selectedFields: [string, string][] = selectedRecord
    ? ([
        ['Indicativo', selectedRecord.indicativo],
        ['Tipo de identificação', selectedRecord.tipoIdentificacao],
        ['CNPJ ou CPF', selectedRecord.cnpjOuCpf],
        ['Nome da entidade', selectedRecord.nomeEntidade],
        ['Fistel', selectedRecord.fistel],
        ['Serviço', selectedRecord.servico],
        ['Classe COER', selectedRecord.coer],
        ['UF da entidade', selectedRecord.ufEntidade],
        ['Número da estação', selectedRecord.numeroEstacao],
        ['Nome da estação', selectedRecord.nomeEstacao],
        ['Tipo da estação', selectedRecord.tipoEstacao],
        ['Frequências de operação', selectedRecord.frequenciasOperacao],
        ['UF da estação', selectedRecord.ufEstacao],
        ['Município da estação', selectedRecord.municipioEstacao],
        ['Status de validade', selectedRecord.statusValidade],
      ] as [string, string | undefined][]).filter((field) => Boolean(field[1]?.trim())) as [
        string,
        string,
      ][]
    : [];
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
              onChange={(e) => setQuery(e.target.value.toLocaleUpperCase())}
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
                encontrados
              </small>
            </div>
            {results.length ? (
              results.map((row, i) => (
                <article
                  className="card"
                  key={`${row.indicativo}-${i}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedRecord(row)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedRecord(row);
                    }
                  }}
                >
                  <div className="call">{row.indicativo}</div>
                  <div className="details">
                    <div className="nameLine">
                      <strong className="radioName">{row.nomeEntidade}</strong>
                      {row.coer && (
                        <span className={`classBadge class${row.coer.replace('Classe ', '')}`}>
                          {row.coer}
                        </span>
                      )}
                    </div>
                    <div className="stationInfo">
                      {(row.municipioEstacao || row.ufEstacao) && (
                        <span>
                          {[row.municipioEstacao, row.ufEstacao].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="id">{row.tipoEstacao || 'N/I'}</div>
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
      {selectedRecord && (
        <div className="modalBackdrop" onClick={() => setSelectedRecord(null)}>
          <section
            className="recordModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recordModalTitle"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modalClose"
              type="button"
              aria-label="Fechar detalhes"
              onClick={() => setSelectedRecord(null)}
            >
              ×
            </button>
            <p className="eyebrow">DETALHES DO REGISTRO</p>
            <h2 id="recordModalTitle">{selectedRecord.indicativo || 'Estação'}</h2>
            <dl className="recordFields">
              {selectedFields.map(([label, value]) => (
                <div className="recordField" key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      )}
    </main>
  );
}
