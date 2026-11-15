const db = require('../db');

async function resetMfa() {
  const email = process.argv[2] || 'superadmin@lccbonline.edu.ph';
  console.log(`Looking up user: ${email}...`);

  const u = await db.query(
    `SELECT u.id, u.email, p.role 
     FROM auth.users u
     LEFT JOIN public.profiles p ON p.id::text = u.id::text
     WHERE u.email ILIKE $1`,
    [email]
  );

  if (!u.rows[0]) {
    console.log(`User with email ${email} not found in auth.users.`);
    return;
  }

  const user = u.rows[0];
  console.log(`Found user: ${user.email} (${user.id}), role: ${user.role}`);

  // Also sync profile email if it was null
  await db.query(`UPDATE public.profiles SET email = $1 WHERE id::text = $2 AND (email IS NULL OR email != $1)`, [user.email, user.id]);

  const existingFactors = await db.query('SELECT id, type, status, created_at FROM public.mfa_factors WHERE user_id = $1', [user.id]);
  console.log('Existing factors:', existingFactors.rows);

  const delFactors = await db.query('DELETE FROM public.mfa_factors WHERE user_id = $1 RETURNING *', [user.id]);
  console.log(`Deleted ${delFactors.rowCount} MFA factor(s).`);

  const delEvents = await db.query('DELETE FROM public.session_events WHERE user_id = $1', [user.id]);
  console.log(`Deleted ${delEvents.rowCount} session event(s).`);

  console.log(`MFA successfully reset for ${user.email}.`);
}

resetMfa()
  .catch(console.error)
  .finally(() => process.exit(0));
