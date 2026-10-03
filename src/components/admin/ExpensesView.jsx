import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import {
    collection,
    query,
    orderBy,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp
} from 'firebase/firestore';
import {
    DollarSign, Plus, Calendar, Trash2, Edit,
    Printer, Search, ChevronDown, Check, X, FileText
} from 'lucide-react';
import { getLocalizedCurrency } from '../../lib/currencyUtils';

const ExpensesView = ({ lang = 'ar', generalSettings }) => {
    const currency = generalSettings?.currency || 'YER';
    const isRTL = lang === 'ar';
    const isWorker = sessionStorage.getItem('isPOSWorkerAuthenticated') === 'true';
    const workerPerms = isWorker ? JSON.parse(sessionStorage.getItem('posWorkerPermissions') || '{}') : {};

    // State for Expenses
    const [expenses, setExpenses] = useState([]);
    const [expensesSearch, setExpensesSearch] = useState('');
    const [expensesPeriod, setExpensesPeriod] = useState('all'); // 'all' | 'this_week' | 'this_month' | 'this_year' | 'custom'
    const [expensesStartDate, setExpensesStartDate] = useState('');
    const [expensesEndDate, setExpensesEndDate] = useState('');
    const [expenseModalOpen, setExpenseModalOpen] = useState(false);
    const [currentExpense, setCurrentExpense] = useState({
        title: '',
        amount: '',
        category: 'Utilities',
        date: new Date().toISOString().split('T')[0],
        description: '',
        paymentMethod: '',
        currency: currency
    });
    const [editingExpenseId, setEditingExpenseId] = useState(null);

    // State for Bonds
    const [bonds, setBonds] = useState([]);
    const [bondsSearch, setBondsSearch] = useState('');
    const [bondsPeriod, setBondsPeriod] = useState('all'); // 'all' | 'this_week' | 'this_month' | 'this_year' | 'custom'
    const [bondsStartDate, setBondsStartDate] = useState('');
    const [bondsEndDate, setBondsEndDate] = useState('');
    const [bondsTab, setBondsTab] = useState('receipt'); // 'receipt' | 'payment'
    const [bondModalOpen, setBondModalOpen] = useState(false);
    const [currentBond, setCurrentBond] = useState({
        number: '',
        type: 'receipt',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0, 5),
        entityName: '',
        amount: '',
        currency: currency,
        paymentMethod: '',
        notes: '',
        entityType: ''
    });
    const [editingBondId, setEditingBondId] = useState(null);

    const predefinedCategories = ['Utilities', 'Rent', 'Salaries', 'Maintenance'];

    const [isCustomCategory, setIsCustomCategory] = useState(false);
    const [customCategoryText, setCustomCategoryText] = useState('');

    // Categories translation mapping
    const categoriesMap = {
        Utilities: isRTL ? 'فواتير وخدمات' : 'Utilities',
        Rent: isRTL ? 'إيجار' : 'Rent',
        Salaries: isRTL ? 'رواتب' : 'Salaries',
        Maintenance: isRTL ? 'صيانة' : 'Maintenance',
        Other: isRTL ? 'أخرى' : 'Other'
    };

    const currencyLabels = {
        'YER': isRTL ? 'ريال يمني' : 'YER',
        'SAR': isRTL ? 'ريال سعودي' : 'SAR',
        'USD': isRTL ? 'دولار أمريكي' : 'USD',
        'AED': isRTL ? 'درهم إماراتي' : 'AED',
    };

    const getCurrencyLabel = () => currencyLabels[currency] || currency;

    // Helper: map old internal entity type values to display text, or show as-is for free text
    const getEntityLabel = (val) => {
        if (val === 'customer') return isRTL ? 'عميل' : 'Customer';
        if (val === 'supplier') return isRTL ? 'مورد' : 'Supplier';
        return val || '';
    };

    // Helper: map old internal payment method values to display text, or show as-is for free text
    const getPaymentLabel = (val) => {
        if (val === 'cash') return isRTL ? 'نقدي' : 'Cash';
        if (val === 'bank') return isRTL ? 'بنك' : 'Bank';
        return val || '';
    };

    // Fetch Expenses from Firestore
    useEffect(() => {
        const expensesRef = collection(db, 'expenses');
        const q = query(expensesRef, orderBy('date', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setExpenses(list);
        }, (err) => {
            console.error("Error loading expenses:", err);
        });
        return () => unsubscribe();
    }, []);

    // Fetch Bonds from Firestore
    useEffect(() => {
        const bondsRef = collection(db, 'bonds');
        const q = query(bondsRef, orderBy('date', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setBonds(list);
        }, (err) => {
            console.error("Error loading bonds:", err);
        });
        return () => unsubscribe();
    }, []);

    // Helper: Date filtering logic
    const filterByDateRange = (itemDateStr, startDate, endDate) => {
        if (!startDate && !endDate) return true;
        const itemDate = new Date(itemDateStr);
        if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            if (itemDate < start) return false;
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (itemDate > end) return false;
        }
        return true;
    };

    // Auto-calculate dates based on Expenses period
    useEffect(() => {
        if (expensesPeriod === 'custom' || expensesPeriod === 'all') {
            if (expensesPeriod === 'all') {
                setExpensesStartDate('');
                setExpensesEndDate('');
            }
            return;
        }
        const now = new Date();
        let start = new Date();
        let end = new Date();
        if (expensesPeriod === 'this_week') {
            const dayOfWeek = now.getDay();
            start.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
            start.setHours(0, 0, 0, 0);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
        } else if (expensesPeriod === 'this_month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        } else if (expensesPeriod === 'this_year') {
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        }
        const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        setExpensesStartDate(formatDate(start));
        setExpensesEndDate(formatDate(end));
    }, [expensesPeriod]);

    // Auto-calculate dates based on Bonds period
    useEffect(() => {
        if (bondsPeriod === 'custom' || bondsPeriod === 'all') {
            if (bondsPeriod === 'all') {
                setBondsStartDate('');
                setBondsEndDate('');
            }
            return;
        }
        const now = new Date();
        let start = new Date();
        let end = new Date();
        if (bondsPeriod === 'this_week') {
            const dayOfWeek = now.getDay();
            start.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
            start.setHours(0, 0, 0, 0);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
        } else if (bondsPeriod === 'this_month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        } else if (bondsPeriod === 'this_year') {
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        }
        const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        setBondsStartDate(formatDate(start));
        setBondsEndDate(formatDate(end));
    }, [bondsPeriod]);

    // Filtered Expenses
    const filteredExpenses = expenses.filter(e => {
        const matchesSearch = e.title.toLowerCase().includes(expensesSearch.toLowerCase()) ||
            (categoriesMap[e.category] || e.category).toLowerCase().includes(expensesSearch.toLowerCase()) ||
            e.amount.toString().includes(expensesSearch);
        const matchesDateRange = filterByDateRange(e.date, expensesStartDate, expensesEndDate);
        return matchesSearch && matchesDateRange;
    });

    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    // Filtered Bonds
    const filteredBonds = bonds.filter(b => {
        const matchesTab = b.type === bondsTab;
        const matchesSearch = (b.entityName || '').toLowerCase().includes(bondsSearch.toLowerCase()) ||
            (b.number || '').toLowerCase().includes(bondsSearch.toLowerCase()) ||
            (b.notes || '').toLowerCase().includes(bondsSearch.toLowerCase());

        // Date range filtering
        const matchesDateRange = filterByDateRange(b.date, bondsStartDate, bondsEndDate);

        return matchesTab && matchesSearch && matchesDateRange;
    });

    // Calculate overall totals for Bonds
    const allFilteredBondsForTotals = bonds.filter(b => {
        const matchesDateRange = filterByDateRange(b.date, bondsStartDate, bondsEndDate);
        const matchesSearch = (b.entityName || '').toLowerCase().includes(bondsSearch.toLowerCase()) ||
            (b.number || '').toLowerCase().includes(bondsSearch.toLowerCase());
        return matchesDateRange && matchesSearch;
    });

    const totalReceipts = allFilteredBondsForTotals.filter(b => b.type === 'receipt').reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
    const totalPayments = allFilteredBondsForTotals.filter(b => b.type === 'payment').reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
    const netBalance = totalReceipts - totalPayments;

    // Expense Handlers
    const handleAddExpenseClick = () => {
        setCurrentExpense({
            title: '',
            amount: '',
            category: 'Utilities',
            date: new Date().toISOString().split('T')[0],
            description: '',
            paymentMethod: '',
            currency: currency
        });
        setIsCustomCategory(false);
        setCustomCategoryText('');
        setEditingExpenseId(null);
        setExpenseModalOpen(true);
    };

    const handleEditExpenseClick = (expense) => {
        const cat = expense.category || 'Utilities';
        const isPredefined = predefinedCategories.includes(cat);
        setCurrentExpense({
            title: expense.title,
            amount: expense.amount,
            category: isPredefined ? cat : 'custom',
            date: expense.date,
            description: expense.description || '',
            paymentMethod: expense.paymentMethod || '',
            currency: currency
        });
        if (isPredefined) {
            setIsCustomCategory(false);
            setCustomCategoryText('');
        } else {
            setIsCustomCategory(true);
            setCustomCategoryText(cat);
        }
        setEditingExpenseId(expense.id);
        setExpenseModalOpen(true);
    };

    const handleSaveExpense = async (e) => {
        e.preventDefault();
        if (!currentExpense.title || !currentExpense.amount) return;

        const categoryValue = currentExpense.category === 'custom' ? customCategoryText : currentExpense.category;

        const payload = {
            title: currentExpense.title,
            amount: Number(currentExpense.amount),
            category: categoryValue,
            date: currentExpense.date,
            description: currentExpense.description,
            paymentMethod: currentExpense.paymentMethod || 'cash',
            currency: currency,
            updatedAt: serverTimestamp()
        };

        try {
            if (editingExpenseId) {
                await updateDoc(doc(db, 'expenses', editingExpenseId), payload);
            } else {
                await addDoc(collection(db, 'expenses'), {
                    ...payload,
                    createdAt: serverTimestamp()
                });
            }
            setExpenseModalOpen(false);
        } catch (err) {
            console.error("Error saving expense:", err);
        }
    };

    const handleDeleteExpense = async (id) => {
        if (window.confirm(isRTL ? 'هل أنت متأكد من حذف هذا المصروف؟' : 'Are you sure you want to delete this expense?')) {
            try {
                await deleteDoc(doc(db, 'expenses', id));
            } catch (err) {
                console.error("Error deleting expense:", err);
            }
        }
    };

    // Bond Handlers
    const handleAddBondClick = (type) => {
        setCurrentBond({
            number: `BND-${Date.now().toString().slice(-6)}`,
            type: type || bondsTab,
            date: new Date().toISOString().split('T')[0],
            time: new Date().toTimeString().slice(0, 5),
            entityName: '',
            amount: '',
            currency: currency,
            paymentMethod: '',
            notes: '',
            entityType: ''
        });
        setEditingBondId(null);
        setBondModalOpen(true);
    };

    const handleEditBondClick = (bond) => {
        setCurrentBond({
            number: bond.number || '',
            type: bond.type,
            date: bond.date,
            time: bond.time || new Date().toTimeString().slice(0, 5),
            entityName: bond.entityName,
            amount: bond.amount,
            currency: currency,
            paymentMethod: bond.paymentMethod || '',
            notes: bond.notes || '',
            entityType: bond.entityType || ''
        });
        setEditingBondId(bond.id);
        setBondModalOpen(true);
    };

    const handleSaveBond = async (e) => {
        e.preventDefault();
        if (!currentBond.entityName || !currentBond.amount) return;

        const entityTypeValue = currentBond.entityType;

        const payload = {
            number: currentBond.number || `BND-${Date.now().toString().slice(-6)}`,
            type: currentBond.type,
            date: currentBond.date,
            time: currentBond.time,
            entityName: currentBond.entityName,
            amount: Number(currentBond.amount),
            currency: currency,
            paymentMethod: currentBond.paymentMethod,
            notes: currentBond.notes,
            entityType: entityTypeValue,
            updatedAt: serverTimestamp()
        };

        try {
            if (editingBondId) {
                await updateDoc(doc(db, 'bonds', editingBondId), payload);
            } else {
                await addDoc(collection(db, 'bonds'), {
                    ...payload,
                    createdAt: serverTimestamp()
                });
            }
            setBondModalOpen(false);
        } catch (err) {
            console.error("Error saving bond:", err);
        }
    };

    const handleDeleteBond = async (id) => {
        if (window.confirm(isRTL ? 'هل أنت متأكد من حذف هذا السند؟' : 'Are you sure you want to delete this bond?')) {
            try {
                await deleteDoc(doc(db, 'bonds', id));
            } catch (err) {
                console.error("Error deleting bond:", err);
            }
        }
    };

    const handlePrintBond = (bond) => {
        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) {
            alert(isRTL ? 'يرجى السماح بالنوافذ المنبثقة للطباعة' : 'Please allow popups to print');
            return;
        }

        const direction = 'rtl';
        const title = bond.type === 'receipt' ? 'سند قبض' : 'سند صرف';
        const titleBg = bond.type === 'receipt' ? '#ecfdf5' : '#fef2f2';
        const titleColor = bond.type === 'receipt' ? '#065f46' : '#991b1b';
        const titleBorder = bond.type === 'receipt' ? '#10b981' : '#ef4444';

        let timeStr = '';
        if (bond.time) {
            const [hour, minute] = bond.time.split(':');
            const h = parseInt(hour, 10);
            const ampm = h >= 12 ? 'م' : 'ص';
            const formattedHour = h % 12 || 12;
            timeStr = `${formattedHour}:${minute} ${ampm}`;
        } else {
            const now = new Date();
            const h = now.getHours();
            const ampm = h >= 12 ? 'م' : 'ص';
            const formattedHour = h % 12 || 12;
            const minute = String(now.getMinutes()).padStart(2, '0');
            timeStr = `${formattedHour}:${minute} ${ampm}`;
        }

        const htmlContent = `
          <!DOCTYPE html>
          <html dir="${direction}">
          <head>
              <title>${title} #${bond.number || ''}</title>
              <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;950&display=swap" rel="stylesheet">
              <style>
                  body {
                      font-family: 'Cairo', sans-serif;
                      background: #f3f4f6;
                      padding: 40px 20px;
                      margin: 0;
                      display: flex;
                      justify-content: center;
                      align-items: center;
                      min-height: 100vh;
                  }
                  .bond-card {
                      background: #ffffff;
                      width: 800px;
                      padding: 45px;
                      border-radius: 30px;
                      box-shadow: 0 10px 30px rgba(0,0,0,0.15);
                      position: relative;
                      overflow: hidden;
                      box-sizing: border-box;
                      border: 1px solid #e5e7eb;
                  }
                  /* Top-left curve - Green flag style */
                  .curve-top-left {
                      position: absolute;
                      top: 0;
                      left: 0;
                      width: 320px;
                      height: 140px;
                      border-bottom-right-radius: 100% 100%;
                      border-top: 15px solid #10b981;
                      border-left: 15px solid #10b981;
                      pointer-events: none;
                  }
                  /* Bottom-right curve - Red flag style */
                  .curve-bottom-right {
                      position: absolute;
                      bottom: 0;
                      right: 0;
                      width: 280px;
                      height: 120px;
                      border-top-left-radius: 100% 100%;
                      border-bottom: 15px solid #ef4444;
                      border-right: 15px solid #ef4444;
                      pointer-events: none;
                  }
                  .header {
                      display: flex;
                      justify-content: space-between;
                      align-items: flex-start;
                      margin-bottom: 25px;
                      position: relative;
                      z-index: 10;
                  }
                  .header-right {
                      text-align: right;
                      flex: 1;
                      margin-top: 30px;
                  }
                  .company-name {
                      font-size: 28px;
                      font-weight: 950;
                      color: #111827;
                      line-height: 1.2;
                  }
                  .company-desc {
                      font-size: 14px;
                      font-weight: 700;
                      color: #4b5563;
                      margin-top: 5px;
                  }
                  .company-phone {
                      font-size: 14px;
                      font-weight: 800;
                      color: #111827;
                      margin-top: 5px;
                  }
                  .header-center {
                      position: absolute;
                      left: 50%;
                      top: 5px;
                      transform: translateX(-50%);
                      z-index: 20;
                  }
                  .bond-title {
                      font-size: 22px;
                      font-weight: 950;
                      color: ${titleColor};
                      background: ${titleBg};
                      border: 2px solid ${titleBorder};
                      padding: 5px 28px;
                      border-radius: 12px;
                      box-shadow: 0 4px 6px rgba(0,0,0,0.02);
                      white-space: nowrap;
                  }
                  .header-left {
                      display: flex;
                      flex-direction: column;
                      align-items: center;
                      text-align: center;
                  }
                  .logo {
                      width: 90px;
                      height: 90px;
                      object-fit: contain;
                      margin-top: 25px;
                      margin-bottom: 10px;
                      background: #ffffff;
                      border-radius: 18px;
                      padding: 6px;
                      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                      box-sizing: border-box;
                  }
                  .date-time {
                      font-size: 13px;
                      font-weight: bold;
                      color: #374151;
                      line-height: 1.5;
                  }
                  .divider {
                      border: 0;
                      border-top: 2px solid #374151;
                      margin: 15px 0 30px 0;
                      position: relative;
                      z-index: 10;
                  }
                  .content-fields {
                      font-size: 17px;
                      color: #1f2937;
                      line-height: 2.4;
                      position: relative;
                      z-index: 10;
                      margin-bottom: 40px;
                  }
                  .field-row {
                      display: flex;
                      align-items: center;
                      margin-bottom: 15px;
                  }
                  .field-label {
                      font-weight: 800;
                      color: #4b5563;
                      min-width: 150px;
                  }
                  .field-value {
                      flex: 1;
                      font-weight: bold;
                      color: #111827;
                      border-bottom: 2px dotted #9ca3af;
                      padding: 0 10px;
                  }
                  .amount-container {
                      display: flex;
                      justify-content: flex-end;
                      margin-top: -10px;
                      margin-bottom: 30px;
                      position: relative;
                      z-index: 10;
                  }
                  .amount-box {
                      border: 3px solid #111827;
                      padding: 10px 30px;
                      font-size: 24px;
                      font-weight: 950;
                      background: #f9fafb;
                      border-radius: 14px;
                      box-shadow: 0 4px 6px rgba(0,0,0,0.02);
                  }
                  .footer-signatures {
                      display: flex;
                      justify-content: space-between;
                      margin-top: 50px;
                      padding: 0 30px;
                      position: relative;
                      z-index: 10;
                  }
                  .signature-box {
                      text-align: center;
                      width: 180px;
                  }
                  .signature-title {
                      font-weight: 800;
                      color: #4b5563;
                      margin-bottom: 45px;
                      font-size: 16px;
                  }
                  .signature-line {
                      border-top: 2px solid #4b5563;
                      width: 100%;
                  }
                  .print-button-container {
                      position: fixed;
                      bottom: 25px;
                      right: 25px;
                      z-index: 100;
                  }
                  .print-btn {
                      background: #111827;
                      color: #ffffff;
                      border: none;
                      padding: 14px 28px;
                      font-size: 15px;
                      font-weight: bold;
                      border-radius: 10px;
                      cursor: pointer;
                      box-shadow: 0 5px 15px rgba(0,0,0,0.2);
                      font-family: 'Cairo', sans-serif;
                      transition: all 0.2s ease;
                  }
                  .print-btn:hover {
                      background: #1f2937;
                      transform: translateY(-2px);
                  }
                  @media print {
                      body {
                          background: white;
                          padding: 0;
                      }
                      .bond-card {
                          box-shadow: none;
                          border: none;
                          padding: 20px;
                      }
                      .print-button-container {
                          display: none;
                      }
                  }
              </style>
          </head>
          <body>
              <div class="print-button-container">
                  <button class="print-btn" onclick="window.print()">طباعة السند</button>
              </div>
              <div class="bond-card">
                  <div class="curve-top-left"></div>
                  <div class="curve-bottom-right"></div>
                  
                  <div class="header">
                      <div class="header-right">
                          <div class="company-name">${generalSettings?.storeName || 'شركة ميلانو'}</div>
                          ${generalSettings?.storeDescription ? `<div class="company-desc">${generalSettings.storeDescription}</div>` : ''}
                          ${generalSettings?.storeAddress ? `<div class="company-phone">${generalSettings.storeAddress}</div>` : ''}
                          ${generalSettings?.phoneNumber ? `<div class="company-phone">الهاتف: ${generalSettings.phoneNumber}</div>` : ''}
                      </div>
                      <div class="header-center">
                          <div class="bond-title">${title}</div>
                      </div>
                      <div class="header-left">
                          <img src="${generalSettings?.invoiceLogo || '/admin-logo.png'}" alt="Logo" class="logo" onerror="this.src='/logo.jpg'; this.onerror=function(){this.src='/logo-rounded.png'; this.onerror=null;}" />
                          <div class="date-time">التاريخ: ${bond.date || ''}</div>
                          <div class="date-time">الوقت: ${timeStr}</div>
                      </div>
                  </div>
                  
                  <hr class="divider" />
                  
                  <div class="content-fields">
                      <div class="field-row">
                          <span class="field-label">${bond.type === 'receipt' ? 'استلمنا من السيد' : 'صرفنا إلى السيد'}:</span>
                          <span class="field-value">${bond.entityName || ''}</span>
                      </div>
                      <div class="field-row">
                          <span class="field-label">مبلغ وقدره:</span>
                          <span class="field-value">${bond.amount ? bond.amount.toLocaleString() : '0'} ${getCurrencyLabel(bond.currency || 'YER')}</span>
                      </div>
                      <div class="field-row">
                          <span class="field-label">طريقة الدفع:</span>
                          <span class="field-value">${getPaymentLabel(bond.paymentMethod)}</span>
                      </div>
                      <div class="field-row">
                          <span class="field-label">وذلك مقابل:</span>
                          <span class="field-value">${bond.notes || ''}</span>
                      </div>
                  </div>
                  
                  <div class="amount-container">
                      <div class="amount-box">
                          ${bond.amount ? bond.amount.toLocaleString() : '0'} ${bond.currency || 'YER'}
                      </div>
                  </div>
                  
                  <div class="footer-signatures">
                      <div class="signature-box">
                          <div class="signature-title">المحاسب</div>
                          <div class="signature-line"></div>
                      </div>
                      <div class="signature-box">
                          <div class="signature-title">المستلم</div>
                          <div class="signature-line"></div>
                      </div>
                  </div>
              </div>
          </body>
          </html>
        `;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const handlePrintBondsReport = () => {
        const printWindow = window.open('', '_blank', 'width=900,height=800');
        if (!printWindow) return;

        const htmlContent = `
          <!DOCTYPE html>
          <html dir="rtl">
          <head>
              <title></title>
              <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
              <style>
                  @page { size: A4 portrait; margin: 8mm 10mm; }
                  body { font-family: 'Cairo', sans-serif; padding: 15px; background: #fff; margin: 0; }
                  h2 { text-align: center; margin-bottom: 10px; font-weight: 900; font-size: 20px; }
                  .report-info { margin-bottom: 15px; font-weight: 600; font-size: 13px; }
                  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 15px; }
                  th { background: #f3f4f6; padding: 10px 8px; text-align: right; border-bottom: 2px solid #ccc; font-weight: 700; font-size: 11px; }
                  td { padding: 8px; border-bottom: 1px solid #eee; }
                  .receipt-val { color: #10b981; font-weight: bold; }
                  .payment-val { color: #ef4444; font-weight: bold; }
                  .totals-table { width: 50%; margin-left: auto; margin-top: 20px; border: 2px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
                  .totals-table td { padding: 10px; font-weight: bold; }
                  .net-total { background: #eff6ff; border-top: 2px solid #3b82f6; }
                  .net-total td { color: #2563eb; font-size: 14px; }
                  .print-btn { background: #111827; color: #fff; border: none; padding: 10px 25px; border-radius: 8px; cursor: pointer; font-weight: bold; font-family: 'Cairo', sans-serif; font-size: 14px; margin-bottom: 15px; }
                  .print-btn:hover { background: #1f2937; }
                  @media print { .print-btn { display: none; } body { padding: 0; } }
              </style>
          </head>
          <body>
              <button class="print-btn" onclick="window.print()">طباعة التقرير</button>
              <h2>تقرير السندات المالية المفلترة</h2>
              <div class="report-info">
                  <div>تاريخ التقرير: ${new Date().toLocaleDateString('ar-YE')}</div>
                  <div>الفترة: ${bondsPeriod === 'all' ? 'الكل' : bondsPeriod === 'this_week' ? 'هذا الأسبوع' : bondsPeriod === 'this_month' ? 'هذا الشهر' : bondsPeriod === 'this_year' ? 'هذا السنة' : 'فترة مخصصة'} ${bondsStartDate ? `من ${bondsStartDate}` : ''} ${bondsEndDate ? `إلى ${bondsEndDate}` : ''}</div>
              </div>

              <table>
                  <thead>
                      <tr>
                          <th>#</th>
                          <th>رقم السند</th>
                          <th>اسم السيد</th>
                          <th>نوع السند</th>
                          <th>التاريخ</th>
                          <th>طريقة الدفع</th>
                          <th>الجهة</th>
                          <th>المبلغ</th>
                      </tr>
                  </thead>
                  <tbody>
                      ${allFilteredBondsForTotals.map((bond, idx) => `
                          <tr>
                              <td>${idx + 1}</td>
                              <td style="font-weight: bold;">${bond.number}</td>
                              <td>${bond.entityName}</td>
                              <td class="${bond.type === 'receipt' ? 'receipt-val' : 'payment-val'}">
                                  ${bond.type === 'receipt' ? 'سند قبض' : 'سند صرف'}
                              </td>
                              <td>${bond.date}</td>
                              <td>${getPaymentLabel(bond.paymentMethod)}</td>
                              <td>${getEntityLabel(bond.entityType)}</td>
                              <td class="${bond.type === 'receipt' ? 'receipt-val' : 'payment-val'}">${bond.amount.toLocaleString()} ${getCurrencyLabel(bond.currency || 'YER')}</td>
                          </tr>
                      `).join('')}
                      ${allFilteredBondsForTotals.length === 0 ? '<tr><td colspan="8" style="text-align: center; color: #9ca3af; padding: 20px;">لا توجد سندات في هذه الفترة</td></tr>' : ''}
                  </tbody>
              </table>

              <table class="totals-table">
                  <tr>
                      <td>إجمالي سندات القبض (+)</td>
                      <td class="receipt-val">${totalReceipts.toLocaleString()} ${getCurrencyLabel(currency)}</td>
                  </tr>
                  <tr>
                      <td>إجمالي سندات الصرف (-)</td>
                      <td class="payment-val">${totalPayments.toLocaleString()} ${getCurrencyLabel(currency)}</td>
                  </tr>
                  <tr>
                      <td>صافي الرصيد الكلي</td>
                      <td style="color: ${netBalance >= 0 ? '#10b981' : '#ef4444'}">${netBalance.toLocaleString()} ${getCurrencyLabel(currency)}</td>
                  </tr>
                  <tr class="net-total">
                      <td>المتبقي من القبض والصرف</td>
                      <td>${netBalance.toLocaleString()} ${getCurrencyLabel(currency)}</td>
                  </tr>
              </table>
          </body>
          </html>
        `;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const handlePrintReceiptBonds = () => {
        const receiptBonds = allFilteredBondsForTotals.filter(b => b.type === 'receipt');
        if (receiptBonds.length === 0) {
            alert(isRTL ? 'لا توجد سندات قبض في هذه الفترة' : 'No receipt bonds found');
            return;
        }
        const printWindow = window.open('', '_blank', 'width=900,height=800');
        if (!printWindow) return;

        const totalR = receiptBonds.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

        const htmlContent = `
          <!DOCTYPE html>
          <html dir="rtl">
          <head>
              <title></title>
              <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
              <style>
                  @page { size: A4 portrait; margin: 8mm 10mm; }
                  body { font-family: 'Cairo', sans-serif; padding: 15px; background: #fff; margin: 0; }
                  h2 { text-align: center; margin-bottom: 10px; font-weight: 900; font-size: 20px; color: #16a34a; }
                  .report-info { margin-bottom: 15px; font-weight: 600; font-size: 13px; }
                  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 15px; }
                  th { background: #f0fdf4; padding: 10px 8px; text-align: right; border-bottom: 2px solid #bbf7d0; font-weight: 700; font-size: 11px; color: #166534; }
                  td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
                  .print-btn { background: #16a34a; color: #fff; border: none; padding: 10px 25px; border-radius: 8px; cursor: pointer; font-weight: bold; font-family: 'Cairo', sans-serif; font-size: 14px; margin-bottom: 15px; }
                  .total-row { margin-top: 20px; padding: 12px; background: #f0fdf4; border: 2px solid #16a34a; border-radius: 10px; font-weight: 900; font-size: 16px; color: #16a34a; text-align: center; }
                  @media print { .print-btn { display: none; } body { padding: 0; } }
              </style>
          </head>
          <body>
              <button class="print-btn" onclick="window.print()">طباعة تقرير سندات القبض</button>
              <h2>تقرير سندات القبض</h2>
              <div class="report-info">
                  <div>تاريخ التقرير: ${new Date().toLocaleDateString('ar-YE')}</div>
                  <div>الفترة: ${bondsPeriod === 'all' ? 'الكل' : bondsPeriod === 'this_week' ? 'هذا الأسبوع' : bondsPeriod === 'this_month' ? 'هذا الشهر' : bondsPeriod === 'this_year' ? 'هذا السنة' : 'فترة مخصصة'}</div>
              </div>
              <table>
                  <thead>
                      <tr><th>#</th><th>رقم السند</th><th>اسم السيد</th><th>التاريخ</th><th>طريقة الدفع</th><th>الجهة</th><th>المبلغ</th></tr>
                  </thead>
                  <tbody>
                      ${receiptBonds.map((bond, idx) => `
                          <tr>
                              <td>${idx + 1}</td>
                              <td style="font-weight: bold;">${bond.number}</td>
                              <td>${bond.entityName}</td>
                              <td>${bond.date}</td>
                              <td>${getPaymentLabel(bond.paymentMethod)}</td>
                              <td>${getEntityLabel(bond.entityType)}</td>
                              <td style="color: #16a34a; font-weight: bold;">${bond.amount.toLocaleString()} ${getCurrencyLabel(bond.currency || 'YER')}</td>
                          </tr>
                      `).join('')}
                  </tbody>
              </table>
              <div class="total-row">إجمالي سندات القبض: ${totalR.toLocaleString()} ${getCurrencyLabel(currency)}</div>
          </body>
          </html>
        `;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const handlePrintPaymentBonds = () => {
        const paymentBonds = allFilteredBondsForTotals.filter(b => b.type === 'payment');
        if (paymentBonds.length === 0) {
            alert(isRTL ? 'لا توجد سندات صرف في هذه الفترة' : 'No payment bonds found');
            return;
        }
        const printWindow = window.open('', '_blank', 'width=900,height=800');
        if (!printWindow) return;

        const totalP = paymentBonds.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

        const htmlContent = `
          <!DOCTYPE html>
          <html dir="rtl">
          <head>
              <title></title>
              <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
              <style>
                  @page { size: A4 portrait; margin: 8mm 10mm; }
                  body { font-family: 'Cairo', sans-serif; padding: 15px; background: #fff; margin: 0; }
                  h2 { text-align: center; margin-bottom: 10px; font-weight: 900; font-size: 20px; color: #dc2626; }
                  .report-info { margin-bottom: 15px; font-weight: 600; font-size: 13px; }
                  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 15px; }
                  th { background: #fef2f2; padding: 10px 8px; text-align: right; border-bottom: 2px solid #fecaca; font-weight: 700; font-size: 11px; color: #991b1b; }
                  td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
                  .print-btn { background: #dc2626; color: #fff; border: none; padding: 10px 25px; border-radius: 8px; cursor: pointer; font-weight: bold; font-family: 'Cairo', sans-serif; font-size: 14px; margin-bottom: 15px; }
                  .total-row { margin-top: 20px; padding: 12px; background: #fef2f2; border: 2px solid #dc2626; border-radius: 10px; font-weight: 900; font-size: 16px; color: #dc2626; text-align: center; }
                  @media print { .print-btn { display: none; } body { padding: 0; } }
              </style>
          </head>
          <body>
              <button class="print-btn" onclick="window.print()">طباعة تقرير سندات الصرف</button>
              <h2>تقرير سندات الصرف</h2>
              <div class="report-info">
                  <div>تاريخ التقرير: ${new Date().toLocaleDateString('ar-YE')}</div>
                  <div>الفترة: ${bondsPeriod === 'all' ? 'الكل' : bondsPeriod === 'this_week' ? 'هذا الأسبوع' : bondsPeriod === 'this_month' ? 'هذا الشهر' : bondsPeriod === 'this_year' ? 'هذا السنة' : 'فترة مخصصة'}</div>
              </div>
              <table>
                  <thead>
                      <tr><th>#</th><th>رقم السند</th><th>اسم السيد</th><th>التاريخ</th><th>طريقة الدفع</th><th>الجهة</th><th>المبلغ</th></tr>
                  </thead>
                  <tbody>
                      ${paymentBonds.map((bond, idx) => `
                          <tr>
                              <td>${idx + 1}</td>
                              <td style="font-weight: bold;">${bond.number}</td>
                              <td>${bond.entityName}</td>
                              <td>${bond.date}</td>
                              <td>${getPaymentLabel(bond.paymentMethod)}</td>
                              <td>${getEntityLabel(bond.entityType)}</td>
                              <td style="color: #dc2626; font-weight: bold;">${bond.amount.toLocaleString()} ${getCurrencyLabel(bond.currency || 'YER')}</td>
                          </tr>
                      `).join('')}
                  </tbody>
              </table>
              <div class="total-row">إجمالي سندات الصرف: ${totalP.toLocaleString()} ${getCurrencyLabel(currency)}</div>
          </body>
          </html>
        `;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const handlePrintExpensesReport = () => {
        const printWindow = window.open('', '_blank', 'width=900,height=800');
        if (!printWindow) return;

        const htmlContent = `
          <!DOCTYPE html>
          <html dir="rtl">
          <head>
              <title></title>
              <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
              <style>
                  @page { size: A4 portrait; margin: 8mm 10mm; }
                  body { font-family: 'Cairo', sans-serif; padding: 15px; background: #fff; }
                  h2 { text-align: center; margin-bottom: 25px; font-weight: 900; }
                  .report-info { margin-bottom: 20px; font-weight: 600; font-size: 14px; }
                  table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 12px; margin-top: 15px; }
                  th { background: #f3f4f6; padding: 8px 6px; text-align: right; border: 1px solid #e5e7eb; border-bottom: 2px solid #ccc; font-weight: 700; white-space: nowrap; }
                  td { padding: 8px 6px; border: 1px solid #e5e7eb; }
                  td.nowrap-cell { white-space: nowrap; }
                  .amount-val { color: #ef4444; font-weight: bold; }
                  .totals-table { width: auto; min-width: 300px; margin-left: auto; margin-top: 30px; border: 2px solid #e5e7eb; }
                  .totals-table td { padding: 12px; font-weight: bold; white-space: nowrap; }
                  @media print { .print-btn { display: none; } body { padding: 0; } }
              </style>
          </head>
          <body>
              <button class="print-btn" onclick="window.print()" style="padding: 10px 20px; background: #111827; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; margin-bottom: 20px;">طباعة التقرير</button>
              <h2>تقرير المصروفات المفلترة</h2>
              <div class="report-info">
                  <div>تاريخ التقرير: ${new Date().toLocaleDateString('ar-YE')}</div>
                  <div>الفترة المحددة: ${expensesPeriod === 'all' ? 'الكل' :
                expensesPeriod === 'week' ? 'الأسبوع الحالي' :
                    expensesPeriod === 'month' ? 'الشهر الحالي' :
                        expensesPeriod === 'year' ? 'السنة الحالية' : expensesPeriod
            }</div>
              </div>
              
              <table>
                  <thead>
                      <tr>
                          <th style="width: 4%;">#</th>
                          <th style="width: 20%;">البند</th>
                          <th style="width: 16%;">التصنيف</th>
                          <th style="width: 12%;">التاريخ</th>
                          <th style="width: 12%;">طريقة الدفع</th>
                          <th style="width: 22%;">التفاصيل/البيان</th>
                          <th style="width: 14%;">المبلغ</th>
                      </tr>
                  </thead>
                  <tbody>
                      ${filteredExpenses.map((expense, idx) => `
                          <tr>
                              <td>${idx + 1}</td>
                              <td>${expense.title}</td>
                              <td class="nowrap-cell">${categoriesMap[expense.category] || expense.category}</td>
                              <td class="nowrap-cell">${expense.date}</td>
                              <td class="nowrap-cell">${getPaymentLabel(expense.paymentMethod)}</td>
                              <td>${expense.description || '-'}</td>
                              <td class="amount-val nowrap-cell">${expense.amount.toLocaleString()} ${getCurrencyLabel(expense.currency || currency)}</td>
                          </tr>
                      `).join('')}
                      ${filteredExpenses.length === 0 ? '<tr><td colspan="7" style="text-align: center; color: #9ca3af; padding: 20px;">لا توجد مصروفات في هذه الفترة</td></tr>' : ''}
                  </tbody>
              </table>

              <table class="totals-table">
                  <tr style="background: #f9fafb; border-top: 2px solid #ccc;">
                      <td>إجمالي المصروفات (بالعملة الافتراضية)</td>
                      <td class="amount-val" style="text-align: left;">${totalExpenses.toLocaleString()} ${getCurrencyLabel(currency)}</td>
                  </tr>
              </table>
          </body>
          </html>
        `;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const handlePrintExpenseSingle = (expense) => {
        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) {
            alert(isRTL ? 'يرجى السماح بالنوافذ المنبثقة للطباعة' : 'Please allow popups to print');
            return;
        }

        const direction = 'rtl';
        const title = 'سند صرف';
        const titleBg = '#fef2f2';
        const titleColor = '#991b1b';
        const titleBorder = '#ef4444';

        const htmlContent = `
          <!DOCTYPE html>
          <html dir="${direction}">
          <head>
              <title>${title} - ${expense.title || ''}</title>
              <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;950&display=swap" rel="stylesheet">
              <style>
                  body {
                      font-family: 'Cairo', sans-serif;
                      background: #f3f4f6;
                      padding: 40px 20px;
                      margin: 0;
                      display: flex;
                      justify-content: center;
                      align-items: center;
                      min-height: 100vh;
                  }
                  .bond-card {
                      background: #ffffff;
                      width: 800px;
                      padding: 45px;
                      border-radius: 30px;
                      box-shadow: 0 10px 30px rgba(0,0,0,0.15);
                      position: relative;
                      overflow: hidden;
                      box-sizing: border-box;
                      border: 1px solid #e5e7eb;
                  }
                  .curve-top-left {
                      position: absolute;
                      top: 0;
                      left: 0;
                      width: 320px;
                      height: 140px;
                      border-bottom-right-radius: 100% 100%;
                      border-top: 15px solid #ef4444;
                      border-left: 15px solid #ef4444;
                      pointer-events: none;
                  }
                  .curve-bottom-right {
                      position: absolute;
                      bottom: 0;
                      right: 0;
                      width: 280px;
                      height: 120px;
                      border-top-left-radius: 100% 100%;
                      border-bottom: 15px solid #374151;
                      border-right: 15px solid #374151;
                      pointer-events: none;
                  }
                  .header {
                      display: flex;
                      justify-content: space-between;
                      align-items: flex-start;
                      margin-bottom: 25px;
                      position: relative;
                      z-index: 10;
                  }
                  .header-right {
                      text-align: right;
                      flex: 1;
                      margin-top: 30px;
                  }
                  .company-name {
                      font-size: 28px;
                      font-weight: 950;
                      color: #111827;
                      line-height: 1.2;
                  }
                  .company-desc {
                      font-size: 14px;
                      font-weight: 700;
                      color: #4b5563;
                      margin-top: 5px;
                  }
                  .company-phone {
                      font-size: 14px;
                      font-weight: 800;
                      color: #111827;
                      margin-top: 5px;
                  }
                  .header-center {
                      position: absolute;
                      left: 50%;
                      top: 5px;
                      transform: translateX(-50%);
                      z-index: 20;
                  }
                  .bond-title {
                      font-size: 22px;
                      font-weight: 950;
                      color: ${titleColor};
                      background: ${titleBg};
                      border: 2px solid ${titleBorder};
                      padding: 5px 28px;
                      border-radius: 12px;
                      box-shadow: 0 4px 6px rgba(0,0,0,0.02);
                      white-space: nowrap;
                  }
                  .header-left {
                      display: flex;
                      flex-direction: column;
                      align-items: center;
                      text-align: center;
                  }
                  .logo {
                      width: 90px;
                      height: 90px;
                      object-fit: contain;
                      margin-top: 25px;
                      margin-bottom: 10px;
                      background: #ffffff;
                      border-radius: 18px;
                      padding: 6px;
                      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                      box-sizing: border-box;
                  }
                  .date-time {
                      font-size: 13px;
                      font-weight: bold;
                      color: #374151;
                      line-height: 1.5;
                  }
                  .divider {
                      border: 0;
                      border-top: 2px solid #374151;
                      margin: 15px 0 30px 0;
                      position: relative;
                      z-index: 10;
                  }
                  .content-fields {
                      font-size: 17px;
                      color: #1f2937;
                      line-height: 2.4;
                      position: relative;
                      z-index: 10;
                      margin-bottom: 40px;
                  }
                  .field-row {
                      display: flex;
                      align-items: center;
                      margin-bottom: 15px;
                  }
                  .field-label {
                      font-weight: 800;
                      color: #4b5563;
                      min-width: 150px;
                  }
                  .field-value {
                      flex: 1;
                      font-weight: bold;
                      color: #111827;
                      border-bottom: 2px dotted #9ca3af;
                      padding: 0 10px;
                  }
                  .amount-container {
                      display: flex;
                      justify-content: flex-end;
                      margin-top: -10px;
                      margin-bottom: 30px;
                      position: relative;
                      z-index: 10;
                  }
                  .amount-box {
                      border: 3px solid #111827;
                      padding: 10px 30px;
                      font-size: 24px;
                      font-weight: 950;
                      background: #f9fafb;
                      border-radius: 14px;
                      box-shadow: 0 4px 6px rgba(0,0,0,0.02);
                  }
                  .footer-signatures {
                      display: flex;
                      justify-content: space-between;
                      margin-top: 50px;
                      padding: 0 30px;
                      position: relative;
                      z-index: 10;
                  }
                  .signature-box {
                      text-align: center;
                      width: 180px;
                  }
                  .signature-title {
                      font-weight: 800;
                      color: #4b5563;
                      margin-bottom: 45px;
                      font-size: 16px;
                  }
                  .signature-line {
                      border-top: 2px solid #4b5563;
                      width: 100%;
                  }
                  .print-button-container {
                      position: fixed;
                      bottom: 25px;
                      right: 25px;
                      z-index: 100;
                  }
                  .print-btn {
                      background: #111827;
                      color: #ffffff;
                      border: none;
                      padding: 14px 28px;
                      font-size: 15px;
                      font-weight: bold;
                      border-radius: 10px;
                      cursor: pointer;
                      box-shadow: 0 5px 15px rgba(0,0,0,0.2);
                      font-family: 'Cairo', sans-serif;
                      transition: all 0.2s ease;
                  }
                  .print-btn:hover {
                      background: #1f2937;
                      transform: translateY(-2px);
                  }
                  @media print {
                      body {
                          background: white;
                          padding: 0;
                      }
                      .bond-card {
                          box-shadow: none;
                          border: none;
                          padding: 20px;
                      }
                      .print-button-container {
                          display: none;
                      }
                  }
              </style>
          </head>
          <body>
              <div class="print-button-container">
                  <button class="print-btn" onclick="window.print()">طباعة المستند</button>
              </div>
              <div class="bond-card">
                  <div class="curve-top-left"></div>
                  <div class="curve-bottom-right"></div>
                  
                  <div class="header">
                      <div class="header-right">
                          <div class="company-name">${generalSettings?.storeName || 'شركة ميلانو'}</div>
                          ${generalSettings?.storeDescription ? `<div class="company-desc">${generalSettings.storeDescription}</div>` : ''}
                          ${generalSettings?.storeAddress ? `<div class="company-phone">${generalSettings.storeAddress}</div>` : ''}
                          ${generalSettings?.phoneNumber ? `<div class="company-phone">الهاتف: ${generalSettings.phoneNumber}</div>` : ''}
                      </div>
                      <div class="header-center">
                          <div class="bond-title">${title}</div>
                      </div>
                      <div class="header-left">
                          <img src="${generalSettings?.invoiceLogo || '/admin-logo.png'}" alt="Logo" class="logo" onerror="this.src='/logo.jpg'; this.onerror=function(){this.src='/logo-rounded.png'; this.onerror=null;}" />
                          <div class="date-time">التاريخ: ${expense.date || ''}</div>
                      </div>
                  </div>
                  
                  <hr class="divider" />
                  
                  <div class="content-fields">
                      <div class="field-row">
                          <span class="field-label">البند / المصروف:</span>
                          <span class="field-value">${expense.title || ''}</span>
                      </div>
                      <div class="field-row">
                          <span class="field-label">التصنيف:</span>
                          <span class="field-value">${categoriesMap[expense.category] || expense.category}</span>
                      </div>
                      <div class="field-row">
                          <span class="field-label">البيان / التفاصيل:</span>
                          <span class="field-value">${expense.description || '-'}</span>
                      </div>
                      <div class="field-row">
                          <span class="field-label">طريقة الدفع:</span>
                          <span class="field-value">${getPaymentLabel(expense.paymentMethod)}</span>
                      </div>
                      <div class="field-row">
                          <span class="field-label">مبلغ وقدره:</span>
                          <span class="field-value">${expense.amount ? expense.amount.toLocaleString() : '0'} ${getCurrencyLabel(expense.currency || currency)}</span>
                      </div>
                  </div>
                  
                  <div class="amount-container">
                      <div class="amount-box">
                          ${expense.amount ? expense.amount.toLocaleString() : '0'} ${expense.currency || currency}
                      </div>
                  </div>
                  
                  <div class="footer-signatures">
                      <div class="signature-box">
                          <div class="signature-title">المحاسب</div>
                          <div class="signature-line"></div>
                      </div>
                      <div class="signature-box">
                          <div class="signature-title">المستلم</div>
                          <div class="signature-line"></div>
                      </div>
                  </div>
              </div>
          </body>
          </html>
        `;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    return (
        <div className="space-y-3 px-1 sm:px-3 py-2 bg-[#f8f9fa] dark:bg-[#0a0a0b] min-h-screen font-['Cairo']">

            {/* -------------------- SECTION 1: EXPENSES -------------------- */}
            {(!isWorker || workerPerms.allowExpenses) && (
            <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl p-3 sm:p-4 transition-colors duration-300">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
                    <div>
                        <h2 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                            <span className="p-1.5 sm:p-2 bg-red-50 dark:bg-red-500/10 rounded-lg text-red-500">
                                <DollarSign size={18} />
                            </span>
                            {isRTL ? 'إدارة المصروفات' : 'Expenses Management'}
                        </h2>
                        <p className="text-xs font-bold text-gray-400 mt-0.5">
                            {isRTL ? 'تسجيل ومراقبة النفقات التشغيلية والمصروفات العامة' : 'Record and monitor operating costs and expenses'}
                        </p>
                    </div>

                    <div className="flex gap-1.5 w-full sm:w-auto">
                        <button
                            onClick={handlePrintExpensesReport}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-white rounded-lg transition-all duration-200 text-xs font-black shadow-sm"
                        >
                            <Printer size={14} />
                            <span>{isRTL ? 'تقرير' : 'Report'}</span>
                        </button>
                        <button
                            onClick={handleAddExpenseClick}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white rounded-lg transition-all duration-200 shadow-sm text-xs font-black"
                        >
                            <Plus size={14} />
                            <span>{isRTL ? 'تسجيل مصروف' : 'New Expense'}</span>
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col gap-2 mb-2 bg-gray-50/50 dark:bg-white/[0.02] p-2.5 rounded-xl">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <div className="relative w-full sm:w-56">
                            <span className="absolute inset-y-0 start-0 flex items-center ps-3 text-gray-400">
                                <Search size={16} />
                            </span>
                            <input
                                type="text"
                                value={expensesSearch}
                                onChange={(e) => setExpensesSearch(e.target.value)}
                                placeholder={isRTL ? 'بحث في المصروفات...' : 'Search expenses...'}
                                className="w-full ps-9 pe-3 py-2 text-sm text-gray-900 border border-gray-200 dark:border-white/5 rounded-lg bg-white dark:bg-[#2c2c2e] focus:ring-red-500 focus:border-red-500 dark:text-white font-bold"
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1.5">
                                <Calendar size={14} className="text-gray-400" />
                                <span className="text-xs font-bold text-gray-400 whitespace-nowrap">{isRTL ? 'تحديد فترة المصروفات:' : 'Period:'}</span>
                            </div>
                            <select
                                value={expensesPeriod}
                                onChange={(e) => setExpensesPeriod(e.target.value)}
                                className="px-3 py-2 text-xs font-bold border border-gray-200 dark:border-white/5 rounded-lg bg-white dark:bg-[#2c2c2e] dark:text-white"
                            >
                                <option value="all">{isRTL ? 'الكل' : 'All'}</option>
                                <option value="this_week">{isRTL ? 'هذا الأسبوع' : 'This Week'}</option>
                                <option value="this_month">{isRTL ? 'هذا الشهر' : 'This Month'}</option>
                                <option value="this_year">{isRTL ? 'هذا السنة' : 'This Year'}</option>
                            </select>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <div className="flex flex-col">
                                <label className="text-[10px] text-gray-400 font-bold mb-0.5">{isRTL ? 'من تاريخ' : 'From'}</label>
                                <input
                                    type="date"
                                    value={expensesStartDate}
                                    onChange={(e) => {
                                        setExpensesPeriod('custom');
                                        setExpensesStartDate(e.target.value);
                                    }}
                                    className="bg-white dark:bg-[#2c2c2e] border border-gray-200 dark:border-white/5 rounded-lg px-2 py-1.5 text-xs outline-none font-bold text-gray-800 dark:text-white"
                                />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-[10px] text-gray-400 font-bold mb-0.5">{isRTL ? 'إلى تاريخ' : 'To'}</label>
                                <input
                                    type="date"
                                    value={expensesEndDate}
                                    onChange={(e) => {
                                        setExpensesPeriod('custom');
                                        setExpensesEndDate(e.target.value);
                                    }}
                                    className="bg-white dark:bg-[#2c2c2e] border border-gray-200 dark:border-white/5 rounded-lg px-2 py-1.5 text-xs outline-none font-bold text-gray-800 dark:text-white"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-xl">
                    <table className="w-full text-sm text-start text-gray-600 dark:text-gray-300 min-w-[500px]">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5 font-black">
                            <tr>
                                <th className="px-3 py-2.5 text-start">#</th>
                                <th className="px-3 py-2.5 text-start">{isRTL ? 'البند' : 'Title'}</th>
                                <th className="px-3 py-2.5 text-start">{isRTL ? 'التصنيف' : 'Category'}</th>
                                <th className="px-3 py-2.5 text-start whitespace-nowrap">{isRTL ? 'التاريخ' : 'Date'}</th>
                                <th className="px-3 py-2.5 text-end whitespace-nowrap">{isRTL ? 'المبلغ' : 'Amount'}</th>
                                <th className="px-3 py-2.5 text-center">{isRTL ? 'إجراءات' : 'Actions'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5 font-bold text-sm">
                            {filteredExpenses.map((expense, idx) => (
                                <tr key={expense.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.01] transition-all">
                                    <td className="px-3 py-2.5 text-start text-gray-400">{idx + 1}</td>
                                    <td className="px-3 py-2.5 text-start text-gray-900 dark:text-white whitespace-nowrap">{expense.title}</td>
                                    <td className="px-3 py-2.5 text-start">
                                        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-[#2c2c2e] text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                            {categoriesMap[expense.category] || expense.category}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5 text-start text-gray-500 whitespace-nowrap">{expense.date}</td>
                                    <td className="px-3 py-2.5 text-end font-extrabold text-red-500 dark:text-red-400 whitespace-nowrap">
                                        {expense.amount.toLocaleString()} {getCurrencyLabel(expense.currency || currency)}
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                        <div className="flex items-center justify-center gap-1.5">
                                            <button
                                                onClick={() => handlePrintExpenseSingle(expense)}
                                                className="p-1.5 bg-gray-50 hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10 rounded-lg text-gray-600 dark:text-white hover:scale-105 transition-transform"
                                                title={isRTL ? 'طباعة المصروف' : 'Print Expense'}
                                            >
                                                <Printer size={14} />
                                            </button>
                                            {!isWorker && (
                                            <button
                                                onClick={() => handleEditExpenseClick(expense)}
                                                className="p-1.5 bg-blue-50 dark:bg-blue-500/10 rounded-lg text-blue-600 hover:scale-105 transition-transform"
                                                title={isRTL ? 'تعديل' : 'Edit'}
                                            >
                                                <Edit size={14} />
                                            </button>
                                            )}
                                            {!isWorker && (
                                            <button
                                                onClick={() => handleDeleteExpense(expense.id)}
                                                className="p-1.5 bg-red-50 dark:bg-red-500/10 rounded-lg text-red-500 hover:scale-105 transition-transform"
                                                title={isRTL ? 'حذف' : 'Delete'}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredExpenses.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-3 py-8 text-center text-gray-400 font-bold text-sm">
                                        {isRTL ? 'لا توجد مصروفات مسجلة' : 'No expenses found'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot className="bg-gray-50/50 dark:bg-white/[0.02] border-t border-gray-100 dark:border-white/5 font-extrabold text-sm">
                            <tr>
                                <td colSpan={4} className="px-3 py-2.5 text-start text-gray-900 dark:text-white whitespace-nowrap">
                                    {isRTL ? 'الإجمالي' : 'Total'}
                                </td>
                                <td className="px-3 py-2.5 text-end text-red-500 dark:text-red-400 whitespace-nowrap">
                                    {totalExpenses.toLocaleString()} {getCurrencyLabel(currency)}
                                </td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
            )}

            {/* -------------------- SECTION 2: BONDS -------------------- */}
            {(!isWorker || workerPerms.allowBonds) && (
            <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl p-3 sm:p-4 transition-colors duration-300">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
                    <div>
                        <h2 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                            <span className="p-1.5 sm:p-2 bg-green-50 dark:bg-green-500/10 rounded-lg text-green-500">
                                <FileText size={18} />
                            </span>
                            {isRTL ? 'إدارة السندات المالية' : 'Financial Bonds Management'}
                        </h2>
                        <p className="text-xs font-bold text-gray-400 mt-0.5">
                            {isRTL ? 'سندات القبض وسندات الصرف' : 'Receipt & Payment Vouchers'}
                        </p>
                    </div>

                    <div className="flex gap-1.5 w-full sm:w-auto">
                        <button
                            onClick={handlePrintBondsReport}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-white rounded-lg transition-all duration-200 text-xs font-black shadow-sm"
                        >
                            <Printer size={14} />
                            <span>{isRTL ? 'تقرير' : 'Report'}</span>
                        </button>
                        <button
                            onClick={() => handleAddBondClick()}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white rounded-lg transition-all duration-200 shadow-sm text-xs font-black"
                        >
                            <Plus size={14} />
                            <span>{isRTL ? 'سند جديد' : 'New Bond'}</span>
                        </button>
                    </div>
                </div>

                {/* Filter and Tab Bar */}
                <div className="space-y-2 mb-2 bg-gray-50/50 dark:bg-white/[0.02] p-2.5 rounded-xl">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        {/* Search */}
                        <div className="relative w-full sm:w-56">
                            <span className="absolute inset-y-0 start-0 flex items-center ps-3 text-gray-400">
                                <Search size={16} />
                            </span>
                            <input
                                type="text"
                                value={bondsSearch}
                                onChange={(e) => setBondsSearch(e.target.value)}
                                placeholder={isRTL ? 'بحث بالاسم أو الرقم...' : 'Search Name or #...'}
                                className="w-full ps-9 pe-3 py-2 text-sm text-gray-900 border border-gray-200 dark:border-white/5 rounded-lg bg-white dark:bg-[#2c2c2e] focus:ring-green-500 focus:border-green-500 dark:text-white font-bold"
                            />
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1.5">
                                <Calendar size={14} className="text-gray-400" />
                                <span className="text-xs font-bold text-gray-400 whitespace-nowrap">{isRTL ? 'تحديد فترة السندات:' : 'Period:'}</span>
                            </div>
                            <select
                                value={bondsPeriod}
                                onChange={(e) => setBondsPeriod(e.target.value)}
                                className="px-3 py-2 text-xs font-bold border border-gray-200 dark:border-white/5 rounded-lg bg-white dark:bg-[#2c2c2e] dark:text-white"
                            >
                                <option value="all">{isRTL ? 'الكل' : 'All'}</option>
                                <option value="this_week">{isRTL ? 'هذا الأسبوع' : 'This Week'}</option>
                                <option value="this_month">{isRTL ? 'هذا الشهر' : 'This Month'}</option>
                                <option value="this_year">{isRTL ? 'هذا السنة' : 'This Year'}</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <div className="flex flex-col">
                                <label className="text-[10px] text-gray-400 font-bold mb-0.5">{isRTL ? 'من تاريخ' : 'From'}</label>
                                <input
                                    type="date"
                                    value={bondsStartDate}
                                    onChange={(e) => {
                                        setBondsPeriod('custom');
                                        setBondsStartDate(e.target.value);
                                    }}
                                    className="bg-white dark:bg-[#2c2c2e] border border-gray-200 dark:border-white/5 rounded-lg px-2 py-1.5 text-xs outline-none font-bold text-gray-800 dark:text-white"
                                />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-[10px] text-gray-400 font-bold mb-0.5">{isRTL ? 'إلى تاريخ' : 'To'}</label>
                                <input
                                    type="date"
                                    value={bondsEndDate}
                                    onChange={(e) => {
                                        setBondsPeriod('custom');
                                        setBondsEndDate(e.target.value);
                                    }}
                                    className="bg-white dark:bg-[#2c2c2e] border border-gray-200 dark:border-white/5 rounded-lg px-2 py-1.5 text-xs outline-none font-bold text-gray-800 dark:text-white"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Tabs for Receipts / Payments */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <button
                            onClick={() => setBondsTab('receipt')}
                            className={`flex-none px-4 py-1.5 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 ${bondsTab === 'receipt'
                                    ? 'bg-green-500 text-white shadow-sm'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 bg-gray-100 dark:bg-[#2c2c2e]'
                                }`}
                        >
                            <span>{isRTL ? 'القبض' : 'Receipts'}</span>
                            {bondsTab === 'receipt' && <Check size={14} />}
                        </button>
                        <button
                            onClick={handlePrintReceiptBonds}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg transition-all text-[11px] font-bold border border-green-200"
                        >
                            <Printer size={12} />
                            <span>{isRTL ? 'طباعة سندات القبض' : 'Print Receipts'}</span>
                        </button>

                        <div className="w-px h-5 bg-gray-200 dark:bg-white/10"></div>

                        <button
                            onClick={() => setBondsTab('payment')}
                            className={`flex-none px-4 py-1.5 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 ${bondsTab === 'payment'
                                    ? 'bg-red-500 text-white shadow-sm'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 bg-gray-100 dark:bg-[#2c2c2e]'
                                }`}
                        >
                            <span>{isRTL ? 'الصرف' : 'Payments'}</span>
                            {bondsTab === 'payment' && <Check size={14} />}
                        </button>
                        <button
                            onClick={handlePrintPaymentBonds}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-all text-[11px] font-bold border border-red-200"
                        >
                            <Printer size={12} />
                            <span>{isRTL ? 'طباعة سندات الصرف' : 'Print Payments'}</span>
                        </button>
                    </div>
                </div>

                {/* Bonds Table */}
                <div className="overflow-x-auto rounded-xl">
                    <table className="w-full text-sm text-start text-gray-600 dark:text-gray-300 min-w-[650px]">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5 font-black">
                            <tr>
                                <th className="px-3 py-2.5 text-start">#</th>
                                <th className="px-3 py-2.5 text-start whitespace-nowrap">{isRTL ? 'رقم السند' : 'Bond #'}</th>
                                <th className="px-3 py-2.5 text-start whitespace-nowrap">{isRTL ? 'اسم السيد' : 'Name'}</th>
                                <th className="px-3 py-2.5 text-start whitespace-nowrap">{isRTL ? 'النوع' : 'Type'}</th>
                                <th className="px-3 py-2.5 text-start whitespace-nowrap">{isRTL ? 'التاريخ' : 'Date'}</th>
                                <th className="px-3 py-2.5 text-start whitespace-nowrap">{isRTL ? 'الجهة' : 'Entity'}</th>
                                <th className="px-3 py-2.5 text-end whitespace-nowrap">{isRTL ? 'المبلغ' : 'Amount'}</th>
                                <th className="px-3 py-2.5 text-start whitespace-nowrap">{isRTL ? 'الدفع' : 'Pay Method'}</th>
                                <th className="px-3 py-2.5 text-center">{isRTL ? 'إجراءات' : 'Actions'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5 font-bold text-sm">
                            {filteredBonds.map((bond, idx) => (
                                <tr key={bond.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.01] transition-all">
                                    <td className="px-3 py-2.5 text-start text-gray-400">{idx + 1}</td>
                                    <td className="px-3 py-2.5 text-start text-gray-900 dark:text-white font-mono whitespace-nowrap">{bond.number}</td>
                                    <td className="px-3 py-2.5 text-start text-gray-900 dark:text-white whitespace-nowrap max-w-[150px] truncate" title={bond.entityName}>{bond.entityName}</td>
                                    <td className="px-3 py-2.5 text-start whitespace-nowrap">
                                        <span className={`px-2 py-0.5 text-xs rounded-full ${bond.type === 'receipt'
                                                ? 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400'
                                                : 'bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400'
                                            }`}>
                                            {isRTL ? (bond.type === 'receipt' ? 'قبض' : 'صرف') : bond.type}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5 text-start text-gray-500 whitespace-nowrap">{bond.date}</td>
                                    <td className="px-3 py-2.5 text-start text-gray-500 whitespace-nowrap">
                                        {getEntityLabel(bond.entityType)}
                                    </td>
                                    <td className={"px-3 py-2.5 text-end font-extrabold whitespace-nowrap ${bond.type === 'receipt' ? 'text-green-500' : 'text-red-500'}"}>
                                        {bond.amount.toLocaleString()} {getCurrencyLabel(bond.currency || currency)}
                                    </td>
                                    <td className="px-3 py-2.5 text-start whitespace-nowrap">
                                        {getPaymentLabel(bond.paymentMethod)}
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <button
                                                onClick={() => handlePrintBond(bond)}
                                                className="p-1.5 bg-gray-50 hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10 rounded-lg text-gray-600 dark:text-white hover:scale-105 transition-transform"
                                                title={isRTL ? 'طباعة' : 'Print'}
                                            >
                                                <Printer size={14} />
                                            </button>
                                            {!isWorker && (
                                            <button
                                                onClick={() => handleEditBondClick(bond)}
                                                className="p-1.5 bg-blue-50 dark:bg-blue-500/10 rounded-lg text-blue-600 hover:scale-105 transition-transform"
                                                title={isRTL ? 'تعديل' : 'Edit'}
                                            >
                                                <Edit size={14} />
                                            </button>
                                            )}
                                            {!isWorker && (
                                            <button
                                                onClick={() => handleDeleteBond(bond.id)}
                                                className="p-1.5 bg-red-50 dark:bg-red-500/10 rounded-lg text-red-500 hover:scale-105 transition-transform"
                                                title={isRTL ? 'حذف' : 'Delete'}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredBonds.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="px-3 py-8 text-center text-gray-400 font-bold text-sm">
                                        {isRTL ? 'لا توجد سندات' : 'No bonds found'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Totals Section for Bonds */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 border-t border-gray-100 dark:border-white/5 pt-3 font-extrabold text-sm text-gray-700 dark:text-gray-300">
                    <div className="bg-green-50/50 dark:bg-green-500/[0.02] p-2.5 rounded-lg text-center">
                        <span className="text-gray-400 block text-xs">{isRTL ? 'إجمالي المقبوضات' : 'Total Receipts'}</span>
                        <span className="text-green-500 text-base font-black">{totalReceipts.toLocaleString()} {getCurrencyLabel(currency)}</span>
                    </div>

                    <div className="bg-red-50/50 dark:bg-red-500/[0.02] p-2.5 rounded-lg text-center">
                        <span className="text-gray-400 block text-xs">{isRTL ? 'إجمالي المدفوعات' : 'Total Payments'}</span>
                        <span className="text-red-500 text-base font-black">{totalPayments.toLocaleString()} {getCurrencyLabel(currency)}</span>
                    </div>

                    <div className={`p-2.5 rounded-lg text-center ${netBalance >= 0
                            ? 'bg-blue-50/50 dark:bg-blue-500/[0.02]'
                            : 'bg-orange-50/50 dark:bg-orange-500/[0.02]'
                        }`}>
                        <span className="text-gray-400 block text-xs">{isRTL ? 'صافي الرصيد' : 'Net Balance'}</span>
                        <span className={`text-base font-black ${netBalance >= 0 ? 'text-blue-500 dark:text-blue-400' : 'text-orange-500'}`}>
                            {netBalance >= 0 ? '+' : ''}{netBalance.toLocaleString()} {getCurrencyLabel(currency)}
                        </span>
                    </div>
                </div>
            </div>
            )}

            {/* -------------------- MODAL 1: ADD/EDIT EXPENSE -------------------- */}
            {expenseModalOpen && (
                <div
                    onClick={() => setExpenseModalOpen(false)}
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-backdrop-in"
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white dark:bg-[#1c1c1e] rounded-[28px] max-w-md w-full shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh] border border-gray-100 dark:border-white/5 animate-modal-in"
                    >
                        <div className="px-6 py-5 border-b border-gray-100 dark:border-white/5 flex justify-between items-center shrink-0">
                            <h3 className="text-lg font-black text-gray-900 dark:text-white">
                                {editingExpenseId ? (isRTL ? 'تعديل المصروف' : 'Edit Expense') : (isRTL ? 'تسجيل مصروف جديد' : 'New Expense')}
                            </h3>
                            <button
                                onClick={() => setExpenseModalOpen(false)}
                                className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveExpense} className="flex-1 flex flex-col overflow-hidden">
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-black text-gray-400 mb-1">{isRTL ? 'عنوان / بند المصروف' : 'Expense Title'}</label>
                                    <input
                                        type="text"
                                        required
                                        value={currentExpense.title}
                                        onChange={(e) => setCurrentExpense({ ...currentExpense, title: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/5 bg-white dark:bg-[#2c2c2e] dark:text-white font-bold"
                                        placeholder={isRTL ? 'فاتورة الكهرباء، إيجار المعرض...' : 'e.g. Electricity, rent...'}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 mb-1">{isRTL ? 'المبلغ' : 'Amount'}</label>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            value={currentExpense.amount}
                                            onChange={(e) => setCurrentExpense({ ...currentExpense, amount: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/5 bg-white dark:bg-[#2c2c2e] dark:text-white font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 mb-1">{isRTL ? 'التاريخ' : 'Date'}</label>
                                        <input
                                            type="date"
                                            required
                                            value={currentExpense.date}
                                            onChange={(e) => setCurrentExpense({ ...currentExpense, date: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/5 bg-white dark:bg-[#2c2c2e] dark:text-white font-bold"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-gray-400 mb-1">{isRTL ? 'التصنيف' : 'Category'}</label>
                                    <select
                                        value={predefinedCategories.includes(currentExpense.category) ? currentExpense.category : 'custom'}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === 'custom') {
                                                setIsCustomCategory(true);
                                                setCurrentExpense({ ...currentExpense, category: 'custom' });
                                            } else {
                                                setIsCustomCategory(false);
                                                setCurrentExpense({ ...currentExpense, category: val });
                                            }
                                        }}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/5 bg-white dark:bg-[#2c2c2e] dark:text-white font-bold"
                                    >
                                        <option value="Utilities">{categoriesMap.Utilities}</option>
                                        <option value="Rent">{categoriesMap.Rent}</option>
                                        <option value="Salaries">{categoriesMap.Salaries}</option>
                                        <option value="Maintenance">{categoriesMap.Maintenance}</option>
                                        <option value="custom">{isRTL ? 'يدوي (كتابة تصنيف جديد)' : 'Manual (Write new category)'}</option>
                                    </select>
                                    {isCustomCategory && (
                                        <div className="mt-2 animate-fade-in">
                                            <label className="block text-xs font-black text-purple-500 mb-1">{isRTL ? 'اسم التصنيف اليدوي' : 'Manual Category Name'}</label>
                                            <input
                                                type="text"
                                                required
                                                value={customCategoryText}
                                                onChange={(e) => setCustomCategoryText(e.target.value)}
                                                className="w-full px-4 py-2.5 rounded-xl border border-purple-200 focus:border-purple-500 bg-white dark:bg-[#2c2c2e] dark:text-white font-bold"
                                                placeholder={isRTL ? 'اكتب اسم التصنيف الجديد هنا...' : 'Write custom category...'}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 mb-1">{isRTL ? 'العملة' : 'Currency'}</label>
                                        <input
                                            value={getCurrencyLabel()}
                                            readOnly
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/5 dark:text-white font-bold cursor-not-allowed"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 mb-1">{isRTL ? 'طريقة الدفع' : 'Payment Method'}</label>
                                        <input
                                            type="text"
                                            value={currentExpense.paymentMethod || ''}
                                            onChange={(e) => setCurrentExpense({ ...currentExpense, paymentMethod: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/5 bg-white dark:bg-[#2c2c2e] dark:text-white font-bold"
                                            placeholder={isRTL ? 'اكتب طريقة الدفع...' : 'Enter payment method...'}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-gray-400 mb-1">{isRTL ? 'تفاصيل إضافية / البيان' : 'Description / Notes'}</label>
                                    <textarea
                                        value={currentExpense.description}
                                        onChange={(e) => setCurrentExpense({ ...currentExpense, description: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/5 bg-white dark:bg-[#2c2c2e] dark:text-white font-bold"
                                        rows="2"
                                    />
                                </div>
                            </div>

                            <div className="px-6 py-4 border-t border-gray-100 dark:border-white/5 flex gap-3 justify-end shrink-0 bg-gray-50/50 dark:bg-white/[0.02]">
                                <button
                                    type="button"
                                    onClick={() => setExpenseModalOpen(false)}
                                    className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-white rounded-xl text-sm font-black"
                                >
                                    {isRTL ? 'إلغاء' : 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-black shadow-sm"
                                >
                                    {isRTL ? 'حفظ' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* -------------------- MODAL 2: ADD/EDIT BOND -------------------- */}
            {bondModalOpen && (
                <div
                    onClick={() => setBondModalOpen(false)}
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-backdrop-in"
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white dark:bg-[#1c1c1e] rounded-[28px] max-w-lg w-full shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh] border border-gray-100 dark:border-white/5 animate-modal-in"
                    >
                        <div className="px-6 py-5 border-b border-gray-100 dark:border-white/5 flex justify-between items-center shrink-0">
                            <h3 className="text-lg font-black text-gray-900 dark:text-white">
                                {editingBondId ? (isRTL ? 'تعديل السند' : 'Edit Bond') : (isRTL ? 'إنشاء سند مالي جديد' : 'New Bond')}
                            </h3>
                            <button
                                onClick={() => setBondModalOpen(false)}
                                className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveBond} className="flex-1 flex flex-col overflow-hidden">
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 mb-1">{isRTL ? 'نوع السند' : 'Bond Type'}</label>
                                        <select
                                            value={currentBond.type}
                                            onChange={(e) => setCurrentBond({ ...currentBond, type: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/5 bg-white dark:bg-[#2c2c2e] dark:text-white font-bold"
                                        >
                                            <option value="receipt">{isRTL ? 'سند قبض' : 'Receipt'}</option>
                                            <option value="payment">{isRTL ? 'سند صرف' : 'Payment'}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 mb-1">{isRTL ? 'رقم السند' : 'Bond Number'}</label>
                                        <input
                                            type="text"
                                            required
                                            value={currentBond.number}
                                            onChange={(e) => setCurrentBond({ ...currentBond, number: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/5 bg-white dark:bg-[#2c2c2e] dark:text-white font-mono font-bold"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 mb-1">{isRTL ? 'التاريخ' : 'Date'}</label>
                                        <input
                                            type="date"
                                            required
                                            value={currentBond.date}
                                            onChange={(e) => setCurrentBond({ ...currentBond, date: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/5 bg-white dark:bg-[#2c2c2e] dark:text-white font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 mb-1">{isRTL ? 'الوقت' : 'Time'}</label>
                                        <input
                                            type="time"
                                            required
                                            value={currentBond.time}
                                            onChange={(e) => setCurrentBond({ ...currentBond, time: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/5 bg-white dark:bg-[#2c2c2e] dark:text-white font-bold"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 mb-1">{isRTL ? 'الجهة' : 'Entity'}</label>
                                        <input
                                            type="text"
                                            value={currentBond.entityType}
                                            onChange={(e) => setCurrentBond({ ...currentBond, entityType: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/5 bg-white dark:bg-[#2c2c2e] dark:text-white font-bold"
                                            placeholder={isRTL ? 'اكتب اسم الجهة...' : 'Enter entity name...'}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 mb-1">
                                            {currentBond.type === 'receipt' ? (isRTL ? 'استلمنا من السيد' : 'Received From') : (isRTL ? 'صرفنا إلى السيد' : 'Paid To')}
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={currentBond.entityName}
                                            onChange={(e) => setCurrentBond({ ...currentBond, entityName: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/5 bg-white dark:bg-[#2c2c2e] dark:text-white font-bold"
                                            placeholder={isRTL ? 'الاسم الثلاثي أو الشركة...' : 'Enter entity name...'}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 mb-1">{isRTL ? 'مبلغ السند' : 'Amount'}</label>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            value={currentBond.amount}
                                            onChange={(e) => setCurrentBond({ ...currentBond, amount: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/5 bg-white dark:bg-[#2c2c2e] dark:text-white font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 mb-1">{isRTL ? 'العملة' : 'Currency'}</label>
                                        <input
                                            value={getCurrencyLabel()}
                                            readOnly
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/5 dark:text-white font-bold cursor-not-allowed"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 mb-1">{isRTL ? 'طريقة الدفع' : 'Payment Method'}</label>
                                        <input
                                            type="text"
                                            value={currentBond.paymentMethod}
                                            onChange={(e) => setCurrentBond({ ...currentBond, paymentMethod: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/5 bg-white dark:bg-[#2c2c2e] dark:text-white font-bold"
                                            placeholder={isRTL ? 'اكتب طريقة الدفع...' : 'Enter payment method...'}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-gray-400 mb-1">{isRTL ? 'وذلك مقابل (البيان)' : 'For (Reason)'}</label>
                                    <textarea
                                        value={currentBond.notes}
                                        onChange={(e) => setCurrentBond({ ...currentBond, notes: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/5 bg-white dark:bg-[#2c2c2e] dark:text-white font-bold"
                                        rows="2"
                                        placeholder={isRTL ? 'قيمة مبيعات، تسوية حساب، سداد دفعة...' : 'Enter reason...'}
                                    />
                                </div>
                            </div>

                            <div className="px-6 py-4 border-t border-gray-100 dark:border-white/5 flex gap-3 justify-end shrink-0 bg-gray-50/50 dark:bg-white/[0.02]">
                                <button
                                    type="button"
                                    onClick={() => setBondModalOpen(false)}
                                    className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-white rounded-xl text-sm font-black"
                                >
                                    {isRTL ? 'إلغاء' : 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-black shadow-sm"
                                >
                                    {isRTL ? 'حفظ' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExpensesView;
