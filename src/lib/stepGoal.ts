import { profileAge, type AppData } from './model';

// A practical adult reference, not a universal medical prescription. The app lets
// each person choose a different target; no adult reference is applied to children.
export const ADULT_STEP_REFERENCE = 7000;
export function dailyStepTarget(data: AppData): number | null {
  const personal = data.settings.stepGoal;
  if (Number.isInteger(personal) && personal !== null && personal >= 100 && personal <= 50000) return personal;
  return data.profile && profileAge(data.profile) >= 18 ? ADULT_STEP_REFERENCE : null;
}
export function stepProgress(steps: number | undefined, target: number | null): number | null {
  if (steps === undefined || !Number.isInteger(steps) || steps < 0 || !target || target <= 0) return null;
  return Math.min(1, steps / target);
}
