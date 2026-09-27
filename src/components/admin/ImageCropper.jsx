import React, { useState, useRef, useEffect } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css'; // Import the CSS for the new library
import { X, Check } from 'lucide-react';
import { getCroppedImg } from '../../lib/cropUtils';

// Helper to center the crop initially
function centerAspectCrop(mediaWidth, mediaHeight, aspect) {
    return centerCrop(
        makeAspectCrop(
            {
                unit: '%',
                width: 90,
            },
            aspect,
            mediaWidth,
            mediaHeight,
        ),
        mediaWidth,
        mediaHeight,
    )
}

const ImageCropper = ({ imageSrc, onCropComplete, onCancel }) => {
    const [crop, setCrop] = useState();
    const [completedCrop, setCompletedCrop] = useState(null);
    const [loading, setLoading] = useState(false);
    const imgRef = useRef(null);

    // Initial load: Set a default crop covering most of the image
    const onImageLoad = (e) => {
        const { width, height } = e.currentTarget;
        // Start with a 1:1 square aspect ratio crop centered
        const newCrop = centerAspectCrop(width, height, 1);
        setCrop(newCrop);
        setCompletedCrop(newCrop);
    }

    const handleSave = async () => {
        if (!completedCrop || !imgRef.current) return;

        const image = imgRef.current;
        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;

        const pixelCrop = {
            x: completedCrop.x * scaleX,
            y: completedCrop.y * scaleY,
            width: completedCrop.width * scaleX,
            height: completedCrop.height * scaleY,
        };

        setLoading(true);
        try {
            const croppedImageBlob = await getCroppedImg(imageSrc, pixelCrop);
            onCropComplete(croppedImageBlob);
        } catch (e) {
            console.error(e);
            alert("حدث خطأ أثناء قص الصورة");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl overflow-hidden w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white z-10 shrink-0">
                    <h3 className="font-black text-lg text-gray-800">قص الصورة (مقاس مربع 1:1)</h3>
                    <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full transition">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Cropper Area - using ReactCrop now */}
                <div className="relative flex-1 bg-gray-900 overflow-auto flex items-center justify-center p-4">
                    <ReactCrop
                        crop={crop}
                        onChange={(_, percentCrop) => setCrop(percentCrop)}
                        onComplete={(c) => setCompletedCrop(c)}
                        aspect={1}
                        className="max-h-full"
                    >
                        <img
                            ref={imgRef}
                            src={imageSrc}
                            alt="Crop me"
                            onLoad={onImageLoad}
                            style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }}
                        />
                    </ReactCrop>
                </div>

                {/* Controls */}
                <div className="px-6 py-4 bg-white border-t border-gray-100 shrink-0">
                    <p className="text-center text-xs text-gray-400 font-bold mb-4">
                        الآن يمكنك سحب أركان المربع الأزرق لتحديد الجزء المطلوب
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition"
                        >
                            إلغاء
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="flex-1 py-3 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 transition shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                        >
                            {loading ? 'جاري المعالجة...' : (
                                <>
                                    <Check size={18} />
                                    قص واستخدام
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImageCropper;
