import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../core/auth/providers/AuthProvider';
import { ApiClient } from '../../../../api/client';
import { useToast } from '../../../../contexts/ToastContext';
import { ArrowLeft, Save, Lock, User, Clock } from 'lucide-react';

interface PersonalSettingsScreenProps {
    onBack: () => void;
}

export const PersonalSettingsScreen: React.FC<PersonalSettingsScreenProps> = ({ onBack }) => {
    const { checkAuth } = useAuth();
    const { showToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    // Profile State
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [birthday, setBirthday] = useState('');

    // Capacity State
    const [dailyCapacity, setDailyCapacity] = useState(480); // minutes
    const [nonWorkingHours, setNonWorkingHours] = useState('');

    // Password State
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            setIsLoading(true);
            const profile = await ApiClient.getUserProfile();
            setDisplayName(profile.display_name || '');
            setEmail(profile.email || '');
            setBirthday(profile.birthday || '');
            setDailyCapacity(profile.daily_capacity_minutes || 480);

            // Handle JSON or string for non_working_hours
            let nwh = profile.non_working_hours;
            if (typeof nwh !== 'string') {
                nwh = JSON.stringify(nwh, null, 2);
            }
            setNonWorkingHours(nwh || '');
        } catch (error) {
            console.error('Failed to load profile', error);
            showToast({ type: 'error', title: 'Error', message: 'Failed to load profile' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveProfile = async () => {
        try {
            setIsLoading(true);
            await ApiClient.updateUserProfile({
                display_name: displayName,
                birthday: birthday,
                daily_capacity_minutes: dailyCapacity,
                non_working_hours: nonWorkingHours
            });
            await checkAuth(); // Refresh global auth state
            showToast({ type: 'success', title: 'Saved', message: 'Profile updated successfully' });
        } catch (error) {
            console.error(error);
            showToast({ type: 'error', title: 'Error', message: 'Failed to save profile' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword) {
            showToast({ type: 'error', title: 'Error', message: 'Both password fields are required' });
            return;
        }
        try {
            setIsLoading(true);
            await ApiClient.changePassword(currentPassword, newPassword);
            setCurrentPassword('');
            setNewPassword('');
            showToast({ type: 'success', title: 'Success', message: 'Password changed successfully' });
        } catch (error: any) {
            console.error(error);
            showToast({ type: 'error', title: 'Error', message: error.message || 'Failed to change password' });
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading && !email) {
        return <div className="p-8 text-slate-500">Loading settings...</div>;
    }

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                    </button>
                    <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <User className="w-6 h-6 text-indigo-500" />
                        Personal Settings
                    </h1>
                </div>
                <button
                    onClick={handleSaveProfile}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-sm transition-all disabled:opacity-50"
                >
                    <Save className="w-4 h-4" />
                    Save Changes
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6 max-w-4xl mx-auto w-full space-y-8">

                {/* Profile Section */}
                <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
                        Basic Information
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Display Name</label>
                            <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                placeholder="Your Name"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Email Address</label>
                            <input
                                type="email"
                                value={email}
                                disabled
                                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
                            />
                            <p className="text-xs text-slate-400">Email cannot be changed.</p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Birthday</label>
                            <input
                                type="date"
                                value={birthday}
                                onChange={(e) => setBirthday(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>
                    </div>
                </section>

                {/* Capacity Section */}
                <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 pb-2 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-slate-500" />
                        Work Capacity & Balance
                    </h2>
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                Daily Work Capacity (Minutes)
                            </label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="number"
                                    value={dailyCapacity}
                                    onChange={(e) => setDailyCapacity(Number(e.target.value))}
                                    className="w-32 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                                />
                                <span className="text-slate-500 dark:text-slate-400 text-sm">
                                    {(dailyCapacity / 60).toFixed(1)} Hours
                                </span>
                            </div>
                            <p className="text-xs text-slate-400">Used for workload calculation and scheduling.</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                Non-Working Hours / Holidays (JSON Config)
                            </label>
                            <textarea
                                value={nonWorkingHours}
                                onChange={(e) => setNonWorkingHours(e.target.value)}
                                rows={4}
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-mono text-sm"
                                placeholder='{"weekends": ["Sat", "Sun"], "holidays": []}'
                            />
                            <p className="text-xs text-slate-400">Advanced configuration for recurring off-hours.</p>
                        </div>
                    </div>
                </section>

                {/* Security Section */}
                <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 pb-2 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                        <Lock className="w-5 h-5 text-slate-500" />
                        Security
                    </h2>
                    <div className="space-y-4 max-w-md">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Current Password</label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">New Password</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                            />
                        </div>
                        <button
                            onClick={handleChangePassword}
                            disabled={isLoading || !currentPassword || !newPassword}
                            className="mt-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-lg font-medium shadow-sm transition-all disabled:opacity-50 text-sm"
                        >
                            Update Password
                        </button>
                    </div>
                </section>

            </div>
        </div>
    );
};
