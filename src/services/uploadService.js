/**
 * Centralized service for uploading files to Cloudinary.
 * Uses environment variables for configuration.
 */

export const uploadToCloudinary = async (file, fileName = 'image') => {
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

    if (!uploadPreset || !cloudName) {
        console.error("Cloudinary configuration missing in environment variables.");
        return null;
    }

    const formData = new FormData();

    // Handle both File objects and Blobs
    if (file instanceof Blob && !(file instanceof File)) {
        formData.append("file", file, fileName + '.jpg');
    } else {
        formData.append("file", file);
    }

    formData.append("upload_preset", uploadPreset);
    formData.append("cloud_name", cloudName);

    try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: "POST",
            body: formData,
        });

        const data = await res.json();

        if (data.secure_url) {
            return data.secure_url;
        } else {
            console.error("Cloudinary Upload Error Details:", data);
            throw new Error(data.error?.message || "Cloudinary Upload Failed");
        }
    } catch (error) {
        console.error("Error in uploadToCloudinary service:", error);
        return null;
    }
};
