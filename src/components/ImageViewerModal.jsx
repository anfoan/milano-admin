import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, ZoomIn, Play, Maximize, Grid, Pause } from 'lucide-react';

const ImageViewerModal = ({ isOpen, onClose, images, initialIndex = 0 }) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isZoomed, setIsZoomed] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setCurrentIndex(initialIndex);
            setIsPlaying(false);
            setIsZoomed(false);
            document.body.style.overflow = 'hidden'; // Prevent scrolling
        } else {
            document.body.style.overflow = 'unset';
            setIsPlaying(false); // Stop slideshow
        }
    }, [isOpen, initialIndex]);

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') handleNext();
            if (e.key === 'ArrowLeft') handlePrev();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, currentIndex]); // Depend on currentIndex if we used state updater correctly, but standard closure handling is fine usually or use updater.

    // Slideshow
    useEffect(() => {
        let interval;
        if (isPlaying && isOpen) {
            interval = setInterval(() => {
                setCurrentIndex((prev) => (prev + 1) % images.length);
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [isPlaying, isOpen, images.length]);

    const handleNext = (e) => {
        e?.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % images.length);
    };

    const handlePrev = (e) => {
        e?.stopPropagation();
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch((e) => console.log(e));
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-between py-4"
                dir="ltr" // Force LTR for the interface layout (Counter Left, Close Right as in screenshot)
                onClick={onClose} // Clicking backdrop closes
            >
                {/* Top Bar */}
                <div className="w-full flex items-center justify-between px-6 py-2 text-white z-50">
                    <span className="text-lg font-medium">{currentIndex + 1} / {images.length}</span>
                    <div className="flex items-center gap-4">
                        <button onClick={(e) => { e.stopPropagation(); setIsZoomed(!isZoomed); }} className="hover:text-blue-500 transition-colors"><ZoomIn size={24} /></button>
                        <button onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }} className="hover:text-blue-500 transition-colors">
                            {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); toggleFullScreen(); }} className="hover:text-blue-500 transition-colors"><Maximize size={24} /></button>
                        {/* Grid Icon - Optional/Placeholder functionality */}
                        <button onClick={(e) => e.stopPropagation()} className="hover:text-blue-500 transition-colors hidden md:block"><Grid size={24} /></button>
                        <button onClick={onClose} className="hover:text-red-500 transition-colors"><X size={32} /></button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 w-full flex items-center justify-center relative px-4" onClick={(e) => e.stopPropagation()}>
                    {/* Prev Button */}
                    <button
                        onClick={handlePrev}
                        className="absolute left-4 p-2 rounded-full bg-black/50 hover:bg-white/20 text-white transition-all hidden md:flex"
                    >
                        <ChevronLeft size={40} />
                    </button>

                    {/* Image */}
                    <div className={`relative transition-transform duration-300 ${isZoomed ? 'scale-150 cursor-zoom-out' : 'cursor-zoom-in'}`}
                        onClick={() => setIsZoomed(!isZoomed)}
                    >
                        <img
                            src={images[currentIndex]}
                            alt={`View ${currentIndex + 1}`}
                            className="max-h-[70vh] md:max-h-[80vh] w-auto max-w-full object-contain select-none"
                            draggable={false}
                        />
                    </div>

                    {/* Next Button */}
                    <button
                        onClick={handleNext}
                        className="absolute right-4 p-2 rounded-full bg-black/50 hover:bg-white/20 text-white transition-all hidden md:flex"
                    >
                        <ChevronRight size={40} />
                    </button>
                </div>

                {/* Bottom Section */}
                <div className="w-full flex flex-col items-center gap-4 z-50 px-4 pb-2" onClick={(e) => e.stopPropagation()}>
                    <span className="text-gray-400 text-sm">Image</span>

                    {/* Thumbnails */}
                    <div className="flex gap-2 overflow-x-auto max-w-full pb-2 no-scrollbar px-4">
                        {images.map((img, idx) => (
                            <button
                                key={idx}
                                onClick={() => setCurrentIndex(idx)}
                                className={`relative w-16 h-20 md:w-20 md:h-24 shrink-0 rounded-md overflow-hidden border-2 transition-all ${currentIndex === idx ? 'border-blue-500 opacity-100' : 'border-transparent opacity-50 hover:opacity-80'
                                    }`}
                            >
                                <img src={img} alt={`Thumb ${idx}`} className="w-full h-full object-cover" />
                            </button>
                        ))}
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default ImageViewerModal;
