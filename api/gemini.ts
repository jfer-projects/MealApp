import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://xamzenezncjsmmvkafxq.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_ouCtW1z5jcvxE1PaDbT1eQ_Xlu5CbNy';

/**
 * Serverless Proxy for Google Gemini requests.
 * Authenticates the caller via their Supabase session token, resolves the household's
 * Gemini API key on the server side, and forwards the prompt to Google's Generative Language API.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const authHeader = req.headers?.authorization || '';
    const { model = 'gemini-2.5-flash', contents, generationConfig, householdId, apiKey } =
      typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

    let resolvedKey = typeof apiKey === 'string' && !apiKey.startsWith('HOUSEHOLD_SHARED')
      ? apiKey.trim()
      : '';

    // If no raw key was passed from client, resolve from Supabase using caller's JWT
    if (!resolvedKey && authHeader) {
      const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });

      if (householdId) {
        const { data } = await supa
          .from('household_settings')
          .select('gemini_api_key')
          .eq('household_id', householdId)
          .maybeSingle();
        if (data?.gemini_api_key) {
          resolvedKey = data.gemini_api_key.trim();
        }
      }

      if (!resolvedKey) {
        const { data: userData } = await supa.auth.getUser();
        const metaKey = userData?.user?.user_metadata?.gemini_api_key;
        if (typeof metaKey === 'string' && metaKey.trim()) {
          resolvedKey = metaKey.trim();
        }
      }
    }

    if (!resolvedKey) {
      res.status(400).json({ error: 'No Gemini API key configured for this household.' });
      return;
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(resolvedKey)}`;

    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, generationConfig }),
    });

    const text = await upstream.text();
    res.status(upstream.status).setHeader('Content-Type', 'application/json').send(text);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Gemini proxy error' });
  }
}
