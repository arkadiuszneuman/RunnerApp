import { NextResponse } from 'next/server';
import { ANDROID_RELEASE_MANIFEST_URL, androidReleaseSchema } from '@/lib/androidRelease';

/**
 * The newest published Android app build, for the app's own update notice (androidApp.ts). Public
 * like the release itself; fetched here rather than from the app because GitHub's release
 * downloads have no CORS headers. `null` until a build with runner.json is published, or when
 * GitHub can't be reached.
 */
export async function GET() {
  try {
    const response = await fetch(ANDROID_RELEASE_MANIFEST_URL, { cache: 'no-store' });
    if (!response.ok) return latest(null);
    const parsed = androidReleaseSchema.safeParse(await response.json());
    return latest(parsed.success ? parsed.data : null);
  } catch {
    return latest(null);
  }
}

function latest(release: unknown) {
  // A new APK appears a few times a month at most: let the CDN answer the app's checks.
  return NextResponse.json(release, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' },
  });
}
