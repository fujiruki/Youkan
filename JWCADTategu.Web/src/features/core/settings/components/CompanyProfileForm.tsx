import React, { useState, useEffect } from 'react';
import { Building, MapPin, Phone, FileText } from 'lucide-react';
import { JbwosTenant } from '../../auth/types';

interface CompanyProfileFormProps {
    tenant: JbwosTenant;
    onSave: (updatedTenant: JbwosTenant) => void;
}

export const CompanyProfileForm: React.FC<CompanyProfileFormProps> = ({ tenant, onSave }) => {
    const [formData, setFormData] = useState<JbwosTenant>(tenant);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        setFormData(tenant);
        setIsDirty(false);
    }, [tenant]);

    const handleChange = (field: keyof JbwosTenant, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setIsDirty(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        setIsDirty(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <Building className="text-blue-500" size={20} />
                    基本情報
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Company Name */}
                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            会社名 (Company Name)
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            電話番号 (Phone)
                        </label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-3 text-slate-400" size={16} />
                            <input
                                type="text"
                                value={formData.phone || ''}
                                onChange={(e) => handleChange('phone', e.target.value)}
                                className="w-full pl-10 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                                placeholder="03-1234-5678"
                            />
                        </div>
                    </div>

                    {/* Postal Code */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            郵便番号 (Zip)
                        </label>
                        <input
                            type="text"
                            value={formData.address_zip || ''}
                            onChange={(e) => handleChange('address_zip' as keyof JbwosTenant, e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                            placeholder="100-0001"
                        />
                    </div>

                    {/* Address */}
                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            住所 (Address)
                        </label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-3 text-slate-400" size={16} />
                            <input
                                type="text"
                                value={formData.address || ''}
                                onChange={(e) => handleChange('address', e.target.value)}
                                className="w-full pl-10 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                                placeholder="東京都千代田区..."
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <FileText className="text-green-500" size={20} />
                    インボイス・会計情報
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Invoice Number */}
                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            登録番号 (Invoice No.)
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-500 font-bold">T</span>
                            <input
                                type="text"
                                value={formData.invoiceNumber?.replace(/^T/, '') || ''}
                                onChange={(e) => handleChange('invoiceNumber', 'T' + e.target.value)}
                                className="w-full pl-8 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 font-mono"
                                placeholder="1234567890123"
                            />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            請求書や見積書に自動的に記載されます。
                        </p>
                    </div>

                    {/* Closing Date */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            締め日 (Closing Date)
                        </label>
                        <select
                            value={formData.closingDate || 0}
                            onChange={(e) => handleChange('closingDate' as keyof JbwosTenant, e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                        >
                            <option value={0}>末日</option>
                            <option value={20}>20日</option>
                            <option value={25}>25日</option>
                            <option value={15}>15日</option>
                            <option value={10}>10日</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-4">
                <button
                    type="submit"
                    disabled={!isDirty}
                    className={`
                        px-6 py-2 rounded-lg font-bold shadow-sm transition-all
                        ${isDirty
                            ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-500/30'
                            : 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed'}
                    `}
                >
                    変更を保存
                </button>
            </div>
        </form>
    );
};
