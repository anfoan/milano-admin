import React from 'react';
import { useCurrency } from "../context/CurrencyContext";

const getInvoiceItemPrices = (item) => {
    const currentPrice = Number(item?.price ?? 0);
    const discountedPrice = Number(item?.priceAfterDiscount ?? item?.discountedPrice ?? item?.salePrice ?? currentPrice);
    const originalPrice = Number(item?.originalPrice ?? item?.priceBeforeDiscount ?? item?.regularPrice ?? currentPrice);
    return {
        original: Number.isFinite(originalPrice) ? originalPrice : currentPrice,
        discounted: Number.isFinite(discountedPrice) ? discountedPrice : currentPrice,
    };
};

const InvoiceTemplate = React.forwardRef(({ orders, lang = 'ar', onClose, generalSettings, hideHeader = false }, ref) => {
    const { formatPrice } = useCurrency();
    const currency = generalSettings?.currency || 'YER';
    const previewWidth = typeof window !== 'undefined' && window.innerWidth < 640
        ? 'calc(100vw - 2rem)'
        : '170mm';
    return (
        <div ref={ref} className="w-full" dir={lang === 'ar' ? 'rtl' : 'ltr'}>

            {/* Preview Header - Hidden when printing or capturing or if hideHeader is true */}
            {!hideHeader && (
                <div className="bg-[#111827] text-white py-4 px-6 mb-8 flex justify-between items-center shadow-md print:hidden" data-html2canvas-ignore="true">
                    <div className="flex gap-3">
                        <button
                            onClick={() => window.print()}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                            <span>{lang === 'ar' ? 'طباعة' : 'Print'}</span>
                        </button>
                        <button
                            onClick={() => onClose ? onClose() : window.history.back()}
                            className="flex items-center gap-2 bg-[#374151] hover:bg-[#4b5563] text-white px-6 py-2 rounded-lg font-bold transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            <span>{lang === 'ar' ? 'إغلاق' : 'Close'}</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Printable Content - Centered */}
            <div className="flex justify-center pb-20 print:p-0 print:block">
                <div ref={ref} className="print-container">
                    <style type="text/css" media="screen">
                        {`.invoice-preview-page { width: min(170mm, calc(100vw - 2rem)) !important; max-width: min(170mm, calc(100vw - 2rem)) !important; min-height: 0 !important; height: auto !important; box-sizing: border-box; overflow: visible !important; } .invoice-preview-page table { width: 100%; table-layout: fixed; } .invoice-preview-page table th { white-space: nowrap !important; font-size: 11px !important; } .invoice-preview-page table td { font-size: 11px !important; line-height: 1.25 !important; } .invoice-preview-page table col:nth-child(1) { width: 43% !important; } .invoice-preview-page table col:nth-child(2) { width: 10% !important; } .invoice-preview-page table col:nth-child(3) { width: 20% !important; } .invoice-preview-page table col:nth-child(4) { width: 9% !important; } .invoice-preview-page table col:nth-child(5) { width: 18% !important; } @media (max-width: 639px) { .invoice-preview-page { width: calc(100vw - 2rem) !important; max-width: calc(100vw - 2rem) !important; } .invoice-preview-page table th, .invoice-preview-page table td { font-size: 9px !important; } }`}
                    </style>
                    <style type="text/css" media="print">
                        {`
                        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
                        @page { size: A4; margin: 0; }
                        body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; }
                        .print-container { width: 100%; }
                        .print-page {
                            width: 210mm;
                            min-height: 148mm;
                            padding: 20px 40px !important;
                            margin: 0 auto;
                            page-break-after: always;
                            break-after: page;
                            background: white;
                            font-family: 'Cairo', sans-serif;
                            position: relative;
                            direction: rtl;
                            border-radius: 0;
                            box-shadow: none;
                            overflow: hidden;
                        }
                        .print-page:last-child { page-break-after: auto; }
                        * { box-sizing: border-box; }
                        `}
                    </style>
                    {orders.map((order) => {
                        const invoiceCurrency = order.currency || currency || 'YER';
                        return (
                        <div key={order.id} className="print-page invoice-preview-page flex flex-col bg-white shadow-xl mb-4 px-4 py-4 sm:px-8 sm:py-6 print:shadow-none print:mb-0 rounded-[24px] print:rounded-none" dir="rtl"
                            style={{ width: previewWidth, maxWidth: previewWidth, minHeight: 0, height: 'auto', margin: '0 auto', fontFamily: "'Cairo', sans-serif" }}>

                            {/* 1. Header Section */}
                            <div className="flex justify-between items-start mb-10 pb-4 border-b-2 border-slate-800">
                                <div className={`${lang === 'ar' ? 'text-right' : 'text-left'}`}>
                                    <h1 className="text-4xl font-black text-[#111317] mb-4">{lang === 'ar' ? 'فاتورة' : 'INVOICE'}</h1>
                                    <p className="text-xl font-bold text-gray-500 mb-4">{lang === 'ar' ? 'متجر ميلانو' : 'Milano Store'}</p>
                                    <div className="space-y-1.5 text-sm font-bold text-gray-800">
                                        <div className="flex items-center gap-3">
                                            <span className="text-gray-800 font-bold">{lang === 'ar' ? 'تاريخ الطلب:' : 'Order Date:'}</span>
                                            <span className="text-base">{order.date || new Date().toLocaleDateString('en-GB')}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-gray-800 font-bold">{lang === 'ar' ? 'رقم الطلب:' : 'Order ID:'}</span>
                                            <span className="text-base">{order.orderId || order.id}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className={`flex flex-col justify-center items-center ${lang === 'ar' ? 'pl-4' : 'pr-4'}`}>
                                    <div className="w-28 h-28 rounded-[20px] bg-black flex items-center justify-center overflow-hidden border-4 border-gray-100 p-1">
                                        <img src={generalSettings?.invoiceLogo || "/admin-logo.png"} onError={(e) => e.target.src = '/admin-logo.png'} className="w-full h-full object-contain rounded-[18px]" />
                                    </div>
                                </div>
                            </div>

                            {/* 2. Customer Info Card */}
                            <div className="mb-5 bg-gray-50 rounded-lg p-4 border border-gray-400 print:bg-gray-50 print:border-gray-400">
                                <h3 className={`font-black text-lg text-gray-800 border-b border-gray-400 pb-3 mb-4 ${lang === 'ar' ? 'text-right' : 'text-left'}`}>{lang === 'ar' ? 'بيانات العميل' : 'Customer Details'}</h3>
                                <div className={`grid grid-cols-2 gap-y-3 gap-x-4 ${lang === 'ar' ? 'text-right' : 'text-left'}`}>
                                    <div className="flex min-w-0 items-start justify-start gap-2">
                                        <span className="text-gray-500 text-xs font-bold">{lang === 'ar' ? 'اسم المشتري:' : 'Name:'}</span>
                                        <span className="min-w-0 break-words whitespace-normal font-black text-sm text-[#111317] leading-relaxed">{order.formData?.name || '---'}</span>
                                    </div>
                                    <div className="flex min-w-0 items-start justify-start gap-2">
                                        <span className="text-gray-500 text-xs font-bold">{lang === 'ar' ? 'الدولة:' : 'Country:'}</span>
                                        <span className="min-w-0 break-words whitespace-normal font-black text-sm text-[#111317] leading-relaxed">
                                            {order.formData?.country === 'Yemen' && lang === 'ar' ? 'اليمن' : (order.formData?.country || 'Yemen')}
                                        </span>
                                    </div>

                                    {/* Row 2: Address - Country */}
                                    <div className="flex min-w-0 items-start justify-start gap-2">
                                        <span className="text-gray-500 text-xs font-bold">{lang === 'ar' ? 'العنوان:' : 'Address:'}</span>
                                        <span className="min-w-0 break-words whitespace-normal font-black text-sm text-[#111317] leading-relaxed">{order.formData?.address || '---'}</span>
                                    </div>
                                    <div className="flex min-w-0 items-start justify-start gap-2">
                                        <span className="text-gray-500 text-xs font-bold">{lang === 'ar' ? 'رقم الهاتف:' : 'Phone:'}</span>
                                        <span className="min-w-0 break-words whitespace-normal font-black text-sm text-[#111317] leading-relaxed">{order.formData?.phone || '---'}</span>
                                    </div>

                                    {/* Row 3: City - Payment Method */}
                                    <div className="flex min-w-0 items-start justify-start gap-2">
                                        <span className="text-gray-500 text-xs font-bold">{lang === 'ar' ? 'المدينة:' : 'City:'}</span>
                                        <span className="min-w-0 break-words whitespace-normal font-black text-sm text-[#111317] leading-relaxed">{order.formData?.city || order.formData?.governorate || '---'}</span>
                                    </div>
                                    <div className="flex min-w-0 items-start justify-start gap-2">
                                        <span className="text-gray-500 text-xs font-bold">{lang === 'ar' ? 'طريقة الدفع:' : 'Payment Method:'}</span>
                                        <span className="min-w-0 break-words whitespace-normal font-black text-sm text-[#111317] leading-relaxed">
                                            {(() => {
                                                const topLevelMethod = String(order.paymentMethod || '').toLowerCase();
                                                const method = topLevelMethod && topLevelMethod !== 'manual'
                                                    ? topLevelMethod
                                                    : String(order.formData?.paymentMethod || '').toLowerCase();
                                                if (method === 'whatsapp') return (lang === 'ar' ? 'واتساب' : 'WhatsApp');
                                                if (['cash', 'cod', 'manual', 'cash_on_delivery'].includes(method)) return (lang === 'ar' ? 'نقدي / كاش' : 'Cash');
                                                if (['card', 'jib', 'jib_wallet', 'wallet'].includes(method)) return (lang === 'ar' ? 'محفظة جيب' : 'Jib Wallet');
                                                if (['transfer', 'bank_transfer'].includes(method)) return (lang === 'ar' ? 'تحويل بنكي' : 'Bank Transfer');
                                                return order.paymentMethod || order.formData?.paymentMethod || (lang === 'ar' ? 'نقدي / كاش' : 'Cash');
                                            })()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* 3. Products Table */}
                            <div className="mb-5">
                                <h3 className={`font-black text-lg sm:text-xl mb-3 text-gray-800 ${lang === 'ar' ? 'text-right' : 'text-left'}`}>{lang === 'ar' ? 'تفاصيل الفاتورة' : 'Invoice Details'}</h3>
                                <table className={`w-full table-fixed ${lang === 'ar' ? 'text-right' : 'text-left'} border-collapse border border-gray-400`} style={{ tableLayout: 'fixed' }}>
                                    <colgroup>
                                        <col style={{ width: '43%' }} /><col style={{ width: '10%' }} /><col style={{ width: '20%' }} /><col style={{ width: '9%' }} /><col style={{ width: '18%' }} />
                                    </colgroup>
                                    <thead style={{ backgroundColor: '#111317', color: '#ffffff' }} className="bg-[#111317] text-white print:bg-[#111317] print:text-white">
                                        <tr>
                                            <th style={{ padding: '10px 8px', verticalAlign: 'middle', color: '#ffffff', backgroundColor: '#111317' }} className={`text-sm font-bold border-l border-gray-500 w-[48%] ${lang === 'ar' ? 'text-right' : 'text-left'}`}>{lang === 'ar' ? 'اسم المنتج' : 'Item'}</th>
                                            <th style={{ padding: '10px 8px', verticalAlign: 'middle', color: '#ffffff', backgroundColor: '#111317' }} className="text-xs sm:text-sm font-bold text-center border-l border-gray-500 w-[10%] whitespace-nowrap">{lang === 'ar' ? 'المقاس' : 'Size'}</th>
                                            <th style={{ padding: '10px 8px', verticalAlign: 'middle', color: '#ffffff', backgroundColor: '#111317' }} className="text-xs sm:text-sm font-bold text-center border-l border-gray-500 w-[20%] whitespace-nowrap">{lang === 'ar' ? 'سعر الحبه' : 'Unit Price'}</th>
                                            <th style={{ padding: '10px 8px', verticalAlign: 'middle', color: '#ffffff', backgroundColor: '#111317' }} className="text-xs sm:text-sm font-bold text-center border-l border-gray-500 w-[9%] whitespace-nowrap">{lang === 'ar' ? 'الكمية' : 'Qty'}</th>
                                            <th style={{ padding: '10px 8px', verticalAlign: 'middle', color: '#ffffff', backgroundColor: '#111317' }} className="text-xs sm:text-sm font-bold text-center w-[18%] whitespace-nowrap">{lang === 'ar' ? 'الإجمالي' : 'Total'}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-400 bg-white">
                                        {order.cartItems?.map((item, idx) => {
                                            const itemPrices = getInvoiceItemPrices(item);
                                            const itemCurrency = order.currency || currency || 'YER';
                                            const hasItemDiscount = itemPrices.original > itemPrices.discounted;
                                            return (
                                            <tr key={idx}>
                                                <td style={{ padding: '8px 16px', verticalAlign: 'middle' }} className="border-l border-gray-400">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <img
                                                            src={item.image}
                                                            style={{ width: '55px', height: '55px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #9ca3af', verticalAlign: 'middle', flexShrink: 0 }}
                                                            onError={(e) => {
                                                                e.target.onerror = null;
                                                                e.target.src = '/nav-logo.png';
                                                            }}
                                                        />
                                                        <span style={{ fontWeight: 'bold', color: '#1f2937', fontSize: '12px', lineHeight: '1.4', verticalAlign: 'middle' }}>{item.title}</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '8px 16px', verticalAlign: 'middle' }} className="text-center text-xs font-bold text-gray-800 border-l border-gray-400">
                                                    <span>
                                                        {(item.selectedSize || item.size || '---')
                                                            .toString()
                                                            .replace(/مقاس|المقاس|Size|size/g, '')
                                                            .trim()}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '8px 16px', verticalAlign: 'middle' }} className="text-center text-xs font-bold text-gray-600 border-l border-gray-400 whitespace-nowrap">
                                                    {hasItemDiscount ? (
                                                        <div className="flex flex-col items-center">
                                                            <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{formatPrice(itemPrices.original, itemCurrency)}</span>
                                                            <span className="font-black text-red-600">{formatPrice(itemPrices.discounted, itemCurrency)}</span>
                                                        </div>
                                                    ) : (
                                                        <span>{formatPrice(itemPrices.discounted, itemCurrency)}</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '8px 16px', verticalAlign: 'middle' }} className="text-center text-xs font-bold text-gray-600 border-l border-gray-400">
                                                    <span>{item.quantity || 1}</span>
                                                </td>
                                                <td style={{ padding: '8px 16px', verticalAlign: 'middle' }} className="text-center text-xs font-black text-[#111317] whitespace-nowrap">
                                                    <span>{formatPrice(itemPrices.discounted * (item.quantity || 1), itemCurrency)}</span>
                                                </td>
                                            </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* 4. Totals & Footer */}
                            <div className={`flex ${lang === 'ar' ? 'justify-start' : 'justify-end'} mt-1 px-0`}>
                                <div className="w-full max-w-[360px] bg-gray-50 rounded-lg p-3 border border-gray-200 print:bg-gray-50 print:border-gray-200">
                                    <div className="space-y-2">
                                        <div className={`flex justify-between items-center text-gray-600 text-sm font-bold`}>
                                            <span>{lang === 'ar' ? 'المجموع الفرعي:' : 'Subtotal:'}</span>
                                            <span className="text-gray-800">
                                                {formatPrice(order.subTotal || order.total, invoiceCurrency)}
                                            </span>
                                        </div>
                                        <div className={`flex justify-between items-center text-red-500 text-sm font-bold`}>
                                            <span>{lang === 'ar' ? 'الخصم:' : 'Discount:'}</span>
                                            <span className="font-bold">
                                                {(() => {
                                                    const productDiscount = Number(order.discount || 0);
                                                    const couponDiscount = Math.round(Number(order.subTotal || 0) * (Number(order.discountPercentage || 0) / 100));
                                                    const totalD = productDiscount + couponDiscount;
                                                    return totalD > 0 ? `- ${formatPrice(totalD, invoiceCurrency)}` : '0';
                                                })()}
                                            </span>
                                        </div>
                                        <div className={`flex justify-between items-center text-gray-600 text-sm font-bold`}>
                                            <span>{lang === 'ar' ? 'رسوم التوصيل:' : 'Delivery:'}</span>
                                            <span className="text-gray-800">
                                                {formatPrice(order.deliveryCost, invoiceCurrency)}
                                            </span>
                                        </div>
                                        <div className="my-2 border-t-2 border-dashed border-gray-300"></div>
                                        <div className={`flex justify-between items-center`}>
                                            <span className="text-lg font-black text-[#111317]">{lang === 'ar' ? 'الإجمالي:' : 'Total:'}</span>
                                            <span className="text-xl font-black text-[#111317]">
                                                {formatPrice(order.total || 0, invoiceCurrency)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-5 mb-0 text-center border-t border-gray-400 pt-4">
                                <p className="text-gray-900 font-bold mb-1 text-xs">{lang === 'ar' ? 'شكراً لتسوقكم من متجر ميلانو' : 'Thank you for shopping with Milano Store'}</p>
                                <p className="text-gray-900 font-mono text-[10px]">{window.location.hostname}</p>
                            </div>
                        </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
});

export default InvoiceTemplate;
