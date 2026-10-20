import { z } from 'zod';

/** Published by .github/workflows/android-release.yml on the `android-latest` GitHub release. */
const RELEASE_URL = 'https://github.com/arkadiuszneuman/RunnerApp/releases/download/android-latest';

export const ANDROID_APK_URL = `${RELEASE_URL}/runner.apk`;

/** Which build runner.apk is — its versionCode is the one Android compares on install. */
export const ANDROID_RELEASE_MANIFEST_URL = `${RELEASE_URL}/runner.json`;

export const androidReleaseSchema = z.object({
  versionCode: z.number().int().positive(),
  versionName: z.string().min(1).max(40),
});

export type AndroidRelease = z.infer<typeof androidReleaseSchema>;
