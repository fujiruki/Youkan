import React, { useState, useEffect, useRef } from 'react';
import { db, FieldNote } from '../../../../db/db';
import { Camera, Image as ImageIcon, Send, Trash2, FileText } from 'lucide-react';
import clsx from 'clsx';

interface FieldNoteListProps {
    projectId: number;
}

export const FieldNoteList: React.FC<FieldNoteListProps> = ({ projectId }) => {
    const [notes, setNotes] = useState<FieldNote[]>([]);
    const [newContent, setNewContent] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadNotes = async () => {
        const list = await db.fieldNotes
            .where('projectId')
            .equals(projectId)
            .reverse()
            .sortBy('createdAt');
        setNotes(list);
    };

    useEffect(() => {
        loadNotes();
    }, [projectId]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleSubmit = async () => {
        if (!newContent.trim() && !selectedFile) return;

        setIsSubmitting(true);
        try {
            const note: FieldNote = {
                projectId,
                content: newContent,
                createdAt: new Date(),
            };

            if (selectedFile) {
                note.photoBlob = selectedFile;
                note.mimeType = selectedFile.type;
            }

            await db.fieldNotes.add(note);

            // Reload list
            loadNotes();

            // Reset form
            setNewContent('');
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (error) {
            console.error("Failed to add note:", error);
            alert("Failed to save note.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (confirm("Are you sure you want to delete this note?")) {
            await db.fieldNotes.delete(id);
            loadNotes();
        }
    };

    const formatDate = (date: number | Date) => {
        const d = date instanceof Date ? date : new Date(date);
        return new Intl.DateTimeFormat('ja-JP', {
            month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }).format(d);
    };

    return (
        <div className="flex flex-col h-full bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center gap-2 font-bold text-slate-300">
                <FileText size={20} className="text-indigo-400" />
                Field Notes & Site Photos
            </div>

            {/* List Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {!notes || notes.length === 0 ? (
                    <div className="text-center text-slate-500 py-10 flex flex-col items-center gap-2">
                        <FileText size={48} className="opacity-20" />
                        <p>No notes yet.</p>
                        <p className="text-xs">Add photos or memos from the site.</p>
                    </div>
                ) : (
                    notes.map(note => (
                        <div key={note.id} className="group relative flex gap-4 p-4 rounded-lg bg-slate-800 border border-slate-700 hover:border-slate-600 transition-colors">
                            {/* Timestamp Column */}
                            <div className="shrink-0 flex flex-col items-center pt-1">
                                <div className="text-xs font-bold text-indigo-400">
                                    {formatDate(note.createdAt as any)}
                                </div>
                                <div className="w-px h-full bg-slate-700 mt-2 mb-[-16px] group-last:hidden" />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                {note.content && (
                                    <p className="text-slate-200 whitespace-pre-wrap mb-2 text-sm">
                                        {note.content}
                                    </p>
                                )}

                                {note.photoBlob && (
                                    <div className="mt-2 rounded-lg overflow-hidden border border-slate-600 max-w-sm">
                                        <img
                                            src={URL.createObjectURL(note.photoBlob)}
                                            alt="Site Photo"
                                            className="w-full h-auto max-h-64 object-cover"
                                            onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <button
                                onClick={() => note.id && handleDelete(note.id)}
                                className="absolute top-2 right-2 p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Delete"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-slate-900 border-t border-slate-800">
                <div className="flex flex-col gap-2">
                    {/* Image Preview */}
                    {selectedFile && (
                        <div className="flex items-center gap-2 text-xs text-sky-400 bg-sky-900/20 p-2 rounded -mb-1 w-fit">
                            <ImageIcon size={14} />
                            {selectedFile.name}
                            <button
                                onClick={() => setSelectedFile(null)}
                                className="ml-2 hover:text-white"
                            >
                                ×
                            </button>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <textarea
                            value={newContent}
                            onChange={(e) => setNewContent(e.target.value)}
                            placeholder="Write a note..."
                            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none h-10 min-h-[40px] focus:h-24 transition-all"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit();
                                }
                            }}
                        />

                        <div className="flex flex-col gap-1 shrink-0">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className={clsx(
                                    "p-2 rounded-lg border transition-colors",
                                    selectedFile
                                        ? "bg-sky-900/50 border-sky-500 text-sky-400"
                                        : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500"
                                )}
                                title="Attach Photo"
                            >
                                <Camera size={20} />
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                accept="image/*"
                                className="hidden"
                            />

                            <button
                                onClick={handleSubmit}
                                disabled={(!newContent && !selectedFile) || isSubmitting}
                                className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                            >
                                <Send size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
