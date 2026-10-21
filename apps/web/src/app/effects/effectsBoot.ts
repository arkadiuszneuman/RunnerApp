// No hooks or atoms here: layout.tsx (a server component) inlines the script.

export const EFFECTS_CHOICE_KEY = 'runner.effects';
export const SLOW_GPU_KEY = 'runner.slowGpu';

export const isLite = (choice: unknown, slowGpu: unknown) =>
  choice === 'lite' || (choice !== 'full' && slowGpu === true);

/**
 * Inline in <head>, so a slow device never paints the heavy version first: isLite on what
 * visualEffects.ts stored (JSON, as jotai's storage writes it).
 */
export const EFFECTS_BOOT_SCRIPT = `try{var c=JSON.parse(localStorage.getItem(${JSON.stringify(
  EFFECTS_CHOICE_KEY
)})),s=JSON.parse(localStorage.getItem(${JSON.stringify(
  SLOW_GPU_KEY
)}));if(c==='lite'||(c!=='full'&&s===true))document.documentElement.dataset.effects='lite'}catch(e){}`;
