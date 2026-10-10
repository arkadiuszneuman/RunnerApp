'use client';

import Page from '../base/Page';
import HeartRateProfileCard from './HeartRateProfileCard';
import ImportFilesCard from './ImportFilesCard';

export default function SettingsPage() {
  return (
    <Page eyebrow="Your account" title="Settings">
      <ImportFilesCard index={1} />
      <HeartRateProfileCard index={2} />
    </Page>
  );
}
