import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine, LabelList,
} from "recharts";
import {
  Wallet, PiggyBank, ShieldCheck, Target, LayoutDashboard, CalendarRange,
  SlidersHorizontal, Sun, Moon, RotateCcw, TrendingUp, Coins, Landmark,
  Banknote, Flag, ArrowUpRight, Database, Cloud, CloudOff, RefreshCw,
  CheckCircle2, AlertTriangle, HardDrive, Download, Upload,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* THÈME */
/* ------------------------------------------------------------------ */

const THEMES = {
  dark: {
    bg: "#061410",
    panel: "#0C1F19",
    panel2: "#102A21",
    row: "#0A1A15",
    border: "#1B4332",
    borderSoft: "#14332766",
    text: "#E8F5EF",
    muted: "#7FA795",
    accent: "#10B981",
    accent2: "#2D6A4F",
    accent3: "#95D5B2",
    deep: "#1B4332",
    ok: "#10B981",
    okBg: "#10B98122",
    warn: "#F5B942",
    warnBg: "#F5B94222",
    idle: "#7FA795",
    idleBg: "#7FA79518",
    grid: "#1B433280",
  },
  light: {
    bg: "#F1F7F3",
    panel: "#FFFFFF",
    panel2: "#EAF4EE",
    row: "#FFFFFF",
    border: "#C9E3D6",
    borderSoft: "#C9E3D680",
    text: "#0B2E22",
    muted: "#4E7A68",
    accent: "#0E9F70",
    accent2: "#2D6A4F",
    accent3: "#74C69D",
    deep: "#1B4332",
    ok: "#0E9F70",
    okBg: "#0E9F7018",
    warn: "#C98A06",
    warnBg: "#F5B94222",
    idle: "#4E7A68",
    idleBg: "#4E7A6812",
    grid: "#C9E3D6",
  },
};

const MOIS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet",
  "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

/* ------------------------------------------------------------------ */
/* FORMATAGE */
/* ------------------------------------------------------------------ */

const nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

const ar = (v) => `${nf0.format(Math.round(v || 0))} Ar`;
const eur = (v) => `${nf0.format(Math.round(v || 0))} €`;
const eur2 = (v) => `${nf2.format(v || 0)} €`;
const millions = (v) => {
  if (Math.abs(v) >= 1e6) return `${nf0.format(v / 1e6)} M`;
  if (Math.abs(v) >= 1e3) return `${nf0.format(v / 1e3)} k`;
  return nf0.format(v);
};
const pct = (v) => `${nf2.format(v)} %`;

/* ------------------------------------------------------------------ */
/* PARAMÈTRES PAR DÉFAUT */
/* ------------------------------------------------------------------ */

const DEFAULTS = {
  revenuEur: 1825,
  taux: 4900,
  depenses: 1_500_000,
  meubles: 12_000_000,
  meublesMois: 2,
  dette: 13_000_000,
  detteMois: 2,
  securiteCible: 9_000_000,
  datAnnuel: 8,
  allocEuro: 50,
  allocDat: 35,
  objectif: 200_000_000,
  moisDepart: 8, // Août
  anneeDepart: 2026,
};

/* ------------------------------------------------------------------ */
/* MOTEUR DE PROJECTION */
/* ------------------------------------------------------------------ */

function buildPlan(p) {
  const revenuAr = p.revenuEur * p.taux;
  const epargne = Math.max(0, revenuAr - p.depenses);
  const rMensuel = p.datAnnuel / 100 / 12;
  const allocSimple = Math.max(0, 100 - p.allocEuro - p.allocDat);

  let meublesRest = p.meubles;
  let detteRest = p.dette;
  let secu = 0;
  let datSolde = 0, datInterets = 0, datVerse = 0;
  let simple = 0;
  let eurSolde = 0; // en €
  let capitalVerse = 0; // total investi hors intérêts

  const rows = [];
  const MAX = 360;

  for (let m = 1; m <= MAX; m++) {
    let dispo = epargne;
    let vMeubles = 0, vDette = 0, vSecu = 0;

    if (meublesRest > 1) {
      vMeubles = Math.min(p.meubles / Math.max(1, p.meublesMois), dispo, meublesRest);
      meublesRest -= vMeubles; dispo -= vMeubles;
    } else if (detteRest > 1) {
      vDette = Math.min(p.dette / Math.max(1, p.detteMois), dispo, detteRest);
      detteRest -= vDette; dispo -= vDette;
    }

    if (secu < p.securiteCible - 1) {
      vSecu = Math.min(p.securiteCible - secu, dispo);
      secu += vSecu; dispo -= vSecu;
    }

    const vInvest = Math.max(0, dispo);

    // Intérêts DAT crédités sur le solde d'ouverture
    const interet = datSolde * rMensuel;
    datSolde += interet;
    datInterets += interet;

    const dEuroAr = vInvest * (p.allocEuro / 100);
    const dDat = vInvest * (p.allocDat / 100);
    const dSimple = vInvest * (allocSimple / 100);

    eurSolde += p.taux > 0 ? dEuroAr / p.taux : 0;
    datSolde += dDat; datVerse += dDat;
    simple += dSimple;
    capitalVerse += vInvest;

    const euroAr = eurSolde * p.taux;
    const total = euroAr + datSolde + simple;

    const mIdx = (p.moisDepart - 1 + (m - 1)) % 12;
    const annee = p.anneeDepart + Math.floor((p.moisDepart - 1 + (m - 1)) / 12);

    let action;
    if (vMeubles > 0) action = `Meubles maison — ${ar(vMeubles)}`;
    else if (vDette > 0) action = `Remboursement tante — ${ar(vDette)}`;
    else if (vSecu > 0 && vInvest > 0) action = `Fonds de sécurité complété + 1er versement portefeuille`;
    else if (vSecu > 0) action = `Constitution fonds de sécurité — ${ar(vSecu)}`;
    else action = `Investissement ${p.allocEuro}/${p.allocDat}/${allocSimple}`;

    rows.push({
      m, label: `M${String(m).padStart(2, "0")}`,
      mois: MOIS_FR[mIdx], annee,
      action, vMeubles, vDette, vSecu, vInvest,
      secu, eurSolde, euroAr,
      dat: datSolde, datInterets, datVerse,
      simple, total, capitalVerse,
      interetsCumules: datInterets,
      progression: p.objectif > 0 ? (total / p.objectif) * 100 : 0,
    });

    if (total >= p.objectif && m >= 31) break;
    if (m >= MAX) break;
  }

  const moisCap100 = rows.find((r) => r.total >= 100_000_000)?.m ?? null;
  const moisObjectif = rows.find((r) => r.total >= p.objectif)?.m ?? null;
  const moisMeubles = rows.filter((r) => r.vMeubles > 0).slice(-1)[0]?.m ?? null;
  const moisDette = rows.filter((r) => r.vDette > 0).slice(-1)[0]?.m ?? null;
  const moisSecu = rows.find((r) => r.secu >= p.securiteCible - 1)?.m ?? null;

  const horizon = Math.min(rows.length, Math.max(31, moisObjectif || 31));

  return {
    rows: rows.slice(0, horizon),
    revenuAr, epargne, allocSimple, rMensuel,
    moisCap100, moisObjectif, moisMeubles, moisDette, moisSecu,
    atteint: moisObjectif !== null,
  };
}

function dateDe(p, m) {
  if (!m) return "—";
  const idx = (p.moisDepart - 1 + (m - 1)) % 12;
  const an = p.anneeDepart + Math.floor((p.moisDepart - 1 + (m - 1)) / 12);
  return `${MOIS_FR[idx]} ${an}`;
}

/* ------------------------------------------------------------------ */
/* PERSISTANCE : stockage local (navigateur) + adaptateur Supabase */
/* ------------------------------------------------------------------ */

const STORE_KEY = "plan200m:etat";
const CFG_KEY = "plan200m:supabase";

const DEFAULT_CFG = {
  enabled: false,
  url: "",
  cle: "",
  table: "plan_patrimoine",
  profil: "moi",
};

/* SQL à exécuter une fois dans l'éditeur SQL de Supabase :

create table if not exists plan_patrimoine (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table plan_patrimoine enable row level security;

create policy "acces profil anon" on plan_patrimoine
  for all to anon using (true) with check (true);
*/

async function localGet(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function localSet(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const sbBase = (cfg) => `${cfg.url.replace(/\/+$/, "")}/rest/v1/${cfg.table}`;
const sbHeaders = (cfg) => ({
  apikey: cfg.cle,
  Authorization: `Bearer ${cfg.cle}`,
  "Content-Type": "application/json",
});

const cfgPrete = (cfg) => Boolean(cfg.enabled && cfg.url && cfg.cle && cfg.table && cfg.profil);

async function sbLoad(cfg) {
  const url = `${sbBase(cfg)}?select=data,updated_at&id=eq.${encodeURIComponent(cfg.profil)}&limit=1`;
  const r = await fetch(url, { headers: sbHeaders(cfg) });
  if (!r.ok) throw new Error(`Lecture refusée (${r.status}) — ${(await r.text()).slice(0, 140)}`);
  const rows = await r.json();
  return rows?.[0]?.data ?? null;
}

async function sbSave(cfg, data) {
  const r = await fetch(`${sbBase(cfg)}?on_conflict=id`, {
    method: "POST",
    headers: { ...sbHeaders(cfg), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([
      { id: cfg.profil, data, updated_at: new Date().toISOString() },
    ]),
  });
  if (!r.ok) throw new Error(`Écriture refusée (${r.status}) — ${(await r.text()).slice(0, 140)}`);
  return true;
}

/* ------------------------------------------------------------------ */
/* PETITS COMPOSANTS */
/* ------------------------------------------------------------------ */

const STATUTS = {
  done: { label: "Validé ✓", key: "done" },
  wip: { label: "En cours ⏳", key: "wip" },
  todo: { label: "À faire ◯", key: "todo" },
};

function statutStyle(t, s) {
  if (s === "done") return { color: t.ok, background: t.okBg, borderColor: `${t.ok}55` };
  if (s === "wip") return { color: t.warn, background: t.warnBg, borderColor: `${t.warn}55` };
  return { color: t.idle, background: t.idleBg, borderColor: t.border };
}

function StatutSelect({ t, value, onChange, compact }) {
  const st = statutStyle(t, value);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...st, borderWidth: 1, borderStyle: "solid" }}
      className={`rounded-full font-semibold outline-none cursor-pointer appearance-none text-center transition-colors ${
        compact ? "text-xs px-2 py-1" : "text-sm px-3 py-1.5"
      }`}
    >
      <option value="done" style={{ background: t.panel, color: t.text }}>Validé ✓</option>
      <option value="wip" style={{ background: t.panel, color: t.text }}>En cours ⏳</option>
      <option value="todo" style={{ background: t.panel, color: t.text }}>À faire ◯</option>
    </select>
  );
}

function Card({ t, children, className = "", style = {} }) {
  return (
    <div
      className={`rounded-2xl border ${className}`}
      style={{ background: t.panel, borderColor: t.border, ...style }}
    >
      {children}
    </div>
  );
}

function Kpi({ t, icon: Icon, label, value, sub, extra, progress }) {
  return (
    <Card t={t} className="p-5 relative overflow-hidden">
      <div
        className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10"
        style={{ background: t.accent }}
      />
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 rounded-xl" style={{ background: `${t.accent}1F`, color: t.accent }}>
          <Icon size={16} />
        </div>
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: t.muted }}>
          {label}
        </span>
      </div>
      <div className="text-2xl font-bold tabular-nums leading-tight" style={{ color: t.text }}>
        {value}
      </div>
      {sub && <div className="text-sm mt-1 tabular-nums" style={{ color: t.muted }}>{sub}</div>}
      {typeof progress === "number" && (
        <div className="mt-4">
          <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: `${t.accent}1A` }}>
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${Math.min(100, Math.max(0, progress))}%`,
                background: `linear-gradient(90deg, ${t.accent2}, ${t.accent})`,
              }}
            />
          </div>
          <div className="text-xs mt-1.5 font-semibold tabular-nums" style={{ color: t.accent }}>
            {pct(progress)}
          </div>
        </div>
      )}
      {extra}
    </Card>
  );
}

function Field({ t, label, hint, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2 gap-3">
        <label className="text-sm font-semibold" style={{ color: t.text }}>{label}</label>
        {hint && <span className="text-xs tabular-nums" style={{ color: t.muted }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Slider({ t, value, min, max, step, onChange }) {
  return (
    <input
      type="range"
      min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full cursor-pointer"
      style={{ accentColor: t.accent }}
    />
  );
}

function NumInput({ t, value, onChange, suffix, step = 1 }) {
  return (
    <div className="flex items-center rounded-xl border overflow-hidden"
      style={{ borderColor: t.border, background: t.panel2 }}>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        className="w-full bg-transparent px-3 py-2 text-sm font-semibold tabular-nums outline-none"
        style={{ color: t.text }}
      />
      {suffix && (
        <span className="px-3 text-xs font-bold" style={{ color: t.muted }}>{suffix}</span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TOOLTIP RECHARTS */
/* ------------------------------------------------------------------ */

function ChartTooltip({ active, payload, label, t, money = true }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border px-3 py-2 text-xs shadow-xl"
      style={{ background: t.panel, borderColor: t.border, color: t.text }}>
      <div className="font-bold mb-1.5">{label}</div>
      {payload.map((e, i) => (
        <div key={i} className="flex items-center gap-2 tabular-nums">
          <span className="w-2 h-2 rounded-full" style={{ background: e.color }} />
          <span style={{ color: t.muted }}>{e.name}</span>
          <span className="font-semibold ml-auto">{money ? ar(e.value) : nf0.format(e.value)}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* APPLICATION */
/* ------------------------------------------------------------------ */

export default function App() {
  const [dark, setDark] = useState(true);
  const [tab, setTab] = useState("dash");
  const [p, setP] = useState(DEFAULTS);
  const [statuts, setStatuts] = useState({}); // mois -> statut
  const [jalons, setJalons] = useState({}); // id -> statut
  const [cfg, setCfg] = useState(DEFAULT_CFG);
  const [sync, setSync] = useState({ source: "local", etat: "loading", message: "" });

  const charge = useRef(false);
  const timer = useRef(null);

  const appliquer = useCallback((d) => {
    if (!d) return;
    if (d.statuts) setStatuts(d.statuts);
    if (d.jalons) setJalons(d.jalons);
    if (d.params) setP((prev) => ({ ...prev, ...d.params }));
  }, []);

  // Chargement initial : Supabase si configuré, sinon stockage local
  useEffect(() => {
    let vivant = true;
    (async () => {
      const cfgSauve = await localGet(CFG_KEY);
      const c = { ...DEFAULT_CFG, ...(cfgSauve || {}) };
      if (!vivant) return;
      setCfg(c);

      let data = null, source = "local", erreur = "";
      if (cfgPrete(c)) {
        try { data = await sbLoad(c); source = "supabase"; }
        catch (e) { erreur = e.message; }
      }
      if (!data) data = await localGet(STORE_KEY);
      if (!vivant) return;

      appliquer(data);
      charge.current = true;
      setSync({
        source,
        etat: erreur ? "error" : "saved",
        message: erreur || (data ? "Données restaurées" : "Aucune donnée enregistrée"),
      });
    })();
    return () => { vivant = false; };
  }, [appliquer]);

  // Sauvegarde automatique (anti-rebond 700 ms)
  useEffect(() => {
    if (!charge.current) return;
    setSync((s) => ({ ...s, etat: "saving", message: "" }));
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const data = { statuts, jalons, params: p, updatedAt: new Date().toISOString() };
      const okLocal = await localSet(STORE_KEY, data);
      if (cfgPrete(cfg)) {
        try {
          await sbSave(cfg, data);
          setSync({ source: "supabase", etat: "saved", message: "Synchronisé" });
        } catch (e) {
          setSync({ source: "local", etat: "error", message: e.message });
        }
      } else {
        setSync({
          source: "local",
          etat: okLocal ? "saved" : "error",
          message: okLocal ? "Enregistré sur cet appareil" : "Stockage local indisponible",
        });
      }
    }, 700);
    return () => clearTimeout(timer.current);
  }, [statuts, jalons, p, cfg]);

  // Persistance de la configuration Supabase elle-même
  useEffect(() => {
    if (!charge.current) return;
    localSet(CFG_KEY, cfg);
  }, [cfg]);

  const majCfg = (k) => (v) => setCfg((c) => ({ ...c, [k]: v }));

  const testerSupabase = async () => {
    setSync({ source: "supabase", etat: "saving", message: "Test en cours…" });
    try {
      await sbLoad(cfg);
      setSync({ source: "supabase", etat: "saved", message: "Connexion établie" });
    } catch (e) {
      setSync({ source: "local", etat: "error", message: e.message });
    }
  };

  const importerSupabase = async () => {
    setSync({ source: "supabase", etat: "saving", message: "Import en cours…" });
    try {
      const d = await sbLoad(cfg);
      if (!d) { setSync({ source: "supabase", etat: "error", message: "Aucun profil trouvé sur Supabase" }); return; }
      appliquer(d);
      setSync({ source: "supabase", etat: "saved", message: "Données importées" });
    } catch (e) {
      setSync({ source: "local", etat: "error", message: e.message });
    }
  };

  const envoyerSupabase = async () => {
    setSync({ source: "supabase", etat: "saving", message: "Envoi en cours…" });
    try {
      await sbSave(cfg, { statuts, jalons, params: p, updatedAt: new Date().toISOString() });
      setSync({ source: "supabase", etat: "saved", message: "Envoyé sur Supabase" });
    } catch (e) {
      setSync({ source: "local", etat: "error", message: e.message });
    }
  };

  const t = dark ? THEMES.dark : THEMES.light;
  const plan = useMemo(() => buildPlan(p), [p]);
  const set = (k) => (v) => setP((prev) => ({ ...prev, [k]: v }));

  const moisValides = useMemo(
    () => plan.rows.filter((r) => statuts[r.m] === "done").length,
    [statuts, plan.rows]
  );
  const courant = moisValides > 0 ? plan.rows[moisValides - 1] : null;
  const dernier = plan.rows[plan.rows.length - 1];

  const patrimoine = courant?.total ?? 0;
  const secuActuel = courant?.secu ?? 0;

  const jalonsList = [
    { id: "j1", titre: "Meubler la maison", detail: `${ar(p.meubles)} au comptant`, mois: plan.moisMeubles, icon: Banknote },
    { id: "j2", titre: "Dette tante soldée", detail: `${ar(p.dette)} sans intérêt`, mois: plan.moisDette, icon: Coins },
    { id: "j3", titre: "Fonds de sécurité complet", detail: `${ar(p.securiteCible)} — 6 mois de vie`, mois: plan.moisSecu, icon: ShieldCheck },
    { id: "j4", titre: "Cap des 100 M Ar franchi", detail: "Mi-parcours du portefeuille", mois: plan.moisCap100, icon: TrendingUp },
    { id: "j5", titre: `Objectif ${millions(p.objectif)} Ar atteint`, detail: "Patrimoine cible", mois: plan.moisObjectif, icon: Flag },
  ];

  const statutJalon = (j) => {
    if (jalons[j.id]) return jalons[j.id];
    if (!j.mois) return "todo";
    if (moisValides >= j.mois) return "done";
    if (moisValides >= j.mois - 2) return "wip";
    return "todo";
  };

  const chartData = plan.rows.map((r) => ({
    name: r.label,
    "Capital versé": Math.round(r.capitalVerse),
    "Intérêts DAT cumulés": Math.round(r.interetsCumules),
    total: Math.round(r.total),
  }));

  const pieData = [
    { name: "Euros sur Deel", value: Math.round(dernier?.euroAr ?? 0), color: t.accent },
    { name: "DAT local + intérêts", value: Math.round(dernier?.dat ?? 0), color: t.accent2 },
    { name: "Épargne simple", value: Math.round(dernier?.simple ?? 0), color: t.accent3 },
  ];
  const pieTotal = pieData.reduce((a, b) => a + b.value, 0) || 1;

  // Mois actif = premier mois non validé (sinon le dernier du plan)
  const moisActif = plan.rows[Math.min(moisValides, plan.rows.length - 1)] ?? plan.rows[0];
  const versementData = [
    { name: "Meubles maison", value: Math.round(moisActif?.vMeubles ?? 0), color: "#F5B942" },
    { name: "Dette tante", value: Math.round(moisActif?.vDette ?? 0), color: "#E08D3C" },
    { name: "Fonds de sécurité", value: Math.round(moisActif?.vSecu ?? 0), color: t.deep },
    { name: "Euros sur Deel", value: Math.round((moisActif?.vInvest ?? 0) * p.allocEuro / 100), color: t.accent },
    { name: "DAT local", value: Math.round((moisActif?.vInvest ?? 0) * p.allocDat / 100), color: t.accent2 },
    { name: "Épargne simple", value: Math.round((moisActif?.vInvest ?? 0) * plan.allocSimple / 100), color: t.accent3 },
  ].filter((d) => d.value > 0);
  const versementTotal = versementData.reduce((a, b) => a + b.value, 0) || 1;

  const TABS = [
    { id: "dash", label: "Tableau de bord", icon: LayoutDashboard },
    { id: "road", label: "Feuille de route", icon: CalendarRange },
    { id: "sim", label: "Simulateur", icon: SlidersHorizontal },
  ];

  const syncUI = {
    loading: { Icon: RefreshCw, txt: "Chargement…", col: t.muted, spin: true },
    saving: { Icon: RefreshCw, txt: "Sauvegarde…", col: t.warn, spin: true },
    saved: {
      Icon: sync.source === "supabase" ? Cloud : HardDrive,
      txt: sync.source === "supabase" ? "Supabase" : "Enregistré",
      col: t.accent, spin: false,
    },
    error: { Icon: AlertTriangle, txt: "Erreur de sync", col: t.warn, spin: false },
  }[sync.etat] || { Icon: CloudOff, txt: "—", col: t.muted, spin: false };

  const th = "px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider whitespace-nowrap";
  const td = "px-3 py-2.5 text-sm tabular-nums whitespace-nowrap";

  return (
    <div className="min-h-screen w-full" style={{ background: t.bg, color: t.text }}>
      <div className="max-w-7xl mx-auto px-4 py-6 md:px-8 md:py-8">

        {/* ---------------- EN-TÊTE ---------------- */}
        <header className="flex flex-wrap items-center gap-4 justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl" style={{ background: `linear-gradient(135deg, ${t.deep}, ${t.accent})` }}>
              <Target size={22} color="#fff" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold leading-tight">
                Plan Patrimoine {millions(p.objectif)} Ar
              </h1>
              <p className="text-xs md:text-sm" style={{ color: t.muted }}>
                Dashboard &amp; roadmap — développeur remote payé en euros via Deel
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold"
              style={{ borderColor: t.border, background: t.panel, color: syncUI.col }}
              title={sync.message}
            >
              <syncUI.Icon size={14} className={syncUI.spin ? "animate-spin" : ""} />
              {syncUI.txt}
            </div>
            <button
              onClick={() => { setP(DEFAULTS); setStatuts({}); setJalons({}); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ borderColor: t.border, color: t.muted, background: t.panel }}
            >
              <RotateCcw size={15} /> Réinitialiser
            </button>
            <button
              onClick={() => setDark(!dark)}
              className="p-2.5 rounded-xl border transition-opacity hover:opacity-80"
              style={{ borderColor: t.border, color: t.accent, background: t.panel }}
              aria-label="Changer de thème"
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </header>

        {/* ---------------- ONGLETS ---------------- */}
        <div className="flex gap-1.5 p-1.5 rounded-2xl border mb-6 overflow-x-auto"
          style={{ background: t.panel, borderColor: t.border }}>
          {TABS.map((x) => {
            const on = tab === x.id;
            return (
              <button
                key={x.id}
                onClick={() => setTab(x.id)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all"
                style={{
                  background: on ? `linear-gradient(135deg, ${t.accent2}, ${t.accent})` : "transparent",
                  color: on ? "#fff" : t.muted,
                }}
              >
                <x.icon size={16} /> {x.label}
              </button>
            );
          })}
        </div>

        {/* ================= TAB 1 : DASHBOARD ================= */}
        {tab === "dash" && (
          <div className="space-y-6">

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <Kpi t={t} icon={Wallet} label="Revenu net mensuel"
                value={ar(plan.revenuAr)} sub={`${eur(p.revenuEur)} · 1 € = ${nf0.format(p.taux)} Ar`} />
              <Kpi t={t} icon={PiggyBank} label="Capacité d'épargne"
                value={ar(plan.epargne)}
                sub={`Dépenses courantes ${ar(p.depenses)}`} />
              <Kpi t={t} icon={ShieldCheck} label="Fonds de sécurité"
                value={ar(secuActuel)}
                sub={`Cible ${ar(p.securiteCible)} — hors objectif`}
                progress={p.securiteCible ? (secuActuel / p.securiteCible) * 100 : 0} />
              <Kpi t={t} icon={Target} label="Patrimoine total"
                value={ar(patrimoine)}
                sub={`Objectif ${ar(p.objectif)}`}
                progress={p.objectif ? (patrimoine / p.objectif) * 100 : 0} />
            </div>

            {/* Bandeau projection */}
            <Card t={t} className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div className="md:col-span-2">
                  <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: t.muted }}>
                    Projection
                  </div>
                  <div className="text-lg font-bold leading-snug">
                    {plan.atteint ? (
                      <>Objectif atteint au <span style={{ color: t.accent }}>M{plan.moisObjectif}</span> —{" "}
                        {dateDe(p, plan.moisObjectif)}</>
                    ) : (
                      <>Objectif non atteint sur l'horizon simulé</>
                    )}
                  </div>
                  <p className="text-sm mt-1" style={{ color: t.muted }}>
                    {moisValides > 0
                      ? `${moisValides} mois validés sur ${plan.rows.length}. Vous êtes à ${dateDe(p, moisValides)}.`
                      : "Validez les mois dans la feuille de route pour suivre votre progression réelle."}
                  </p>
                </div>
                {[
                  { l: "Patrimoine final", v: ar(dernier?.total ?? 0) },
                  { l: "Capital versé", v: ar(dernier?.capitalVerse ?? 0) },
                  { l: "Intérêts DAT gagnés", v: ar(dernier?.interetsCumules ?? 0) },
                ].map((x, i) => (
                  <div key={i} className="md:col-span-2 xl:col-span-1 flex md:block items-baseline gap-2">
                    <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: t.muted }}>
                      {x.l}
                    </div>
                    <div className="text-base font-bold tabular-nums" style={{ color: i === 2 ? t.accent : t.text }}>
                      {x.v}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Versement du mois en cours */}
            <Card t={t} className="p-5">
              <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Banknote size={17} style={{ color: t.accent }} />
                    <h2 className="font-bold">Versement du mois en cours</h2>
                  </div>
                  <p className="text-xs mt-1" style={{ color: t.muted }}>
                    {moisActif?.label} · {moisActif?.mois} {moisActif?.annee} — {moisActif?.action}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: t.muted }}>
                    À placer ce mois-ci
                  </div>
                  <div className="text-xl font-bold tabular-nums" style={{ color: t.accent }}>
                    {ar(versementTotal)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                <div className="lg:col-span-3" style={{ width: "100%", height: Math.max(180, versementData.length * 46) }}>
                  <ResponsiveContainer>
                    <BarChart data={versementData} layout="vertical"
                      margin={{ top: 0, right: 96, left: 0, bottom: 0 }} barCategoryGap="24%">
                      <CartesianGrid strokeDasharray="3 3" stroke={t.grid} horizontal={false} />
                      <XAxis type="number" tickFormatter={millions}
                        tick={{ fill: t.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={124}
                        tick={{ fill: t.text, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip t={t} />} cursor={{ fill: `${t.accent}0F` }} />
                      <Bar dataKey="value" name="Montant" radius={[0, 6, 6, 0]}>
                        {versementData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        <LabelList dataKey="value" position="right"
                          formatter={(v) => ar(v)}
                          style={{ fill: t.muted, fontSize: 11, fontWeight: 600 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="lg:col-span-2 space-y-2.5">
                  <div className="flex h-3 rounded-full overflow-hidden" style={{ background: t.panel2 }}>
                    {versementData.map((e, i) => (
                      <div key={i} style={{ width: `${(e.value / versementTotal) * 100}%`, background: e.color }} />
                    ))}
                  </div>
                  {versementData.map((e, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm p-2 rounded-lg"
                      style={{ background: t.panel2 }}>
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: e.color }} />
                      <span className="truncate" style={{ color: t.muted }}>{e.name}</span>
                      <span className="ml-auto font-bold tabular-nums">{ar(e.value)}</span>
                      <span className="text-xs font-semibold tabular-nums w-11 text-right" style={{ color: t.accent }}>
                        {nf0.format((e.value / versementTotal) * 100)} %
                      </span>
                    </div>
                  ))}
                  <div className="text-xs pt-1" style={{ color: t.muted }}>
                    Équivalent {eur2(versementTotal / (p.taux || 1))} · validez {moisActif?.label} dans la
                    feuille de route pour passer au mois suivant.
                  </div>
                </div>
              </div>
            </Card>

            {/* Jalons */}
            <Card t={t} className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Flag size={17} style={{ color: t.accent }} />
                <h2 className="font-bold">Jalons stratégiques</h2>
              </div>
              <div className="space-y-2.5">
                {jalonsList.map((j, i) => {
                  const s = statutJalon(j);
                  const st = statutStyle(t, s);
                  return (
                    <div key={j.id}
                      className="flex flex-wrap items-center gap-3 p-3 rounded-xl border transition-colors"
                      style={{
                        background: s === "done" ? t.okBg : s === "wip" ? t.warnBg : t.panel2,
                        borderColor: s === "todo" ? t.borderSoft : st.borderColor,
                      }}>
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 text-xs font-bold"
                        style={{ background: `${t.accent}1F`, color: t.accent }}>
                        {i + 1}
                      </div>
                      <j.icon size={17} style={{ color: t.muted }} className="shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm truncate">{j.titre}</div>
                        <div className="text-xs" style={{ color: t.muted }}>{j.detail}</div>
                      </div>
                      <div className="text-xs font-bold tabular-nums px-2.5 py-1 rounded-lg"
                        style={{ background: `${t.accent}14`, color: t.accent }}>
                        {j.mois ? `M${String(j.mois).padStart(2, "0")} · ${dateDe(p, j.mois)}` : "Non atteint"}
                      </div>
                      <StatutSelect t={t} value={s} onChange={(v) => setJalons({ ...jalons, [j.id]: v })} compact />
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Graphiques */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card t={t} className="p-5 lg:col-span-2">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={17} style={{ color: t.accent }} />
                  <h2 className="font-bold">Trajectoire du portefeuille</h2>
                </div>
                <p className="text-xs mb-4" style={{ color: t.muted }}>
                  Capital versé et intérêts DAT cumulés, mois par mois
                </p>
                <div style={{ width: "100%", height: 300 }}>
                  <ResponsiveContainer>
                    <AreaChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gCap" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={t.accent2} stopOpacity={0.85} />
                          <stop offset="100%" stopColor={t.accent2} stopOpacity={0.15} />
                        </linearGradient>
                        <linearGradient id="gInt" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={t.accent} stopOpacity={0.95} />
                          <stop offset="100%" stopColor={t.accent} stopOpacity={0.25} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: t.muted, fontSize: 10 }} interval={2}
                        axisLine={{ stroke: t.grid }} tickLine={false} />
                      <YAxis tickFormatter={millions} tick={{ fill: t.muted, fontSize: 10 }}
                        axisLine={false} tickLine={false} width={48} />
                      <Tooltip content={<ChartTooltip t={t} />} />
                      <Legend wrapperStyle={{ fontSize: 12, color: t.muted }} />
                      <ReferenceLine y={p.objectif} stroke={t.accent} strokeDasharray="6 4"
                        label={{ value: `Objectif ${millions(p.objectif)}`, fill: t.accent, fontSize: 10, position: "insideTopLeft" }} />
                      <Area type="monotone" dataKey="Capital versé" stackId="1"
                        stroke={t.accent2} fill="url(#gCap)" strokeWidth={2} />
                      <Area type="monotone" dataKey="Intérêts DAT cumulés" stackId="1"
                        stroke={t.accent} fill="url(#gInt)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card t={t} className="p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Landmark size={17} style={{ color: t.accent }} />
                  <h2 className="font-bold">Allocation à M{plan.rows.length}</h2>
                </div>
                <p className="text-xs mb-2" style={{ color: t.muted }}>
                  Répartition cible {p.allocEuro}/{p.allocDat}/{plan.allocSimple}
                </p>
                <div style={{ width: "100%", height: 210 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name"
                        cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={3} stroke="none">
                        {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip t={t} />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-1">
                  {pieData.map((e, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: e.color }} />
                      <span className="truncate" style={{ color: t.muted }}>{e.name}</span>
                      <span className="ml-auto font-bold tabular-nums">
                        {nf0.format((e.value / pieTotal) * 100)} %
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ================= TAB 2 : FEUILLE DE ROUTE ================= */}
        {tab === "road" && (
          <Card t={t} className="overflow-hidden">
            <div className="p-5 flex flex-wrap items-center gap-3 justify-between border-b" style={{ borderColor: t.border }}>
              <div>
                <h2 className="font-bold flex items-center gap-2">
                  <CalendarRange size={17} style={{ color: t.accent }} />
                  Feuille de route sur {plan.rows.length} mois
                </h2>
                <p className="text-xs mt-1" style={{ color: t.muted }}>
                  {moisValides} mois validés · patrimoine suivi {ar(patrimoine)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const n = {}; plan.rows.forEach((r) => { n[r.m] = "done"; }); setStatuts(n);
                  }}
                  className="px-3 py-2 rounded-xl border text-xs font-semibold"
                  style={{ borderColor: t.border, color: t.muted }}>
                  Tout valider
                </button>
                <button
                  onClick={() => setStatuts({})}
                  className="px-3 py-2 rounded-xl border text-xs font-semibold"
                  style={{ borderColor: t.border, color: t.muted }}>
                  Tout remettre à faire
                </button>
              </div>
            </div>

            <div className="overflow-auto" style={{ maxHeight: "70vh" }}>
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr style={{ background: t.panel2 }}>
                    {["Mois", "Année", "Statut", "Action / priorité", "Fonds sécurité",
                      "Euros Deel", "Équiv. Deel (Ar)", "DAT + intérêts", "Épargne simple",
                      "Total portefeuille", "Progression"].map((h, i) => (
                      <th key={i} className={th}
                        style={{ color: t.muted, borderBottom: `1px solid ${t.border}`, background: t.panel2 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {plan.rows.map((r) => {
                    const s = statuts[r.m] || "todo";
                    const bg = s === "done" ? t.okBg : s === "wip" ? t.warnBg : t.row;
                    return (
                      <tr key={r.m} style={{ background: bg, borderBottom: `1px solid ${t.borderSoft}` }}>
                        <td className={`${td} font-bold`} style={{ color: t.accent }}>{r.label}</td>
                        <td className={td} style={{ color: t.muted }}>{r.mois} {r.annee}</td>
                        <td className="px-3 py-2.5">
                          <StatutSelect t={t} value={s} compact
                            onChange={(v) => setStatuts({ ...statuts, [r.m]: v })} />
                        </td>
                        <td className={`${td} font-medium`}>{r.action}</td>
                        <td className={td} style={{ color: r.secu >= p.securiteCible ? t.accent : t.text }}>
                          {ar(r.secu)}
                        </td>
                        <td className={`${td} font-semibold`}>{eur2(r.eurSolde)}</td>
                        <td className={td} style={{ color: t.muted }}>{ar(r.euroAr)}</td>
                        <td className={td}>
                          {ar(r.dat)}
                          {r.interetsCumules > 1 && (
                            <span className="ml-1.5 text-xs font-semibold" style={{ color: t.accent }}>
                              +{ar(r.interetsCumules)}
                            </span>
                          )}
                        </td>
                        <td className={td}>{ar(r.simple)}</td>
                        <td className={`${td} font-bold`}>{ar(r.total)}</td>
                        <td className="px-3 py-2.5 min-w-[130px]">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 rounded-full overflow-hidden"
                              style={{ background: `${t.accent}1A` }}>
                              <div className="h-full rounded-full transition-all duration-700"
                                style={{
                                  width: `${Math.min(100, r.progression)}%`,
                                  background: `linear-gradient(90deg, ${t.accent2}, ${t.accent})`,
                                }} />
                            </div>
                            <span className="text-xs font-bold tabular-nums w-12 text-right"
                              style={{ color: t.accent }}>
                              {nf0.format(r.progression)} %
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ================= TAB 3 : SIMULATEUR ================= */}
        {tab === "sim" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">

              <Card t={t} className="p-5">
                <h2 className="font-bold mb-1 flex items-center gap-2">
                  <SlidersHorizontal size={17} style={{ color: t.accent }} /> Revenus &amp; change
                </h2>
                <p className="text-xs mb-5" style={{ color: t.muted }}>
                  Tout se recalcule instantanément : tableau, graphiques et date d'atteinte.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Field t={t} label="Revenu Deel mensuel" hint={eur(p.revenuEur)}>
                    <Slider t={t} value={p.revenuEur} min={500} max={6000} step={25} onChange={set("revenuEur")} />
                    <div className="mt-2"><NumInput t={t} value={p.revenuEur} onChange={set("revenuEur")} suffix="€" /></div>
                  </Field>
                  <Field t={t} label="Taux de change net" hint={`1 € = ${nf0.format(p.taux)} Ar`}>
                    <Slider t={t} value={p.taux} min={3500} max={7000} step={25} onChange={set("taux")} />
                    <div className="mt-2"><NumInput t={t} value={p.taux} onChange={set("taux")} suffix="Ar" /></div>
                  </Field>
                  <Field t={t} label="Dépenses de vie courante" hint={ar(p.depenses)}>
                    <Slider t={t} value={p.depenses} min={0} max={8_000_000} step={50_000} onChange={set("depenses")} />
                    <div className="mt-2"><NumInput t={t} value={p.depenses} onChange={set("depenses")} suffix="Ar" step={50000} /></div>
                  </Field>
                  <Field t={t} label="Rendement du DAT" hint={`${nf2.format(p.datAnnuel)} % / an · ${nf2.format(plan.rMensuel * 100)} % / mois`}>
                    <Slider t={t} value={p.datAnnuel} min={0} max={20} step={0.25} onChange={set("datAnnuel")} />
                    <div className="mt-2"><NumInput t={t} value={p.datAnnuel} onChange={set("datAnnuel")} suffix="%/an" step={0.25} /></div>
                  </Field>
                </div>
              </Card>

              <Card t={t} className="p-5">
                <h2 className="font-bold mb-5">Budgets de départ &amp; sécurité</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Field t={t} label="Budget meubles" hint={`${ar(p.meubles)} sur ${p.meublesMois} mois`}>
                    <Slider t={t} value={p.meubles} min={0} max={40_000_000} step={500_000} onChange={set("meubles")} />
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <NumInput t={t} value={p.meubles} onChange={set("meubles")} suffix="Ar" step={500000} />
                      <NumInput t={t} value={p.meublesMois} onChange={(v) => set("meublesMois")(Math.max(1, v))} suffix="mois" />
                    </div>
                  </Field>
                  <Field t={t} label="Dette familiale (tante)" hint={`${ar(p.dette)} sur ${p.detteMois} mois`}>
                    <Slider t={t} value={p.dette} min={0} max={40_000_000} step={500_000} onChange={set("dette")} />
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <NumInput t={t} value={p.dette} onChange={set("dette")} suffix="Ar" step={500000} />
                      <NumInput t={t} value={p.detteMois} onChange={(v) => set("detteMois")(Math.max(1, v))} suffix="mois" />
                    </div>
                  </Field>
                  <Field t={t} label="Fonds de sécurité cible" hint={ar(p.securiteCible)}>
                    <Slider t={t} value={p.securiteCible} min={0} max={30_000_000} step={250_000} onChange={set("securiteCible")} />
                    <div className="mt-2"><NumInput t={t} value={p.securiteCible} onChange={set("securiteCible")} suffix="Ar" step={250000} /></div>
                  </Field>
                  <Field t={t} label="Objectif de patrimoine" hint={ar(p.objectif)}>
                    <Slider t={t} value={p.objectif} min={50_000_000} max={600_000_000} step={5_000_000} onChange={set("objectif")} />
                    <div className="mt-2"><NumInput t={t} value={p.objectif} onChange={set("objectif")} suffix="Ar" step={5000000} /></div>
                  </Field>
                </div>
              </Card>

              <Card t={t} className="p-5">
                <h2 className="font-bold mb-1">Allocation mensuelle de l'épargne</h2>
                <p className="text-xs mb-5" style={{ color: t.muted }}>
                  L'épargne simple absorbe automatiquement le reste.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Field t={t} label="Euros conservés sur Deel" hint={`${p.allocEuro} % · ${ar(plan.epargne * p.allocEuro / 100)}`}>
                    <Slider t={t} value={p.allocEuro} min={0} max={100} step={1}
                      onChange={(v) => setP({ ...p, allocEuro: v, allocDat: Math.min(p.allocDat, 100 - v) })} />
                  </Field>
                  <Field t={t} label="DAT bancaire local" hint={`${p.allocDat} % · ${ar(plan.epargne * p.allocDat / 100)}`}>
                    <Slider t={t} value={p.allocDat} min={0} max={100 - p.allocEuro} step={1} onChange={set("allocDat")} />
                  </Field>
                </div>
                <div className="mt-5 flex h-3 rounded-full overflow-hidden" style={{ background: t.panel2 }}>
                  <div style={{ width: `${p.allocEuro}%`, background: t.accent }} />
                  <div style={{ width: `${p.allocDat}%`, background: t.accent2 }} />
                  <div style={{ width: `${plan.allocSimple}%`, background: t.accent3 }} />
                </div>
                <div className="flex justify-between mt-2 text-xs font-semibold" style={{ color: t.muted }}>
                  <span>Deel {p.allocEuro} %</span>
                  <span>DAT {p.allocDat} %</span>
                  <span>Simple {plan.allocSimple} %</span>
                </div>
              </Card>

              <Card t={t} className="p-5">
                <h2 className="font-bold mb-5">Point de départ du plan</h2>
                <div className="grid grid-cols-2 gap-4">
                  <Field t={t} label="Mois">
                    <select
                      value={p.moisDepart}
                      onChange={(e) => set("moisDepart")(Number(e.target.value))}
                      className="w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none cursor-pointer"
                      style={{ background: t.panel2, borderColor: t.border, color: t.text }}>
                      {MOIS_FR.map((m, i) => (
                        <option key={m} value={i + 1} style={{ background: t.panel }}>{m}</option>
                      ))}
                    </select>
                  </Field>
                  <Field t={t} label="Année">
                    <NumInput t={t} value={p.anneeDepart} onChange={set("anneeDepart")} />
                  </Field>
                </div>
              </Card>
              <Card t={t} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
                  <h2 className="font-bold flex items-center gap-2">
                    <Database size={17} style={{ color: t.accent }} /> Sauvegarde &amp; synchronisation
                  </h2>
                  <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cfg.enabled}
                      onChange={(e) => majCfg("enabled")(e.target.checked)}
                      className="w-4 h-4 cursor-pointer"
                      style={{ accentColor: t.accent }}
                    />
                    Utiliser Supabase
                  </label>
                </div>
                <p className="text-xs mb-5" style={{ color: t.muted }}>
                  Les statuts des mois, des jalons et vos paramètres sont enregistrés automatiquement
                  sur cet appareil. Activez Supabase pour les retrouver sur tous vos appareils.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Field t={t} label="URL du projet">
                      <input
                        type="url"
                        value={cfg.url}
                        onChange={(e) => majCfg("url")(e.target.value)}
                        placeholder="https://xxxxxxxx.supabase.co"
                        className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                        style={{ background: t.panel2, borderColor: t.border, color: t.text }}
                      />
                    </Field>
                  </div>
                  <div className="md:col-span-2">
                    <Field t={t} label="Clé publique anon" hint="jamais la clé service_role">
                      <input
                        type="password"
                        value={cfg.cle}
                        onChange={(e) => majCfg("cle")(e.target.value)}
                        placeholder="eyJhbGciOi…"
                        className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                        style={{ background: t.panel2, borderColor: t.border, color: t.text }}
                      />
                    </Field>
                  </div>
                  <Field t={t} label="Table">
                    <input
                      type="text"
                      value={cfg.table}
                      onChange={(e) => majCfg("table")(e.target.value)}
                      className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                      style={{ background: t.panel2, borderColor: t.border, color: t.text }}
                    />
                  </Field>
                  <Field t={t} label="Identifiant de profil" hint="clé primaire de la ligne">
                    <input
                      type="text"
                      value={cfg.profil}
                      onChange={(e) => majCfg("profil")(e.target.value)}
                      className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                      style={{ background: t.panel2, borderColor: t.border, color: t.text }}
                    />
                  </Field>
                </div>

                <div className="flex flex-wrap gap-2 mt-5">
                  {[
                    { l: "Tester la connexion", I: RefreshCw, f: testerSupabase },
                    { l: "Importer depuis Supabase", I: Download, f: importerSupabase },
                    { l: "Envoyer vers Supabase", I: Upload, f: envoyerSupabase },
                  ].map((b, i) => (
                    <button
                      key={i}
                      onClick={b.f}
                      disabled={!cfgPrete(cfg)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ borderColor: t.border, background: t.panel2, color: t.text }}
                    >
                      <b.I size={14} /> {b.l}
                    </button>
                  ))}
                </div>

                {sync.message && (
                  <div
                    className="mt-4 p-3 rounded-xl text-xs font-semibold flex items-start gap-2"
                    style={{
                      background: sync.etat === "error" ? t.warnBg : t.okBg,
                      color: sync.etat === "error" ? t.warn : t.accent,
                    }}
                  >
                    {sync.etat === "error"
                      ? <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                      : <CheckCircle2 size={14} className="shrink-0 mt-0.5" />}
                    <span className="break-words">{sync.message}</span>
                  </div>
                )}

                <details className="mt-4">
                  <summary className="text-xs font-semibold cursor-pointer" style={{ color: t.muted }}>
                    SQL à exécuter une fois dans Supabase
                  </summary>
                  <pre
                    className="mt-2 p-3 rounded-xl text-[11px] overflow-x-auto leading-relaxed"
                    style={{ background: t.panel2, color: t.muted }}
                  >{`create table if not exists ${cfg.table || "plan_patrimoine"} (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table ${cfg.table || "plan_patrimoine"} enable row level security;

create policy "acces profil anon" on ${cfg.table || "plan_patrimoine"}
  for all to anon using (true) with check (true);`}</pre>
                  <p className="text-[11px] mt-2" style={{ color: t.muted }}>
                    Cette politique ouvre la table à toute personne détenant la clé anon. Pour un usage
                    réel, remplacez-la par une règle basée sur <span className="font-semibold">auth.uid()</span>.
                  </p>
                </details>

                <div className="mt-4 p-3 rounded-xl text-[11px] leading-relaxed"
                  style={{ background: t.panel2, color: t.muted }}>
                  <span className="font-semibold" style={{ color: t.text }}>À savoir :</span> vos données
                  sont enregistrées automatiquement dans le stockage local de votre navigateur sur cet
                  appareil. Activez Supabase ci-dessus pour les synchroniser entre plusieurs appareils.
                </div>
              </Card>
            </div>

            {/* Résultat en direct */}
            <div className="space-y-4">
              <Card t={t} className="p-5 sticky top-4"
                style={{ background: `linear-gradient(160deg, ${t.panel}, ${t.panel2})`, borderColor: t.accent2 }}>
                <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: t.accent }}>
                  Résultat en direct
                </div>

                <div className="mb-5">
                  <div className="text-sm mb-1" style={{ color: t.muted }}>Objectif {ar(p.objectif)} atteint</div>
                  <div className="text-2xl font-bold leading-tight">
                    {plan.atteint ? dateDe(p, plan.moisObjectif) : "Hors horizon"}
                  </div>
                  {plan.atteint && (
                    <div className="text-sm font-semibold mt-1 flex items-center gap-1" style={{ color: t.accent }}>
                      <ArrowUpRight size={14} />
                      M{plan.moisObjectif} · {nf2.format(plan.moisObjectif / 12)} ans
                    </div>
                  )}
                </div>

                <div className="space-y-3 text-sm">
                  {[
                    ["Revenu mensuel", ar(plan.revenuAr)],
                    ["Capacité d'épargne", ar(plan.epargne)],
                    ["Taux d'épargne", plan.revenuAr ? pct((plan.epargne / plan.revenuAr) * 100) : "—"],
                    ["Cap 100 M Ar", plan.moisCap100 ? `M${plan.moisCap100} · ${dateDe(p, plan.moisCap100)}` : "Non atteint"],
                    ["Fonds sécurité complet", plan.moisSecu ? `M${plan.moisSecu} · ${dateDe(p, plan.moisSecu)}` : "Non atteint"],
                    ["Patrimoine final", ar(dernier?.total ?? 0)],
                    ["dont intérêts DAT", ar(dernier?.interetsCumules ?? 0)],
                  ].map(([l, v], i) => (
                    <div key={i} className="flex justify-between gap-3 pb-2.5"
                      style={{ borderBottom: `1px solid ${t.borderSoft}` }}>
                      <span style={{ color: t.muted }}>{l}</span>
                      <span className="font-bold tabular-nums text-right">{v}</span>
                    </div>
                  ))}
                </div>

                {plan.epargne <= 0 && (
                  <div className="mt-4 p-3 rounded-xl text-xs font-semibold"
                    style={{ background: t.warnBg, color: t.warn }}>
                    Les dépenses dépassent le revenu : aucune épargne possible. Baissez les dépenses ou augmentez le revenu.
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        <footer className="mt-8 text-xs text-center" style={{ color: t.muted }}>
          Projection indicative. Le fonds de sécurité de {ar(p.securiteCible)} est compté à part de l'objectif de {ar(p.objectif)}.
          Rendement DAT supposé constant à {nf2.format(p.datAnnuel)} %/an, hors fiscalité et hors variation du taux de change.
        </footer>
      </div>
    </div>
  );
}
