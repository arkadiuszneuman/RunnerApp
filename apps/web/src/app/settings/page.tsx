'use client';

import Page from '../base/Page';
import HeartRateProfileCard from './HeartRateProfileCard';
import ImportFilesCard from './ImportFilesCard';
import IntervalsCard from './IntervalsCard';

export default function SettingsPage() {
  return (
    <Page eyebrow="Your account" title="Settings">
      <IntervalsCard index={1} />
      <ImportFilesCard index={2} />
      <HeartRateProfileCard index={3} />
    </Page>
  );
}
