import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';

interface SectionAccordionProps {
    title: string;
    totalAmountText: string;
    totalAmount: number; // TWD Amount
    secondaryTotalAmountText?: string;
    secondaryTotalAmount?: number;
    children: React.ReactNode;
    onExpand?: () => void;
    onCollapse?: () => void;
    actionButtonText?: {
        expand: string;
        collapse: string;
    }
}

export default function SectionAccordion({
    title,
    totalAmountText,
    totalAmount,
    secondaryTotalAmountText,
    secondaryTotalAmount,
    children,
    onExpand,
    onCollapse,
    actionButtonText = { expand: '輸入', collapse: '收合' },
    disabled = false
}: SectionAccordionProps & { disabled?: boolean }) {
    const [isOpen, setIsOpen] = useState(false);

    const toggle = () => {
        if (disabled) return;
        const nextState = !isOpen;
        setIsOpen(nextState);
        if (nextState) {
            onExpand?.();
        } else {
            onCollapse?.();
        }
    };

    return (
        <div className="border border-gray-200 rounded-lg bg-white shadow-sm mb-4 overflow-hidden transition-all duration-300">
            <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-800">{title}</h3>

                <div className="flex items-center gap-6">
                    <div className="text-gray-600 font-medium">
                        {totalAmountText}: <span className="text-blue-600 ml-1">{totalAmount.toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
                        {secondaryTotalAmountText !== undefined && secondaryTotalAmount !== undefined && (
                            <span className="ml-4 pl-4 border-l border-gray-300">
                                {secondaryTotalAmountText}: <span className="text-blue-600 ml-1">{secondaryTotalAmount.toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
                            </span>
                        )}
                    </div>

                    <button
                        onClick={toggle}
                        disabled={disabled}
                        className={clsx(
                            "flex items-center gap-2 px-4 py-2 rounded-md transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-1",
                            disabled ? "cursor-not-allowed opacity-50 bg-gray-300 text-gray-500" : (
                                isOpen
                                    ? "bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-400"
                                    : "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500"
                            )
                        )}
                    >
                        {isOpen ? (
                            <>
                                {actionButtonText.collapse} <ChevronUp size={16} />
                            </>
                        ) : (
                            <>
                                {actionButtonText.expand} <ChevronDown size={16} />
                            </>
                        )}
                    </button>
                </div>
            </div>

            {isOpen && (
                <div className="p-6 bg-white border-t border-gray-100 animate-in fade-in slide-in-from-top-4 duration-300">
                    {/* Automatic scroll to here could be added */}
                    {children}
                </div>
            )}
        </div>
    );
}
