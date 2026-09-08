// Sends WhatsApp alerts via CallMeBot — a free service for personal notifications
//
// Setup for Admin Notifications:
//   1. Save +34 644 59 71 20 to your phone contacts
//   2. WhatsApp that number: "I allow callmebot to send me messages"
//   3. You'll receive an API key in reply — add it plus your phone number to .env
//
// Note: CallMeBot can only send messages to ONE registered phone number (the admin).
// For sending to customers, use WhatsApp Business App manually or upgrade to WhatsApp Business API.

async function sendWhatsAppMessage(phone, message) {
  const apiKey = process.env.CALLMEBOT_API_KEY;
  const adminPhone = process.env.CALLMEBOT_PHONE; // your number, with country code, no +/spaces e.g. 919999999999

  if (!apiKey || !adminPhone) {
    console.log(`[DEV ONLY - CallMeBot not configured] WhatsApp message would say: ${message}`);
    return { delivered: false, reason: 'CallMeBot not configured' };
  }

  // CallMeBot only sends to the registered admin phone number
  // If trying to send to a different number, log it for manual handling
  if (phone !== adminPhone) {
    console.log(`[WhatsApp Business App] Send this message to customer ${phone}: ${message}`);
    console.log('Note: CallMeBot only sends to admin phone. Use WhatsApp Business App to send to customers.');
    return { delivered: false, reason: 'CallMeBot only sends to registered admin number. Use WhatsApp Business App for customers.' };
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

async function notifyAdminWhatsApp(message) {
  return sendWhatsAppMessage(process.env.CALLMEBOT_PHONE, message);
}

// WhatsApp ordering via Twilio
const twilio = require('twilio');

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  
  if (!accountSid || !authToken) {
    console.log('[DEV ONLY - Twilio not configured]');
    return null;
  }
  
  return twilio(accountSid, authToken);
}

async function sendWhatsAppOrder(to, orderDetails) {
  const client = getTwilioClient();
  const from = process.env.TWILIO_WHATSAPP_NUMBER;
  
  if (!client || !from) {
    console.log('[DEV ONLY - Twilio WhatsApp not configured] Order would be sent to:', to);
    console.log('Order details:', orderDetails);
    return { delivered: false, reason: 'Twilio not configured' };
  }

  try {
    const message = formatOrderMessage(orderDetails);
    const response = await client.messages.create({
      from: `whatsapp:${from}`,
      to: `whatsapp:${to}`,
      body: message
    });
    
    console.log('WhatsApp order sent:', response.sid);
    return { delivered: true, sid: response.sid };
  } catch (err) {
    console.error('Twilio WhatsApp error:', err.message);
    return { delivered: false, reason: err.message };
  }
}

function formatOrderMessage(orderDetails) {
  const { items, total, address, customerName, orderId } = orderDetails;
  
  let message = `🌸 *New Order #${orderId}*\n\n`;
  message += `*Customer:* ${customerName}\n`;
  message += `*Delivery Address:* ${address.line1}, ${address.locality}, ${address.city} - ${address.pincode}\n\n`;
  message += `*Items:*\n`;
  
  items.forEach((item, index) => {
    message += `${index + 1}. ${item.name} x${item.quantity} - ₹${item.price * item.quantity}\n`;
  });
  
  message += `\n*Total: ₹${total}*\n`;
  message += `\nThank you for ordering with DailyBloom! 🌸`;
  
  return message;
}

async function sendWhatsAppConfirmation(to, orderId, status) {
  const client = getTwilioClient();
  const from = process.env.TWILIO_WHATSAPP_NUMBER;
  
  if (!client || !from) {
    console.log('[DEV ONLY - Twilio WhatsApp not configured] Confirmation would be sent to:', to);
    return { delivered: false, reason: 'Twilio not configured' };
  }

  try {
    const statusMessages = {
      confirmed: '✅ Your order has been confirmed!',
      preparing: '👨‍🍳 Your order is being prepared.',
      out_for_delivery: '🚚 Your order is out for delivery!',
      delivered: '🎉 Your order has been delivered!',
      cancelled: '❌ Your order has been cancelled.'
    };
    
    const message = `${statusMessages[status] || 'Order status updated'}\n\nOrder #${orderId}\n\nThank you for choosing DailyBloom! 🌸`;
    
    const response = await client.messages.create({
      from: `whatsapp:${from}`,
      to: `whatsapp:${to}`,
      body: message
    });
    
    return { delivered: true, sid: response.sid };
  } catch (err) {
    console.error('Twilio WhatsApp confirmation error:', err.message);
    return { delivered: false, reason: err.message };
  }
}

// WhatsApp ordering flow for zero-cost startup
// Customers can send orders via WhatsApp to a business number
// Admin receives notification via CallMeBot and processes manually

async function processWhatsAppOrder(orderDetails) {
  const { customerPhone, customerName, items, address, total } = orderDetails;
  
  // Notify admin about new WhatsApp order
  const adminMessage = `🌸 *New WhatsApp Order*\n\n*Customer:* ${customerName}\n*Phone:* ${customerPhone}\n*Address:* ${address.line1}, ${address.city} - ${address.pincode}\n\n*Items:*\n${items.map((i, idx) => `${idx + 1}. ${i.name} x${i.quantity} - ₹${i.price * i.quantity}`).join('\n')}\n\n*Total: ₹${total}*\n\nPlease process this order and confirm with customer via WhatsApp Business App.`;
  
  const result = await notifyAdminWhatsApp(adminMessage);
  
  // Log customer notification for manual sending via WhatsApp Business App
  console.log(`[WhatsApp Business App] Send order confirmation to customer ${customerPhone}:`);
  console.log(`Message: ✅ Order received! We'll process it shortly. Total: ₹${total}`);
  
  return result;
}

module.exports = { 
  notifyAdminWhatsApp, 
  sendWhatsAppOrder, 
  sendWhatsAppConfirmation,
  formatOrderMessage,
  sendWhatsAppMessage,
  processWhatsAppOrder
};
