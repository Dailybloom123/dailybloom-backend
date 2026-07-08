// Handles sending OTP SMS via MSG91's Flow API.
// Docs: https://docs.msg91.com/reference/send-otp-flow
//
// This requires three things set up on your MSG91 dashboard first:
//   1. MSG91_AUTH_KEY   - from Settings > Authkey
//   2. MSG91_TEMPLATE_ID - the ID of your approved DLT SMS template
//                          (the template must contain a variable, commonly ##OTP##,
//                          matching the "OTP" key sent below)
//
// Until DLT template approval comes through, this call may fail or be rejected —
// that's expected, it's a regulatory step outside of the code itself.

async function sendOtpSms(phone, otp) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;

  if (!authKey || !templateId) {
    // Fall back to console logging if MSG91 isn't configured yet,
    // so local development still works without real credentials.
    console.log(`[DEV ONLY - MSG91 not configured] OTP for ${phone}: ${otp}`);
    return { delivered: false, reason: 'MSG91 not configured' };
  }

  // MSG91 expects numbers with country code and no leading "+", e.g. 919999999999
  const mobile = phone.startsWith('91') ? phone : `91${phone}`;

  const response = await fetch('https://control.msg91.com/api/v5/flow/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authkey: authKey,
    },
    body: JSON.stringify({
      template_id: templateId,
      short_url: '0',
      recipients: [
        {
          mobiles: mobile,
          OTP: otp,
        },
      ],
    }),
  });

  const data = await response.json();

  if (!response.ok || data.type === 'error') {
    console.error('MSG91 send failed:', data);
    // We still log the OTP locally so you're not locked out during testing
    // while MSG91 configuration/approval is being sorted out.
    console.log(`[FALLBACK] OTP for ${phone}: ${otp}`);
    return { delivered: false, reason: data.message || 'MSG91 request failed' };
  }

  return { delivered: true };
}

module.exports = { sendOtpSms };
