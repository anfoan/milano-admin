import React, { useState, useEffect } from 'react';
import { Star, MessageSquare, Trash2, User, X, Send, Pencil } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';

const ReviewsView = ({ lang = 'ar' }) => {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);

    // Reply Modal State
    const [replyModalOpen, setReplyModalOpen] = useState(false);
    const [selectedReview, setSelectedReview] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const t = {
        ar: {
            title: "آراء العملاء",
            customer: "العميل",
            rating: "التقييم",
            comment: "التعليق",
            date: "التاريخ",
            actions: "تحكم",
            loading: "جاري التحميل...",
            no_reviews: "لا يوجد تقييمات حتى الآن",
            reply_label: "ردك:",
            reply_title: "الرد على تقييم",
            reply_placeholder: "اكتب ردك هنا...",
            send: "إرسال الرد",
            cancel: "إلغاء",
            delete_confirm: "هل أنت متأكد من حذف هذا التقييم؟",
            delete_success: "تم الحذف بنجاح",
            reply_success: "تم حفظ الرد بنجاح",
            error: "حدث خطأ",
            missing_reply: "يرجى كتابة نص الرد",
            chars_remaining: "حرف متبقي"
        },
        en: {
            title: "Customer Reviews",
            customer: "Customer",
            rating: "Rating",
            comment: "Comment",
            date: "Date",
            actions: "Actions",
            loading: "Loading...",
            no_reviews: "No reviews yet",
            reply_label: "Your Reply:",
            reply_title: "Reply to Review",
            reply_placeholder: "Write your reply here...",
            send: "Send Reply",
            cancel: "Cancel",
            delete_confirm: "Are you sure you want to delete this review?",
            delete_success: "Deleted successfully",
            reply_success: "Reply saved successfully",
            error: "An error occurred",
            missing_reply: "Please enter a reply message",
            chars_remaining: "chars remaining"
        }
    };

    const txt = t[lang];
    const isRTL = lang === 'ar';
    const MAX_CHARS = 500;

    useEffect(() => {
        const q = query(collection(db, "reviews"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedReviews = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setReviews(fetchedReviews);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const openReplyModal = (review) => {
        setSelectedReview(review);
        setReplyText(review.replyText || '');
        setReplyModalOpen(true);
    };

    const closeReplyModal = () => {
        setReplyModalOpen(false);
        setSelectedReview(null);
        setReplyText('');
        setIsSubmitting(false);
    };

    const handleSaveReply = async () => {
        if (!replyText.trim()) return alert(txt.missing_reply);
        if (isSubmitting) return;

        setIsSubmitting(true);
        try {
            const reviewRef = doc(db, "reviews", selectedReview.id);
            await updateDoc(reviewRef, {
                replyText: replyText.trim().slice(0, MAX_CHARS), // Ensure limit server-side too
                replyDate: new Date().toISOString()
            });
            alert(txt.reply_success);
            closeReplyModal();
        } catch (error) {
            console.error("Error saving reply:", error);
            alert(txt.error);
            setIsSubmitting(false);
        }
    };

    const deleteReview = async (id) => {
        if (!window.confirm(txt.delete_confirm)) return;
        try {
            await deleteDoc(doc(db, "reviews", id));
        } catch (error) {
            console.error("Error deleting review:", error);
            alert(txt.error);
        }
    };

    return (
        <div className="space-y-6 font-['Cairo']" dir={isRTL ? "rtl" : "ltr"}>
            <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
                <h2 className="text-2xl font-black text-gray-800 mb-6 flex items-center gap-2">
                    <Star className="text-yellow-500" fill="currentColor" />
                    {txt.title}
                </h2>

                <div className="overflow-x-auto">
                    <table className={`w-full ${isRTL ? 'text-right' : 'text-left'}`}>
                        <thead className="bg-gray-50 text-gray-600 border-b border-gray-100">
                            <tr>
                                <th className={`p-4 font-bold ${isRTL ? 'rounded-r-xl' : 'rounded-l-xl'}`}>{txt.customer}</th>
                                <th className="p-4 font-bold">{txt.rating}</th>
                                <th className="p-4 font-bold md:w-1/2">{txt.comment}</th>
                                <th className="p-4 font-bold">{txt.date}</th>
                                <th className={`p-4 font-bold ${isRTL ? 'rounded-l-xl' : 'rounded-r-xl'}`}>{txt.actions}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr><td colSpan="5" className="p-8 text-center text-gray-400">{txt.loading}</td></tr>
                            ) : reviews.length === 0 ? (
                                <tr><td colSpan="5" className="p-8 text-center text-gray-400 font-bold">{txt.no_reviews}</td></tr>
                            ) : (
                                reviews.map((review) => (
                                    <tr key={review.id} className="group hover:bg-gray-50 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">
                                                    <User size={20} />
                                                </div>
                                                <span className="font-bold text-gray-800">{review.name}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex text-yellow-500">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star key={i} size={14} fill={i < review.rating ? "currentColor" : "none"} className={i >= review.rating ? "text-gray-200" : ""} />
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <p className="text-gray-600 text-sm leading-relaxed max-w-lg">{review.message}</p>
                                            {review.replyText && (
                                                <div className="mt-2 text-xs bg-blue-50 text-blue-800 p-2 rounded-lg border border-blue-100">
                                                    <span className="font-bold">{txt.reply_label} </span> {review.replyText}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <span className="text-xs font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded-lg dir-ltr">
                                                {review.createdAt?.seconds
                                                    ? new Date(review.createdAt.seconds * 1000).toISOString().slice(0, 19).replace('T', ' ')
                                                    : (review.time || 'N/A')}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => openReplyModal(review)}
                                                    className="p-2.5 bg-green-500/15 text-green-600 hover:bg-green-500/25 rounded-xl transition-all shadow-sm"
                                                    title={txt.reply_title}
                                                >
                                                    <MessageSquare size={18} />
                                                </button>
                                                <button
                                                    onClick={() => openReplyModal(review)}
                                                    className="p-2.5 bg-blue-500/15 text-blue-600 hover:bg-blue-500/25 rounded-xl transition-all shadow-sm"
                                                    title={lang === 'ar' ? 'تعديل الرد' : 'Edit Reply'}
                                                >
                                                    <Pencil size={18} />
                                                </button>
                                                <button
                                                    onClick={() => deleteReview(review.id)}
                                                    className="p-2.5 bg-red-500/15 text-red-600 hover:bg-red-500/25 rounded-xl transition-all shadow-sm"
                                                    title={lang === 'ar' ? 'حذف التقييم' : 'Delete Review'}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Reply Modal */}
            <AnimatePresence>
                {replyModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                        onClick={closeReplyModal}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl"
                            onClick={e => e.stopPropagation()}
                            dir={isRTL ? "rtl" : "ltr"}
                        >
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold text-gray-800">{txt.reply_title}</h3>
                                <button onClick={closeReplyModal} className="text-gray-400 hover:text-gray-600">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="mb-4 bg-gray-50 p-4 rounded-xl">
                                <p className="text-sm text-gray-600 italic">"{selectedReview?.message}"</p>
                            </div>

                            <div className="relative">
                                <textarea
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    placeholder={txt.reply_placeholder}
                                    maxLength={MAX_CHARS}
                                    className="w-full h-32 p-4 bg-white border border-gray-200 rounded-xl focus:border-blue-500 outline-none resize-none font-bold text-gray-700"
                                />
                                <span className="absolute bottom-3 left-3 text-xs font-bold text-gray-400">
                                    {MAX_CHARS - replyText.length} {txt.chars_remaining}
                                </span>
                            </div>

                            <div className="flex justify-end gap-3 mt-4">
                                <button
                                    onClick={closeReplyModal}
                                    disabled={isSubmitting}
                                    className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
                                >
                                    {txt.cancel}
                                </button>
                                <button
                                    onClick={handleSaveReply}
                                    disabled={isSubmitting}
                                    className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <Send size={18} />
                                    )}
                                    <span>{txt.send}</span>
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ReviewsView;
