import { useState } from 'react';
import { Check, Dumbbell, Flag, Leaf, Save, Trash2 } from 'lucide-react';
import type { AppData, DailyRecord, Profile, WeightUnit } from '../lib/model';
import { dateKey, displayHeight, fromKg, getStats, toKg } from '../lib/model';
import { HabitChoice, HeightSwitch, Modal, UnitSwitch } from './UI';

export function RecordEditor({ data, record, daily, onClose, onSave, onDelete }: { data: AppData; record?: DailyRecord; daily: boolean; onClose: () => void; onSave: (record: DailyRecord, initial: boolean) => void; onDelete: (id: string) => void }) {
  const [unit, setUnit] = useState(data.settings.weightUnit);
  const [date, setDate] = useState(record?.date || dateKey());
  const [weight, setWeight] = useState(String(Number(fromKg(record?.weightKg ?? getStats(data).currentWeight, unit).toFixed(2))));
  const [canonicalWeight, setCanonicalWeight] = useState(record?.weightKg ?? getStats(data).currentWeight);
  const [exercise, setExercise] = useState<boolean | null>(record?.exercise ?? null);
  const [healthy, setHealthy] = useState<boolean | null>(record?.healthy ?? null);
  const [note, setNote] = useState(record?.note || '');
  const [initial, setInitial] = useState(record ? record.id === data.initialRecordId : false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  function changeUnit(u: WeightUnit) { setWeight(String(Number(fromKg(canonicalWeight, u).toFixed(2)))); setUnit(u); }
  return <Modal title={record ? 'Tu día, en detalle.' : daily ? '¿Cómo va tu día?' : 'Un día que cuenta.'} subtitle={daily ? 'Un minuto para registrar tu peso y tus hábitos.' : 'Puedes ajustar tus registros cuando lo necesites.'} onClose={onClose}><form onSubmit={e => { e.preventDefault(); const weightKg = canonicalWeight; if (!weight.trim() || !Number.isFinite(weightKg) || weightKg < 10 || weightKg > 650) return setError('Ingresa un peso válido entre 10 y 650 kg, o su equivalente.'); if (!date || date < '1900-01-01' || date > dateKey()) return setError('Elige una fecha válida hasta hoy.'); if (data.records.some(r => r.date === date && r.id !== record?.id)) return setError('Ya tienes un registro para ese día. Puedes editarlo desde el historial.'); if (exercise === null || healthy === null) return setError('Elige una respuesta para cada hábito.'); onSave({ id: record?.id || crypto.randomUUID(), date, weightKg, exercise, healthy, note: note.trim() }, initial); }}>
    <div className="form-row"><label className="field">Fecha<input type="date" value={date} max={dateKey()} min="1900-01-01" required disabled={daily} onChange={e => setDate(e.target.value)} /></label><UnitSwitch value={unit} onChange={changeUnit} /></div><label className="record-weight"><span>Tu peso de {date === dateKey() ? 'hoy' : 'ese día'}</span><div><input aria-label="Peso del registro" inputMode="decimal" type="text" value={weight} onChange={e => { const v = e.target.value.replace(',', '.'); if (/^\d*\.?\d*$/.test(v)) { setWeight(v); setCanonicalWeight(toKg(Number(v), unit)); } }} required /><span>{unit}</span></div></label>
    <HabitChoice question="¿Te moviste hoy?" hint="Cada movimiento cuenta. Descansar también es parte del camino." icon={<Dumbbell size={18} />} value={exercise} onChange={setExercise} />
    <HabitChoice question="¿Toca comer sano hoy?" icon={<Leaf size={18} />} value={healthy} onChange={setHealthy} yes="Sí, hoy sí" no="Hoy no" />
    <label className="field">Una nota para ti <span className="muted">(opcional)</span><textarea rows={2} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} placeholder="¿Cómo te sentiste? ¿Algo que quieras recordar?" /></label>
    {!daily && <label className="initial-choice"><input type="checkbox" checked={initial} onChange={e => setInitial(e.target.checked)} disabled={record?.id === data.initialRecordId} /><Flag size={17} /><span>Usar como punto de partida<small>Tu progreso se calculará desde este registro.</small></span></label>}
    {error && <p className="error-message" role="alert">{error}</p>}<button type="submit" className="primary-button full-width"><Check size={18} />{record ? 'Guardar cambios' : 'Guardar mi día'}</button>
    {record && record.id !== data.initialRecordId && <div className="delete-record">{deleting ? <><span>¿Eliminar este registro?</span><button type="button" className="danger-link" onClick={() => onDelete(record.id)}>Sí, eliminar</button><button type="button" className="text-link" onClick={() => setDeleting(false)}>Cancelar</button></> : <button type="button" className="text-link muted" onClick={() => setDeleting(true)}><Trash2 size={14} /> Eliminar registro</button>}</div>}
  </form></Modal>;
}

