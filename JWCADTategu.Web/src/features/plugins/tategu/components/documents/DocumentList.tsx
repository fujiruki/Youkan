import React, { useState, useEffect } from 'react';
import { Plus, ArrowRight, Calendar } from 'lucide-react';
import { Document, DocumentType } from '../../domain/ManufacturingTypes';
import { ManufacturingService } from '../../services/ManufacturingService';

interface DocumentListProps {
    projectId: string;
    onSelectDocument: (doc: Document) => void;
}

export const DocumentList: React.FC<DocumentListProps> = ({ projectId, onSelectDocument }) => {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [filterType, setFilterType] = useState<DocumentType | 'all'>('all');
    const [isLoading, setIsLoading] = useState(false);

    const loadDocuments = async () => {
        if (!projectId) return;
        setIsLoading(true);
        try {
            const docs = await ManufacturingService.getDocuments(projectId);
            setDocuments(docs);
        } catch (error) {
            console.error('Failed to load documents', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadDocuments();
    }, [projectId]);

    const handleCreate = async (type: DocumentType) => {
        if (!confirm(`${type === 'estimate' ? '見積' : type === 'sales' ? '売上伝票' : '請求書'}を新規作成しますか？`)) return;
        try {
            const res = await ManufacturingService.createDocument({
                projectId,
                type,
                status: 'draft',
                issueDate: new Date().toISOString().split('T')[0],
                totalAmount: 0
            });
            if (res.success) {
                await loadDocuments();
                // Auto select the new doc?
                const newDoc = await ManufacturingService.getDocument(res.id);
                onSelectDocument(newDoc);
            }
        } catch (error) {
            alert('作成に失敗しました');
        }
    };

    const handleConvert = async (e: React.MouseEvent, doc: Document) => {
        e.stopPropagation();
        if (!confirm('この見積を確定して、売上伝票を作成しますか？\n（見積の内容はコピーされ、別レコードとして保存されます）')) return;
        try {
            const res = await ManufacturingService.convertToSales(doc.id);
            if (res.success) {
                alert('売上伝票を作成しました');
                loadDocuments();
            }
        } catch (error) {
            alert('変換に失敗しました');
        }
    };

    const filteredDocs = documents.filter(d => filterType === 'all' || d.type === filterType);

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 rounded-t-xl">
                <div className="flex gap-2">
                    {/* Filter Tabs */}
                    {(['all', 'estimate', 'sales', 'invoice'] as const).map(type => (
                        <button
                            key={type}
                            onClick={() => setFilterType(type)}
                            className={`px-3 py-1 text-sm rounded-full transition-colors ${filterType === type
                                ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                                }`}
                        >
                            {type === 'all' ? '全て' : type === 'estimate' ? '見積' : type === 'sales' ? '売上' : '請求'}
                        </button>
                    ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <button
                        onClick={() => handleCreate('estimate')}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 rounded-lg text-sm transition-colors border border-blue-200 dark:border-blue-800"
                    >
                        <Plus size={14} /> 見積
                    </button>
                    <button
                        onClick={() => handleCreate('sales')}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 rounded-lg text-sm transition-colors border border-emerald-200 dark:border-emerald-800"
                    >
                        <Plus size={14} /> 売上
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {isLoading ? (
                    <div className="text-center py-10 text-slate-500">読み込み中...</div>
                ) : filteredDocs.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">ドキュメントがありません</div>
                ) : (
                    filteredDocs.map(doc => (
                        <div
                            key={doc.id}
                            onClick={() => onSelectDocument(doc)}
                            className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 cursor-pointer transition-all group"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className={`px-2 py-0.5 text-xs font-bold uppercase tracking-wide rounded border ${doc.type === 'estimate' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                    doc.type === 'sales' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                        'bg-amber-50 text-amber-700 border-amber-200'
                                    }`}>
                                    {doc.type === 'estimate' ? '見積書' : doc.type === 'sales' ? '売上伝票' : '請求書'}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${doc.status === 'draft' ? 'bg-slate-100 text-slate-500' :
                                    doc.status === 'sent' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                                    }`}>
                                    {doc.status}
                                </span>
                            </div>

                            <div className="flex justify-between items-end">
                                <div>
                                    <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono flex items-baseline gap-1">
                                        ¥{doc.totalAmount.toLocaleString()}
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                        <span className="flex items-center gap-1"><Calendar size={12} /> {doc.issueDate}</span>
                                        {doc.type === 'estimate' && (
                                            <button
                                                onClick={(e) => handleConvert(e, doc)}
                                                className="flex items-center gap-1 text-blue-600 hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <ArrowRight size={12} /> 売上作成
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
