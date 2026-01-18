/**
 * DispatchScreen.tsx
 * JBWOS Enterprise: Stock & Dispatch Board
 * 
 * 思想:
 * 1. Grab (Pull) First: 自律的に仕事を掴み取る
 * 2. Visual Package: Stockは「箱」として見せる
 */
import React, { useEffect } from 'react';
import { useStocks } from '../hooks/useStocks';
import { Package, ArrowRight } from 'lucide-react';

export const DispatchScreen: React.FC = () => {
    const { stocks, loading, fetchStocks } = useStocks();

    useEffect(() => {
        fetchStocks();
    }, [fetchStocks]);

    return (
        <div className="h-full flex bg-gray-50">
            {/* Left: Stock Pool (Shop Floor) */}
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Package className="w-5 h-5 text-gray-600" />
                        Stock Pool
                        <span className="text-xs font-normal text-gray-500 ml-auto">
                            {stocks.length} packages
                        </span>
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">
                        Inboxに入る前の未割当ジョブ
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {loading ? (
                        <div className="p-4 text-center text-gray-400">Loading...</div>
                    ) : stocks.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm">
                            No stocks available.<br />Clean floor!
                        </div>
                    ) : (
                        stocks.map(stock => (
                            <div key={stock.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing group">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-medium text-gray-800 line-clamp-2">{stock.title}</h3>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${stock.estimatedMinutes > 180 ? 'bg-orange-100 text-orange-700' :
                                        stock.estimatedMinutes > 60 ? 'bg-blue-100 text-blue-700' :
                                            'bg-green-100 text-green-700'
                                        }`}>
                                        {Math.round(stock.estimatedMinutes / 60 * 10) / 10}h
                                    </span>
                                </div>
                                <div className="flex justify-between items-center mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-xs text-gray-400">Drag to assign</span>
                                    <button className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded flex items-center gap-1">
                                        Grab <ArrowRight className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Right: Staff Lanes (Calendar/Kanban) */}
            <div className="flex-1 p-6 overflow-x-auto">
                <header className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">Dispatch Board</h1>
                    <p className="text-gray-500 text-sm">Manage team workload and assignments.</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Mock Employee Lane */}
                    {['Employee A', 'Employee B', 'Employee C'].map(name => (
                        <div key={name} className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-[600px]">
                            <div className="p-4 border-b border-gray-200 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                                    {name[0]}
                                </div>
                                <div>
                                    <div className="font-bold text-gray-800">{name}</div>
                                    <div className="text-xs text-gray-500">Capacity: 8.0h / day</div>
                                </div>
                            </div>
                            <div className="flex-1 bg-gray-50/50 p-2">
                                <div className="h-full border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-sm">
                                    Drop items here or use "Grab" from Stock
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
