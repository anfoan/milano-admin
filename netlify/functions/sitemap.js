const admin = require('firebase-admin');

// Initialize Firebase Admin (Only once)
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: "milano-store-53d33",
            // For security, use environment variables in Netlify UI
            // But we'll try to fetch from standard config if possible
            // For now, we'll use the basic fetch approach if we don't have a full service account
        }),
        databaseURL: "https://milano-store-53d33.firebaseio.com"
    });
}

const db = admin.firestore();

exports.handler = async (event, context) => {
    try {
        const baseUrl = "https://milano-store.com"; // Change to your actual domain
        
        // 1. Fetch Categories
        const catsSnap = await db.collection('categories').get();
        const categories = catsSnap.docs.map(doc => doc.data().name);

        // 2. Fetch Products
        const prodSnap = await db.collection('products').where('hidden', '==', false).get();
        const products = prodSnap.docs.map(doc => ({ id: doc.id, updatedAt: doc.data().updatedAt }));

        // 3. Build XML
        let xml = '<?xml version="1.0" encoding="UTF-8"?>';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

        // Static Pages
        const staticPages = ['', '/offers', '/reviews', '/contact', '/info'];
        staticPages.forEach(page => {
            xml += `
            <url>
                <loc>${baseUrl}${page}</loc>
                <changefreq>daily</changefreq>
                <priority>0.8</priority>
            </url>`;
        });

        // Category Pages
        categories.forEach(cat => {
            xml += `
            <url>
                <loc>${baseUrl}/category/${encodeURIComponent(cat)}</loc>
                <changefreq>weekly</changefreq>
                <priority>0.7</priority>
            </url>`;
        });

        // Product Pages
        products.forEach(p => {
            const lastMod = p.updatedAt ? new Date(p.updatedAt.toDate()).toISOString() : new Date().toISOString();
            xml += `
            <url>
                <loc>${baseUrl}/product/${p.id}</loc>
                <lastmod>${lastMod}</lastmod>
                <changefreq>weekly</changefreq>
                <priority>1.0</priority>
            </url>`;
        });

        xml += '</urlset>';

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/xml",
                "Cache-Control": "public, max-age=3600"
            },
            body: xml
        };
    } catch (error) {
        console.error("Sitemap Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
