import React from 'react';
import { Toast } from '../components/Toast/ToastContainer';

type ToastContextType = {
    showToast: (toast: Omit<Toast, 'id'>) => void;
    toasts: Toast[];
    dismissToast: (id: string) => void;
};

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = React.useState<Toast[]>([]);

    const showToast = React.useCallback((toast: Omit<Toast, 'id'>) => {
        const id = `toast-${Date.now()}-${Math.random()}`;
        setToasts(prev => [...prev, { ...toast, id }]);
    }, []);

    const dismissToast = React.useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast, toasts, dismissToast }}>
            {children}
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = React.useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
};
