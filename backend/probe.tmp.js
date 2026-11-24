require('dotenv').config();
const db = require('./db');
(async () => {
  const q = async (s, p) => { try { const r = await db.query(s, p); return r.rows; } catch (e) { return [{ err: e.message }]; } };
  const out = {};
  out.postsCols = await q("select column_name, data_type from information_schema.columns where table_name='posts' order by ordinal_position");
  out.posts = await q("select * from posts order by created_at desc limit 3");
  out.snapsCols = await q("select column_name, data_type from information_schema.columns where table_name='snaps' order by ordinal_position");
  out.snaps = await q("select count(*)::int c from snaps");
  out.audit = await q("select action, count(*)::int c from admin_audit_log group by 1 order by c desc");
  out.reports = await q("select count(*)::int c from reports");
  out.reposts = await q("select count(*)::int c from reposts");
  out.saved = await q("select count(*)::int c from saved_posts");
  out.msgs = await q("select count(*)::int c from messages");
  out.friends = await q("select status, count(*)::int c from friendships group by 1");
  out.departments = await q("select name, code from departments");
  console.log(JSON.stringify(out, null, 1));
  process.exit(0);
})();
