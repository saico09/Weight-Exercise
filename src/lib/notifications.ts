import type { Language } from './model';
import { translate } from './i18n';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type Weekday } from '@capacitor/local-notifications';

export type NotificationPermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';
export type ReminderSettings = { enabled: boolean; time: string; days: number[] };
export type NotificationResult = { enabled: boolean; message: string };

const REMINDER_ID_BASE = 810100;
const TEST_ID = REMINDER_ID_BASE + 7;
const CHANNEL_ID = 'weight-exercise-daily';
const OWN_IDS = Array.from({ length: 8 }, (_, index) => REMINDER_ID_BASE + index);
const WEB_LIMITATION = 'Los recordatorios programados están disponibles en la app para teléfono. La vista de PC no puede avisarte con la app cerrada.';
const PERMISSION_DENIED = 'Las notificaciones están bloqueadas. Puedes habilitarlas en los ajustes de notificaciones de tu dispositivo y volver a intentarlo.';

let operations: Promise<void> = Promise.resolve();

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = operations.then(operation);
  operations = result.then(() => undefined, () => undefined);
  return result;
}

function supportsBrowserNotifications(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext && 'Notification' in window;
}

/** Read-only. Merely opening settings must never trigger the permission dialog. */
export async function getNotificationPermission(): Promise<NotificationPermissionState> {
  if (Capacitor.isNativePlatform()) {
    const { display } = await LocalNotifications.checkPermissions();
    return display === 'granted' || display === 'denied' ? display : 'prompt';
  }
  if (!supportsBrowserNotifications()) return 'unsupported';
  return Notification.permission === 'default' ? 'prompt' : Notification.permission;
}

async function requestNativePermission(): Promise<boolean> {
  const permission = await getNotificationPermission();
  if (permission === 'granted') return true;
  if (permission === 'denied') return false;
  const { display } = await LocalNotifications.requestPermissions();
  return display === 'granted';
}

async function ensureChannel(language: Language): Promise<void> {
  const t = (source: string) => translate(source, language);
  if (Capacitor.getPlatform() === 'android') {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: t('Tu registro diario'),
      description: t('Un recordatorio para registrar tu peso y tus hábitos.'),
      importance: 3,
      visibility: 0,
      vibration: true,
    });
  }
}

async function cancelOwnedNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.cancel({ notifications: OWN_IDS.map((id) => ({ id })) });
}

export function cancelNotifications(): Promise<void> {
  return enqueue(cancelOwnedNotifications);
}

/** Invoke from the user's explicit enable/save action, never from app startup. */
export function configureNotifications(settings: ReminderSettings, language: Language = 'es'): Promise<NotificationResult> {
  const t = (source: string) => translate(source, language);
  const requested = { ...settings, days: [...settings.days] };
  return enqueue(async () => {
    if (!requested.enabled) {
      await cancelOwnedNotifications();
      return { enabled: false, message: t('Recordatorios desactivados.') };
    }
    if (!Capacitor.isNativePlatform()) {
      return { enabled: false, message: t(WEB_LIMITATION) };
    }
    const days = [...new Set(requested.days)].sort((a, b) => a - b);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(requested.time) || days.length === 0 || days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
      throw new Error(t('Elige una hora válida y al menos un día para tus recordatorios.'));
    }
    if (!(await requestNativePermission())) {
      await cancelOwnedNotifications();
      return { enabled: false, message: t(PERMISSION_DENIED) };
    }
    const [hour, minute] = requested.time.split(':').map(Number);
    await ensureChannel(language);
    await cancelOwnedNotifications();
    try {
      await LocalNotifications.schedule({
        notifications: days.map((day) => ({
          id: REMINDER_ID_BASE + day,
          title: t('Un momento para ti'),
          body: t('Registra tu peso y tus hábitos de hoy. Cada día cuenta.'),
          channelId: CHANNEL_ID,
          // Gentle reminders don't need Android's exact-alarm permission.
          isExactNotification: false,
          schedule: {
            on: { weekday: (day + 1) as Weekday, hour, minute, second: 0 },
            repeats: true,
          },
          extra: { screen: 'daily-record', owner: 'weight-exercise' },
        })),
      });
      return { enabled: true, message: translate('Listo. Te recordaremos registrar tu día cerca de las {time}, los días que elegiste.', language, { time: requested.time }) };
    } catch {
      await cancelOwnedNotifications();
      return { enabled: false, message: t('No pudimos programar los recordatorios. Revisa los permisos del dispositivo e inténtalo otra vez.') };
    }
  });
}

/** Optional explicit preview button. A successful test does not enable reminders. */
export async function testNotification(language: Language = 'es'): Promise<NotificationResult> {
  const t = (source: string) => translate(source, language);
  if (!Capacitor.isNativePlatform()) {
    if (!supportsBrowserNotifications()) return { enabled: false, message: t('Este navegador no admite una notificación de prueba.') };
    // Request immediately within the click handler, before any queued operation.
    const permission = Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission;
    if (permission !== 'granted') return { enabled: false, message: t(PERMISSION_DENIED) };
    try {
      const notification = new Notification(t('Un momento para ti'), {
        body: t('Así se verá tu recordatorio de Weight&Exercise.'),
        tag: 'weight-exercise-test',
      });
      notification.onclick = () => { window.focus(); notification.close(); };
      return { enabled: false, message: t('Notificación de prueba enviada. Los recordatorios programados requieren la app para teléfono.') };
    } catch {
      return { enabled: false, message: t('Este navegador no pudo mostrar la prueba. Los recordatorios están disponibles en la app para teléfono.') };
    }
  }

  return enqueue(async () => {
    if (!(await requestNativePermission())) return { enabled: false, message: t(PERMISSION_DENIED) };
    await ensureChannel(language);
    await LocalNotifications.schedule({
      notifications: [{
        id: TEST_ID,
        title: t('Un momento para ti'),
        body: t('Así se verá tu recordatorio de Weight&Exercise.'),
        channelId: CHANNEL_ID,
        isExactNotification: false,
        schedule: { at: new Date(Date.now() + 3000) },
        extra: { owner: 'weight-exercise', test: true },
      }],
    });
    return { enabled: false, message: t('Prueba programada para dentro de unos segundos. Esto no cambia tus recordatorios.') };
  });
}
