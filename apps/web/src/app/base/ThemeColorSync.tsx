'use client';

import { useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { currentStageAtom, runningStateAtom } from '../atoms';
import { stageTypeColor, tokens } from '../theme';

/**
 * Tints the mobile browser's own chrome — Android Chrome's address bar,
 * Safari 15+'s URL bar — to match the stage you're actually running: the
 * live stage-type accent (the same cyan/red/violet used everywhere else for
 * Run/Sprint/Recovery, see stageTypeColor) while a stage is active, updating
 * automatically as stages change; the app's base background the rest of the
 * time (including cooldown, which has no stage type of its own).
 *
 * Mutates the single <meta name="theme-color"> tag layout.tsx's `viewport`
 * export already renders (creating it if somehow missing) rather than
 * layering in a second one — there's no supported way to make that static,
 * per-route `viewport` export react to client-side run state.
 */
export default function ThemeColorSync() {
  const runningState = useAtomValue(runningStateAtom);
  const currentStage = useAtomValue(currentStageAtom);

  const color =
    runningState.running && currentStage ? stageTypeColor[currentStage.type] : tokens.bg;

  useEffect(() => {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', color);
  }, [color]);

  return null;
}
