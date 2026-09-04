// PostgREST returns at most 1000 rows per request (Supabase's default Max
// Rows) and does not error when it truncates. Season-wide reads page through.
export async function fetchAll(build, page = 1000) {
  const out = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await build().range(from, from + page - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < page) return out;
  }
}
