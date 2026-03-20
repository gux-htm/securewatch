import { Settings as SettingsIcon } from 'lucide-react';

export default function Settings() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <SettingsIcon className="w-5 h-5 text-text-secondary" />
        <h1 className="text-lg font-semibold text-text-primary">Settings &amp; Notifications</h1>
      </div>
      <div className="bg-bg-secondary border border-border rounded-md p-8 text-center text-text-muted text-sm">
        Settings configuration coming soon.
      </div>
    </div>
  );
}
