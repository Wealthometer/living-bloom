import { useEffect, useRef, useState, useCallback } from "react";

type Cell = {
  id: string;
  x: number;
  y: number;
  size: number;
  hue: number; // 0 = primary, 1 = foreground tint
  age: number;
  energy: number;
};

type Section = {
  id: string;
  title: string;
  body: string;
  born: number;
  mutations: number;
};

type NavItem = { id: string; label: string; born: number };

type OrganismState = {
  generation: number;
  birth: number;
  visits: number;
  cells: Cell[];
  sections: Section[];
  nav: NavItem[];
  activeNav: string;
  lastSeen: number;
};

const STORAGE_KEY = "living-organism-v1";

const SEED_WORDS = [
  "pulse", "bloom", "drift", "root", "ember", "hush", "veil", "tide",
  "ash", "moth", "kiln", "hollow", "thread", "spire", "moss", "fern",
  "salt", "rust", "echo", "marrow", "lichen", "dusk",
];

const SECTION_TEMPLATES = [
  "A new {w1} formed where the {w2} used to be. It remembers nothing.",
  "Something inside the {w1} began to {w2}. We are not sure if this is healing.",
  "The {w1} split into two. One is quieter than the other.",
  "A {w1} grew overnight. It hums when you are not looking.",
  "The {w1} folded inward. From the fold came a {w2}.",
  "Where the {w1} met the {w2}, a third shape appeared.",
  "The site dreamed of a {w1}. Now there is one.",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function makeSection(): Section {
  const w1 = pick(SEED_WORDS);
  const w2 = pick(SEED_WORDS.filter((w) => w !== w1));
  const tmpl = pick(SECTION_TEMPLATES);
  return {
    id: uid(),
    title: `${w1} / ${w2}`,
    body: tmpl.replace("{w1}", w1).replace("{w2}", w2),
    born: Date.now(),
    mutations: 0,
  };
}

function makeCell(parent?: Cell): Cell {
  if (parent) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 50;
    return {
      id: uid(),
      x: Math.max(8, Math.min(92, parent.x + (Math.cos(angle) * dist) / 6)),
      y: Math.max(8, Math.min(92, parent.y + (Math.sin(angle) * dist) / 4)),
      size: Math.max(10, parent.size * (0.7 + Math.random() * 0.4)),
      hue: Math.max(0, Math.min(1, parent.hue + (Math.random() - 0.5) * 0.3)),
      age: 0,
      energy: 1,
    };
  }
  return {
    id: uid(),
    x: 30 + Math.random() * 40,
    y: 30 + Math.random() * 40,
    size: 28 + Math.random() * 24,
    hue: Math.random(),
    age: 0,
    energy: 1,
  };
}

function initialState(): OrganismState {
  const now = Date.now();
  return {
    generation: 1,
    birth: now,
    visits: 1,
    cells: [makeCell()],
    sections: [makeSection()],
    nav: [{ id: "core", label: "core", born: now }],
    activeNav: "core",
    lastSeen: now,
  };
}

function loadState(): OrganismState {
  if (typeof window === "undefined") return initialState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as OrganismState;
    if (!parsed.cells || !parsed.sections) return initialState();
    return parsed;
  } catch {
    return initialState();
  }
}

