export const getCroppedImg = (imageSrc, pixelCrop, outputSize = 1600) => {
    const createImage = (url) =>
        new Promise((resolve, reject) => {
            const image = new Image();
            image.addEventListener('load', () => resolve(image));
            image.addEventListener('error', (error) => reject(error));
            image.setAttribute('crossOrigin', 'anonymous'); // needed to avoid cross-origin issues on CodeSandbox
            image.src = url;
        });

    return new Promise(async (resolve, reject) => {
        const image = await createImage(imageSrc);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            return null;
        }

        // Keep the output square but cap its size so very large camera images do
        // not exceed the browser canvas limit or fail silently.
        const sourceWidth = Math.max(1, Number(pixelCrop.width) || 1);
        const sourceHeight = Math.max(1, Number(pixelCrop.height) || 1);
        const targetSize = Math.min(outputSize, sourceWidth, sourceHeight);
        canvas.width = Math.max(1, Math.round(targetSize));
        canvas.height = Math.max(1, Math.round(targetSize));
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // draw the cropped image
        ctx.drawImage(
            image,
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height,
            0,
            0,
            canvas.width,
            canvas.height
        );

        // As Blob
        canvas.toBlob((blob) => {
            if (!blob) {
                //reject(new Error('Canvas is empty'));
                console.error('Canvas is empty');
                return;
            }
            blob.name = 'cropped-product.jpg';
            resolve(blob);
        }, 'image/jpeg', 0.95);
    });
};
