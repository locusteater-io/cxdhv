# Supabase Consolidation Plan — locusteater-io

## Current State

| App | Domain | Supabase Ref | Account | Status |
|-----|--------|-------------|---------|--------|
| Field Logger | fieldlogger.locusteater.io | vwriuvmdareoteaymiif | Lovable-managed (external) | Needs migration |
| Micro 2.0 | micro.locusteater.io | uuntipxqxrjxbakjuqzm | Lovable-managed (external) | Needs migration |
| EdgePlanner | — | jngsullxezlxdwibtozx | locusteater-io (pro) | OK |
| HighGround Staging | — | oksrlrlhkrvkrzezjlpi | locusteater-io (pro) | OK |
| CXDHV | dhi.locusteater.io | TBD | locusteater-io (pro) | Creating now |

## Target State

All projects under `locusteater-io` org (zuodrspmzdtcvynudqws) on the pro plan.

---

## Migration: Field Logger

### 1. Create new project
```bash
supabase projects create field-logger --org-id zuodrspmzdtcvynudqws --region us-east-1
```

### 2. Apply schema
Field Logger has migrations in `supabase/migrations/`. Run them against the new project:
```bash
cd /path/to/field-logger
supabase link --project-ref <NEW_REF>
supabase db push
```

### 3. Migrate data
Connect to the OLD project via psql and dump data:
```bash
# Get connection strings from Supabase dashboard for both old and new
pg_dump --data-only --no-owner \
  "postgresql://postgres:[OLD_PASSWORD]@db.vwriuvmdareoteaymiif.supabase.co:5432/postgres" \
  > field-logger-data.sql

psql "postgresql://postgres:[NEW_PASSWORD]@db.<NEW_REF>.supabase.co:5432/postgres" \
  < field-logger-data.sql
```

### 4. Migrate storage
Field Logger uses a "field-log-photos" storage bucket. Export photos:
- Download all objects from old bucket via Supabase dashboard or API
- Upload to new project's storage bucket
- Ensure bucket policies match (public bucket)

### 5. Migrate auth users
```bash
# Export auth.users from old project (requires service_role key)
# Use Supabase Management API or pg_dump of auth schema
# Re-create users in new project via admin API or edge function
```

### 6. Update environment
- Update Netlify env vars: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
- Update any edge function secrets
- Update email templates (password reset redirect URLs should stay the same)

### 7. Verify
- [ ] All field logs visible
- [ ] Photos loading correctly
- [ ] Auth login/signup working
- [ ] Role assignments intact
- [ ] PDF export working
- [ ] Edge functions deployed and functional

### 8. Cutover
- Deploy app with new env vars
- Verify in production
- Decommission old Lovable-managed project

---

## Migration: Micro 2.0 (cx-trip-planner)

### 1. Create new project
```bash
supabase projects create micro --org-id zuodrspmzdtcvynudqws --region us-east-1
```

### 2. Apply schema
```bash
cd /path/to/cx-trip-planner
supabase link --project-ref <NEW_REF>
supabase db push
```

### 3. Migrate data
```bash
pg_dump --data-only --no-owner \
  "postgresql://postgres:[OLD_PASSWORD]@db.uuntipxqxrjxbakjuqzm.supabase.co:5432/postgres" \
  > micro-data.sql

psql "postgresql://postgres:[NEW_PASSWORD]@db.<NEW_REF>.supabase.co:5432/postgres" \
  < micro-data.sql
```

### 4. Migrate auth users
Same process as Field Logger. Micro uses Google OAuth limited to @gotenna.com — ensure Google OAuth provider is configured in new project with same client ID/secret.

### 5. Migrate Asana integration
- Re-deploy `sync-asana` and `create-users` edge functions to new project
- Update any Asana webhook URLs if applicable
- Set edge function secrets (Asana API token, etc.)

### 6. Update environment
- Update Netlify env vars
- Update edge function secrets

### 7. Verify
- [ ] All trips visible
- [ ] Team assignments intact
- [ ] Asana sync working
- [ ] Google OAuth login working
- [ ] Holiday calendar populated
- [ ] Role assignments correct

### 8. Cutover
- Deploy with new env vars
- Verify in production
- Decommission old project

---

## Risk Mitigation

- **Do NOT delete old projects until new ones are verified in production for at least 1 week**
- **Auth users are the hardest part** — passwords cannot be exported from Supabase. Options:
  - If using OAuth only (Micro): just configure same OAuth provider, users re-login seamlessly
  - If using email/password (Field Logger): users will need a password reset on first login to new project
  - Alternative: use Supabase's project transfer feature if available for Lovable projects
- **Run both old and new in parallel** during transition — point staging to new, prod to old, then swap
- **Storage migration** for Field Logger photos is the most time-consuming — script it

## Timeline Estimate
- Field Logger: ~2-3 hours (most time on storage + auth migration)
- Micro 2.0: ~1-2 hours (no storage, simpler schema)
- Buffer for testing: 1 day parallel run each
