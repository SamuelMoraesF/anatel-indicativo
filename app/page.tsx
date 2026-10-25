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
  dataPrimeiroLicenciamento?: string;
  dataUltimoLicenciamento?: string;
  dataValidadeEstacao?: string;
  statusValidade?: string;
};
type FieldKey = keyof RecordRow;
type IndicativoGroup = {
  indicativo: string;
  records: RecordRow[];
  latestRecord: RecordRow;
  coer?: string;
  municipalities: string[];
  stationTypes: string[];
};
type VersionState = { current: string; available: string | null };
const joinPortuguese = (values: string[]) => {
  if (values.length < 2) return values[0] ?? '';
  return `${values.slice(0, -1).join(', ')} e ${values[values.length - 1]}`;
};
const fieldDefinitions: [FieldKey, string][] = [
  ['indicativo', 'Indicativo'],
  ['tipoIdentificacao', 'Tipo de identificação'],
  ['cnpjOuCpf', 'CNPJ ou CPF'],
  ['nomeEntidade', 'Nome da entidade'],
  ['fistel', 'Fistel'],
  ['servico', 'Serviço'],
  ['coer', 'Classe COER'],
  ['ufEntidade', 'UF da entidade'],
  ['numeroEstacao', 'Número da estação'],
  ['nomeEstacao', 'Nome da estação'],
  ['tipoEstacao', 'Tipo da estação'],
  ['frequenciasOperacao', 'Frequências de operação'],
  ['ufEstacao', 'UF da estação'],
  ['municipioEstacao', 'Município da estação'],
  ['dataPrimeiroLicenciamento', 'Data do primeiro licenciamento'],
  ['dataUltimoLicenciamento', 'Data do último licenciamento'],
  ['dataValidadeEstacao', 'Data de validade da estação'],
  ['statusValidade', 'Status de validade'],
];
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
        dataPrimeiroLicenciamento: { type: 'string', id: 15 },
        dataUltimoLicenciamento: { type: 'string', id: 16 },
        dataValidadeEstacao: { type: 'string', id: 17 },
        statusValidade: { type: 'string', id: 18 },
      },
    },
  },
}).lookupType('Indicativos');

