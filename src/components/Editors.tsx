import { useState } from 'react';
import { CalendarDays, Check, Dumbbell, Flag, Leaf, Save, Trash2 } from 'lucide-react';
import type { AppData, DailyRecord, Profile, WeightUnit } from '../lib/model';
import { ageFromBirthDate, dateKey, displayHeight, fromKg, getStats, profileAge, toKg } from '../lib/model';
import { useI18n } from '../lib/i18n';
import BirthDatePicker from './BirthDatePicker';
import { HabitChoice, HeightSwitch, Modal, UnitSwitch } from './UI';
import Motivation from './Motivation';
import { ProfilePhotoPicker } from './ProfileIdentity';
import type { MotivationPreferences } from '../lib/motivation';

export function RecordEditor({ data, record, daily, initialDate, onClose, onSave, onDelete, onMotivationChange }: { data: AppData; record?: DailyRecord; daily: boolean; initialDate?: string; onClose: () => void; onSave: (record: DailyRecord, initial: boolean) => void; onDelete: (id: string) => void; onMotivationChange: (value: MotivationPreferences) => void }) {
  const { t } = useI18n();
  const [unit, setUnit] = useState(data.settings.weightUnit);
  const [date, setDate] = useState(record?.date || initialDate || dateKey());
  const [weight, setWeight] = useState(String(Number(fromKg(record?.weightKg ?? getStats(data).currentWeight, unit).toFixed(2))));
  const [canonicalWeight, setCanonicalWeight] = useState(record?.weightKg ?? getStats(data).currentWeight);
  const [exercise, setExercise] = useState<boolean | null>(record?.exercise ?? null);
  const [healthy, setHealthy] = useState<boolean | null>(record?.healthy ?? null);
  const [note, setNote] = useState(record?.note || '');
  const [initial, setInitial] = useState(record ? record.id === data.initialRecordId : false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  function changeUnit(u: WeightUnit) { setWeight(String(Number(fromKg(canonicalWeight, u).toFixed(2)))); setUnit(u); }
  return <Modal title={t(record ? 'Tu día, en detalle.' : daily ? '¿Cómo va tu día?' : 'Un día que cuenta.')} subtitle={t(daily ? 'Un minuto para registrar tu peso y tus hábitos.' : 'Puedes ajustar tus registros cuando lo necesites.')} onClose={onClose}><form onSubmit={e => {
    e.preventDefault(); const weightKg = canonicalWeight;
    if (!weight.trim() || !Number.isFinite(weightKg) || weightKg < 10 || weightKg > 650) return setError('Ingresa un peso válido entre 10 y 650 kg, o su equivalente.');
    if (!date || date < '1900-01-01' || date > dateKey()) return setError('Elige una fecha válida hasta hoy.');
    if (data.records.some(r => r.date === date && r.id !== record?.id)) return setError('Ya tienes un registro para ese día. Puedes editarlo desde el historial.');
    if (exercise === null || healthy === null) return setError('Elige una respuesta para cada hábito.');
    onSave({ id: record?.id || crypto.randomUUID(), date, weightKg, exercise, healthy, note: note.trim() }, initial);
  }}>
    <div className="form-row"><label className="field">{t('Fecha')}<input type="date" value={date} max={dateKey()} min="1900-01-01" required disabled={daily} onChange={e => setDate(e.target.value)} /></label><UnitSwitch value={unit} onChange={changeUnit} /></div>
    <label className="record-weight"><span>{t(date === dateKey() ? 'Tu peso de hoy' : 'Tu peso de ese día')}</span><div><input aria-label={t('Peso del registro')} inputMode="decimal" type="text" value={weight} onChange={e => { const v = e.target.value.replace(',', '.'); if (/^\d*\.?\d*$/.test(v)) { setWeight(v); setCanonicalWeight(toKg(Number(v), unit)); } }} required /><span>{unit}</span></div></label>
    <Motivation value={data.settings.motivation} onChange={onMotivationChange} compact />
    <HabitChoice question="¿Te moviste hoy?" hint="Cada movimiento cuenta. Descansar también es parte del camino." icon={<Dumbbell size={18} />} value={exercise} onChange={setExercise} />
    <HabitChoice question="¿Toca comer sano hoy?" icon={<Leaf size={18} />} value={healthy} onChange={setHealthy} yes="Sí, hoy sí" no="Hoy no" />
    <label className="field">{t('Una nota para ti')} <span className="muted">{t('(opcional)')}</span><textarea rows={2} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} placeholder={t('¿Cómo te sentiste? ¿Algo que quieras recordar?')} /></label>
    {!daily && <label className="initial-choice"><input type="checkbox" checked={initial} onChange={e => setInitial(e.target.checked)} disabled={record?.id === data.initialRecordId} /><Flag size={17} /><span>{t('Usar como punto de partida')}<small>{t('Tu progreso se calculará desde este registro.')}</small></span></label>}
    {error && <p className="error-message" role="alert">{t(error)}</p>}<button type="submit" className="primary-button full-width"><Check size={18} />{t(record ? 'Guardar cambios' : 'Guardar mi día')}</button>
    {record && record.id !== data.initialRecordId && <div className="delete-record">{deleting ? <><span>{t('¿Eliminar este registro?')}</span><button type="button" className="danger-link" onClick={() => onDelete(record.id)}>{t('Sí, eliminar')}</button><button type="button" className="text-link" onClick={() => setDeleting(false)}>{t('Cancelar')}</button></> : <button type="button" className="text-link muted" onClick={() => setDeleting(true)}><Trash2 size={14} /> {t('Eliminar registro')}</button>}</div>}
  </form></Modal>;
}

