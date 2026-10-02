'use client';
import { useEffect, useMemo, useState } from 'react';

type RecordRow = string[];
const fields = [
  'Tipo de Identificação',
  'CNPJ ou CPF',
  'Nome da Entidade',
  'Fistel do Serviço da Estação',
  'Serviço',
  'Indicativo',
];

export default function Home() {
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/data/indicativos.json.gz')
      .then(async (r) => {
        const stream = r.body?.pipeThrough(new DecompressionStream('gzip'));
        const text = await new Response(stream ?? r.body).text();
        const p = JSON.parse(text);
        setRecords(p.r.map((row: number[]) => row.map((i) => p.d[i])));
      })
      .finally(() => setLoading(false));
  }, []);
  const results = useMemo(() => {
    const q = query.trim().toLocaleUpperCase();
    if (!q) return [];
    return records
      .filter((row) => row[5]?.toLocaleUpperCase().includes(q))
      .sort((a, b) => {
        const aCall = a[5].toLocaleUpperCase();
        const bCall = b[5].toLocaleUpperCase();
        const aExact = aCall === q ? 0 : 1;
        const bExact = bCall === q ? 0 : 1;
        return aExact - bExact || aCall.localeCompare(bCall, 'pt-BR');
      })
      .slice(0, 80);
  }, [query, records]);
  return (
    <main>
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
                    <strong>{row[2]}</strong>
                    <span>
                      {row[4]} · {row[0]}
                    </span>
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
