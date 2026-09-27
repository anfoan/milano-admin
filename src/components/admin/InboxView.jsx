import React, { useState, useEffect } from 'react';
import { Search, Filter, RefreshCw, Trash2, Mail, MessageSquare, XCircle, CheckCircle } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, limit, getDocs, onSnapshot, deleteDoc, doc } from 'firebase/firestore';

const InboxView = ({ onOpenChat, lang = 'ar' }) => {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);

    const t = {
        ar: {
            search_placeholder: "ابحث عن البريد الإلكتروني / اسم العميل / الحالة",
            search_btn: "بحث",
            name: "الاسم",
            subject: "الموضوع",
            email: "البريد الالكتروني",
            block_list: "قائمة الحظر",
            date: "تاريخ الإنشاء",
            status: "الحالة",
            actions: "عمليات",
            loading: "جاري تحميل الرسائل...",
            no_messages: "لا توجد رسائل حالياً",
            blocked_yes: "نعم",
            blocked_no: "لا",
            delete_confirm: "هل أنت متأكد من حذف هذه الرسالة؟",
            delete_error: "حدث خطأ أثناء الحذف",
            open_chat: "فتح المحادثة",
            delete: "حذف",
            status_new: 'لم يتم الرد',
            status_pending: 'انتظار رد العميل',
            status_replied: 'تم الرد',
            status_closed_by_buyer: 'مغلق من قبل العميل',
            status_closed: 'مغلق من قبل المتجر'
        },
        en: {
            search_placeholder: "Search Email / Name / Status",
            search_btn: "Search",
            name: "Name",
            subject: "Subject",
            email: "Email",
            block_list: "Block List",
            date: "Date",
            status: "Status",
            actions: "Actions",
            loading: "Loading messages...",
            no_messages: "No messages found",
            blocked_yes: "Yes",
            blocked_no: "No",
            delete_confirm: "Are you sure you want to delete this message?",
            delete_error: "Error deleting message",
            open_chat: "Open Chat",
            delete: "Delete",
            status_new: 'New',
            status_pending: 'Pending User',
            status_replied: 'Replied',
            status_closed_by_buyer: 'Closed by Customer',
            status_closed: 'Closed'
        }
    };

    const txt = t[lang];
    const isRTL = lang === 'ar';

    useEffect(() => {
        setLoading(true);
        // Real-time listener for contact messages
        const q = query(
            collection(db, "contact_messages"),
            orderBy("createdAt", "desc"),
            limit(50)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                // Fallback for status/date if missing
                status: doc.data().status || 'new',
                date: doc.data().date || 'Unknown Date',
                // Add visual props based on status
                statusLabel: getStatusLabel(doc.data().status),
                statusColor: getStatusColor(doc.data().status)
            }));
            setMessages(msgs);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching messages:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [lang]); // Re-run if lang changes to update status labels? Actually cleaner to do it in render or separate function

    const handleDelete = async (id) => {
        if (window.confirm(txt.delete_confirm)) {
            try {
                await deleteDoc(doc(db, "contact_messages", id));
            } catch (error) {
                console.error("Error deleting message:", error);
                alert(txt.delete_error);
            }
        }
    };

    const getStatusLabel = (status) => {
        const map = {
            'new': txt.status_new,
            'pending': txt.status_pending,
            'replied': txt.status_replied,
            'closed_by_buyer': txt.status_closed_by_buyer,
            'closed': txt.status_closed
        };
        return map[status] || status;
    };

    const getStatusColor = (status) => {
        const map = {
            'new': 'bg-blue-100 text-blue-600',
            'pending': 'bg-orange-100 text-orange-600',
            'replied': 'bg-green-100 text-green-600',
            'closed_by_buyer': 'bg-red-100 text-red-600',
            'closed': 'bg-gray-100 text-gray-600'
        };
        return map[status] || 'bg-gray-100 text-gray-600';
    };


    return (
        <div className="space-y-6 font-['Cairo']" dir={isRTL ? "rtl" : "ltr"}>
            {/* ... Header ... */}
            <div className={`bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between`}>
                <div className="relative flex-1 w-full">
                    <input
                        type="text"
                        placeholder={txt.search_placeholder}
                        className={`w-full ${isRTL ? 'pl-12 pr-4' : 'pl-4 pr-12'} py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors ${isRTL ? 'text-right' : 'text-left'}`}
                    />
                    <Search className={`absolute ${isRTL ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 text-gray-400`} size={20} />
                </div>
                <button className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20">
                    {txt.search_btn}
                </button>
            </div>

            {/* Messages Table */}
            <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className={`w-full ${isRTL ? 'text-right' : 'text-left'}`}>
                        <thead>
                            <tr className="border-b border-gray-50 text-gray-400 text-xs font-bold bg-gray-50/50">
                                <th className="px-6 py-5">{txt.name}</th>
                                <th className="px-6 py-5">{txt.subject}</th>
                                <th className="px-6 py-5 text-center">{txt.email}</th>
                                <th className="px-6 py-5 text-center">{txt.block_list}</th>
                                <th className="px-6 py-5 text-center">{txt.date}</th>
                                <th className="px-6 py-5 text-center">{txt.status}</th>
                                <th className="px-6 py-5 text-center">{txt.actions}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="p-10 text-center text-gray-400">{txt.loading}</td>
                                </tr>
                            ) : (
                                messages.length > 0 ? (
                                    messages.map((msg) => (
                                        <tr key={msg.id} className="hover:bg-gray-50 transition-colors group">
                                            <td className="px-6 py-5 font-bold text-gray-700">{msg.name}</td>
                                            <td className="px-6 py-5 text-gray-500 text-sm">{msg.subject || msg.title}</td>
                                            <td className="px-6 py-5 text-center text-gray-400 text-xs font-mono dir-ltr">{msg.email}</td>
                                            <td className="px-6 py-5 text-center">
                                                <span className={`inline-block px-3 py-1 rounded-lg text-xs font-bold ${msg.isBlocked ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                                    {msg.isBlocked ? txt.blocked_yes : txt.blocked_no}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5 text-center text-gray-400 text-xs dir-ltr font-mono">{msg.date}</td>
                                            <td className={`px-6 py-5 text-center whitespace-nowrap ${msg.status === 'closed' ? 'opacity-50' : ''}`}>
                                                <span className={`inline-block px-4 py-1.5 rounded-full text-[10px] font-black ${getStatusColor(msg.status)}`}>
                                                    {getStatusLabel(msg.status)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5 text-center whitespace-nowrap">
                                                <div className="flex items-center justify-center gap-6">
                                                    <button
                                                        onClick={() => {
                                                            console.log("Opening chat for:", msg.id);
                                                            onOpenChat(msg.id);
                                                        }}
                                                        className="group relative flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all duration-300 shadow-sm hover:shadow-blue-500/30 active:scale-95"
                                                        title={txt.open_chat}
                                                    >
                                                        <MessageSquare size={20} className="stroke-[2.5px]" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(msg.id)}
                                                        className="group relative flex items-center justify-center w-10 h-10 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all duration-300 shadow-sm hover:shadow-red-500/30 active:scale-95"
                                                        title={txt.delete}
                                                    >
                                                        <Trash2 size={20} className="stroke-[2.5px]" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="p-10 text-center text-gray-400">{txt.no_messages}</td>
                                    </tr>
                                )
                            )}
                        </tbody>
                    </table>
                </div>

                {/* End of Table Container */}
            </div>
        </div>
    );
};

export default InboxView;
