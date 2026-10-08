import React, { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, ArrowRight, ArrowLeft, Settings, X, Search, Image as ImageIcon } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, getDoc, orderBy, limit } from 'firebase/firestore';
import { uploadChatMedia } from '../../services/uploadService';

const AdminChatView = ({ chatId, onBack, lang = 'ar' }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [chatDetails, setChatDetails] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    const t = {
        ar: {
            loading_chat: "تحميل...",
            online: "متصل الآن",
            settings_title: "الإعدادات",
            close_chat: "إغلاق المحادثة",
            loading_msgs: "جاري تحميل المحادثة...",
            uploading: "جاري رفع الملف...",
            closed_msg: "تم إغلاق هذه المحادثة ولا يمكن إرسال رسائل جديدة",
            type_placeholder: "اكتب ردك هنا...",
            just_now: "حالا"
        },
        en: {
            loading_chat: "Loading...",
            online: "Online",
            settings_title: "Settings",
            close_chat: "Close Chat",
            loading_msgs: "Loading chat...",
            uploading: "Uploading file...",
            closed_msg: "This chat is closed and cannot receive new messages",
            type_placeholder: "Type your reply here...",
            just_now: "Just now"
        }
    };

    const txt = t[lang];
    const isRTL = lang === 'ar';

    // Fetch Chat Details
    useEffect(() => {
        const fetchChatDetails = async () => {
            if (!chatId) return;
            try {
                const docRef = doc(db, "contact_messages", chatId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setChatDetails(docSnap.data());
                }
            } catch (error) {
                console.error("Error fetching chat details:", error);
            }
        };
        fetchChatDetails();
    }, [chatId]);

    // Real-time Messages
    useEffect(() => {
        if (!chatId) return;

        const q = query(
            collection(db, "contact_messages", chatId, "messages"),
            orderBy("createdAt", "asc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMessages(msgs);
            scrollToBottom();
        });

        return () => unsubscribe();
    }, [chatId]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Centralized upload service used instead of local function

    const chatMediaError = error => {
        const code = error?.message || '';
        if (code === 'CHAT_MEDIA_TYPE_NOT_ALLOWED') return lang === 'ar'
            ? 'يسمح بإرسال الصور (JPEG، PNG، GIF، WEBP) أو الفيديوهات (MP4، WEBM، MOV) فقط.'
            : 'Only JPEG, PNG, GIF, WEBP images or MP4, WEBM, MOV videos can be sent.';
        if (code === 'CHAT_VIDEO_TOO_LARGE') return lang === 'ar'
            ? 'حجم الفيديو كبير جداً. الحد الأقصى 30 ميجابايت.'
            : 'The video is too large. Maximum size is 30 MB.';
        if (code === 'CHAT_IMAGE_TOO_LARGE') return lang === 'ar'
            ? 'حجم الصورة كبير جداً. الحد الأقصى 10 ميجابايت.'
            : 'The image is too large. Maximum size is 10 MB.';
        return lang === 'ar' ? 'تعذّر رفع الملف. حاول مرة أخرى.' : 'The file could not be uploaded. Please try again.';
    };

    const handleFileUpload = async event => {
        const input = event.target;
        const file = input.files?.[0];
        if (!file || !chatId) { input.value = ''; return; }

        try {
            setIsUploading(true);
            const media = await uploadChatMedia(file);
            await addDoc(collection(db, 'contact_messages', chatId, 'messages'), {
                text: '',
                mediaUrl: media.url,
                mediaType: media.mediaType,
                fileName: media.name,
                fileSize: media.bytes,
                // Compatibility for older image-only message readers.
                imageUrl: media.mediaType === 'image' ? media.url : '',
                sender: 'admin',
                createdAt: serverTimestamp(),
            });
            await updateDoc(doc(db, 'contact_messages', chatId), { status: 'replied' });
        } catch (error) {
            console.error('Admin chat media upload failed:', error);
            alert(chatMediaError(error));
        } finally {
            setIsUploading(false);
            input.value = '';
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !chatId) return;

        try {
            await addDoc(collection(db, "contact_messages", chatId, "messages"), {
                text: newMessage,
                sender: 'admin',
                createdAt: serverTimestamp(),
            });
            setNewMessage('');
            // Update main doc status to replied
            await updateDoc(doc(db, "contact_messages", chatId), { status: 'replied' });
        } catch (error) {
            console.error("Error sending message:", error);
        }
    };

    const handleCloseChat = async () => {
        if (!chatId) return;
        try {
            await updateDoc(doc(db, "contact_messages", chatId), { status: 'closed' });
            setShowSettings(false);
        } catch (error) {
            console.error("Error closing chat:", error);
        }
    };

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col bg-gray-50 dark:bg-zinc-950 font-['Cairo'] overflow-hidden rounded-[32px] border border-gray-100 dark:border-white/5 shadow-sm relative" dir={isRTL ? "rtl" : "ltr"}>

            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 px-6 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors text-gray-500"
                    >
                        {isRTL ? <ArrowRight size={24} /> : <ArrowLeft size={24} />}
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-black text-lg">
                            {chatDetails?.name?.charAt(0) || 'U'}
                        </div>
                        <div className={`${isRTL ? 'text-right' : 'text-left'} `}>
                            <h2 className="font-black text-gray-800 dark:text-white text-base leading-none mb-1">
                                {chatDetails?.name || txt.loading_chat}
                            </h2>
                            <span className="text-[10px] font-bold text-green-500">{txt.online}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 relative">

                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`p - 2.5 transition - colors rounded - xl ${showSettings ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-blue-500'} `}
                        title={txt.settings_title}
                    >
                        <Settings size={20} />
                    </button>

                    {/* Settings Dropdown */}
                    {showSettings && (
                        <div className={`absolute top - full ${isRTL ? 'left-0' : 'right-0'} mt - 2 w - 48 bg - white dark: bg - zinc - 800 rounded - 2xl shadow - xl border border - gray - 100 dark: border - white / 5 overflow - hidden z - 50`}>
                            <button
                                onClick={handleCloseChat}
                                className={`w - full ${isRTL ? 'text-right' : 'text-left'} px - 4 py - 3 text - red - 500 hover: bg - red - 50 dark: hover: bg - red - 500 / 10 transition - colors text - sm font - bold flex items - center gap - 2`}
                            >
                                <X size={16} />
                                {txt.close_chat}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Messages Area */}
            <div className="chat-dot-pattern flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide bg-[#f0f2f5] dark:bg-[#0a0a0b]">
                {!chatId && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <p>{txt.loading_msgs}</p>
                    </div>
                )}

                {messages.map((msg) => {
                    const mediaUrl = msg.mediaUrl || msg.imageUrl;
                    const isVideo = msg.mediaType === 'video' || (!msg.mediaType && /\.(mp4|webm|mov)(?:[?#]|$)/i.test(mediaUrl || ''));
                    return <div key={msg.id} className={`flex ${msg.sender === 'admin' ? (isRTL ? 'flex-row' : 'flex-row-reverse') : (isRTL ? 'flex-row-reverse' : 'flex-row')} items-end gap-3`}>
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white dark:border-zinc-800 shadow-sm flex-shrink-0">
                            <img
                                src={msg.sender === 'admin' ? "/logo.jpg" : "/user-icon.png"}
                                alt="avatar"
                                className="w-full h-full object-cover"
                                onError={(e) => e.target.src = "/logo.jpg"}
                            />
                        </div>

                        {/* Bubble */}
                        <div className={`max-w-[70%] relative group ${mediaUrl ? 'p-1.5 rounded-2xl' : 'px-5 py-3 rounded-2xl'
                            } ${msg.sender === 'admin'
                                ? 'bg-[#3b82f6] text-white rounded-br-sm'
                                : 'bg-white dark:bg-zinc-900 text-gray-800 dark:text-gray-200 rounded-bl-sm border border-gray-100 dark:border-white/5 shadow-sm'
                            } `}>
                            {mediaUrl ? (
                                <div className="space-y-1">
                                    <div className="max-w-[300px] overflow-hidden rounded-xl bg-gray-50/10">
                                        {isVideo ? (
                                            <video src={mediaUrl} controls preload="metadata" className="block max-h-[300px] w-full bg-black" />
                                        ) : (
                                            <img src={mediaUrl} alt="attachment" className="w-full h-auto cursor-zoom-in hover:brightness-95 transition-all" onClick={() => setSelectedImage(mediaUrl)} />
                                        )}
                                    </div>
                                    <span className={`text-[8px] block ${msg.sender === 'admin' ? 'text-blue-100' : 'text-gray-400'}`}>
                                        {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : txt.just_now}
                                    </span>
                                </div>
                            ) : (
                                <>
                                    <p className="text-sm font-bold leading-relaxed">{msg.text}</p>
                                    <span className={`text-[8px] block mt-1 ${msg.sender === 'admin' ? 'text-blue-100' : 'text-gray-400'}`}>
                                        {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : txt.just_now}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>;
                })}

                {isUploading && (
                    <div className="flex justify-center py-2">
                        <span className="text-xs text-blue-500 font-black animate-pulse">{txt.uploading}</span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area or Closed Message */}
            {chatDetails?.status === 'closed' || chatDetails?.status === 'closed_by_buyer' ? (
                <div className="bg-gray-50 dark:bg-zinc-900 p-4 border-t border-gray-100 dark:border-white/5 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-500 rounded-xl text-sm font-bold">
                        <X size={16} />
                        <span>{txt.closed_msg}</span>
                    </div>
                </div>
            ) : (
                <div className="bg-white dark:bg-zinc-900 p-4 border-t border-gray-100 dark:border-white/5">
                    <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex items-center gap-3">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            className="hidden"
                            accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
                        />

                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-all disabled:opacity-50"
                        >
                            <Paperclip size={22} className={isUploading ? 'animate-spin text-blue-500' : ''} />
                        </button>

                        <div className="flex-1 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/5 rounded-2xl flex items-center px-4 py-1.5 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                            <textarea
                                rows="1"
                                placeholder={txt.type_placeholder}
                                className="w-full bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-400 font-bold text-sm py-2 resize-none"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage(e);
                                    }
                                }}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={!newMessage.trim() || isUploading}
                            className="w-11 h-11 bg-[#3b82f6] hover:bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Send size={20} className={`transform ${isRTL ? 'rotate-180' : ''} `} />
                        </button>
                    </form>
                </div>
            )}

            {/* Image Zoom Modal */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
                    onClick={() => setSelectedImage(null)}
                >
                    <div className="relative max-w-full max-h-full" onClick={e => e.stopPropagation()}>
                        <img
                            src={selectedImage}
                            alt="Preview"
                            className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl"
                        />
                        <button
                            className={`absolute - top - 14 ${isRTL ? 'left-0' : 'right-0'} text - white hover: text - gray - 300 transition - colors`}
                            onClick={() => setSelectedImage(null)}
                        >
                            <X size={40} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminChatView;
