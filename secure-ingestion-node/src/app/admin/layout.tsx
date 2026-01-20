import NavigationPill from '@/components/NavigationPill';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
        redirect('/dashboard');
    }

    return (
        <div className="min-h-screen">
            <div className="sticky top-0 z-50 h-0 overflow-visible flex justify-center w-full pointer-events-none">
                <div className="pointer-events-auto w-full max-w-7xl px-4 flex justify-center">
                    <NavigationPill />
                </div>
            </div>
            <main className="pt-24 pb-12">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
