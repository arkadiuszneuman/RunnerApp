#!/usr/bin/env node
// Perf harness for the "przycinki" (jank) investigation on /programs (select
// a program) and /runs/:id (open a run's history). Drives a real production
// build with Playwright, a mobile viewport + touch input, and 4x CPU
// throttling (CDP `Emulation.setCPUThrottlingRate`) to approximate a mid-tier
// phone. Seeds its own user/programs/runs through the real API (cookies
// shared with the browser context via `context.request`) so it can run
// against any environment with the app + Postgres up — see
// apps/web/package.json's `perf` script for how it's invoked.
//
// Not a correctness test — no assertions, just a measurement report (JSON on
// stdout). Compare a "before" and "after" run around a fix by hand.

import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

const BASE_URL = process.env.PERF_BASE_URL ?? 'http://localhost:3010';
const CHROME_PATH =
  process.env.PERF_CHROME_PATH ??
  path.join(os.homedir(), '.cache/ms-playwright/chromium-1234/chrome-linux64/chrome');
const CPU_THROTTLE = Number(process.env.PERF_CPU_THROTTLE ?? 4);
const MEASURE_WINDOW_MS = 2500;

function buildStages(count) {
  return Array.from({ length: count }, (_, i) => ({
    times: 1,
    stages: [
      i % 3 === 0
        ? { type: 'sprint', speedType: 'bmp', bmp: 165, duration: { totalMilliseconds: 30_000 } }
        : i % 3 === 1
          ? {
              type: 'regeneration',
              speedType: 'tempo',
              tempo: { totalMilliseconds: 6 * 60_000 },
              duration: { totalMilliseconds: 90_000 },
            }
          : { type: 'simple', speedType: 'bmp', bmp: 142, duration: { totalMilliseconds: 120_000 } },
    ],
  }));
}

function buildTelemetry(points) {
  const telemetry = [];
  for (let t = 0; t < points; t++) {
    const thr = 140 + 10 * Math.sin(t / 90);
    const phr = thr + 3 * Math.sin(t / 17);
    telemetry.push({
      t,
      hr: Math.round(phr + (Math.random() - 0.5) * 4),
      thr: Math.round(thr),
      phr: Math.round(phr),
      spd: Math.round((9 + Math.sin(t / 60)) * 10) / 10,
      aspd: Math.round((9 + Math.sin(t / 60)) * 10) / 10,
      inc: 1,
      si: Math.floor(t / 180),
      err: Math.round(thr - phr),
    });
  }
  return telemetry;
}

async function seed(context) {
  const email = `perf-${Date.now()}-${crypto.randomUUID().slice(0, 8)}@example.invalid`;
  const password = 'perf-test-password-123';

  const registerRes = await context.request.post(`${BASE_URL}/api/register`, {
    data: { name: 'Perf Tester', email, password },
  });
  if (!registerRes.ok()) {
    throw new Error(`register failed: ${registerRes.status()} ${await registerRes.text()}`);
  }

  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(`${BASE_URL}/`, { timeout: 15_000 });

  const programNames = [];
  let firstProgramId;
  for (let i = 0; i < 8; i++) {
    const name = `Perf program ${i + 1}`;
    const res = await context.request.post(`${BASE_URL}/api/programs`, {
      data: { name, data: { stages: buildStages(10 + i), cooldown: i % 2 === 0 } },
    });
    if (!res.ok()) throw new Error(`create program failed: ${res.status()} ${await res.text()}`);
    const { id } = await res.json();
    if (i === 0) firstProgramId = id;
    programNames.push(name);
  }

  // The run whose detail page we'll open: a full hour at 1 Hz, same order
  // of magnitude as a real long run's telemetry.
  const heavyRunId = crypto.randomUUID();
  const startedAt = new Date(Date.now() - 60 * 60_000).toISOString();
  await context.request.post(`${BASE_URL}/api/runs`, {
    data: { id: heavyRunId, startedAt, programId: firstProgramId, controller: 'adaptive' },
  });
  const patchRes = await context.request.patch(`${BASE_URL}/api/runs/${heavyRunId}`, {
    data: {
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: 60 * 60_000,
      telemetry: buildTelemetry(3600),
    },
  });
  if (!patchRes.ok()) throw new Error(`seed telemetry failed: ${patchRes.status()} ${await patchRes.text()}`);

  // A handful of lighter runs so /runs shows a realistic list above it.
  for (let i = 0; i < 5; i++) {
    const id = crypto.randomUUID();
    const started = new Date(Date.now() - (i + 2) * 3600_000).toISOString();
    await context.request.post(`${BASE_URL}/api/runs`, { data: { id, startedAt: started } });
    await context.request.patch(`${BASE_URL}/api/runs/${id}`, {
      data: {
        startedAt: started,
        finishedAt: new Date(Date.now() - (i + 2) * 3600_000 + 20 * 60_000).toISOString(),
        durationMs: 20 * 60_000,
        telemetry: buildTelemetry(1200),
      },
    });
  }

  await page.close();
  return { programNames, heavyRunId };
}

