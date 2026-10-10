'use client';

import Page from '../base/Page';
import HeartRateProfileCard from './HeartRateProfileCard';
import ImportFilesCard from './ImportFilesCard';
import IntervalsCard from './IntervalsCard';
import StatsPrefsCard from './StatsPrefsCard';

export default function SettingsPage() {
  return (
    <Page eyebrow="Your account" title="Settings">
      <IntervalsCard index={1} />
      <ImportFilesCard index={2} />
      <HeartRateProfileCard index={3} />
      <StatsPrefsCard index={4} />
    </Page>
  );
}
