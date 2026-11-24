require('dotenv').config({ quiet: true });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  const email = process.argv[2];
  const out = process.argv[3];
  const { data, error } = await supabase.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) { console.error('link error', error.message); process.exit(1); }
  const { data: v, error: e2 } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: data.properties.hashed_token });
  if (e2) { console.error('verify error', e2.message); process.exit(1); }
  fs.writeFileSync(out, JSON.stringify(v.session));
  console.error('written', out);
  process.exit(0);
})();
