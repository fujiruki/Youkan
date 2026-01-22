import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calculator } from 'lucide-react';

interface WoodCalculatorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (result: { cost: number; volume: number; description: string; dimensions: string }) => void;
    initialValues?: { length?: number; width?: number; thickness?: number; pricePerM3?: number };
}

export const WoodCalculatorModal: React.FC<WoodCalculatorModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    initialValues
}) => {
    const [length, setLength] = useState(2000);
    const [width, setWidth] = useState(100);
    const [thickness, setThickness] = useState(30);
    const [count, setCount] = useState(1);
    const [pricePerM3, setPricePerM3] = useState(200000); // 20万円/m3 default

    useEffect(() => {
        if (isOpen && initialValues) {
            if (initialValues.length) setLength(initialValues.length);
            if (initialValues.width) setWidth(initialValues.width);
            if (initialValues.thickness) setThickness(initialValues.thickness);
            if (initialValues.pricePerM3) setPricePerM3(initialValues.pricePerM3);
        }
    }, [isOpen, initialValues]);

    // Calculation
    // Volume (m3) = L(mm) * W(mm) * T(mm) / 1,000,000,000
    const volume = (length * width * thickness * count) / 1000000000;
    const cost = Math.floor(volume * pricePerM3);

    const handleConfirm = () => {
        onConfirm({
            cost,
            volume,
            description: `${length}x${width}x${thickness} x${count}`,
            dimensions: `${length}x${width}x${thickness}`
        });
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="relative z-10 bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-sm border border-slate-200 dark:border-slate-700"
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <Calculator size={18} /> 木材計算
                            </h3>
                            <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
                        </div>

                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-slate-500">長さ (mm)</label>
                                    <input type="number" value={length} onChange={e => setLength(Number(e.target.value))} className="w-full border p-1 rounded" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500">幅 (mm)</label>
                                    <input type="number" value={width} onChange={e => setWidth(Number(e.target.value))} className="w-full border p-1 rounded" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500">厚み (mm)</label>
                                    <input type="number" value={thickness} onChange={e => setThickness(Number(e.target.value))} className="w-full border p-1 rounded" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500">本数</label>
                                    <input type="number" value={count} onChange={e => setCount(Number(e.target.value))} className="w-full border p-1 rounded" />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-slate-500">立米単価 (円/m3)</label>
                                <input type="number" value={pricePerM3} onChange={e => setPricePerM3(Number(e.target.value))} className="w-full border p-1 rounded" />
                            </div>
                        </div>

                        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                            <div className="text-xs text-slate-500 mb-1">計算結果 (体積: {volume.toFixed(5)} m3)</div>
                            <div className="text-xl font-bold text-blue-700 dark:text-blue-300">¥{cost.toLocaleString()}</div>
                        </div>

                        <button
                            onClick={handleConfirm}
                            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg"
                        >
                            この金額を使用
                        </button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
