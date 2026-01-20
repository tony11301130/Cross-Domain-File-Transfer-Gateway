import { getTransferConfig, getPublicKey } from './actions';
import SettingsForm from './SettingsForm';
import MainHeader from '@/components/MainHeader';
import { Settings } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
    const config = await getTransferConfig();
    const publicKey = await getPublicKey();

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <MainHeader title="SETTINGS_CORE" subtitle="Protocol Configuration" icon={Settings} accentColor="indigo" />
            <SettingsForm config={config} publicKey={publicKey} />
        </div>
    );
}
