// Sends WhatsApp alerts to the admin (you) via CallMeBot — a free service
// meant for personal notifications, not for messaging customers/vendors at scale.
//
// Setup:
//   1. Save +34 644 59 71 20 to your phone contacts
//   2. WhatsApp that number: "I allow callmebot to send me messages"
//   3. You'll receive an API key in reply — add it plus your phone number to .env

async function notifyAdminWhatsApp(message) {
  const apiKey = process.env.CALLMEBOT_API_KEY;
  const phone = process.env.CALLMEBOT_PHONE; // your number, with country code, no +/spaces e.g. 919999999999

  if (!apiKey || !phone) {
    console.log(`[DEV ONLY - CallMeBot not configured] WhatsApp alert would say: ${message}`);
    return { delivered: false, reason: 'CallMeBot not configured' };
  }

  try {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(message)}&apikey=${apiKey}`;
    const response = await fetch(url);
    const text = await response.text();

    if (!response.ok) {
      console.error('CallMeBot send failed:', text);
      return { delivered: false, reason: text };
    }
    return { delivered: true };
  } catch (err) {
    console.error('CallMeBot request error:', err.message);
    return { delivered: false, reason: err.message };
  }
}

module.exports = { notifyAdminWhatsApp };
