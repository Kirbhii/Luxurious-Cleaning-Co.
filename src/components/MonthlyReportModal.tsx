import { useMemo, useRef } from 'react';
import { X, Printer, FileText } from 'lucide-react';
import type { Booking, User } from '../store';
import logoImg from '../imports/image-3.png';

interface MonthlyReportModalProps {
  /** 'YYYY-MM' */
  monthKey: string;
  bookings: Booking[];
  users: User[];
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  awaiting_review: 'Awaiting Review',
  awaiting_quote: 'Awaiting Quote',
  rejected: 'Rejected',
  pending: 'Pending',
  confirmed: 'Confirmed',
  cleaner_assigned: 'Cleaner Assigned',
  en_route: 'En Route',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rescheduled: 'Rescheduled',
};

const OPEN_STATUSES = ['awaiting_review', 'awaiting_quote', 'pending', 'confirmed', 'cleaner_assigned', 'en_route', 'in_progress'];

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Postgres DATE arrives as 'YYYY-MM-DD'. Anything else is parsed, and an
 *  unparseable date is reported as '' rather than guessed into a month. */
function monthOf(dateStr: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(dateStr ?? '');
  if (match) return `${match[1]}-${match[2]}`;
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
}

function periodLabel(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return monthKey;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return date.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
}

