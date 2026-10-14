import { useEffect, useId, useRef, useState } from 'react';
import type { DailyRecord, WeightUnit } from '../lib/model';
import { displayWeight, fromKg } from '../lib/model';

export function WeightChart({ records, unit, goal }: { records: DailyRecord[]; unit: WeightUnit; goal: number }) {
  const id = useId().replace(/:/g, '');
  const [active, setActive] = useState<number | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(720);
  useEffect(() => { const element = container.current; if (!element) return; const observer = new ResizeObserver(([entry]) => setChartWidth(Math.max(260, Math.min(720, entry.contentRect.width)))); observer.observe(element); return () => observer.disconnect(); }, [records.length]);
  const W = chartWidth, H = chartWidth < 450 ? 220 : 245, left = 35, right = 12, top = 22, bottom = 34;
  if (!records.length) return <div className="chart-empty"><span>Tu historia empieza con un punto.</span><p>Guarda tu primer peso para ver tu evolución aquí.</p></div>;
  const values = records.map(r => fromKg(r.weightKg, unit));
  const goalValue = fromKg(goal, unit);
  const spread = Math.max(...values) - Math.min(...values);
  const showGoal = Math.abs(goalValue - values[values.length - 1]) < Math.max(spread * 1.7, 3);
  const all = showGoal ? [...values, goalValue] : values;
  const min = Math.min(...all) - Math.max(.5, spread * .2), max = Math.max(...all) + Math.max(.5, spread * .2);
  const start = Date.parse(`${records[0].date}T12:00:00Z`);
  const end = Date.parse(`${records[records.length - 1].date}T12:00:00Z`);
  const x = (i: number) => records.length === 1 ? (W + left - right) / 2 : left + ((Date.parse(`${records[i].date}T12:00:00Z`) - start) / (end - start || 1)) * (W - left - right);
  const y = (v: number) => top + (max - v) / (max - min) * (H - top - bottom);
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
  const idx = active !== null && active < records.length ? active : records.length - 1;
  const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
  const tickIndices = Array.from(new Set([0, Math.floor((records.length - 1) / 3), Math.floor((records.length - 1) * 2 / 3), records.length - 1]));
  return <div className="weight-chart" ref={container}>
    <div className="chart-tooltip"><span className="dot" />{dateLabel(records[idx].date)} <strong>{displayWeight(records[idx].weightKg, unit)} {unit}</strong></div>
    <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`Peso desde ${displayWeight(records[0].weightKg, unit)} hasta ${displayWeight(records[records.length - 1].weightKg, unit)} ${unit}. ${records.length} registros.`}>
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity=".23" /><stop offset="100%" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
      {[0, 1, 2, 3].map(t => { const val = min + (max - min) * t / 3; return <g key={t}><line className="chart-grid" x1={left} x2={W - right} y1={y(val)} y2={y(val)} /><text x={0} y={y(val) + 4} className="chart-label">{val.toFixed(1)}</text></g>; })}
      {showGoal && <g><line x1={left} x2={W - right} y1={y(goalValue)} y2={y(goalValue)} stroke="var(--accent)" strokeOpacity=".35" strokeDasharray="4 6" /><text x={W - right} y={y(goalValue) - 8} textAnchor="end" className="chart-label">META</text></g>}
      {records.length > 1 && <path d={`${line} L${x(records.length - 1)},${H - bottom} L${x(0)},${H - bottom} Z`} fill={`url(#${id})`} />}
      <path d={line} fill="none" stroke="var(--chart-accent, var(--accent))" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" className="chart-line" />
      <line x1={x(idx)} x2={x(idx)} y1={top} y2={H - bottom} stroke="var(--accent)" strokeOpacity=".22" strokeDasharray="3 5" />
      {values.map((v, i) => <g key={records[i].id} onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onClick={() => setActive(i)} role="button" tabIndex={0} aria-label={`${dateLabel(records[i].date)}: ${v.toFixed(1)} ${unit}`} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActive(i); } }}><circle cx={x(i)} cy={y(v)} r={15} fill="transparent" /><circle cx={x(i)} cy={y(v)} r={i === idx ? 5 : 2.7} fill={i === idx ? 'var(--accent)' : 'var(--surface)'} stroke="var(--accent)" strokeWidth={i === idx ? 3 : 1.5} /></g>)}
      {tickIndices.map(i => <text key={i} x={x(i)} y={H - 5} textAnchor={i === 0 ? 'start' : i === records.length - 1 ? 'end' : 'middle'} className="chart-label">{dateLabel(records[i].date)}</text>)}
    </svg>
  </div>;
}

export function ProgressRing({ progress, remaining, unit }: { progress: number; remaining: number; unit: WeightUnit }) {
  const radius = 87, length = 2 * Math.PI * radius;
  return <div className="progress-ring"><svg viewBox="0 0 220 220" aria-label={`${Math.round(progress)}% del camino a tu meta`} role="img"><circle cx="110" cy="110" r={radius} fill="none" stroke="var(--track)" strokeWidth="12" /><circle cx="110" cy="110" r={radius} fill="none" stroke="var(--accent)" strokeWidth="12" strokeLinecap="round" strokeDasharray={length} strokeDashoffset={length * (1 - progress / 100)} transform="rotate(-90 110 110)" className="ring-value" /><circle cx="110" cy="23" r="3" fill="var(--surface)" /></svg><div><span className="ring-percentage">{Math.round(progress)}<small>%</small></span><span>de tu camino</span><strong>{remaining < .05 ? '¡Meta alcanzada!' : `${displayWeight(remaining, unit)} ${unit} para tu meta`}</strong></div></div>;
}

export function BmiGauge({ value, adult }: { value: number; adult: boolean }) {
  const clamped = Math.max(14, Math.min(42, value));
  const angle = Math.PI - (clamped - 14) / 28 * Math.PI;
  const x = 180 + 140 * Math.cos(angle), y = 175 - 140 * Math.sin(angle);
  const ranges = [[14, 16, '#8ba2d8'], [16, 17, '#83bbdf'], [17, 18.5, '#86d7e0'], [18.5, 25, '#42ff85'], [25, 30, '#e0d179'], [30, 35, '#eeb17f'], [35, 40, '#e98f89'], [40, 42, '#bd849f']] as const;
  const point = (v: number) => { const a = Math.PI - (v - 14) / 28 * Math.PI; return `${180 + 140 * Math.cos(a)} ${175 - 140 * Math.sin(a)}`; };
  return <div className="bmi-gauge"><svg viewBox="0 0 360 205" aria-label={`IMC ${value.toFixed(1)}`} role="img">{ranges.map(([start, end, color]) => <path key={start} d={`M ${point(start + .12)} A 140 140 0 0 1 ${point(end - .12)}`} fill="none" stroke={adult ? color : 'var(--track)'} strokeWidth="14" strokeLinecap="round" />)}{adult && <><circle cx={x} cy={y} r="12" fill="var(--text)" stroke="var(--surface)" strokeWidth="5" /><text x="28" y="202" className="chart-label">14</text><text x="320" y="202" className="chart-label">42+</text></>}</svg><div><span>Tu IMC actual</span><strong>{value.toFixed(1)}</strong><span>kg/m²</span></div></div>;
}
