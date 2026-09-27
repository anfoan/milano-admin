import { useState } from 'react';
import { ShoppingBag } from 'lucide-react';

const ImageWithFallback = ({ src, alt, className }) => {
    const [error, setError] = useState(false);

    if (!src || error) {
        return (
            <div className={`flex items-center justify-center bg-gray-100 text-gray-400 rounded-lg ${className}`}>
                <ShoppingBag size={24} />
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={alt}
            className={className}
            onError={() => setError(true)}
            draggable="false"
        />
    );
};

export default ImageWithFallback;
