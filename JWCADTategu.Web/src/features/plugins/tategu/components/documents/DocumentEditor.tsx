import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, ArrowLeft, Printer } from 'lucide-react';
import { Document, DocumentItem } from '../../domain/ManufacturingTypes';
import { ManufacturingService } from '../../services/ManufacturingService';
import { DocumentItemGrid } from './DocumentItemGrid';
import { CostCalculationPanel } from './CostCalculationPanel';

interface DocumentEditorProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string; // Required for new doc
    initialDocument?: Document | null; // Null implies new
    initialType?: 'estimate' | 'sales' | 'invoice'; // Required if new
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
    isOpen,
    onClose,
    projectId,
    initialDocument,
    initialType
}) => {
    // Header State
    const [issueDate, setIssueDate] = useState('');
    const [status, setStatus] = useState('draft');

    // Items State
    const [items, setItems] = useState<DocumentItem[]>([]);
    const [selectedItem, setSelectedItem] = useState<DocumentItem | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Load Data
    useEffect(() => {
        if (isOpen) {
            if (initialDocument) {
                setIssueDate(initialDocument.issueDate);
                setStatus(initialDocument.status);
                setItems(initialDocument.items || []);
                setSelectedItem(null);
            } else {
                // New Doc
                setIssueDate(new Date().toISOString().split('T')[0]);
                setStatus('draft');
                setItems([]);
                setSelectedItem(null);
            }
        }
    }, [isOpen, initialDocument]);

    // Update selected item when items list changes
    const handleUpdateItems = (newItems: DocumentItem[]) => {
        setItems(newItems);
        // If selected item was modified, update selection ref
        if (selectedItem) {
            const updatedSelected = newItems.find(i => i.id === selectedItem.id);
            if (updatedSelected) {
                setSelectedItem(updatedSelected);
            } else {
                setSelectedItem(null); // Deleted
            }
        }
    };

    const handleUpdateSingleItem = (updates: Partial<DocumentItem>) => {
        if (!selectedItem) return;
        const index = items.findIndex(i => i.id === selectedItem.id);
        if (index === -1) return;

        const newItems = [...items];
        newItems[index] = { ...newItems[index], ...updates };
        setItems(newItems);
        setSelectedItem(newItems[index]);
    };

    const handleSave = async () => {
        setIsSubmitting(true);
        try {
            const totalAmount = items.reduce((sum, i) => sum + (i.unitPrice * i.quantity), 0);
            const costTotal = items.reduce((sum, i) => {
                const materials = i.costDetail?.materials?.reduce((ms, m) => ms + m.cost, 0) || 0;
                const labor = i.costDetail?.laborCost || 0;
                const other = i.costDetail?.otherCost || 0;
                return sum + ((materials + labor + other) * i.quantity);
            }, 0);

            let profitRate = 0;
            if (totalAmount > 0) {
                const profit = totalAmount - costTotal;
                profitRate = profit / totalAmount;
            }

            const docData: Partial<Document> = {
                projectId, // Ensure Project ID
                type: initialDocument ? initialDocument.type : initialType!,
                status: status as any,
                issueDate,
                totalAmount,
                costTotal,
                profitRate,
                items // Send items to save (Backend handles Full Replace)
            };

            if (initialDocument) {
                await ManufacturingService.updateDocument(initialDocument.id, docData);
            } else {
                await ManufacturingService.createDocument(docData);
            }
            onClose(); // Parent should refresh
        } catch (error) {
            console.error('Save failed', error);
            alert('保存に失敗しました');
        } finally {
            setIsSubmitting(false);
        }
    };

    // UI Layout
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-100 dark:bg-slate-900">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="w-full h-full flex flex-col bg-white dark:bg-slate-900"
                    >
                        {/* Header Bar */}
                        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm z-20">
                            <div className="flex items-center gap-4">
                                <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                    <ArrowLeft className="text-slate-600 dark:text-slate-300" />
                                </button>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 text-xs font-bold uppercase tracking-wide rounded border 
                                            ${(initialDocument?.type || initialType) === 'estimate' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                (initialDocument?.type || initialType) === 'sales' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                    'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                            {(initialDocument?.type || initialType) === 'estimate' ? '見積書' :
                                                (initialDocument?.type || initialType) === 'sales' ? '売上伝票' : '請求書'}
                                        </span>
                                        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                                            {initialDocument ? 'ドキュメント編集' : '新規作成'}
                                        </h1>
                                    </div>
                                    <div className="text-xs text-slate-500 flex gap-4 mt-1">
                                        <label className="flex items-center gap-1">
                                            <span>発行日:</span>
                                            <input
                                                type="date"
                                                value={issueDate}
                                                onChange={e => setIssueDate(e.target.value)}
                                                className="bg-transparent border-b border-slate-300 dark:border-slate-700 focus:border-blue-500 outline-none px-1"
                                            />
                                        </label>
                                        <label className="flex items-center gap-1">
                                            <span>状態:</span>
                                            <select
                                                value={status}
                                                onChange={e => setStatus(e.target.value)}
                                                className="bg-transparent border-b border-slate-300 dark:border-slate-700 focus:border-blue-500 outline-none px-1"
                                            >
                                                <option value="draft">下書き</option>
                                                <option value="sent">送付済</option>
                                                <option value="approved">承認済/受注</option>
                                            </select>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="text-right mr-4">
                                    <div className="text-xs text-slate-500">合計金額 (税込: {(items.reduce((s, i) => s + i.unitPrice * i.quantity, 0) * 1.1).toLocaleString()})</div>
                                    <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                                        ¥{items.reduce((s, i) => s + (i.unitPrice * i.quantity), 0).toLocaleString()}
                                    </div>
                                </div>
                                <button className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                                    <Printer size={20} />
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSubmitting}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-2 shadow-sm transition-colors"
                                >
                                    <Save size={18} />
                                    保存
                                </button>
                            </div>
                        </div>

                        {/* Body - 2 Pane Layout */}
                        <div className="flex-1 overflow-hidden flex">
                            {/* Left Pane: Grid */}
                            <div className={`${selectedItem ? 'w-2/3' : 'w-full'} transition-all duration-300 p-4 overflow-y-auto border-r border-slate-200 dark:border-slate-800`}>
                                <DocumentItemGrid
                                    items={items}
                                    onUpdateItems={handleUpdateItems}
                                    selectedItemId={selectedItem?.id || null}
                                    onSelectItem={setSelectedItem}
                                />
                            </div>

                            {/* Right Pane: Details / Cost */}
                            <AnimatePresence>
                                {selectedItem && (
                                    <motion.div
                                        initial={{ width: 0, opacity: 0 }}
                                        animate={{ width: '33.333%', opacity: 1 }}
                                        exit={{ width: 0, opacity: 0 }}
                                        className="w-1/3 bg-slate-50 dark:bg-slate-900/30 overflow-hidden"
                                    >
                                        <CostCalculationPanel
                                            item={selectedItem}
                                            onUpdate={handleUpdateSingleItem}
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
