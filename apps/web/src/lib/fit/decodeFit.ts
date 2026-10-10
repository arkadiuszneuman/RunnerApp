import { Decoder, Stream } from '@garmin/fitsdk';
import {
  activityFromFitMessages,
  type FitImportResult,
  type FitMessagesLike,
} from '@runner/core/src/activities/fitActivity';

export type DecodeFitResult = FitImportResult | { activities: []; error: string };

/**
 * Decodes a FIT file with Garmin's official SDK and maps it to ImportedActivity records (see
 * packages/core's activities/fitActivity.ts). The only place `@garmin/fitsdk` is used: the
 * browser import worker (app/import/) and the intervals.icu sync run the same code.
 */
export function decodeFit(bytes: Uint8Array): DecodeFitResult {
  try {
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer;
    const stream = Stream.fromArrayBuffer(buffer);
    if (!Decoder.isFIT(stream)) return { activities: [], error: 'Not a FIT file' };
    const { messages, errors } = new Decoder(stream).read({
      convertDateTimesToDates: false,
      // Known decoder crash on some files with unknown fields before accumulated ones.
      includeUnknownData: false,
      mergeHeartRates: true,
    });
    const result = activityFromFitMessages(messages as FitMessagesLike);
    if (result.activities.length === 0 && errors.length > 0) {
      return { activities: [], error: errors[0]?.message ?? 'Unreadable FIT file' };
    }
    return result;
  } catch (error) {
    return {
      activities: [],
      error: error instanceof Error ? error.message : 'Unreadable FIT file',
    };
  }
}
