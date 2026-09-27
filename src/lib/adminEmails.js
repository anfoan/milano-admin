import { doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';

// Fallback list — keeps the original admins working even if Firestore is unreachable,
// and is used to seed the Firestore doc on first use.
export const FALLBACK_ADMIN_EMAILS = [
    'ah3992222@gmail.com',
    'milanoyemen@gmail.com',
    'milanostore@gmail.com',
    'payg91254@gmail.com',
    'grgr@getemails.uk'
];

const ADMINS_DOC = doc(db, 'admins', 'list');

// Read admin emails from Firestore. If the doc is missing, seed it with the fallback list.
// Returns null only if Firestore is unreachable/denied (gate then falls back to the code list).
export async function getAdminEmails() {
    try {
        const snap = await getDoc(ADMINS_DOC);
        if (snap.exists()) {
            const emails = snap.data().emails;
            return Array.isArray(emails) ? emails : [];
        }
        // Doc missing → seed once so future email self-adds have somewhere to write
        await setDoc(ADMINS_DOC, { emails: FALLBACK_ADMIN_EMAILS });
        return FALLBACK_ADMIN_EMAILS;
    } catch (e) {
        return null;
    }
}

// Case-insensitive admin check against Firestore list + fallback list
export async function isAdminEmail(email) {
    if (!email) return false;
    const target = String(email).toLowerCase();
    const firestoreList = await getAdminEmails();
    const combined = new Set([...FALLBACK_ADMIN_EMAILS, ...(firestoreList || [])]);
    return [...combined].some(e => String(e).toLowerCase() === target);
}

// Add an email to the Firestore admin list — called automatically when an admin
// changes their email via verifyBeforeUpdateEmail, so the new email works instantly.
export async function addAdminEmail(email) {
    if (!email) return;
    try {
        const snap = await getDoc(ADMINS_DOC);
        if (snap.exists()) {
            await updateDoc(ADMINS_DOC, { emails: arrayUnion(email) });
        } else {
            const seed = [...new Set([...FALLBACK_ADMIN_EMAILS, email])];
            await setDoc(ADMINS_DOC, { emails: seed });
        }
    } catch (e) {
        // Silently ignore — gate falls back to the code list, nothing breaks
    }
}
