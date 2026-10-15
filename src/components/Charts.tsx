import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Maximize2, Minus, Plus, MoveHorizontal, Layers3 } from 'lucide-react';
import type { DailyRecord, GoalChartStyle, WeightUnit } from '../lib/model';
import { displayWeight, fromKg } from '../lib/model';
import { useI18n } from '../lib/i18n';
import { chartDay, clampChartWindow, nextChartStyle, sampleChartPoints, signedChartValue, weightChartDomain, zoomChartWindow } from './chartUtils';
import type { ChartWindow, WeightChartStyle } from './chartUtils';
import { IS_PRO } from '../lib/edition';
import './charts-dashboard.css';

type Gesture = { window: ChartWindow; x: number; midpoint: number; distance: number; moved: boolean };

export function WeightChart({ records, unit, goal, periodBounds, hasHistory = false, style: preferredStyle, onStyleChange }: { records: DailyRecord[]; unit: WeightUnit; goal: number; periodBounds: ChartWindow; hasHistory?: boolean; style?: WeightChartStyle; onStyleChange?: (style: WeightChartStyle) => void }) {
  const { t, locale } = useI18n();
  const id = useId().replace(/:/g, '');
  const [active, setActive] = useState<string | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const surface = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const [chartWidth, setChartWidth] = useState(720);
  const [view, setView] = useState<ChartWindow | null>(null);
  const [localStyle, setLocalStyle] = useState<WeightChartStyle>('area');
  const chartStyle = IS_PRO ? preferredStyle || localStyle : 'area';
  const columns = chartStyle === 'bars';
  const styleNames = { area: 'Área', line: 'Línea', bars: 'Variación' };
  const sorted = useMemo(() => [...records].sort((a, b) => a.date.localeCompare(b.date)), [records]);
  const points = useMemo(() => sorted.map(record => ({ record, x: chartDay(record.date), value: fromKg(record.weightKg, unit) })), [sorted, unit]);
  const first = points[0]?.x ?? 0, last = points[points.length - 1]?.x ?? 1;
  const bounds = useMemo(() => ({ start: periodBounds.start, end: periodBounds.end }), [periodBounds.start, periodBounds.end]);
  const window = view ? clampChartWindow(view, bounds) : bounds;
  const viewRef = useRef(window);
  viewRef.current = window;
  const W = chartWidth, H = chartWidth < 450 ? 220 : 245, left = 38, right = 30, top = 21, bottom = 33;
  const plotWidth = W - left - right;
  const span = window.end - window.start || 1;
  const total = bounds.end - bounds.start;
  const isZoomed = span < total - .001;

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setChartWidth(Math.max(180, Math.min(900, entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { setView(null); setActive(null); pointers.current.clear(); gesture.current = null; }, [first, last, records.length, bounds]);

  const changeView = (next: ChartWindow) => {
    const bounded = clampChartWindow(next, bounds);
    viewRef.current = bounded;
    setView(bounded);
  };
  const zoom = (factor: number, anchor = .5) => changeView(zoomChartWindow(viewRef.current, bounds, factor, anchor));
  const localFraction = (clientX: number) => {
    const rect = surface.current?.getBoundingClientRect();
    return rect ? Math.max(0, Math.min(1, ((clientX - rect.left) / rect.width * W - left) / plotWidth)) : .5;
  };

  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        zoom(Math.exp(Math.max(-1, Math.min(1, event.deltaY * .007))), localFraction(event.clientX));
      } else if (Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.shiftKey) {
        if (!isZoomed) return;
        event.preventDefault();
        const delta = event.deltaX || event.deltaY;
        const current = viewRef.current;
        const offset = delta / plotWidth * (current.end - current.start);
        changeView({ start: current.start + offset, end: current.end + offset });
      }
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  });

  const visible = points.filter(point => point.x >= window.start - .00001 && point.x <= window.end + .00001);
  const before = [...points].reverse().find(point => point.x < window.start);
  const after = points.find(point => point.x > window.end);
  const linePoints = [...(before ? [before] : []), ...visible, ...(after ? [after] : [])];
  const goalValue = fromKg(goal, unit);
  // Keep the reference fixed while panning/zooming within the selected period.
  const referenceValue = points[0]?.value ?? 0;
  const domainPoints = columns ? (visible.length ? visible : points) : (linePoints.length ? linePoints : points);
  const { min, max, showGoal } = weightChartDomain(domainPoints.map(point => point.value), goalValue, chartStyle, referenceValue, fromKg(1, unit));
  const x = (day: number) => left + (day - window.start) / span * plotWidth;
  const y = (value: number) => top + (max - value) / (max - min || 1) * (H - top - bottom);
  const rendered = [...(before ? [before] : []), ...sampleChartPoints(visible, Math.floor(plotWidth / 2)), ...(after ? [after] : [])];
  const renderedBars = sampleChartPoints(visible, Math.max(1, Math.floor(plotWidth / 5)));
  const barWidth = Math.max(.65, Math.min(28, plotWidth / Math.max(1, visible.length) * .6, plotWidth / span * .65));
  const line = rendered.map((point, index) => `${index ? 'L' : 'M'}${x(point.x)},${y(point.value)}`).join(' ');
  const selected = visible.find(point => point.record.id === active) ?? visible[visible.length - 1];
  const markers = visible.reduce<typeof points>((result, point, index) => {
    if (!result.length || x(point.x) - x(result[result.length - 1].x) >= 25) result.push(point);
    else if (index === visible.length - 1 && result.length > 1) result[result.length - 1] = point;
    return result;
  }, []);
  const dateLabel = (day: number, year = false) => new Date(day * 86_400_000).toLocaleDateString(locale, { day: 'numeric', month: 'short', ...(year ? { year: '2-digit' as const } : {}), timeZone: 'UTC' });
  const rangeText = `${dateLabel(window.start, total > 365)} — ${dateLabel(window.end, total > 365)}`;
  const deltaLabel = (value: number) => signedChartValue(value, locale);

  const selectAt = (clientX: number) => {
    const day = viewRef.current.start + localFraction(clientX) * (viewRef.current.end - viewRef.current.start);
    const candidates = points.filter(point => point.x >= viewRef.current.start && point.x <= viewRef.current.end);
    const nearest = candidates.reduce<typeof points[number] | undefined>((best, point) => !best || Math.abs(point.x - day) < Math.abs(best.x - day) ? point : best, undefined);
    if (nearest) setActive(nearest.record.id);
  };
  const beginGesture = () => {
    const values = [...pointers.current.values()];
    if (!values.length) { gesture.current = null; return; }
    const [a, b] = values;
    gesture.current = { window: viewRef.current, x: a.x, midpoint: b ? (a.x + b.x) / 2 : a.x, distance: b ? Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)) : 0, moved: false };
  };
  const pointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    beginGesture();
  };
  const pointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(event.pointerId)) { if (event.pointerType === 'mouse') selectAt(event.clientX); return; }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const current = gesture.current;
    if (!current) return;
    const [a, b] = [...pointers.current.values()];
    if (b && current.distance) {
      current.moved = true;
      const distance = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
      const newSpan = Math.min(total, Math.max(Math.min(3, total), (current.window.end - current.window.start) * current.distance / distance));
      const anchorDay = current.window.start + localFraction(current.midpoint) * (current.window.end - current.window.start);
      const start = anchorDay - localFraction((a.x + b.x) / 2) * newSpan;
      changeView({ start, end: start + newSpan });
    } else {
      const delta = a.x - current.x;
      if (Math.abs(delta) < 4 && !current.moved) return;
      current.moved = true;
      const renderedWidth = surface.current?.getBoundingClientRect().width ?? W;
      const offset = delta / (renderedWidth * plotWidth / W) * (current.window.end - current.window.start);
      changeView({ start: current.window.start - offset, end: current.window.end - offset });
    }
  };
  const pointerEnd = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.type !== 'pointercancel' && gesture.current && !gesture.current.moved && pointers.current.size === 1) selectAt(event.clientX);
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    beginGesture();
    if (gesture.current) gesture.current.moved = true;
  };
  const pointerCaptureLost = (event: ReactPointerEvent<SVGSVGElement>) => {
    // Capture can be interrupted by the OS without an ordinary pointer-up.
    // Ignore the normal release already handled by pointerEnd.
    if (!pointers.current.delete(event.pointerId)) return;
    beginGesture();
    if (gesture.current) gesture.current.moved = true;
  };
  const keyboardPoint = (index: number) => {
    const point = points[Math.max(0, Math.min(points.length - 1, index))];
    if (!point) return;
    setActive(point.record.id);
    if (point.x < window.start || point.x > window.end) changeView({ start: point.x - span / 2, end: point.x + span / 2 });
  };

  return <div className="weight-chart interactive-weight-chart" ref={container}>
    <div className="chart-range-line"><div className="chart-date-range" aria-live="polite">{rangeText}</div>{IS_PRO && <button type="button" className="chart-style-cycle" aria-label={t('Estilo: {style}. Cambiar a {next}.', { style: t(styleNames[chartStyle]), next: t(styleNames[nextChartStyle(chartStyle)]) })} onClick={() => { const next = nextChartStyle(chartStyle); setLocalStyle(next); onStyleChange?.(next); }}><Layers3 size={13} /><span>{t(styleNames[chartStyle])}</span></button>}</div>
    <div className="chart-readout">{points.length > 0 && <div className="chart-selected-readout"><div className="chart-tooltip"><span className="dot" />{selected ? <>{dateLabel(selected.x, total > 365)} <strong>{displayWeight(selected.record.weightKg, unit, 1, locale)} {unit}</strong></> : t('Sin registros en este intervalo')}</div><span className="chart-visible-count">{visible.length} {t(visible.length === 1 ? 'registro' : 'registros')}</span></div>}<div className="chart-goal-pill" aria-label={t('Meta: {weight} {unit}', { weight: displayWeight(goal, unit, 1, locale), unit })}><i aria-hidden="true" /><span><small>{t('Meta')}</small><strong>{displayWeight(goal, unit, 1, locale)} <small>{unit}</small></strong></span></div></div>
    {!points.length ? <div className="chart-empty"><span>{t(hasHistory ? 'Sin registros en este período' : 'Tu historia empieza con un punto.')}</span><p>{t(hasHistory ? 'Prueba un período más amplio o añade un registro.' : 'Guarda tu primer peso para ver tu evolución aquí.')}</p></div> : <>
      {columns && <div className="chart-reference-caption"><span>{t('Variación desde {weight} {unit}', { weight: referenceValue.toLocaleString(locale, { maximumFractionDigits: 1 }), unit })}<small>{dateLabel(first, total > 365)}</small></span><strong>{selected ? `${deltaLabel(selected.value - referenceValue)} ${unit}` : '—'}</strong></div>}
      <svg ref={surface} viewBox={`0 0 ${W} ${H}`} className={`chart-gesture-surface ${isZoomed ? 'is-zoomed' : ''}`} role="group" tabIndex={0} aria-label={t('Gráfico interactivo de peso')} aria-describedby={`${id}-instructions`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onLostPointerCapture={pointerCaptureLost} onKeyDown={event => {
        const index = selected ? points.findIndex(point => point.record.id === selected.record.id) : 0;
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End', '+', '=', '-'].includes(event.key)) event.preventDefault();
        if (event.key === 'ArrowLeft') keyboardPoint(index - 1);
        if (event.key === 'ArrowRight') keyboardPoint(index + 1);
        if (event.key === 'Home') keyboardPoint(0);
        if (event.key === 'End') keyboardPoint(points.length - 1);
        if (event.key === '+' || event.key === '=') zoom(.6);
        if (event.key === '-') zoom(1 / .6);
      }}>
        <title>{t(columns ? 'Variación de peso respecto de la referencia' : 'Peso registrado')}: {rangeText}</title>
        <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity=".23" /><stop offset="100%" stopColor="var(--accent)" stopOpacity="0" /></linearGradient><clipPath id={`${id}-clip`}><rect x={left - 7} y={top - 9} width={plotWidth + 14} height={H - top - bottom + 18} /></clipPath></defs>
        {[0, 1, 2, 3].map(tick => { const value = min + (max - min) * tick / 3; return <g key={tick} aria-hidden="true"><line className="chart-grid" x1={left} x2={W - right} y1={y(value)} y2={y(value)} /><text x={0} y={y(value) + 4} className="chart-label">{columns ? deltaLabel(value - referenceValue) : value.toLocaleString(locale, { maximumFractionDigits: 1 })}</text></g>; })}
        {columns && <g aria-hidden="true"><line className="chart-reference-line" x1={left} x2={W - right} y1={y(referenceValue)} y2={y(referenceValue)} /><text x={W - right} y={y(referenceValue) - 6} textAnchor="end" className="chart-label chart-reference-label">0 {unit}</text></g>}
        {showGoal && <line className="chart-goal-line" aria-hidden="true" x1={left} x2={W - right} y1={y(goalValue)} y2={y(goalValue)} />}
        <g clipPath={`url(#${id}-clip)`} aria-hidden="true">
          {columns ? renderedBars.map(point => { const bx = x(point.x) - barWidth / 2, by = y(point.value), baseline = y(referenceValue), fill = 'var(--chart-accent, var(--accent))'; return <g key={point.record.id} className="chart-weight-column"><rect x={bx} y={Math.min(by, baseline)} width={barWidth} height={Math.abs(baseline - by)} rx={Math.min(3, barWidth / 3)} fill={fill} opacity={point.record.id === selected?.record.id ? .95 : .6} />{Math.abs(point.value - referenceValue) < .00001 && <line x1={bx} x2={bx + barWidth} y1={baseline} y2={baseline} stroke={fill} strokeWidth="2" />}</g>; }) : <>
            {chartStyle === 'area' && rendered.length > 1 && <path d={`${line} L${x(rendered[rendered.length - 1].x)},${H - bottom} L${x(rendered[0].x)},${H - bottom} Z`} fill={`url(#${id})`} />}
            <path d={line} fill="none" stroke="var(--chart-accent, var(--accent))" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" className="chart-line" />
            {markers.map(point => <circle key={point.record.id} cx={x(point.x)} cy={y(point.value)} r="2.5" fill="var(--surface)" stroke="var(--chart-accent, var(--accent))" strokeWidth="1.5" />)}
          </>}
          {selected && <><line x1={x(selected.x)} x2={x(selected.x)} y1={top} y2={H - bottom} stroke="var(--chart-accent, var(--accent))" strokeOpacity=".25" strokeDasharray="3 5" /><circle cx={x(selected.x)} cy={y(selected.value)} r="5" fill="var(--chart-accent, var(--accent))" stroke="var(--surface)" strokeWidth="2.5" /></>}
        </g>
        {showGoal && <g className="chart-goal-marker" aria-hidden="true" transform={`translate(${W - right + 16} ${y(goalValue)})`}><path d="M0 -6 6 0 0 6 -6 0Z" /><circle r="1.5" /></g>}
        {[window.start, ...(span < 3 ? [] : W >= 400 ? [window.start + span / 3, window.start + span * 2 / 3] : [window.start + span / 2]), window.end].map((day, index, ticks) => <text key={index} aria-hidden="true" x={x(day)} y={H - 5} textAnchor={index === 0 ? 'start' : index === ticks.length - 1 ? 'end' : 'middle'} className="chart-label">{dateLabel(day, total > 365)}</text>)}
      </svg>
      <div className="chart-navigation"><span className="chart-gesture-hint"><MoveHorizontal size={14} />{t(isZoomed ? 'Desliza para explorar' : total > 3 ? 'Amplía para explorar' : 'Vista completa')}</span><div className="chart-zoom-controls" role="group" aria-label={t('Zoom del gráfico')}><button type="button" disabled={!isZoomed} onClick={() => zoom(1 / .6)} aria-label={t('Alejar gráfico')}><Minus size={16} /></button><button type="button" disabled={span <= Math.min(3, total) + .001} onClick={() => zoom(.6)} aria-label={t('Acercar gráfico')}><Plus size={16} /></button><button type="button" disabled={!isZoomed} onClick={() => { setView(null); viewRef.current = bounds; }} aria-label={t('Ver todo el período')}><Maximize2 size={14} /></button></div></div>
      {isZoomed && <div className="chart-window-track" aria-hidden="true"><span style={{ left: `${(window.start - bounds.start) / total * 100}%`, width: `${span / total * 100}%` }} /></div>}
      <span className="chart-sr-only" id={`${id}-instructions`}>{t('Arrastra para desplazarte. Pellizca o usa los botones para cambiar el zoom. Con teclado, usa las flechas para recorrer los registros y + o − para ampliar o reducir.')}</span>
      <span className="chart-sr-only" aria-live="polite">{selected ? `${dateLabel(selected.x, true)}: ${displayWeight(selected.record.weightKg, unit, 1, locale)} ${unit}` : t('Sin registros en este intervalo')}</span>
    </>}
  </div>;
}

