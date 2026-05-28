# Supabase

The DB schema for BrowseLater. Migrations are timestamp-prefixed and meant to be applied with the Supabase CLI:

```bash
# One-time
supabase link --project-ref <project-ref>

# Apply all migrations to remote
supabase db push

# Generate TypeScript types
supabase gen types typescript --linked > lib/db/database.types.ts
```

Then enable:

- **Auth → Providers → Email**: turn on Magic Link.
- **Auth → Providers → Google**: paste client ID/secret, set authorized redirect URI to `https://<project>.supabase.co/auth/v1/callback`.
- **Database → Extensions**: confirm `vector`, `pgcrypto`, `uuid-ossp` are enabled (migration 0001 enables them).
- **Storage**: confirm buckets `html-snapshots`, `pdfs`, `images` exist (migration 0011 creates them).

## RLS

Every table is single-user: `user_id = auth.uid()` everywhere. The few "child" tables (`item_content`, `item_ai`, `insight_cards`, `item_tags`) gate access via `items.user_id`.

## Notes

- Embeddings dimension is 1024 (Voyage `voyage-3`). If you swap providers, change the column type and re-run.
- IVFFlat index uses `lists=100`; tune after corpus reaches ~10k vectors.
- The `events` table allows owner SELECT but no client INSERT — events go in via the service-role server.
