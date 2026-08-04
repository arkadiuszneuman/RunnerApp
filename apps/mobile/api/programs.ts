import { Timespan } from '@runner/core';
import type { MultiplyStage } from '@runner/core';
import { client } from './client';

export interface ProgramSummary {
  id: string;
  name: string;
  updatedAt: string;
}

export interface ProgramData {
  stages: MultiplyStage[];
  cooldown: boolean;
}

export interface ProgramRow {
  id: string;
  name: string;
  data: ProgramData;
  updatedAt: string;
}

/**
 * Programs carry Timespan fields nested inside `data.stages`. Timespan's
 * toJSON/reviver pair requires JSON.parse(raw, Timespan.reviver) — the
 * default axios JSON parsing bypasses that and leaves plain
 * `{ totalMilliseconds }` objects instead of Timespan instances. This is the
 * one place that must not be forgotten (see services/Timespan.ts on web).
 */
export async function getProgram(id: string): Promise<ProgramRow> {
  const { data } = await client.get<string>(`/api/programs/${id}`, {
    transformResponse: [(raw) => raw],
  });
  return JSON.parse(data, Timespan.reviver);
}

export async function listPrograms(): Promise<ProgramSummary[]> {
  const { data } = await client.get<ProgramSummary[]>('/api/programs');
  return data;
}

export async function createProgram(name: string): Promise<{ id: string }> {
  const { data } = await client.post<{ id: string }>('/api/programs', { name });
  return data;
}

export async function updateProgram(id: string, updates: { name?: string; data?: ProgramData }): Promise<void> {
  await client.put(`/api/programs/${id}`, updates);
}

export async function deleteProgram(id: string): Promise<void> {
  await client.delete(`/api/programs/${id}`);
}

export interface UserSettings {
  activeProgramId: string | null;
}

export async function getUserSettings(): Promise<UserSettings> {
  const { data } = await client.get<Partial<UserSettings>>('/api/user-settings');
  return { activeProgramId: data.activeProgramId ?? null };
}

export async function updateUserSettings(settings: UserSettings): Promise<void> {
  await client.put('/api/user-settings', settings);
}
