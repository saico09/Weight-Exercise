import { describe, expect, it } from 'vitest';
import { defaultData, validateData } from './model';
import { dailyStepTarget, stepProgress } from './stepGoal';
const adult = () => ({ ...defaultData(), profile: { age: 30, heightCm: 170, initialWeightKg: 70, goalWeightKg: 65, initialDate: '2026-10-15' } });
describe('daily step reference', () => {
  it('offers an adult reference but never assigns it to a child', () => {
    expect(dailyStepTarget(adult())).toBe(7000);
    const child = adult(); child.profile.age = 15;
    expect(dailyStepTarget(child)).toBeNull();
    child.settings.stepGoal = 4000;
    expect(dailyStepTarget(child)).toBe(4000);
    expect(dailyStepTarget(defaultData())).toBeNull();
  });
  it('distinguishes missing counts from zero and caps the filled arc', () => {
    expect(stepProgress(undefined, 7000)).toBeNull();
    expect(stepProgress(0, 7000)).toBe(0);
    expect(stepProgress(3500, 7000)).toBe(.5);
    expect(stepProgress(14000, 7000)).toBe(1);
    expect(stepProgress(1000, null)).toBeNull();
  });
  it('migrates and validates targets independently of health permissions', () => {
    const data = adult(); data.settings.stepGoal = 5500;
    expect(validateData(data)?.settings.stepGoal).toBe(5500);
    expect(validateData({ ...data, settings: { ...data.settings, stepGoal: 0 } })?.settings.stepGoal).toBeNull();
    expect(validateData({ ...data, settings: { ...data.settings, stepGoal: 50001 } })?.settings.stepGoal).toBeNull();
    const legacy = JSON.parse(JSON.stringify(data)); delete legacy.settings.stepGoal;
    expect(dailyStepTarget(validateData(legacy)!)).toBe(7000);
  });
});
