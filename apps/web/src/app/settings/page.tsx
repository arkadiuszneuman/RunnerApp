'use client';

import Page from '../base/Page';
import EffectsCard from './EffectsCard';
import HeartRateProfileCard from './HeartRateProfileCard';
import ImportFilesCard from './ImportFilesCard';
import InstallAppCard from './InstallAppCard';
import IntervalsCard from './IntervalsCard';

export default function SettingsPage() {
  return (
    <Page eyebrow="Your account" title="Settings">
      <IntervalsCard index={1} />
      <ImportFilesCard index={2} />
      <HeartRateProfileCard index={3} />
      <EffectsCard index={4} />
      <InstallAppCard index={5} />
    </Page>
  );
}
