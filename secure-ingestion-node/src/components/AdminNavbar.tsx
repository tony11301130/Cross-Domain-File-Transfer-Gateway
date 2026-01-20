import Link from 'next/link';

export default function AdminNavbar() {
    return (
        <nav className="bg-white border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex">
                        <div className="flex-shrink-0 flex items-center">
                            <span className="text-xl font-bold text-gray-800">Admin Console</span>
                        </div>
                        <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                            <Link
                                href="/admin/settings"
                                className="border-indigo-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                            >
                                Settings
                            </Link>
                            {/* Future menu items can be added here */}
                        </div>
                    </div>
                    <div className="flex items-center">
                        <Link href="/dashboard" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                            Back to Dashboard
                        </Link>
                    </div>
                </div>
            </div>
        </nav>
    );
}