export function ProgressRing({ progress, remaining, unit, style = 'ring' }: { progress: number; remaining: number; unit: WeightUnit; style?: GoalChartStyle }) {
  const { t, locale } = useI18n();
  const id = useId().replace(/:/g, '');
  const radius = 87, length = 2 * Math.PI * radius;
  const percentage = Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0));
  const offset = length * (1 - percentage / 100);
  const depth = style === 'depth';
  return <div className={`progress-ring ${depth ? 'progress-ring-depth' : ''}`}><svg viewBox="0 0 220 220" aria-label={`${Math.round(percentage)}% ${t('del camino a tu meta')}`} role="img">
    <defs><linearGradient id={`${id}-edge`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--accent)" /><stop offset="1" stopColor="var(--accent-ink)" /></linearGradient><radialGradient id={`${id}-shadow`}><stop offset="0" stopColor="var(--accent-ink)" stopOpacity=".18" /><stop offset="1" stopColor="var(--accent-ink)" stopOpacity="0" /></radialGradient></defs>
    {depth ? <g className="goal-depth-visual"><ellipse cx="110" cy="181" rx="105" ry="19" fill={`url(#${id}-shadow)`} /><g transform="translate(0 24) scale(1 .76)">
      {Array.from({ length: 18 }, (_, index) => 18 - index).map(layer => <g key={layer} transform={`translate(0 ${layer})`} aria-hidden="true"><circle cx="110" cy="110" r={radius} fill="none" stroke="var(--track)" strokeWidth="19" /><circle cx="110" cy="110" r={radius} fill="none" stroke={`url(#${id}-edge)`} strokeWidth="19" strokeOpacity={.35 + (18 - layer) / 36} strokeLinecap={percentage > 0 ? 'round' : 'butt'} strokeDasharray={length} strokeDashoffset={offset} transform="rotate(-90 110 110)" className="ring-value" /></g>)}
      <circle cx="110" cy="110" r={radius} fill="none" stroke="var(--track)" strokeWidth="19" /><circle cx="110" cy="110" r={radius} fill="none" stroke="var(--accent)" strokeWidth="19" strokeLinecap={percentage > 0 ? 'round' : 'butt'} strokeDasharray={length} strokeDashoffset={offset} transform="rotate(-90 110 110)" className="ring-value" /><circle cx="110" cy="110" r="78" fill="none" stroke="var(--accent)" strokeOpacity=".15" strokeWidth="1" />
    </g></g> : <><circle cx="110" cy="110" r={radius} fill="none" stroke="var(--track)" strokeWidth="12" /><circle cx="110" cy="110" r={radius} fill="none" stroke="var(--accent)" strokeWidth="12" strokeLinecap={percentage > 0 ? 'round' : 'butt'} strokeDasharray={length} strokeDashoffset={offset} transform="rotate(-90 110 110)" className="ring-value" /><circle cx="110" cy="23" r="3" fill="var(--surface)" /></>}
    </svg><div><span className="ring-percentage">{Math.round(percentage)}<small>%</small></span><span>{t('de tu camino')}</span><strong>{remaining < .05 ? t('¡Meta alcanzada!') : `${displayWeight(remaining, unit, 1, locale)} ${unit} ${t('para tu meta')}`}</strong></div></div>;
}

