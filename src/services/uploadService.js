/**
 * Cloudinary upload helpers.
 * Product uploads keep using the configured image uploader. Chat media uses the
 * store's existing unsigned chat preset as a safe fallback when local Vite
 * variables are not available, so the customer and admin use one compatible path.
 */

const CHAT_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CHAT_CLOUD_NAME
    || import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
    || 'dgknc2shk';
const CHAT_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_CHAT_UPLOAD_PRESET
    || import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
    || 'milano_upload';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;

export const getChatMediaType = file => {
    if (IMAGE_TYPES.has(file?.type)) return 'image';
    if (VIDEO_TYPES.has(file?.type)) return 'video';
    return null;
};

export const uploadChatMedia = async file => {
    const mediaType = getChatMediaType(file);
    if (!mediaType) throw new Error('CHAT_MEDIA_TYPE_NOT_ALLOWED');
    if (file.size > (mediaType === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)) {
        throw new Error(mediaType === 'video' ? 'CHAT_VIDEO_TOO_LARGE' : 'CHAT_IMAGE_TOO_LARGE');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CHAT_UPLOAD_PRESET);

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CHAT_CLOUD_NAME}/${mediaType}/upload`,
        { method: 'POST', body: formData }
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.secure_url) {
        throw new Error(payload?.error?.message || 'CHAT_MEDIA_UPLOAD_FAILED');
    }

    return {
        url: payload.secure_url,
        mediaType,
        name: file.name || `${mediaType}-attachment`,
        bytes: Number(file.size || 0),
    };
};

// Store settings use the existing unsigned Milano uploader as a fallback.
// This keeps profile, invoice, and brand images working even when preview builds do
// not inject Vite environment variables.
const SETTINGS_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_SETTINGS_CLOUD_NAME
    || import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
    || CHAT_CLOUD_NAME;
const SETTINGS_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_SETTINGS_UPLOAD_PRESET
    || import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
    || CHAT_UPLOAD_PRESET;

const appendImageFile = (formData, file, fileName) => {
    if (file instanceof Blob && !(file instanceof File)) {
        formData.append('file', file, `${fileName}.jpg`);
    } else {
        formData.append('file', file);
    }
};

export const uploadSettingsImage = async (file, fileName = 'store-image') => {
    const formData = new FormData();
    appendImageFile(formData, file, fileName);
    formData.append('upload_preset', SETTINGS_UPLOAD_PRESET);
    formData.append('cloud_name', SETTINGS_CLOUD_NAME);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${SETTINGS_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.secure_url) {
        throw new Error(payload?.error?.message || 'SETTINGS_IMAGE_UPLOAD_FAILED');
    }
    return payload.secure_url;
};

// Existing product upload API: intentionally retains its environment-only behavior.
export const uploadToCloudinary = async (file, fileName = 'image') => {
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

    if (!uploadPreset || !cloudName) {
        console.error('Cloudinary configuration missing in environment variables.');
        return null;
    }

    const formData = new FormData();
    if (file instanceof Blob && !(file instanceof File)) {
        formData.append('file', file, `${fileName}.jpg`);
    } else {
        formData.append('file', file);
    }
    formData.append('upload_preset', uploadPreset);
    formData.append('cloud_name', cloudName);

    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: 'POST',
            body: formData,
        });
        const payload = await response.json();
        if (payload.secure_url) return payload.secure_url;
        console.error('Cloudinary upload error:', payload);
        return null;
    } catch (error) {
        console.error('Error in uploadToCloudinary service:', error);
        return null;
    }
};

// Promotional storefront reels use the same unsigned Cloudinary account as settings.
export const uploadVideoToCloudinary = async (file, fileName = 'promotional-video') => {
    if (!file || !String(file.type || '').startsWith('video/')) return null;
    // Cloudinary's resumable upload accepts sequential chunks, so duration and
    // file size are not constrained by the browser request body.
    const chunkSize = 20 * 1024 * 1024;
    const uploadId = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`).replace(/-/g, '');
    let uploadedUrl = null;
    for (let start = 0; start < file.size; start += chunkSize) {
        const end = Math.min(start + chunkSize, file.size) - 1;
        const formData = new FormData();
        formData.append('file', file.slice(start, end + 1), fileName);
        formData.append('upload_preset', SETTINGS_UPLOAD_PRESET);
        formData.append('cloud_name', SETTINGS_CLOUD_NAME);
        const response = await fetch(`https://api.cloudinary.com/v1_1/${SETTINGS_CLOUD_NAME}/video/upload`, {
            method: 'POST',
            headers: { 'Content-Range': `bytes ${start}-${end}/${file.size}`, 'X-Unique-Upload-Id': uploadId },
            body: formData,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error?.message || 'VIDEO_UPLOAD_FAILED');
        if (payload.secure_url) uploadedUrl = payload.secure_url;
    }
    return uploadedUrl;
};
