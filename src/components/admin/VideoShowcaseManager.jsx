import React, { useEffect, useRef, useState } from 'react';
import { Film, Upload, Trash2, X, ArrowRight, ArrowLeft, Loader2, Play, Volume2, VolumeX, Power } from 'lucide-react';
import { collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { uploadVideoToCloudinary } from '../../services/uploadService';

const optimizeVideoUrl = (url) => {
    if (!url || typeof url !== 'string') return url;
    if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
    return url.replace('/upload/', '/upload/q_90,vc_auto,h_720,c_limit/');
};

const VideoShowcaseManager = ({ lang = 'ar', onBack }) => {
    const inputRef = useRef(null);
    const [videos, setVideos] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [selectedMuted, setSelectedMuted] = useState(true);
    const isRTL = lang === 'ar';

    useEffect(() => onSnapshot(collection(db, 'promotional_videos'), snap => {
        setVideos(snap.docs.map(item => ({ id: item.id, ...item.data() }))
            .sort((a, b) => Number(a.order || 0) - Number(b.order || 0)));
    }, err => { console.error(err); setError('تعذر تحميل الفيديوهات'); }), []);

    const handleUpload = async (event) => {
        const files = Array.from(event.target.files || []);
        event.target.value = '';
        if (!files.length) return;
        setError(''); setUploading(true);
        try {
            for (const file of files) {
                if (!file.type.startsWith('video/')) throw new Error('يرجى اختيار ملف فيديو فقط');
                const url = await uploadVideoToCloudinary(file, `milano-reel-${Date.now()}`);
                if (!url) throw new Error('فشل رفع الفيديو');
                const ref = doc(collection(db, 'promotional_videos'));
                await setDoc(ref, { url, title: file.name, order: videos.length, active: true, createdAt: serverTimestamp() });
            }
        } catch (err) { console.error(err); setError(err.message || 'تعذر رفع الفيديو'); }
        finally { setUploading(false); }
    };
    const removeVideo = async (id) => {
        if (!window.confirm('هل أنت متأكد من حذف هذا الفيديو؟')) return;
        await deleteDoc(doc(db, 'promotional_videos', id));
    };
    const toggleVideo = async (video) => {
        try {
            await updateDoc(doc(db, 'promotional_videos', video.id), { active: video.active === false });
        } catch (err) {
            console.error(err);
            setError('تعذر تغيير حالة الفيديو');
        }
    };

    return <div className="space-y-5 font-['Cairo']" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="rounded-[22px] border border-blue-400/30 bg-gradient-to-l from-[#172d69] to-[#13204b] text-white p-4 md:p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
            <div className="flex items-center gap-3 text-center md:text-right">
                <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center"><Film size={25} /></div>
                <div><div className="flex items-center gap-2 justify-center md:justify-start"><h2 className="text-lg md:text-xl font-black">إضافة فيديوهات متحركة</h2><span className="text-[10px] bg-blue-400/30 px-2 py-1 rounded-full font-black">ريلز المتجر</span></div><p className="text-blue-100/80 text-xs font-bold mt-1">أضف فيديوهات صامتة لعرضها في نهاية أقسام المنتجات داخل المتجر.</p></div>
            </div>
            <button onClick={onBack} className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 font-black text-xs flex items-center gap-2"><ArrowRight size={16} /> العودة لقائمة المنتجات</button>
        </div>
        <div className="bg-white dark:bg-[#15171b] rounded-[22px] border border-gray-100 dark:border-white/10 p-5 shadow-sm">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-gray-100 dark:border-white/10 pb-5">
                <div><h3 className="font-black text-gray-900 dark:text-white">إضافة فيديو جديد للمتجر</h3><p className="text-xs text-gray-400 font-bold mt-1">MP4 أو WebM — فيديو صامت — يتم رفع الملفات الكبيرة على أجزاء تلقائياً</p></div>
                <button disabled={uploading} onClick={() => inputRef.current?.click()} className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm flex items-center gap-2 disabled:opacity-60">{uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />} {uploading ? 'جارٍ الرفع...' : 'رفع فيديوهات جديدة'}</button>
                <input ref={inputRef} type="file" accept="video/mp4,video/webm,video/quicktime" multiple hidden onChange={handleUpload} />
            </div>
            {error && <div className="mt-4 p-3 rounded-xl bg-red-50 text-red-600 font-bold text-sm">{error}</div>}
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {videos.map(video => <div key={video.id} className={`relative overflow-hidden rounded-2xl bg-gray-900 aspect-[9/16] border ${video.active === false ? 'border-red-300 opacity-70' : 'border-gray-200 dark:border-white/10'} group`}>
                    <button type="button" onClick={() => { setSelectedVideo(video); setSelectedMuted(true); }} className="absolute inset-0 z-10 cursor-pointer" aria-label="فتح الفيديو" />
                    <video src={optimizeVideoUrl(video.url)} muted loop playsInline autoPlay preload="auto" className="w-full h-full object-cover" />
                    <div className="absolute inset-x-2 top-2 z-20 flex justify-between items-center"><button type="button" onClick={() => toggleVideo(video)} className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-black text-white ${video.active === false ? 'bg-red-500' : 'bg-emerald-500'}`}><Power size={12} />{video.active === false ? 'معطل' : 'نشط'}</button><button type="button" onClick={() => removeVideo(video.id)} className="w-8 h-8 rounded-lg bg-red-500/90 text-white flex items-center justify-center"><Trash2 size={15} /></button></div>
                    <div className="absolute inset-x-2 bottom-2 z-20 rounded-lg bg-black/60 text-white text-[10px] font-bold p-2 truncate">{video.title || 'فيديو المتجر'}</div>
                    <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Play size={28} className="text-white drop-shadow" /></div>
                </div>)}
                {!videos.length && <div className="col-span-full py-12 text-center text-gray-400 font-bold"><Film size={42} className="mx-auto mb-3 opacity-30" />لا توجد فيديوهات مضافة بعد</div>}
            </div>
        </div>
        {selectedVideo && <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setSelectedVideo(null)}>
            <div className="relative h-[min(84vh,720px)] w-[min(92vw,460px)] overflow-hidden rounded-[24px] bg-black shadow-2xl ring-1 ring-white/20" onClick={event => event.stopPropagation()}>
                <video src={optimizeVideoUrl(selectedVideo.url)} autoPlay loop playsInline muted={selectedMuted} controls={!selectedMuted} preload="auto" className="h-full w-full object-contain" />
                <button type="button" onClick={() => setSelectedVideo(null)} className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white"><X size={19} /></button>
                <button type="button" onClick={() => setSelectedMuted(value => !value)} className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-xl bg-black/65 px-3 py-2 text-xs font-black text-white">{selectedMuted ? <><VolumeX size={16} /> صامت</> : <><Volume2 size={16} /> تشغيل الصوت</>}</button>
            </div>
        </div>}
    </div>;
};
export default VideoShowcaseManager;
