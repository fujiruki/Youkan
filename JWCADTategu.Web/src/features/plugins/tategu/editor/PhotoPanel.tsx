import React, { useRef, useState } from 'react';
import { Camera, Upload, Trash2 } from 'lucide-react';
import { DoorPhoto } from '../../../../db/db';

interface PhotoPanelProps {
    photo: DoorPhoto | null;
    onUpload: (file: File) => void;
    onDelete: () => void;
    onMemoChange: (memo: string) => void;
}

export const PhotoPanel: React.FC<PhotoPanelProps> = ({ photo, onUpload, onDelete, onMemoChange }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [dragActive, setDragActive] = useState(false);
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);

    // Create object URL when photo changes
    React.useEffect(() => {
        if (photo?.blob) {
            const url = URL.createObjectURL(photo.blob);
            setPhotoUrl(url);
            return () => URL.revokeObjectURL(url);
        } else {
            setPhotoUrl(null);
        }
    }, [photo]);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            onUpload(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            onUpload(e.target.files[0]);
        }
    };

    return (
        <div className="bg-slate-900 border-l border-slate-800 h-full flex flex-col text-slate-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
                <h2 className="text-base font-bold flex items-center gap-2 text-emerald-400">
                    <Camera size={20} />
                    実績写真
                </h2>
            </div>

            <div className="p-4 flex-1 overflow-y-auto">
                {!photo ? (
                    // Empty State / Upload Area
                    <div
                        className={`border-2 border-dashed rounded-xl h-64 flex flex-col items-center justify-center gap-4 transition-colors cursor-pointer
                            ${dragActive ? "border-emerald-500 bg-emerald-900/10" : "border-slate-700 hover:border-emerald-500/50 hover:bg-slate-800/50"}`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Upload size={32} className="text-slate-500" />
                        <div className="text-center">
                            <p className="font-bold text-slate-300">写真をアップロード</p>
                            <p className="text-xs text-slate-500 mt-1">ドラッグ＆ドロップ<br />またはクリックして選択</p>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={handleChange}
                        />
                    </div>
                ) : (
                    // Photo View
                    <div className="space-y-4">
                        <div className="relative group rounded-lg overflow-hidden border border-slate-700 bg-black aspect-[3/4] flex items-center justify-center">
                            {photoUrl && (
                                <img src={photoUrl} alt="Door Photo" className="max-w-full max-h-full object-contain" />
                            )}

                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                <button onClick={onDelete} className="p-2 bg-red-500/80 rounded-full text-white hover:bg-red-600 transition-colors" title="削除">
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500">メモ・備考</label>
                            <textarea
                                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-200 outline-none focus:border-emerald-500 h-24 resize-none"
                                placeholder="施工日、場所、気づきなど..."
                                value={photo.memo || ''}
                                onChange={(e) => onMemoChange(e.target.value)}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
