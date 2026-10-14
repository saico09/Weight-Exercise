import { Preferences } from '@capacitor/preferences';
import { defaultData, validateData, type AppData } from './model';

/** One app-owned key: reset must never clear another plugin's preferences. */
export const STORAGE_KEY = 'weight-exercise.data.v1';

export class StorageError extends Error {
  readonly code: 'read' | 'invalid' | 'write' | 'clear';

  constructor(code: StorageError['code'], message: string) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
  }
}

let operations: Promise<void> = Promise.resolve();
let checkedExistingData = false;
let invalidExistingData = false;

// Serialize reads, writes and resets so a slow save cannot resurrect reset data.
function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = operations.then(operation);
  operations = result.then(() => undefined, () => undefined);
  return result;
}

function invalidDataError(): StorageError {
  return new StorageError(
    'invalid',
    'No pudimos leer tus datos guardados. Los conservamos sin cambios para evitar perderlos. Puedes reintentar o reiniciar la app desde la opción de borrar datos.',
  );
}

async function readExistingData(): Promise<AppData> {
  let value: string | null;
  try {
    ({ value } = await Preferences.get({ key: STORAGE_KEY }));
  } catch {
    throw new StorageError('read', 'No pudimos acceder a los datos de este dispositivo. Revisa el almacenamiento e inténtalo de nuevo.');
  }

  if (value === null) {
    checkedExistingData = true;
    invalidExistingData = false;
    return defaultData();
  }

  let data: AppData | null = null;
  try {
    data = validateData(JSON.parse(value));
  } catch {
    // Keep the original value intact, including malformed JSON or future schemas.
  }

  checkedExistingData = true;
  invalidExistingData = data === null;
  if (!data) throw invalidDataError();
  return data;
}

export function loadData(): Promise<AppData> {
  return enqueue(readExistingData);
}

export async function saveData(data: AppData): Promise<void> {
  // Capture the snapshot before enqueueing: callers may modify their object later.
  const validated = validateData(data);
  if (!validated) {
    throw new StorageError('write', 'No se guardaron los cambios porque contienen datos no válidos. Tus registros anteriores siguen guardados.');
  }
  const value = JSON.stringify(validated);

  return enqueue(async () => {
    if (!checkedExistingData) await readExistingData();
    if (invalidExistingData) throw invalidDataError();
    try {
      await Preferences.set({ key: STORAGE_KEY, value });
    } catch {
      throw new StorageError('write', 'No se pudieron guardar los cambios. Revisa el espacio disponible y vuelve a intentarlo antes de cerrar la app.');
    }
  });
}

/** Call only after the user confirms the destructive reset in the interface. */
export function clearData(): Promise<void> {
  return enqueue(async () => {
    try {
      await Preferences.remove({ key: STORAGE_KEY });
      checkedExistingData = true;
      invalidExistingData = false;
    } catch {
      throw new StorageError('clear', 'No pudimos borrar los datos. Inténtalo otra vez; el reinicio no se ha completado.');
    }
  });
}