function tally<T extends string>(values: T[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  values.forEach(v => counts.set(v, (counts.get(v) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export interface MonthlyReportData {
  rows: Booking[];
  total: number;
  completed: number;
  cancelled: number;
  open: number;
  uniqueCustomers: number;
  newCustomers: number;
  byService: Array<[string, number]>;
  byStatus: Array<[string, number]>;
  byCity: Array<[string, number]>;
  memberBookings: number;
  priorityBookings: number;
  /** completed ÷ total, rounded to a whole percent. 0 when the month is empty. */
  completionRate: number;
}

/** Everything the report shows is derived here, so the preview and the printout
 *  can never disagree — they are the same string. */
export function buildReportData(monthKey: string, bookings: Booking[], users: User[]): MonthlyReportData {
  const rows = bookings
    .filter(b => monthOf(b.date) === monthKey)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  const customerIds = [...new Set(rows.map(b => b.customerId))];
  const newCustomers = customerIds.filter(id => {
    const user = users.find(u => u.id === id);
    return user ? monthOf(user.createdAt) === monthKey : false;
  }).length;
  const completed = rows.filter(b => b.status === 'completed').length;

  return {
    rows,
    total: rows.length,
    completed,
    cancelled: rows.filter(b => b.status === 'cancelled').length,
    open: rows.filter(b => OPEN_STATUSES.includes(b.status)).length,
    uniqueCustomers: customerIds.length,
    newCustomers,
    byService: tally(rows.map(b => b.service || 'Unspecified')),
    byStatus: tally(rows.map(b => STATUS_LABELS[b.status] ?? b.status)),
    byCity: tally(rows.map(b => b.city || 'Unspecified')),
    memberBookings: rows.filter(b => !!b.memberTier).length,
    priorityBookings: rows.filter(b => b.priority && b.priority !== 'normal').length,
    completionRate: rows.length > 0 ? Math.round((completed / rows.length) * 100) : 0,
  };
}

/** The calendar month before `monthKey`. '2026-01' goes back to '2025-12'. */
export function previousMonthKey(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return '';
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  date.setMonth(date.getMonth() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Short name for the baseline month. The year is only appended when it differs
 *  from the reported month, so 'vs Dec 2025' appears only when it is needed. */
export function baselineLabel(monthKey: string, prevKey: string): string {
  const current = /^(\d{4})/.exec(monthKey);
  const prev = /^(\d{4})-(\d{2})$/.exec(prevKey);
  if (!prev) return '';
  const name = new Date(Number(prev[1]), Number(prev[2]) - 1, 1)
    .toLocaleDateString('en-PH', { month: 'short' });
  return current && current[1] === prev[1] ? name : `${name} ${prev[1]}`;
}

/** One figure in the KPI strip. `goodWhenUp` is null where the direction carries
 *  no judgement — "still open" is a healthy pipeline one month and a growing
 *  backlog the next, and guessing a colour there would make the strip lie. */
export interface ReportMetric {
  key: 'total' | 'completed' | 'rate' | 'cancelled' | 'open' | 'customers' | 'new';
  label: string;
  value: number;
  goodWhenUp: boolean | null;
  unit: 'count' | 'percent';
}

export function buildReportMetrics(data: MonthlyReportData): ReportMetric[] {
  return [
    { key: 'total', label: 'Bookings', value: data.total, goodWhenUp: true, unit: 'count' },
    { key: 'completed', label: 'Completed', value: data.completed, goodWhenUp: true, unit: 'count' },
    { key: 'rate', label: 'Completion rate', value: data.completionRate, goodWhenUp: true, unit: 'percent' },
    { key: 'cancelled', label: 'Cancelled', value: data.cancelled, goodWhenUp: false, unit: 'count' },
    { key: 'open', label: 'Still open', value: data.open, goodWhenUp: null, unit: 'count' },
    { key: 'customers', label: 'Customers served', value: data.uniqueCustomers, goodWhenUp: true, unit: 'count' },
    { key: 'new', label: 'New customers', value: data.newCustomers, goodWhenUp: true, unit: 'count' },
  ];
}

/** The same figure read from the baseline month. A month with no bookings at all
 *  is not a baseline — '+42 vs an empty August' is a true number that tells you
 *  nothing, so it is reported as absent instead. */
export function previousValueFor(metric: ReportMetric, prev: MonthlyReportData | null): number | null {
  if (!prev || prev.total === 0) return null;
  switch (metric.key) {
    case 'total': return prev.total;
    case 'completed': return prev.completed;
    case 'rate': return prev.completionRate;
    case 'cancelled': return prev.cancelled;
    case 'open': return prev.open;
    case 'customers': return prev.uniqueCustomers;
    case 'new': return prev.newCustomers;
    default: return null;
  }
}

export interface MetricDelta {
  /** null when there is no comparable previous month. */
  change: number | null;
  direction: 'up' | 'down' | 'flat' | 'none';
  tone: 'good' | 'bad' | 'neutral';
}

export function metricDelta(metric: ReportMetric, previousValue: number | null): MetricDelta {
  if (previousValue === null) return { change: null, direction: 'none', tone: 'neutral' };
  const change = metric.value - previousValue;
  if (change === 0) return { change: 0, direction: 'flat', tone: 'neutral' };
  const up = change > 0;
  let tone: MetricDelta['tone'] = 'neutral';
  if (metric.goodWhenUp === true) tone = up ? 'good' : 'bad';
  if (metric.goodWhenUp === false) tone = up ? 'bad' : 'good';
  return { change, direction: up ? 'up' : 'down', tone };
}

/** '▲ 8', '▼ 3 pts', 'no change', or '—' when there is nothing to compare with. */
export function formatDelta(delta: MetricDelta, unit: 'count' | 'percent'): string {
  if (delta.change === null) return '—';
  if (delta.change === 0) return 'no change';
  const arrow = delta.change > 0 ? '▲' : '▼';
  const size = Math.abs(delta.change);
  return unit === 'percent' ? `${arrow} ${size} pts` : `${arrow} ${size}`;
}

function kpiCard(metric: ReportMetric, prev: MonthlyReportData | null, prevLabel: string): string {
  const delta = metricDelta(metric, previousValueFor(metric, prev));
  const shown = metric.unit === 'percent' ? `${metric.value}%` : String(metric.value);
  const text = formatDelta(delta, metric.unit);
  const cls = delta.change === null || delta.change === 0 ? 'kpi-d' : `kpi-d d-${delta.tone}`;
  const suffix = delta.change === null || !prevLabel ? '' : ` vs ${esc(prevLabel)}`;
  return `<div class="kpi">
    <div class="kpi-v">${esc(shown)}</div>
    <div class="kpi-l">${esc(metric.label)}</div>
    <div class="${cls}">${esc(text)}${suffix}</div>
  </div>`;
}

function breakdown(title: string, entries: Array<[string, number]>, total: number): string {
  if (entries.length === 0) {
    return `<div class="panel"><h3>${esc(title)}</h3><div class="empty">No bookings in this period.</div></div>`;
  }
  const rows = entries.map(([name, count]) => {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return `<tr><td class="name">${esc(name)}</td><td class="num">${count}</td><td class="num muted">${pct}%</td></tr>`;
  }).join('');
  return `<div class="panel"><h3>${esc(title)}</h3>
    <table class="mini"><tbody>${rows}</tbody></table></div>`;
}

export function buildMonthlyReportHtml(
  monthKey: string,
  bookings: Booking[],
  users: User[],
  logoUrl: string
): string {
  const data = buildReportData(monthKey, bookings, users);
  const prevKey = previousMonthKey(monthKey);
  const prev = prevKey ? buildReportData(prevKey, bookings, users) : null;
  const prevLabel = prevKey ? baselineLabel(monthKey, prevKey) : '';
  const period = periodLabel(monthKey);
  const generated = new Date().toLocaleString('en-PH', {
    month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });

  const detailRows = data.rows.map(b => {
    const customer = users.find(u => u.id === b.customerId);
    const cleaner = b.cleanerId ? users.find(u => u.id === b.cleanerId) : null;
    return `<tr>
      <td class="mono">${esc(b.date)}</td>
      <td class="mono">${esc(b.id)}</td>
      <td>${esc(b.customerName || customer?.name || '—')}</td>
      <td>${esc(b.service || '—')}</td>
      <td>${esc(b.city || '—')}</td>
      <td>${esc(cleaner?.name || 'Unassigned')}</td>
      <td class="st st-${esc(b.status)}">${esc(STATUS_LABELS[b.status] ?? b.status)}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Monthly Operations Report — ${esc(period)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    color: #14161c;
    background: #fff;
    margin: 0;
    padding: 20px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet { max-width: 780px; margin: 0 auto; }
  header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
           border-bottom: 2px solid #c9a227; padding-bottom: 12px; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand img { height: 38px; width: auto; }
  .brand .name { font-family: Georgia, 'Times New Roman', serif; font-weight: bold;
                 font-size: 17px; letter-spacing: 0.08em; line-height: 1; }
  .brand .sub { font-size: 7.5px; letter-spacing: 0.32em; color: #6b6257; margin-top: 2px; }
  .brand .addr { font-size: 9px; color: #6b6257; margin-top: 6px; }
  .title { text-align: right; }
  .title h1 { font-family: Georgia, 'Times New Roman', serif; font-size: 16px;
              letter-spacing: 0.12em; text-transform: uppercase; margin: 0; }
  .title .period { font-size: 13px; color: #8a6d1b; font-weight: bold; margin-top: 3px; }
  .title .gen { font-size: 8.5px; color: #6b6257; margin-top: 4px; }

  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 16px 0; }
  .kpi { border: 1px solid #e2dccb; border-radius: 6px; padding: 9px 10px; background: #fbfaf6; }
  .kpi:first-child { grid-column: span 2; }
  .kpi-v { font-size: 19px; font-weight: bold; line-height: 1.1; color: #14161c; }
  .kpi-l { font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; color: #6b6257; margin-top: 3px; }
  .kpi-d { font-size: 7.5px; margin-top: 2px; color: #8b8578; }
  .kpi-d.d-good { color: #16794a; }
  .kpi-d.d-bad { color: #b4232a; }

  .panels { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .panel { border: 1px solid #e2dccb; border-radius: 6px; padding: 10px 12px; break-inside: avoid; }
  .panel h3 { font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase;
              color: #8a6d1b; margin: 0 0 7px; }
  .mini { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  .mini td { padding: 2.5px 0; border-bottom: 1px dotted #eee7d5; }
  .mini tr:last-child td { border-bottom: none; }
  .mini .name { color: #2b2f38; }
  .mini .num { text-align: right; font-variant-numeric: tabular-nums; font-weight: bold; width: 34px; }
  .mini .muted { color: #8b8578; font-weight: normal; width: 38px; }
  .empty { font-size: 10.5px; color: #8b8578; }

  h2.section { font-size: 9.5px; letter-spacing: 0.16em; text-transform: uppercase;
               color: #8a6d1b; margin: 0 0 6px; }
  table.detail { width: 100%; border-collapse: collapse; font-size: 9.5px; }
  table.detail thead th { text-align: left; font-size: 8px; letter-spacing: 0.1em;
                          text-transform: uppercase; color: #6b6257;
                          border-bottom: 1px solid #c9a227; padding: 5px 4px; }
  table.detail td { padding: 4.5px 4px; border-bottom: 1px solid #f0ece0; vertical-align: top; }
  table.detail tr { break-inside: avoid; }
  .mono { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 8.5px; color: #4a443c; }
  .st { font-weight: bold; white-space: nowrap; }
  .st-completed { color: #16794a; }
  .st-cancelled { color: #b4232a; }
  .st-rejected { color: #b4232a; }
  .st-in_progress, .st-en_route, .st-cleaner_assigned { color: #7a3fa8; }
  .st-pending, .st-awaiting_review, .st-awaiting_quote { color: #a8760f; }
  .st-confirmed { color: #1d5fa8; }

  footer { margin-top: 22px; padding-top: 12px; border-top: 1px solid #e2dccb;
           display: flex; justify-content: space-between; gap: 24px; break-inside: avoid; }
  .sig { flex: 1; }
  .sig .script { font-family: Georgia, 'Times New Roman', serif; font-style: italic;
                 font-size: 13px; color: #14161c; }
  .sig .line { border-top: 1px solid #999; margin-top: 4px; padding-top: 3px;
               font-size: 8px; letter-spacing: 0.16em; text-transform: uppercase; color: #8a6d1b; }
  .note { font-size: 8px; color: #8b8578; text-align: center; margin-top: 14px; }
  @media print { body { padding: 0; } .sheet { max-width: none; } }
</style>
</head>
<body>
<div class="sheet">
  <header>
    <div class="brand">
      <img src="${esc(logoUrl)}" alt="" />
      <div>
        <div class="name">LUXURIOUS</div>
        <div class="sub">CLEANING CO.</div>
        <div class="addr">Atlanta Centre, 31 Annapolis Street, San Juan City, Metro Manila<br />0919 002 4136</div>
      </div>
    </div>
    <div class="title">
      <h1>Monthly Operations Report</h1>
      <div class="period">${esc(period)}</div>
      <div class="gen">Generated ${esc(generated)}</div>
    </div>
  </header>

  <div class="kpis">
    ${buildReportMetrics(data).map(m => kpiCard(m, prev, prevLabel)).join('')}
  </div>

  <div class="panels">
    ${breakdown('Bookings by service', data.byService, data.total)}
    ${breakdown('Bookings by status', data.byStatus, data.total)}
  </div>

  <div class="panels">
    ${breakdown('Bookings by city', data.byCity, data.total)}
    <div class="panel">
      <h3>Membership &amp; priority</h3>
      <table class="mini"><tbody>
        <tr><td class="name">Member bookings</td><td class="num">${data.memberBookings}</td><td class="num muted">${data.total ? Math.round((data.memberBookings / data.total) * 100) : 0}%</td></tr>
        <tr><td class="name">Priority bookings</td><td class="num">${data.priorityBookings}</td><td class="num muted">${data.total ? Math.round((data.priorityBookings / data.total) * 100) : 0}%</td></tr>
        <tr><td class="name">Non-member bookings</td><td class="num">${data.total - data.memberBookings}</td><td class="num muted">${data.total ? Math.round(((data.total - data.memberBookings) / data.total) * 100) : 0}%</td></tr>
      </tbody></table>
    </div>
  </div>

  <h2 class="section">Booking detail</h2>
  ${data.rows.length === 0
    ? '<div class="empty">No bookings were recorded in this period.</div>'
    : `<table class="detail">
    <thead><tr>
      <th>Date</th><th>Booking</th><th>Customer</th><th>Service</th><th>City</th><th>Cleaner</th><th>Status</th>
    </tr></thead>
    <tbody>${detailRows}</tbody>
  </table>`}

  <footer>
    <div class="sig">
      <div class="script">Luxurious Cleaning Co.</div>
      <div class="line">Prepared By</div>
    </div>
    <div class="sig">
      <div class="script">${esc(generated)}</div>
      <div class="line">Date Prepared</div>
    </div>
  </footer>
  <div class="note">
    This report covers bookings whose service date falls within ${esc(period)}.
    Deltas compare against the previous calendar month; a "—" means that month held no bookings to compare against.
    Figures are derived from the booking records at the time of printing.
  </div>
</div>
</body>
</html>`;
}

export default function MonthlyReportModal({ monthKey, bookings, users, onClose }: MonthlyReportModalProps) {
  const html = useMemo(() => {
    const logoUrl = `${window.location.origin}${logoImg}`;
    return buildMonthlyReportHtml(monthKey, bookings, users, logoUrl);
  }, [monthKey, bookings, users]);
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  function handlePrint() {
    // Printing reuses the previewed document, so what is on screen is what
    // comes out of the printer — there is no second copy of the layout.
    const frame = frameRef.current;
    const win = frame?.contentWindow ?? window.open('', '_blank', 'width=1100,height=800');
    if (!win) return;
    if (!frame) {
      (win as Window).document.write(html);
      (win as Window).document.close();
    }
    win.focus();
    win.print();
  }

  return (
    <div
      className="fixed inset-0 z-[110] bg-navy-950/90 backdrop-blur-sm animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Monthly operations report preview"
          className="relative bg-navy-800 border border-gold-400/20 rounded-2xl shadow-2xl max-w-4xl w-full m-auto animate-scale-in overflow-hidden flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)]"
          onClick={event => event.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gold-400/10 shrink-0 bg-navy-800">
            <h3 className="font-serif text-2xl text-cream-100 flex items-center gap-2">
              <FileText size={20} className="text-gold-400" /> Monthly Report Preview
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 rounded-lg bg-gold-400 hover:bg-gold-300 px-4 py-2 text-sm font-semibold text-navy-950 transition-colors"
              >
                <Printer size={15} /> Print / Save as PDF
              </button>
              <button
                onClick={onClose}
                aria-label="Close report preview"
                className="rounded-lg border border-gold-400/20 p-2 text-cream-300 transition-colors hover:border-gold-400/50 hover:text-cream-100"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 bg-white">
            <iframe
              ref={frameRef}
              title="Monthly operations report"
              srcDoc={html}
              className="w-full h-full min-h-[60vh] border-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
