import type { MultiplyStage } from '@runner/core';
import { atom } from 'jotai';

/** Mirrors apps/web/src/app/add-program/atoms.ts — local to the program-edit screen, not shared business state. */
export const editingSectionAtom = atom<MultiplyStage | undefined>(undefined);
