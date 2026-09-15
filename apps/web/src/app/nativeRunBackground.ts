import {
  ForegroundService,
  type ServiceType,
} from '@capawesome-team/capacitor-android-foreground-service';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { isNativeApp } from './ble/platform';

const NOTIFICATION_ID = 1;

// Android's FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE, which is what this actually is — keeping
// the BLE link to the treadmill/heart-rate monitor alive, not location or microphone (the only
// two the plugin's ServiceType enum names). It's still a valid value: the plugin just forwards
// this number to Android's startForeground(), so any real foreground-service-type bit works, as
// long as AndroidManifest.xml's <service> declares the same type ("connectedDevice").
const CONNECTED_DEVICE_SERVICE_TYPE = 16 as ServiceType;

/**
 * Keeps a run alive on native (apps/android) when the app is backgrounded or the screen turns
 * off: a foreground-service notification ("Training in progress") stops Android from
 * suspending/killing the process — the screen wake lock in useRunningLoop.ts only keeps the
 * screen itself on while the app is in front, which isn't enough once the user switches away
 * (e.g. to change music) or the phone locks. No-op outside the native shell — the web/PWA has no
 * equivalent for surviving true backgrounding, only the screen wake lock.
 */
export async function startRunBackground(): Promise<void> {
  if (!isNativeApp()) return;
  await KeepAwake.keepAwake().catch(() => {});
  try {
    const status = await ForegroundService.checkPermissions();
    if (status.display !== 'granted') await ForegroundService.requestPermissions();
    await ForegroundService.startForegroundService({
      id: NOTIFICATION_ID,
      title: 'Runner',
      body: 'Training in progress',
      smallIcon: 'ic_stat_notify',
      serviceType: CONNECTED_DEVICE_SERVICE_TYPE,
    });
  } catch (error) {
    // Not fatal — the run continues, it just won't survive the app being backgrounded.
    console.warn('Foreground service failed to start', error);
  }
}

export async function stopRunBackground(): Promise<void> {
  if (!isNativeApp()) return;
  await KeepAwake.allowSleep().catch(() => {});
  try {
    await ForegroundService.stopForegroundService();
  } catch {
    // Wasn't running — fine.
  }
}
