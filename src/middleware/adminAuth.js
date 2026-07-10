// A deliberately simple admin guard — checks a shared secret key rather than
// a full user login system, since there's only one admin (you) for now.
// If you later have multiple staff needing different access, this should be
// upgraded to real per-person accounts.

function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Invalid admin key' });
  }
  next();
}

module.exports = { requireAdmin };
