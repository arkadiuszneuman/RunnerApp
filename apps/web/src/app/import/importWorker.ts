import { decodeFit } from '@/lib/fit/decodeFit';
import { fitFilesFrom, garminIdAt, garminIdFromName, garminIdsFromExport } from './fitFiles';
import type { ImportWorkerMessage, ImportWorkerRequest } from './protocol';

/**
 * Off-main-thread half of the file import (see runImport.ts): unpacks the uploaded files and
 * decodes every FIT file in them, posting each result back as soon as it's ready so the main
 * thread can upload while this keeps going. A Garmin export can hold thousands of files.
 */
const post = (message: ImportWorkerMessage) => self.postMessage(message);

self.onmessage = async (event: MessageEvent<ImportWorkerRequest>) => {
  for (const file of event.data.files) {
    const onError = (name: string, message: string) => post({ type: 'error', name, message });
    // Read up front: zip entry order is arbitrary, the summaries may come after the FIT files.
    const exportIds = await garminIdsFromExport(file, file.name);
    for await (const fit of fitFilesFrom(file, file.name, onError)) {
      const result = decodeFit(fit.bytes);
      const fromName = garminIdFromName(fit.name);
      post({
        type: 'file',
        name: fit.name,
        activities: result.activities.map((a) => {
          const garminId = fromName ?? garminIdAt(exportIds, a.startTime);
          return garminId ? { ...a, garminId } : a;
        }),
        skipped: 'skipped' in result ? result.skipped : undefined,
        error: 'error' in result ? result.error : undefined,
      });
    }
  }
  post({ type: 'done' });
};
