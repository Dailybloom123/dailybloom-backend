// A robust admin guard — checks a shared secret key from either custom
// or standard headers, strips Bearer prefixes, and trims whitespace.
// If you later have multiple staff needing different access, this should be
// upgraded to real per-person accounts.

function requireAdmin(req, res, next) {
  // 1. Check custom header first, fall back to standard Authorization header
  const rawHeader = req.headers['x-admin-key'] || req.headers.authorization || '';
  
  // 2. Strip 'Bearer ' if present and trim any hidden whitespace/newlines
  const key = rawHeader.replace(/^Bearer\s+/i, '').trim();
  const expectedKey = (process.env.ADMIN_KEY || '').trim();
  
  // 3. Informative debug logging (logs lengths so you can see invisible character mismatches)
  console.log('Admin auth check:', {
    receivedLength: key ? key.length : 0,
    expectedLength: expectedKey ? expectedKey.length : 0,
    match: key !== '' && key === expectedKey
  });
  
  if (!key) {
    console.log('Admin key missing from request headers');
    return res.status(401).json({ error: 'Admin key is required' });
  }
  
  if (key !== expectedKey) {
    console.log(`Admin key mismatch -> Received len: ${key.length}, Expected len: ${expectedKey.length}`);
    return res.status(401).json({ error: 'Invalid admin key' });
  }
  
  next();
}

module.exports = { requireAdmin };