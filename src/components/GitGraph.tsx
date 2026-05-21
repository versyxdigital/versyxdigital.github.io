import { useEffect, useRef, useState } from 'react';

const REPO = 'versyxdigital/mkeditor';
const TRUNK = 'main';

type Status = 'idle' | 'loading' | 'ok' | 'err';

type Branch = { name: string; commit: { sha: string } };
type Commit = { sha: string; commit: { message: string } };
type Compare = {
  merge_base_commit: { sha: string } | null;
  ahead_by: number;
  behind_by: number;
  commits: Commit[];
};

type BranchData = {
  name: string;
  head: string;
  mergeBase: string | null;
  ahead: number;
  behind: number;
  commits: Commit[];
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const subj = (m: string | undefined) => esc((m || '').split('\n')[0].slice(0, 92));

async function api<T>(path: string): Promise<T> {
  const r = await fetch(`https://api.github.com/repos/${REPO}${path}`);
  if (!r.ok) throw new Error(`GitHub API ${r.status}`);
  return r.json();
}

async function buildHtml(): Promise<string> {
  const [branches, mainCommits] = await Promise.all([
    api<Branch[]>('/branches?per_page=50'),
    api<Commit[]>(`/commits?sha=${TRUNK}&per_page=30`),
  ]);

  const others = branches.filter((b) => b.name !== TRUNK);
  const branchData: BranchData[] = await Promise.all(
    others.map(async (b) => {
      try {
        const cmp = await api<Compare>(`/compare/${TRUNK}...${encodeURIComponent(b.name)}`);
        return {
          name: b.name,
          head: b.commit.sha,
          mergeBase: cmp.merge_base_commit ? cmp.merge_base_commit.sha : null,
          ahead: cmp.ahead_by || 0,
          behind: cmp.behind_by || 0,
          commits: (cmp.commits || []).slice(-15),
        };
      } catch {
        return { name: b.name, head: b.commit.sha, mergeBase: null, ahead: 0, behind: 0, commits: [] };
      }
    }),
  );

  const lines: string[] = [];
  lines.push(`<span class="t-prompt">$</span> <span class="t-cmd">git log --graph --all --oneline --decorate</span>`);
  lines.push('');

  for (const c of mainCommits) {
    const short = c.sha.substring(0, 7);
    const heads = branches
      .filter((b) => b.commit.sha === c.sha)
      .map((b) => (b.name === TRUNK ? `HEAD -> ${TRUNK}, origin/${TRUNK}` : `${b.name}, origin/${b.name}`));
    const dec = heads.length ? ` <span class="t-deco">(${heads.join(', ')})</span>` : '';
    lines.push(`<span class="t-glyph-main">*</span> <span class="t-sha">${short}</span>${dec} <span class="t-msg">${subj(c.commit.message)}</span>`);

    for (const b of branchData) {
      if (b.mergeBase === c.sha && b.commits.length > 0) {
        const reversed = b.commits.slice().reverse();
        for (let j = 0; j < reversed.length; j++) {
          const bc = reversed[j];
          const bShort = bc.sha.substring(0, 7);
          const bDec = j === 0 ? ` <span class="t-deco">(${b.name}, origin/${b.name})</span>` : '';
          lines.push(`<span class="t-glyph-branch">| *</span> <span class="t-sha">${bShort}</span>${bDec} <span class="t-msg">${subj(bc.commit.message)}</span>`);
        }
        lines.push(`<span class="t-glyph-branch">|/</span>`);
      }
    }
  }

  lines.push('');
  lines.push(`<span class="t-prompt">$</span> <span class="t-cmd">git branch -avv</span>`);
  const all = branches.slice().sort((a, b) =>
    a.name === TRUNK ? -1 : b.name === TRUNK ? 1 : a.name.localeCompare(b.name),
  );
  for (const b of all) {
    const marker = b.name === TRUNK ? '<span class="t-glyph-main">*</span>' : ' ';
    const short = b.commit.sha.substring(0, 7);
    const info =
      b.name === TRUNK
        ? ''
        : (() => {
            const d = branchData.find((x) => x.name === b.name);
            return d ? ` <span class="t-comment">[ahead ${d.ahead}, behind ${d.behind}]</span>` : '';
          })();
    lines.push(`${marker} <span class="t-branch">${b.name.padEnd(46, ' ')}</span> <span class="t-sha">${short}</span>${info}`);
  }

  return lines.join('\n');
}

export function GitGraph() {
  const preRef = useRef<HTMLPreElement>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [html, setHtml] = useState<string>(`<span class="t-comment"># Fetching git history from ${REPO}…</span>`);

  useEffect(() => {
    const el = preRef.current;
    if (!el) return;

    let cancelled = false;

    const load = async () => {
      setStatus('loading');
      try {
        const out = await buildHtml();
        if (cancelled) return;
        setHtml(out);
        setStatus('ok');
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'unknown';
        setHtml(
          `<span class="t-comment"># Could not load git history (${esc(msg)})</span>
<span class="t-comment"># Browse the project on GitHub instead:</span>
<span class="t-prompt">$</span> <span class="t-cmd">open https://github.com/${REPO}</span>`,
        );
        setStatus('err');
      }
    };

    if (typeof IntersectionObserver === 'undefined') {
      load();
      return () => { cancelled = true; };
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            load();
            io.disconnect();
          }
        }
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, []);

  const statusCls =
    status === 'ok'
      ? 'text-[var(--color-accent)] border-[rgba(77,212,191,0.3)] bg-[rgba(77,212,191,0.08)]'
      : status === 'err'
        ? 'text-[#ef4444] border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)]'
        : 'text-[var(--color-text-dim)] border-[var(--color-border-1)] bg-white/5';
  const dotCls =
    status === 'ok'
      ? 'bg-[var(--color-accent)]'
      : status === 'err'
        ? 'bg-[#ef4444]'
        : 'bg-[var(--color-text-dim)] animate-[terminal-pulse_1.4s_ease-in-out_infinite]';

  return (
    <figure
      className="terminal-wash relative col-span-full m-0 overflow-hidden rounded-md border border-[var(--color-border-2)] text-left"
      style={{
        background: 'rgba(15, 17, 21, 0.55)',
        backdropFilter: 'blur(18px) saturate(160%)',
        WebkitBackdropFilter: 'blur(18px) saturate(160%)',
        boxShadow:
          '0 30px 80px -30px rgba(0,0,0,0.6), 0 10px 30px -10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      <figcaption
        className="relative z-[1] flex items-center gap-3 border-b px-3.5 py-3"
        style={{
          background: 'rgba(255,255,255,0.04)',
          borderBottomColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <span className="inline-flex items-center gap-1.5" aria-hidden>
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#ff5f57', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25)', opacity: 0.9 }} />
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#febc2e', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25)', opacity: 0.9 }} />
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#28c840', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25)', opacity: 0.9 }} />
        </span>
        <span className="flex-none font-mono text-[0.74rem] tracking-[-0.005em] text-[var(--color-text-dim)]">
          ~/mkeditor — git log --graph --all
        </span>
        <span className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[0.66rem] uppercase tracking-[0.08em] ${statusCls}`}>
          <span
            className={`h-1.5 w-1.5 rounded-full ${dotCls}`}
            style={status === 'ok' ? { boxShadow: '0 0 8px rgba(77,212,191,0.6)' } : undefined}
          />
          live
        </span>
      </figcaption>
      <pre
        ref={preRef}
        className="terminal-scroll relative z-[1] m-0 overflow-x-auto whitespace-pre p-6 font-mono text-[0.84rem] leading-[1.7] text-[var(--color-text)]"
        style={{ tabSize: 2, background: 'transparent', textShadow: '0 1px 0 rgba(0,0,0,0.25)' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </figure>
  );
}
