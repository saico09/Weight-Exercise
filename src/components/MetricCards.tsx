import { createContext, useContext, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';
import { displayWeight, type WeightUnit } from '../lib/model';
import { metricGeometry, type MetricSeries } from '../lib/metricSeries';
import { useI18n } from '../lib/i18n';
import './metric-cards.css';

const GridContext = createContext({ expanded: new Set<string>(), toggle: (_id: string) => {} });

export function MetricGrid({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(new Set<string>());
  const grid = useRef<HTMLDivElement>(null);
  const previous = useRef(new Map<Element, DOMRect>());
  const toggle = (id: string) => {
    previous.current = new Map(Array.from(grid.current?.children ?? [], child => [child, child.getBoundingClientRect()]));
    setExpanded(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  useLayoutEffect(() => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (const child of Array.from(grid.current?.children ?? [])) {
        const before = previous.current.get(child);
        if (!before) continue;
        const after = child.getBoundingClientRect();
        const x = before.x - after.x;
        const y = before.y - after.y;
        if ((x || y) && 'animate' in child) child.animate([
          { transform: `translate(${x}px, ${y}px)` }, { transform: 'translate(0, 0)' },
        ], { duration: 320, easing: 'cubic-bezier(.2,.7,.2,1)' });
      }
    }
    previous.current.clear();
  }, [expanded]);
  return <GridContext.Provider value={{ expanded, toggle }}><div ref={grid} className="metrics-grid metric-interactive-grid">{children}</div></GridContext.Provider>;
}

function Sparkline({ series }: { series: MetricSeries }) {
  const geometry = metricGeometry(series);
  if (!geometry) return <svg viewBox="0 0 100 52" aria-hidden="true" className="metric-sparkline is-empty"><path d="M8 27H92" stroke="currentColor" strokeDasharray="3 6" fill="none" /></svg>;
  const { points, referenceY } = geometry;
  const path = points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
  const last = points.at(-1)!;
  const barWidth = Math.max(1.5, Math.min(9, 76 / points.length));
  return <svg viewBox="0 0 100 52" preserveAspectRatio="none" aria-hidden="true" className="metric-sparkline">
    <path d="M5 46H95" className="metric-chart-base" fill="none" />
    {referenceY !== undefined && <path d={`M5 ${referenceY}H95`} className="metric-chart-reference" fill="none" />}
    {series.kind === 'bars' ? points.map((point, index) => <rect key={index} x={point.x - barWidth / 2} y={Math.min(point.y, geometry.zeroY)} width={barWidth} height={Math.max(.7, Math.abs(geometry.zeroY - point.y))} rx="1" className={index === points.length - 1 ? 'metric-chart-bar final' : 'metric-chart-bar'} />) : <>
      {points.length > 1 && <path d={path} className="metric-chart-line" fill="none" vectorEffect="non-scaling-stroke" />}
      <ellipse cx={last.x} cy={last.y} rx={points.length === 1 ? 2.5 : 2} ry={points.length === 1 ? 2.5 : 2} className="metric-chart-dot" />
    </>}
  </svg>;
}

export function Metric({ id, label, value, unit, note, icon, accent = false, series, weightUnit }: {
  id: string; label: string; value: string; unit?: string; note: string; icon: ReactNode; accent?: boolean;
  series: MetricSeries; weightUnit: WeightUnit;
}) {
  const { t, locale } = useI18n();
  const { expanded, toggle } = useContext(GridContext);
  const open = expanded.has(id);
  const geometry = metricGeometry(series);
  const format = (number: number) => series.valueKind === 'weight' ? `${displayWeight(number, weightUnit, 1, locale)} ${weightUnit}` : `${number.toLocaleString(locale, { maximumFractionDigits: 1 })} ${t(number === 1 ? 'día' : 'días')}`;
  const formatDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  return <button type="button" className={`card metric-card interactive-metric ${accent ? 'metric-accent' : ''} ${open ? 'is-expanded' : ''}`} onClick={() => toggle(id)} aria-expanded={open} aria-describedby={`${id}-metric-note`} aria-label={`${t(label)}: ${value}${unit ? ` ${t(unit)}` : ''}. ${t(open ? 'Contraer gráfico' : 'Ampliar gráfico')}`}>
    <span className="card-head"><span className="muted">{t(label)}</span><span className="metric-card-icons"><span className="metric-category-icon">{icon}</span>{open ? <Minus size={12} /> : <Plus size={12} />}</span></span>
    <span className="metric-reading"><strong className="metric-value" style={{ '--metric-number-width': Math.max(3, Array.from(value).length) * .62 } as CSSProperties}><span className="metric-number">{value}</span>{unit && <small>{t(unit)}</small>}</strong><span className="metric-chart-wrap"><Sparkline series={series} /></span></span>
    <span id={`${id}-metric-note`} className="metric-note muted">{t(note)}</span>
    {open && <span className="metric-chart-detail">
      <span className="metric-chart-description">{t(series.description)}</span>
      {geometry ? <>
        <span className="metric-chart-range"><span>{formatDate(series.points[0].date)}</span><span>{formatDate(series.points.at(-1)!.date)}</span></span>
        <span className="metric-chart-range metric-chart-values"><span>{t('Mín.')} {format(geometry.min)}</span><span>{t('Máx.')} {format(geometry.max)}</span></span>
        {series.points.length === 1 && <span className="metric-chart-hint">{t('Un punto por ahora. La tendencia aparecerá con más registros.')}</span>}
      </> : <span className="metric-chart-hint">{t('Aún no hay suficientes registros para este gráfico.')}</span>}
    </span>}
  </button>;
}
