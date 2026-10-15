import type { AppData, DailyRecord } from '../src/lib/model';
export interface WorkbookOptions { records?: DailyRecord[]; locale?: string; title?: string; scopeLabel?: string; generatedAt?: Date | string }
export function buildProgressWorkbook(snapshot: AppData, options?: WorkbookOptions, compress?: (raw: Uint8Array) => Uint8Array): Uint8Array;
