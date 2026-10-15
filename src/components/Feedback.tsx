import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, CheckCircle2, LoaderCircle, MessageSquareHeart, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import { feedbackAvailable, feedbackErrorMessage, getFeedbackChallenge, submitFeedback, validateFeedbackDraft, type FeedbackChallenge } from '../lib/feedback';
import { useI18n } from '../lib/i18n';
import { Modal } from './UI';
import './feedback.css';

function FeedbackForm({ onClose }: { onClose: () => void }) {
  const { t, locale } = useI18n();
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [answer, setAnswer] = useState('');
  const [website, setWebsite] = useState('');
  const [challenge, setChallenge] = useState<FeedbackChallenge | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const live = useRef(true);
  const challengeRequest = useRef<AbortController | null>(null);
  const readyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const available = feedbackAvailable();
  const refreshChallenge = useCallback(async () => {
    challengeRequest.current?.abort();
    if (readyTimer.current) clearTimeout(readyTimer.current);
    const controller = new AbortController(); challengeRequest.current = controller;
    setLoading(true); setReady(false); setChallenge(null); setAnswer('');
    try {
      const next = await getFeedbackChallenge(controller.signal);
      if (!live.current || controller.signal.aborted) return;
      setChallenge(next);
      readyTimer.current = setTimeout(() => { if (live.current && !controller.signal.aborted) setReady(true); }, next.minWaitMs);
    } catch (cause) { if (live.current && !controller.signal.aborted) setError(feedbackErrorMessage(cause)); }
    finally { if (live.current && !controller.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    live.current = true;
    if (available) void refreshChallenge();
    return () => { live.current = false; challengeRequest.current?.abort(); if (readyTimer.current) clearTimeout(readyTimer.current); };
  }, [available, refreshChallenge]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending.current || !challenge || !ready) return;
    const draft = { message, email, answer, website };
    try { validateFeedbackDraft(draft); } catch (cause) { setError(feedbackErrorMessage(cause)); return; }
    pending.current = true; setSending(true); setError('');
    try { await submitFeedback(draft, challenge); if (live.current) setSent(true); }
    catch (cause) { if (live.current) { setError(feedbackErrorMessage(cause)); setChallenge(null); setAnswer(''); setReady(false); } }
    finally { pending.current = false; if (live.current) setSending(false); }
  };
  return <Modal title={t('Sugerencias')} onClose={() => { if (!pending.current) onClose(); }}><div className="feedback-dialog">
    {sent ? <div className="feedback-success" role="status"><CheckCircle2 size={39} /><h3>{t('Gracias por ayudarnos a mejorar.')}</h3><p>{t('Tu sugerencia fue enviada. Nos alegra construir esta app contigo.')}</p><button type="button" className="primary-button full-width" onClick={onClose}>{t('Listo')}</button></div> : <>
      <p className="feedback-intro">{t('¿Qué te gustaría mejorar o añadir a Weight&Exercise?')}</p>
      {!available ? <p className="notice" role="status">{t('El envío de sugerencias aún no está disponible en esta versión. No se ha enviado ningún mensaje.')}</p> : <form onSubmit={event => void submit(event)}>
        <label className="field">{t('Tu idea')}<textarea required minLength={20} maxLength={2000} disabled={sending} rows={4} value={message} onChange={event => setMessage(event.target.value)} placeholder={t('Cuéntanos qué haría la app mejor para ti…')} /><span className="feedback-character-count">{message.trim().length.toLocaleString(locale)} / {(2000).toLocaleString(locale)}</span></label>
        <label className="field">{t('Correo para responderte (opcional)')}<input type="email" autoComplete="email" maxLength={254} disabled={sending} value={email} onChange={event => setEmail(event.target.value)} placeholder="nombre@ejemplo.com" /></label>
        <div className="feedback-honeypot" hidden aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" name="website" value={website} onChange={event => setWebsite(event.target.value)} /></label></div>
        <div className="feedback-check"><ShieldCheck size={17} aria-hidden="true" /><div><span>{t('Una pequeña comprobación')}</span>{loading ? <p role="status">{t('Preparando comprobación…')}</p> : challenge ? <label className="feedback-answer"><span>{challenge.question}</span><input required inputMode="numeric" pattern="[0-9]{1,2}" maxLength={2} autoComplete="off" disabled={sending} value={answer} onChange={event => setAnswer(event.target.value)} aria-label={t('Respuesta a {question}', { question: challenge.question })} /></label> : <button type="button" className="text-link" disabled={sending} onClick={() => { setError(''); void refreshChallenge(); }}><RefreshCw size={13} />{t('Obtener nueva comprobación')}</button>}</div></div>
        <p className="feedback-privacy">{t('Solo se enviarán tu mensaje, el correo que escribas y la versión de la app. No adjuntamos registros, fotos ni datos de tu cuenta.')}</p>
        {error && <p className="notice" role="alert">{t(error)}</p>}
        <button type="submit" className="primary-button full-width" disabled={sending || loading || !challenge || !ready || message.trim().length < 20 || !answer.trim()}>{sending ? <LoaderCircle size={16} className="feedback-spinner" /> : <Send size={16} />}{t(sending ? 'Enviando sugerencia…' : 'Enviar sugerencia')}</button>
      </form>}
    </>}
  </div></Modal>;
}

export default function Feedback() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return <><button type="button" className="card feedback-entry" onClick={() => setOpen(true)} aria-haspopup="dialog"><span className="soft-icon"><MessageSquareHeart size={20} /></span><span><strong>{t('Enviar sugerencias')}</strong><small>{t('Tu idea puede ser lo próximo.')}</small></span><ArrowUpRight size={17} /></button>{open && <FeedbackForm onClose={() => setOpen(false)} />}</>;
}