export function BmiGauge({ value, adult }: { value: number; adult: boolean }) {
  const { t, locale } = useI18n();
  const clamped = Math.max(14, Math.min(42, value));
  const angle = Math.PI - (clamped - 14) / 28 * Math.PI;
  const x = 180 + 140 * Math.cos(angle), y = 175 - 140 * Math.sin(angle);
  const ranges = [[14, 16], [16, 17], [17, 18.5], [18.5, 25], [25, 30], [30, 35], [35, 40], [40, 42]] as const;
  const point = (v: number) => { const a = Math.PI - (v - 14) / 28 * Math.PI; return `${180 + 140 * Math.cos(a)} ${175 - 140 * Math.sin(a)}`; };
  const number = value.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return <div className="bmi-gauge tonal-bmi-gauge"><svg viewBox="0 0 360 211" aria-label={`${t('IMC')} ${number}`} role="img">{ranges.map(([start, end], index) => <path key={start} d={`M ${point(start + .12)} A 140 140 0 0 1 ${point(end - .12)}`} fill="none" stroke={adult ? 'var(--chart-accent, var(--accent))' : 'var(--track)'} strokeOpacity={adult ? start === 18.5 ? .95 : .22 + index * .055 : 1} strokeWidth="13" strokeLinecap="round" />)}{adult && <><circle cx={x} cy={y} r="12" fill="var(--text)" stroke="var(--surface)" strokeWidth="5" />{[14, 18.5, 25, 30, 42].map(boundary => { const a = Math.PI - (boundary - 14) / 28 * Math.PI; return <text key={boundary} x={180 + 165 * Math.cos(a)} y={179 - 165 * Math.sin(a)} textAnchor="middle" className="chart-label bmi-boundary">{boundary === 42 ? '42+' : boundary.toLocaleString(locale)}</text>; })}</>}</svg><div><span>{t('Tu IMC actual')}</span><strong>{number}</strong><span>kg/m²</span></div></div>;
}
