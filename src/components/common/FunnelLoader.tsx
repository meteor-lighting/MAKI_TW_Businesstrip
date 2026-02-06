import { Filter } from 'lucide-react';

const FunnelLoader = () => {
    return (
        <div className="fixed inset-0 bg-gray-100/80 z-50 flex flex-col items-center justify-center backdrop-blur-sm transition-opacity duration-300">
            <div className="relative">
                {/* Funnel Icon with animation */}
                <div className="animate-bounce">
                    <Filter className="w-16 h-16 text-teal-600 fill-teal-100" strokeWidth={1.5} />
                </div>

                {/* Loading text / dots */}
                <div className="mt-4 flex items-center gap-1 justify-center">
                    <span className="h-2 w-2 bg-teal-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="h-2 w-2 bg-teal-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="h-2 w-2 bg-teal-500 rounded-full animate-bounce"></span>
                </div>
                <p className="mt-2 text-sm text-teal-700 font-medium tracking-wide">Updating Fields...</p>
            </div>
        </div>
    );
};

export default FunnelLoader;
