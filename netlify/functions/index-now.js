const { google } = require('googleapis');

// Google Service Account Key (MUST be provided via Netlify Environment Variable: GOOGLE_SERVICE_ACCOUNT_KEY)
let auth;
try {
    const keyData = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    auth = new google.auth.JWT(
        keyData.client_email,
        null,
        keyData.private_key,
        ['https://www.googleapis.com/auth/indexing']
    );
} catch (e) {
    console.error("Auth init error:", e.message);
}

exports.handler = async (event, context) => {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
    if (!auth) return { statusCode: 500, body: "Google Auth Not Configured. Please add GOOGLE_SERVICE_ACCOUNT_KEY to Netlify." };

    try {
        const { url, type = "URL_UPDATED" } = JSON.parse(event.body);
        if (!url) return { statusCode: 400, body: "URL is required" };

        const indexing = google.indexing('v3');
        const res = await indexing.urlNotifications.publish({
            auth,
            requestBody: {
                url: url,
                type: type
            }
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Google notified!", data: res.data })
        };
    } catch (error) {
        console.error("Indexing API Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