export function ProfileEditor({ data, onClose, onSave }: { data: AppData; onClose: () => void; onSave: (profile: Profile) => void }) {
  const profile = data.profile!;
  const [weightUnit, setWeightUnit] = useState(data.settings.weightUnit);
  const [heightUnit, setHeightUnit] = useState(data.settings.heightUnit);
  const [goal, setGoal] = useState(String(Number(fromKg(profile.goalWeightKg, weightUnit).toFixed(2))));
  const [height, setHeight] = useState(String(Number((heightUnit === 'cm' ? profile.heightCm : profile.heightCm / 30.48).toFixed(2))));
  const [canonicalGoal, setCanonicalGoal] = useState(profile.goalWeightKg);
  const [canonicalHeight, setCanonicalHeight] = useState(profile.heightCm);
  const [age, setAge] = useState(String(profile.age));
  const [error, setError] = useState('');
  return <Modal title="Tu camino, tus ajustes." subtitle="Tu meta puede cambiar contigo." onClose={onClose}><form onSubmit={e => { e.preventDefault(); const goalWeightKg = canonicalGoal, heightCm = canonicalHeight, years = Number(age); if (!goal || !height || !age || !Number.isFinite(goalWeightKg) || !Number.isFinite(heightCm) || goalWeightKg < 10 || goalWeightKg > 650 || heightCm < 50 || heightCm > 300 || !Number.isInteger(years) || years < 5 || years > 120) return setError('Revisa los valores: peso 10–650 kg, altura 50–300 cm y edad 5–120 años.'); onSave({ ...profile, goalWeightKg, heightCm, age: years }); }}><div className="form-row"><label className="field">Peso objetivo<input aria-label="Peso objetivo" type="number" step="any" value={goal} onChange={e => { setGoal(e.target.value); setCanonicalGoal(toKg(Number(e.target.value), weightUnit)); }} required /></label><UnitSwitch value={weightUnit} onChange={u => { setGoal(String(Number(fromKg(canonicalGoal, u).toFixed(2)))); setWeightUnit(u); }} /></div><div className="form-row"><label className="field">Altura ({heightUnit === 'cm' ? 'cm' : 'pies decimales'})<input aria-label="Altura" type="number" step="any" value={height} onChange={e => { setHeight(e.target.value); setCanonicalHeight(Number(e.target.value) * (heightUnit === 'cm' ? 1 : 30.48)); }} required /></label><HeightSwitch value={heightUnit} onChange={u => { setHeight(String(Number((canonicalHeight * (u === 'cm' ? 1 : 1 / 30.48)).toFixed(3)))); setHeightUnit(u); }} /></div>{heightUnit === 'ft' && <p className="input-hint">Equivale a {displayHeight(Number(height) * 30.48, 'ft')}. Usa pies en decimales.</p>}<label className="field">Edad<input aria-label="Edad" type="number" min="5" max="120" step="1" value={age} onChange={e => setAge(e.target.value)} required /></label><p className="footnote">Para cambiar tu peso actual, edita tu último registro. El punto de partida se elige en el historial.</p>{error && <p className="error-message" role="alert">{error}</p>}<button className="primary-button full-width" type="submit"><Save size={17} /> Guardar ajustes</button></form></Modal>;
}