export function ProfileEditor({ data, onClose, onSave }: { data: AppData; onClose: () => void; onSave: (profile: Profile) => void }) {
  const { t, locale } = useI18n();
  const profile = data.profile!;
  const [photo, setPhoto] = useState<string | null>(profile.photo ?? null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [weightUnit, setWeightUnit] = useState(data.settings.weightUnit);
  const [heightUnit, setHeightUnit] = useState(data.settings.heightUnit);
  const [goal, setGoal] = useState(String(Number(fromKg(profile.goalWeightKg, weightUnit).toFixed(2))));
  const [height, setHeight] = useState(String(Number((heightUnit === 'cm' ? profile.heightCm : profile.heightCm / 30.48).toFixed(2))));
  const [canonicalGoal, setCanonicalGoal] = useState(profile.goalWeightKg);
  const [canonicalHeight, setCanonicalHeight] = useState(profile.heightCm);
  const [birthDate, setBirthDate] = useState(profile.birthDate ?? '');
  const [error, setError] = useState('');
  return <Modal title={t('Tu camino, tus ajustes.')} subtitle={t('Tu meta puede cambiar contigo.')} onClose={onClose}><form onSubmit={e => {
    e.preventDefault();
    const goalWeightKg = canonicalGoal, heightCm = canonicalHeight, years = birthDate ? ageFromBirthDate(birthDate) : profile.age;
    if (!goal || !height || !Number.isFinite(goalWeightKg) || !Number.isFinite(heightCm) || goalWeightKg < 10 || goalWeightKg > 650 || heightCm < 50 || heightCm > 300 || !Number.isInteger(years) || years < 5 || years > 120) return setError('Revisa los valores: peso 10–650 kg, altura 50–300 cm y edad 5–120 años.');
    if (photoBusy) return;
    onSave({ ...profile, photo: photo ?? undefined, goalWeightKg, heightCm, age: years, ...(birthDate ? { birthDate } : {}) });
  }}>
    <ProfilePhotoPicker value={photo} onChange={setPhoto} onBusy={setPhotoBusy} />
    <div className="form-row"><label className="field">{t('Peso objetivo')}<input aria-label={t('Peso objetivo')} type="number" step="any" value={goal} onChange={e => { setGoal(e.target.value); setCanonicalGoal(toKg(Number(e.target.value), weightUnit)); }} required /></label><UnitSwitch value={weightUnit} onChange={u => { setGoal(String(Number(fromKg(canonicalGoal, u).toFixed(2)))); setWeightUnit(u); }} /></div>
    <div className="form-row"><label className="field">{t('Altura')} ({heightUnit === 'cm' ? 'cm' : t('pies decimales')})<input aria-label={t('Altura')} type="number" step="any" value={height} onChange={e => { setHeight(e.target.value); setCanonicalHeight(Number(e.target.value) * (heightUnit === 'cm' ? 1 : 30.48)); }} required /></label><HeightSwitch value={heightUnit} onChange={u => { setHeight(String(Number((canonicalHeight * (u === 'cm' ? 1 : 1 / 30.48)).toFixed(3)))); setHeightUnit(u); }} /></div>
    {heightUnit === 'ft' && <p className="input-hint">{t('Equivale a {height}. Usa pies en decimales.', { height: displayHeight(canonicalHeight, 'ft', locale) })}</p>}
    <div className="profile-birthday"><span className="field-label">{t('Fecha de nacimiento')}</span>{birthDate ? <><BirthDatePicker value={birthDate} onChange={setBirthDate} /><p className="input-hint">{t('{age} años', { age: ageFromBirthDate(birthDate) })}</p></> : <div className="legacy-age"><p>{t('Edad guardada: {age} años.', { age: profileAge(profile) })}</p><button type="button" className="text-link" onClick={() => { const today = new Date(); today.setFullYear(today.getFullYear() - profile.age); setBirthDate(dateKey(today)); }}><CalendarDays size={16} />{t('Añadir fecha de nacimiento')}</button></div>}</div>
    <p className="footnote">{t('Para cambiar tu peso actual, edita tu último registro. El punto de partida se elige en el historial.')}</p>
    {error && <p className="error-message" role="alert">{t(error)}</p>}<button className="primary-button full-width" type="submit" disabled={photoBusy}><Save size={17} />{t('Guardar ajustes')}</button>
  </form></Modal>;
}