export default function Home() {
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [query, setQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<IndicativoGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState<VersionState>({ current: '', available: null });
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
    }
    const versionRequest = fetch('/version.json', { cache: 'no-store' })
      .then((response) => response.json())
      .then(({ version: current }) => {
        setVersion({ current, available: null });
        return current as string;
      })
      .catch(() => '');
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
    versionRequest
      .then((current) =>
        fetch(`/data/indicativos.pb.gz${current ? `?v=${encodeURIComponent(current)}` : ''}`),
      )
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
  const groups = useMemo<IndicativoGroup[]>(() => {
    const grouped = new Map<string, RecordRow[]>();
    for (const record of records) {
      const indicativo = record.indicativo?.trim();
      if (!indicativo) continue;
      grouped.set(indicativo, [...(grouped.get(indicativo) ?? []), record]);
    }

    const parseDate = (value?: string) => {
      const match = value?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      return match ? Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])) : 0;
    };
    const classRank = (value?: string) => {
      const normalized = value?.toLocaleUpperCase('pt-BR') ?? '';
      return normalized === 'CLASSE A'
        ? 3
        : normalized === 'CLASSE B'
          ? 2
          : normalized === 'CLASSE C'
            ? 1
            : 0;
    };
    const unique = (values: (string | undefined)[]) =>
      Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));
    const joinLocation = (record: RecordRow) =>
      [record.municipioEstacao, record.ufEstacao].filter(Boolean).join(' - ');

    return Array.from(grouped.entries()).map(
      ([indicativo, groupRecords]: [string, RecordRow[]]) => {
        const latestRecord = [...groupRecords].sort(
          (left, right) =>
            parseDate(right.dataUltimoLicenciamento) - parseDate(left.dataUltimoLicenciamento),
        )[0];
        const classes = groupRecords
          .filter((record) => classRank(record.coer) > 0)
          .sort((left, right) => classRank(right.coer) - classRank(left.coer));
        return {
          indicativo,
          records: groupRecords,
          latestRecord,
          coer: classes[0]?.coer,
          municipalities: unique(groupRecords.map(joinLocation)),
          stationTypes: unique(groupRecords.map((record) => record.tipoEstacao)),
        };
      },
    );
  }, [records]);
  const results = useMemo(() => {
    const q = query.trim().toLocaleUpperCase();
    if (q.length < 3) return { items: [], total: 0 };
    const exactMatches = groups.filter((group) => group.indicativo.toLocaleUpperCase() === q);
    const matches = exactMatches.length
      ? exactMatches
      : groups.filter((group) => group.indicativo.toLocaleUpperCase().includes(q));
    const sortedMatches = exactMatches.length
      ? matches
      : [...matches].sort((a, b) => a.indicativo.localeCompare(b.indicativo, 'pt-BR'));
    return {
      items: sortedMatches.slice(0, 10),
      total: matches.length,
    };
  }, [query, groups]);
  useEffect(() => {
    if (!selectedGroup) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedGroup(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedGroup]);
  const selectedFieldState = useMemo(() => {
    if (!selectedGroup) return { common: [], specific: [] };
    const common = fieldDefinitions.filter(([key]) => {
      const values = selectedGroup.records.map((record) => record[key]?.trim() ?? '');
      return values.every((value) => value === values[0]);
    });
    const varying = fieldDefinitions.filter(
      ([key]) => !common.some(([commonKey]) => commonKey === key),
    );
    return {
      common: common.map(
        ([key, label]) =>
          [label, selectedGroup.records[0][key]?.trim() || 'N/I'] as [string, string],
      ),
      specific: selectedGroup.records.map((record) => ({
        record,
        fields: varying.map(
          ([key, label]) => [label, record[key]?.trim() || 'N/I'] as [string, string],
        ),
      })),
    };
  }, [selectedGroup]);
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
              onChange={(e) =>
                setQuery(e.target.value.toLocaleUpperCase().replace(/[^A-Z0-9]/g, ''))
              }
              placeholder="Digite o indicativo..."
            />
            <kbd>⌘ K</kbd>
          </div>
          <div className="meta">
            <span className="pulse" />{' '}
            {loading
              ? 'Carregando base...'
              : `${records.length.toLocaleString('pt-BR')} registros disponíveis`}
            <span className="hint">Busca a partir de 3 caracteres</span>
          </div>
        </div>
        {query.length > 0 && query.length < 3 && (
          <div className="welcome">
            <span>↳</span>
            <p>Digite pelo menos 3 caracteres para buscar.</p>
          </div>
        )}
        {query.length >= 3 && (
          <div className="results">
            <div className="resultHead">
              <span>RESULTADOS</span>
              <small>
                {results.total} {results.total === 1 ? 'encontrado' : 'encontrados'}
              </small>
            </div>
            {results.items.length ? (
              results.items.map((group) => (
                <article
                  className="card"
                  key={group.indicativo}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedGroup(group)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedGroup(group);
                    }
                  }}
                >
                  <div className="call">{group.indicativo}</div>
                  <div className="details">
                    <div className="nameLine">
                      <strong className="radioName">
                        {group.latestRecord.nomeEntidade || group.latestRecord.nomeEstacao || 'N/I'}
                      </strong>
                      {group.coer && (
                        <span className={`classBadge class${group.coer.replace('Classe ', '')}`}>
                          {group.coer}
                        </span>
                      )}
                    </div>
                    <div className="stationInfo">
                      {group.municipalities.length > 0 && (
                        <span>{group.municipalities.join(' / ')}</span>
                      )}
                    </div>
                  </div>
                  <div className="id">{joinPortuguese(group.stationTypes) || 'N/I'}</div>
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
      {selectedGroup && (
        <div className="modalBackdrop" onClick={() => setSelectedGroup(null)}>
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
              onClick={() => setSelectedGroup(null)}
            >
              ×
            </button>
            <p className="eyebrow">DETALHES DO REGISTRO</p>
            <h2 id="recordModalTitle">{selectedGroup.indicativo || 'Estação'}</h2>
            {selectedFieldState.common.length > 0 && (
              <>
                <h3 className="recordSectionTitle">Dados comuns</h3>
                <dl className="recordFields">
                  {selectedFieldState.common.map(([label, value]) => (
                    <div className="recordField" key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
            <h3 className="recordSectionTitle">Estações</h3>
            {selectedFieldState.specific.map(({ record, fields }, index) => (
              <section className="stationSection" key={record.numeroEstacao || index}>
                <h4>
                  Estação {index + 1}
                  {record.numeroEstacao ? ` · ${record.numeroEstacao}` : ''}
                </h4>
                <dl className="recordFields">
                  {fields.map(([label, value]) => (
                    <div className="recordField" key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </section>
        </div>
      )}
    </main>
  );
}