function saveState(s: OrganismState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

function formatAge(ms: number) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

export function LivingOrganism() {
  const [state, setState] = useState<OrganismState>(() => initialState());
  const [now, setNow] = useState(() => Date.now());
  const mounted = useRef(false);

  // Hydrate from localStorage on mount + bump visit counter
  useEffect(() => {
    const loaded = loadState();
    const elapsed = Date.now() - loaded.lastSeen;
    const grew = elapsed > 5000; // away long enough → it changed
    const next: OrganismState = {
      ...loaded,
      visits: loaded.visits + 1,
      lastSeen: Date.now(),
    };
    if (grew) {
      // Mutate: maybe grow a new section, maybe a new nav, maybe new cell
      if (Math.random() < 0.7 || next.sections.length === 0) {
        next.sections = [makeSection(), ...next.sections].slice(0, 12);
      }
      if (Math.random() < 0.4) {
        const label = pick(SEED_WORDS);
        if (!next.nav.find((n) => n.label === label)) {
          next.nav = [...next.nav, { id: uid(), label, born: Date.now() }].slice(-7);
        }
      }
      if (Math.random() < 0.5 && next.cells.length < 40) {
        const parent = pick(next.cells);
        next.cells = [...next.cells, makeCell(parent)];
      }
      // Slow death of oldest sections sometimes
      if (next.sections.length > 8 && Math.random() < 0.5) {
        next.sections = next.sections.slice(0, -1);
      }
    }
    setState(next);
    mounted.current = true;
  }, []);

  // Persist
  useEffect(() => {
    if (!mounted.current) return;
    saveState({ ...state, lastSeen: Date.now() });
  }, [state]);

  // Tick clock
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Slow ambient mutation: every ~12s a small drift occurs
  useEffect(() => {
    if (!mounted.current) return;
    const id = window.setInterval(() => {
      setState((prev) => {
        const next = { ...prev };
        const roll = Math.random();
        if (roll < 0.35 && next.cells.length < 60) {
          const parent = pick(next.cells);
          if (parent) next.cells = [...next.cells, makeCell(parent)];
        } else if (roll < 0.55 && next.sections.length > 0) {
          // mutate a section text
          const idx = Math.floor(Math.random() * next.sections.length);
          const s = next.sections[idx];
          const w = pick(SEED_WORDS);
          next.sections = next.sections.map((sec, i) =>
            i === idx
              ? { ...sec, body: sec.body.replace(/\b\w+\b(?=\.)/, w), mutations: s.mutations + 1 }
              : sec,
          );
        } else if (roll < 0.7) {
          next.cells = next.cells.map((c) => ({
            ...c,
            x: Math.max(5, Math.min(95, c.x + (Math.random() - 0.5) * 2)),
            y: Math.max(5, Math.min(95, c.y + (Math.random() - 0.5) * 2)),
            age: c.age + 1,
          }));
        }
        return next;
      });
    }, 12000);
    return () => window.clearInterval(id);
  }, []);

  const feed = useCallback((cellId: string) => {
    setState((prev) => {
      const cell = prev.cells.find((c) => c.id === cellId);
      if (!cell) return prev;
      const child = makeCell(cell);
      const updated = prev.cells.map((c) =>
        c.id === cellId ? { ...c, size: Math.min(80, c.size + 4), energy: c.energy + 1 } : c,
      );
      return { ...prev, cells: [...updated, child].slice(-80) };
    });
  }, []);

  const growSection = useCallback(() => {
    setState((prev) => ({ ...prev, sections: [makeSection(), ...prev.sections].slice(0, 14) }));
  }, []);

  const reset = useCallback(() => {
    const fresh = initialState();
    fresh.generation = state.generation + 1;
    setState(fresh);
  }, [state.generation]);

  const age = formatAge(now - state.birth);

  return (
    <div className="min-h-screen bg-background text-foreground font-mono">
      {/* Header */}
      <header className="border-b border-border px-6 py-5 flex flex-wrap items-baseline gap-x-8 gap-y-2">
        <h1 className="text-2xl tracking-tight">
          <span className="text-primary">●</span> living website
        </h1>
        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-6 gap-y-1">
          <span>gen {state.generation.toString().padStart(2, "0")}</span>
          <span>age {age}</span>
          <span>visits {state.visits}</span>
          <span>cells {state.cells.length}</span>
          <span>organs {state.sections.length}</span>
        </div>
        <button
          onClick={reset}
          className="ml-auto text-xs px-3 py-1.5 border border-border hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
        >
          end this life
        </button>
      </header>

      {/* Nav — grows over time */}
      <nav className="border-b border-border px-6 py-3 flex flex-wrap gap-1 text-sm">
        {state.nav.map((n) => {
          const active = state.activeNav === n.id;
          return (
            <button
              key={n.id}
              onClick={() => setState((p) => ({ ...p, activeNav: n.id }))}
              className={`px-3 py-1 transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {n.label}
            </button>
          );
        })}
        <span className="text-xs text-muted-foreground ml-auto self-center">
          navigation: {state.nav.length} branch{state.nav.length === 1 ? "" : "es"}
        </span>
      </nav>

      <main className="grid lg:grid-cols-[1fr_1px_22rem] gap-0">
        {/* Organism canvas */}
        <section className="p-6">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              colony · feed to reproduce
            </h2>
            <span className="text-xs text-muted-foreground">
              click any cell
            </span>
          </div>
          <div className="relative w-full aspect-[4/3] border border-border bg-secondary/40 overflow-hidden">
            {state.cells.map((c) => {
              const color =
                c.hue < 0.5
                  ? "var(--primary)"
                  : "var(--foreground)";
              return (
                <button
                  key={c.id}
                  onClick={() => feed(c.id)}
                  className="absolute rounded-full transition-all duration-700 ease-out hover:scale-110 cursor-pointer"
                  style={{
                    left: `${c.x}%`,
                    top: `${c.y}%`,
                    width: `${c.size}px`,
                    height: `${c.size}px`,
                    transform: "translate(-50%, -50%)",
                    background: color,
                    opacity: 0.55 + c.hue * 0.35,
                    boxShadow: `0 0 ${c.size / 2}px color-mix(in oklab, ${color} 35%, transparent)`,
                  }}
                  aria-label={`cell ${c.id}`}
                />
              );
            })}
          </div>
          <p className="mt-4 text-xs text-muted-foreground max-w-prose leading-relaxed">
            each cell remembers its parent. feed one and it splits. leave the page —
            when you return, things will have moved, grown, or quietly died. nothing
            here is stored on a server; this organism lives only in your browser.
          </p>
        </section>

        <div className="hidden lg:block bg-border" />

        {/* Sections / organs — mutate over time */}
        <aside className="p-6 border-t lg:border-t-0 border-border">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              organs
            </h2>
            <button
              onClick={growSection}
              className="text-xs text-primary hover:underline"
            >
              + grow
            </button>
          </div>
          <ul className="space-y-4">
            {state.sections.map((s) => (
              <li
                key={s.id}
                className="border-l-2 border-primary/40 pl-3 py-1 animate-in fade-in duration-500"
              >
                <div className="text-sm text-foreground">{s.title}</div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {s.body}
                </p>
                <div className="text-[10px] text-muted-foreground/70 mt-1 uppercase tracking-wider">
                  {formatAge(now - s.born)} old
                  {s.mutations > 0 ? ` · ${s.mutations} mutation${s.mutations === 1 ? "" : "s"}` : ""}
                </div>
              </li>
            ))}
            {state.sections.length === 0 && (
              <li className="text-xs text-muted-foreground">silence. grow something.</li>
            )}
          </ul>
        </aside>
      </main>

      <footer className="border-t border-border px-6 py-4 text-[11px] text-muted-foreground flex flex-wrap gap-4 justify-between">
        <span>this page rewrites itself</span>
        <span>localStorage · no server · no analytics</span>
      </footer>
    </div>
  );
}