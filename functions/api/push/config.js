import { VAPID_PUBLIC_KEY, corsHeaders, json } from './_shared.js';

export function onRequestOptions() { return new Response(null, { status: 204, headers: corsHeaders }); }
export function onRequestGet() { return json({ publicKey: VAPID_PUBLIC_KEY }); }
