import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../lib/i18n';
import './onboarding-controls.css';

type RulerPickerProps = {
  value: number;
  min: number;
  max: number;
  step: number;
  label: string;
  unit: string;
  onChange: (value: number) => void;
};

const TICK_WIDTH = 9;

/** A moving scale: pulling the ticks left increases the value at the fixed marker. */
export default function RulerPicker({ value, min, max, step, label, unit, onChange }: RulerPickerProps) {
  const { t, locale } = useI18n();
  const element = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; startX: number; value: number } | null>(null);
  const latest = useRef({ value, min, max, step, onChange });
  const [dragging, setDragging] = useState(false);
  latest.current = { value, min, max, step, onChange };
  const precision = step < .1 ? 2 : 1;
  const apply = (candidate: number) => {
    const current = latest.current;
    const rounded = Math.round(candidate / current.step) * current.step;
    current.onChange(Number(Math.max(current.min, Math.min(current.max, rounded)).toFixed(current.step < .1 ? 2 : 1)));
  };

  useEffect(() => {
    const node = element.current;
    if (!node) return;
    let wheelRemainder = 0;
    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      event.preventDefault();
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      wheelRemainder += delta * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 200 : 1);
      const ticks = Math.trunc(wheelRemainder / 15);
      if (ticks) {
        wheelRemainder -= ticks * 15;
        apply(latest.current.value + ticks * latest.current.step);
      }
    };
    node.addEventListener('wheel', handleWheel, { passive: false });
    return () => node.removeEventListener('wheel', handleWheel);
  }, []);

  const centerTick = Math.round(value / step);
  return <div className="measure-ruler-wrap">
    <div
      ref={element}
      className={`interactive-ruler ${dragging ? 'is-dragging' : ''}`}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${value.toLocaleString(locale, { maximumFractionDigits: precision })} ${unit}`}
      aria-describedby="ruler-instructions"
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { id: event.pointerId, startX: event.clientX, value };
        setDragging(true);
      }}
      onPointerMove={event => {
        if (!drag.current || drag.current.id !== event.pointerId) return;
        apply(drag.current.value + (drag.current.startX - event.clientX) / TICK_WIDTH * step);
      }}
      onPointerUp={event => {
        if (drag.current?.id !== event.pointerId) return;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        drag.current = null;
        setDragging(false);
      }}
      onPointerCancel={() => { drag.current = null; setDragging(false); }}
      onLostPointerCapture={() => { drag.current = null; setDragging(false); }}
      onKeyDown={event => {
        const direction = ['ArrowRight', 'ArrowUp'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowDown'].includes(event.key) ? -1 : 0;
        if (direction) { event.preventDefault(); apply(value + direction * step * (event.shiftKey ? 10 : 1)); }
        else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); apply(event.key === 'Home' ? min : max); }
        else if (event.key === 'PageUp' || event.key === 'PageDown') { event.preventDefault(); apply(value + (event.key === 'PageUp' ? 1 : -1) * step * 10); }
      }}
    >
      <div className="ruler-ticks" aria-hidden="true">
        {Array.from({ length: 101 }, (_, index) => {
          const tick = centerTick + index - 50;
          const tickValue = Number((tick * step).toFixed(precision));
          if (tickValue < min || tickValue > max) return null;
          return <span key={tick} className={`ruler-tick ${tick % 10 === 0 ? 'major' : tick % 5 === 0 ? 'middle' : ''}`} style={{ left: `calc(50% + ${(tick - value / step) * TICK_WIDTH}px)` }}>
            {tick % 10 === 0 && <span>{tickValue.toLocaleString(locale, { maximumFractionDigits: precision })}</span>}
          </span>;
        })}
      </div>
      <span className="ruler-fixed-marker" aria-hidden="true" />
    </div>
    <span className="ruler-instructions" id="ruler-instructions">{t('Desliza la regla o toca el número')}</span>
  </div>;
}
