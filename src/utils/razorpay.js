// Sets up the Razorpay SDK instance used for creating orders server-side.
// Docs: https://razorpay.com/docs/api/orders/

const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

module.exports = razorpay;