async function installPerfHooks(page) {
  await page.evaluate(() => {
    window.__perf = { longtasks: [] };
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__perf.longtasks.push({ start: entry.startTime, duration: entry.duration });
      }
    });
    po.observe({ type: 'longtask', buffered: true });
  });
}

/** Runs `action`, then reports long tasks / frame drops in the following window. */
async function measure(page, action) {
  await page.evaluate(() => {
    window.__perf.longtasks = [];
    window.__perf.mark = performance.now();
  });
  const wallStart = Date.now();
  await action();
  const wallActionMs = Date.now() - wallStart;

  // Count frames > 32ms (roughly half of 60fps) via rAF sampling, alongside
  // the longtask-based numbers — two different lenses on the same jank.
  const frames = await page.evaluate(
    (windowMs) =>
      new Promise((resolve) => {
        const gaps = [];
        let last = performance.now();
        function tick(now) {
          gaps.push(now - last);
          last = now;
          if (now - window.__perf.mark < windowMs) requestAnimationFrame(tick);
          else resolve(gaps);
        }
        requestAnimationFrame(tick);
      }),
    MEASURE_WINDOW_MS
  );

  const data = await page.evaluate(() => ({ mark: window.__perf.mark, longtasks: window.__perf.longtasks }));
  const relevant = data.longtasks.filter((t) => t.start >= data.mark);
  const totalBlockingTimeMs = Math.round(relevant.reduce((sum, t) => sum + Math.max(0, t.duration - 50), 0));
  const longTasksOver100ms = relevant.filter((t) => t.duration > 100).length;
  const maxTaskMs = Math.round(Math.max(0, ...relevant.map((t) => t.duration)));
  const droppedFrames = frames.filter((g) => g > 32).length;
  const worstFrameMs = Math.round(Math.max(0, ...frames));

  return {
    wallActionMs,
    longTasks: relevant.length,
    longTasksOver100ms,
    totalBlockingTimeMs,
    maxTaskMs,
    droppedFramesOver32ms: droppedFrames,
    worstFrameMs,
  };
}

// All navigation below goes through taps on the app's own links/rows — the
// same client-side (SPA, no full reload) transitions a real user triggers —
// rather than page.goto(), so the long-task observer installed once by
// installPerfHooks keeps running across every "navigation" measured here.
// page.goto() would tear down that document entirely (a real network
// navigation), which is realistic for the very first page load but not for
// what these two scenarios are actually about.

async function measureProgramSwitch(page, programNames) {
  await page.getByRole('link', { name: 'Programs', exact: true }).tap();
  await page.waitForURL(`${BASE_URL}/programs`, { timeout: 10_000 });
  await page.waitForTimeout(800); // let the list's own entrance animation settle
  // Pick a program that isn't already active — a real "switch", not a no-op.
  const target = programNames[3];
  const result = await measure(page, async () => {
    await page.getByText(target, { exact: true }).tap();
    await page.waitForURL(`${BASE_URL}/`, { timeout: 10_000 });
  });
  return result;
}

async function measureRunDetail(page, runRowText, label) {
  await page.getByRole('link', { name: 'History', exact: true }).tap();
  await page.waitForURL(`${BASE_URL}/runs`, { timeout: 10_000 });
  await page.waitForTimeout(800);
  const result = await measure(page, async () => {
    await page.getByText(runRowText, { exact: true }).tap();
    await page.waitForSelector('text=Avg pace', { timeout: 15_000 });
  });
  // Back to /runs (client-side), so a following call can re-open the same
  // run for the "warm" (already-cached) measurement.
  await page.getByRole('link', { name: 'Back to history' }).tap();
  await page.waitForURL(`${BASE_URL}/runs`, { timeout: 10_000 });
  return { label, ...result };
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  });

  try {
    const { programNames } = await seed(context);
    const heavyRunRowText = programNames[0]; // the heavy run's programName snapshot (see seed())

    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });

    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await installPerfHooks(page);

    const results = {
      cpuThrottle: CPU_THROTTLE,
      viewport: '390x844 (mobile, touch)',
      programSwitch: await measureProgramSwitch(page, programNames),
      runDetailCold: await measureRunDetail(page, heavyRunRowText, 'cold (not cached)'),
      runDetailWarm: await measureRunDetail(page, heavyRunRowText, 'warm (cached in runDetailsAtom)'),
    };

    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
