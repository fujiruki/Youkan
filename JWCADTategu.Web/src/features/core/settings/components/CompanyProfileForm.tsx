import React, { useState, useEffect } from 'react';
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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setIsDirty(true);
    };

    const handleBankChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            bankInfo: {
                ...prev.bankInfo || { bankName: '', accountType: '普通', accountNumber: '', accountHolder: '' },
                [name]: value
            }
        }));
        setIsDirty(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        setIsDirty(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
            <div className="bg-white p-6 shadow-sm rounded-lg border border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-4">基本情報 (Basic Info)</h3>

                <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                    <div className="sm:col-span-4">
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">会社名 / 屋号</label>
                        <input
                            type="text"
                            name="name"
                            id="name"
                            value={formData.name}
                            onChange={handleChange}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                        />
                    </div>

                    <div className="sm:col-span-6">
                        <label htmlFor="address" className="block text-sm font-medium text-gray-700">住所</label>
                        <input
                            type="text"
                            name="address"
                            id="address"
                            value={formData.address || ''}
                            onChange={handleChange}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                        />
                    </div>

                    <div className="sm:col-span-3">
                        <label htmlFor="phone" className="block text-sm font-medium text-gray-700">電話番号</label>
                        <input
                            type="text"
                            name="phone"
                            id="phone"
                            value={formData.phone || ''}
                            onChange={handleChange}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                        />
                    </div>

                    <div className="sm:col-span-3">
                        <label htmlFor="invoiceNumber" className="block text-sm font-medium text-gray-700">インボイス登録番号</label>
                        <input
                            type="text"
                            name="invoiceNumber"
                            id="invoiceNumber"
                            placeholder="T+13桁の数字"
                            value={formData.invoiceNumber || ''}
                            onChange={handleChange}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 shadow-sm rounded-lg border border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-4">振込先口座 (Bank Account)</h3>
                <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                    <div className="sm:col-span-3">
                        <label htmlFor="bankName" className="block text-sm font-medium text-gray-700">銀行名・支店名</label>
                        <input
                            type="text"
                            name="bankName"
                            id="bankName"
                            value={formData.bankInfo?.bankName || ''}
                            onChange={handleBankChange}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                        />
                    </div>

                    <div className="sm:col-span-2">
                        <label htmlFor="accountType" className="block text-sm font-medium text-gray-700">口座種別</label>
                        <select
                            name="accountType"
                            id="accountType"
                            value={formData.bankInfo?.accountType || '普通'}
                            onChange={handleBankChange}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                        >
                            <option value="普通">普通</option>
                            <option value="当座">当座</option>
                        </select>
                    </div>

                    <div className="sm:col-span-3">
                        <label htmlFor="accountNumber" className="block text-sm font-medium text-gray-700">カ）口座番号</label>
                        <input
                            type="text"
                            name="accountNumber"
                            id="accountNumber"
                            value={formData.bankInfo?.accountNumber || ''}
                            onChange={handleBankChange}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                        />
                    </div>

                    <div className="sm:col-span-3">
                        <label htmlFor="accountHolder" className="block text-sm font-medium text-gray-700">口座名義 (カナ)</label>
                        <input
                            type="text"
                            name="accountHolder"
                            id="accountHolder"
                            value={formData.bankInfo?.accountHolder || ''}
                            onChange={handleBankChange}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                        />
                    </div>
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={!isDirty}
                    className={`ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white 
                        ${isDirty ? 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500' : 'bg-gray-300 cursor-not-allowed'}`}
                >
                    変更を保存 (Save)
                </button>
            </div>
        </form>
    );
};
