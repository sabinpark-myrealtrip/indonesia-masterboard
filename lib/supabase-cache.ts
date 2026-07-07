import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.');
    client = createClient(url, key);
  }
  return client;
}

/** sync 스크립트가 채워둔 bq_cache에서 읽는다. 캐시가 없으면 null. */
export async function getCached<T>(cacheKey: string): Promise<{ data: T; syncedAt: string } | null> {
  const { data, error } = await getClient()
    .from('bq_cache')
    .select('data, synced_at')
    .eq('cache_key', cacheKey)
    .maybeSingle();

  if (error) throw new Error(`Supabase cache read 실패 (${cacheKey}): ${error.message}`);
  if (!data) return null;
  return { data: data.data as T, syncedAt: data.synced_at as string };
}

/** sync 스크립트 전용 — API 라우트에서는 쓰지 않는다. */
export async function setCached(cacheKey: string, data: unknown): Promise<void> {
  const { error } = await getClient()
    .from('bq_cache')
    .upsert({ cache_key: cacheKey, data, synced_at: new Date().toISOString() });
  if (error) throw new Error(`Supabase cache write 실패 (${cacheKey}): ${error.message}`);
}
