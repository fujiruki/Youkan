import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { SimpleModal } from '../Modal/SimpleModal';
import { ApiClient } from '@/api/client';
import { useToast } from '@/contexts/ToastContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return '対応していない画像形式です（png / jpeg / webpのみ添付できます）';
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return '画像サイズは5MBまでです';
  }
  return null;
}

export const ImprovementRequestModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { showToast } = useToast();
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // isOpen が false→true に切り替わった時だけ状態をリセットする
  // (送信失敗時に入力内容を保持したまま再送できるようにするため、開いている間はリセットしない)
  useEffect(() => {
    if (isOpen) {
      setContent('');
      setImageFile(null);
      setImagePreviewUrl(null);
      setErrorMessage(null);
      setIsSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const setImage = useCallback((file: File | null) => {
    setImagePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
    setImageFile(file);
  }, []);

  const applyImageFile = useCallback((file: File) => {
    const validationError = validateImageFile(file);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }
    setErrorMessage(null);
    setImage(file);
  }, [setImage]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      applyImageFile(file);
    }
    // 同じファイルを再選択しても onChange が発火するようにリセット
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          applyImageFile(file);
        }
        break;
      }
    }
  };

  const handleRemoveImage = () => {
    setImage(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isContentValid = content.trim() !== '';

  const handleSubmit = async () => {
    if (!isContentValid || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await ApiClient.submitImprovementRequest(content.trim(), imageFile ?? undefined);
      showToast({ type: 'success', title: '改善要望を送信しました' });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : '送信に失敗しました';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SimpleModal isOpen={isOpen} onClose={onClose} title="改善要望を送る">
      <div className="flex flex-col gap-4 p-6">
        <div>
          <label htmlFor="improvement-request-content" className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">
            本文
          </label>
          <textarea
            id="improvement-request-content"
            aria-label="本文"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onPaste={handlePaste}
            placeholder="気づいたこと、不便に感じたことを書いてください（スクリーンショットはCtrl+Vで貼り付けできます）"
            className="w-full h-32 text-sm border border-slate-200 dark:border-slate-700 rounded-lg p-3 resize-none bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200"
          />
        </div>

        <div>
          <label htmlFor="improvement-request-image" className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">
            画像添付（任意、1枚まで、5MBまで）
          </label>
          <input
            id="improvement-request-image"
            ref={fileInputRef}
            type="file"
            aria-label="画像添付"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileInputChange}
            className="text-sm text-slate-500 dark:text-slate-400"
          />

          {imagePreviewUrl && (
            <div className="mt-2 relative inline-block">
              <img
                src={imagePreviewUrl}
                alt="添付画像プレビュー"
                className="max-h-32 rounded border border-slate-200 dark:border-slate-700"
              />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute -top-2 -right-2 bg-slate-700 hover:bg-slate-600 text-white rounded-full p-1"
                aria-label="添付画像を削除"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>

        {errorMessage && (
          <div role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-2">
            {errorMessage}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isContentValid || isSubmitting}
            className="px-4 py-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {isSubmitting ? '送信中...' : '送信する'}
          </button>
        </div>
      </div>
    </SimpleModal>
  );
};
