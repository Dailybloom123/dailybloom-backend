const db = require('../config/db');

/**
 * WhatsApp Conversation Service
 * Handles automated conversation flow for WhatsApp orders
 */

const CONVERSATION_STATES = {
  INITIAL: 'initial',
  LANGUAGE_SELECTED: 'language_selected',
  AWAITING_INPUT: 'awaiting_input',
  PRODUCT_SELECTED: 'product_selected',
  AWAITING_QUANTITY: 'awaiting_quantity',
  AWAITING_TIMING: 'awaiting_timing',
  AWAITING_ADDRESS: 'awaiting_address',
  AWAITING_PAYMENT_MODE: 'awaiting_payment_mode',
  PAYMENT_PENDING: 'payment_pending',
  ORDER_CONFIRMED: 'order_confirmed'
};

const LANGUAGES = {
  english: { name: 'English', code: 'en' },
  hindi: { name: 'Hindi', code: 'hi' },
  assamese: { name: 'Assamese', code: 'as' },
  bengali: { name: 'Bengali', code: 'bn' },
  nepali: { name: 'Nepali', code: 'ne' },
  tamil: { name: 'Tamil', code: 'ta' },
  telugu: { name: 'Telugu', code: 'te' },
  malayalam: { name: 'Malayalam', code: 'ml' },
  kannada: { name: 'Kannada', code: 'kn' },
  marathi: { name: 'Marathi', code: 'mr' },
  gujarati: { name: 'Gujarati', code: 'gu' },
  punjabi: { name: 'Punjabi', code: 'pa' }
};

const MESSAGES = {
  english: {
    greeting: "Hello! Welcome to DailyBloom 🌸\n\nChoose your language:",
    awaiting_input: "Please let us know what you're looking for, or you may also leave a voice message with the items you're looking for, and we shall be happy to assist you.",
    quantity: "Please enter the quantity you would like:",
    timing: "When would you like to receive your order?\n\n1. Today Morning (6:30-8:30 AM)\n2. Today Evening (6:00-8:30 PM)\n3. Tomorrow Morning (6:30-8:30 AM)\n4. Tomorrow Evening (6:00-8:30 PM)\n5. Custom date/time",
    address: "Please provide your delivery address:\n\nName:\nFlat/House No:\nStreet/Landmark:\nLocality:\nPincode:",
    payment_mode: "Select payment mode:\n\n1. Cash on Delivery\n2. Online Payment (Razorpay)",
    order_confirmed: "✅ Order Confirmed!\n\nThank you for your order. You will receive a confirmation shortly.",
    payment_redirect: "You will be redirected to Razorpay Payment Gateway to complete your payment. Please return to this chat after payment.",
    invalid_input: "I didn't understand that. Please try again or type 'help' for assistance."
  },
  hindi: {
    greeting: "नमस्ते! DailyBloom में आपका स्वागत है 🌸\n\nअपनी भाषा चुनें:",
    awaiting_input: "कृपया बताएं कि आप क्या ढूंढ रहे हैं, या आप वॉइस मैसेज भी छोड़ सकते हैं। हम आपकी मदद करने में खुश होंगे।",
    quantity: "कृपया मात्रा बताएं:",
    timing: "आप अपना ऑर्डर कब प्राप्त करना चाहेंगे?\n\n1. आज सुबह (6:30-8:30 AM)\n2. आज शाम (6:00-8:30 PM)\n3. कल सुबह (6:30-8:30 AM)\n4. कल शाम (6:00-8:30 PM)\n5. कस्टम दिनांक/समय",
    address: "कृपया अपना पता प्रदान करें:\n\nनाम:\nफ्लैट/हाउस नंबर:\nसड़क/लैंडमार्क:\nलोकेलिटी:\nपिनकोड:",
    payment_mode: "भुगतान विधि चुनें:\n\n1. कैश ऑन डिलीवरी\n2. ऑनलाइन भुगतान (Razorpay)",
    order_confirmed: "✅ ऑर्डर की पुष्टि!\n\nआपके ऑर्डर के लिए धन्यवाद। आप जल्द ही पुष्टि प्राप्त करेंगे।",
    payment_redirect: "आपको भुगतान पूरा करने के लिए Razorpay पेमेंट गेटवे पर भेजा जाएगा। भुगतान के बाद इस चैट पर वापस आएं।",
    invalid_input: "मुझे समझ नहीं आया। कृपया पुनः प्रयास करें या सहायता के लिए 'help' टाइप करें।"
  },
  assamese: {
    greeting: "নমস্কাৰ! DailyBloomত আপোনাক স্বাগতম 🌸\n\nআপোনাৰ ভাষা বাছনি লওক:",
    awaiting_input: "অনুগ্ৰহ কৰক কি আপুনি বিচাৰি আছেন, বা আপুনি ভইচ মেছেজও দিব পাৰে। আমি আপোনাক সহায কৰিবলৈ আনন্দিত।",
    quantity: "পৰিমাণ লিখক দিয়ন:",
    timing: "আপুনি কেতিয়া অৰ্ডাৰ পাব বিচাৰে?\n\n1. আজি পুৱতি (6:30-8:30 AM)\n2. আজি সন্ধিয়া (6:00-8:30 PM)\n3. কালি পুৱতি (6:30-8:30 AM)\n4. কালি সন্ধিয়া (6:00-8:30 PM)\n5. কাস্টম তাৰিখ/সময়",
    address: "অনুগ্ৰহ কৰক আপোনাৰ ঠিকনা দিয়ন:\n\nনাম:\nফ্লেট/ঘৰ নম্বৰ:\nপথ/লেণ্ডমাৰ্ক:\nলোকেলিটি:\nপিনকোড:",
    payment_mode: "পেমেন্ট মোড বাছনি লওক:\n\n1. কেশ অন ডেলিভাৰী\n2. অনলাইন পেমেন্ট (Razorpay)",
    order_confirmed: "✅ অৰ্ডাৰ নিশ্চিত!\n\nআপোনাৰ অৰ্ডাৰৰ বাবে ধন্যবাদ। আপুনি শীঘ্ৰেই নিশ্চিতকৰত পাব।",
    payment_redirect: "পেমেন্ট সম্পূৰ্ণ কৰিবলৈ আপোনাক Razorpay পেমেন্ট গেটৱেলৈ পঠোৱা হ'ব। পেমেন্টৰ পিছত এই চেটলৈ ঘূৰি আহক।",
    invalid_input: "মই বুজিব নোৱাৰি। অনুগ্ৰহ কৰি পুনঃ চেষ্টা কৰক বা সহায়ৰ বাবে 'help' টাইপ কৰক।"
  }
};

class WhatsAppConversationService {
  /**
   * Get or create conversation state for a phone number
   */
  static async getConversationState(phoneNumber) {
    const result = await db.query(
      `SELECT * FROM whatsapp_conversations
       WHERE phone_number = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [phoneNumber]
    );

    if (result.rows.length === 0) {
      // Create new conversation
      const newConversation = await db.query(
        `INSERT INTO whatsapp_conversations
         (phone_number, state, language, created_at, updated_at)
         VALUES ($1, 'initial', 'english', NOW(), NOW())
         RETURNING *`,
        [phoneNumber]
      );
      return newConversation.rows[0];
    }

    return result.rows[0];
  }

  /**
   * Update conversation state
   */
  static async updateConversationState(conversationId, state, data = {}) {
    await db.query(
      `UPDATE whatsapp_conversations
       SET state = $1, conversation_data = conversation_data || $2, updated_at = NOW()
       WHERE conversation_id = $3`,
      [state, JSON.stringify(data), conversationId]
    );
  }

  /**
   * Process incoming message
   */
  static async processMessage(phoneNumber, message, messageType = 'text') {
    const conversation = await this.getConversationState(phoneNumber);
    const state = conversation.state;
    const language = conversation.language || 'english';
    const conversationData = conversation.conversation_data || {};

    let response = null;

    switch (state) {
      case CONVERSATION_STATES.INITIAL:
        // Check if message is a language selection
        const selectedLanguage = this.detectLanguage(message);
        if (selectedLanguage) {
          await this.updateConversationState(
            conversation.conversation_id,
            CONVERSATION_STATES.LANGUAGE_SELECTED,
            { language: selectedLanguage }
          );
          response = MESSAGES[selectedLanguage]?.awaiting_input || MESSAGES.english.awaiting_input;
        } else {
          response = MESSAGES[language].greeting;
        }
        break;

      case CONVERSATION_STATES.LANGUAGE_SELECTED:
      case CONVERSATION_STATES.AWAITING_INPUT:
        // Search for products
        const products = await this.searchProducts(message, language);
        if (products.length > 0) {
          await this.updateConversationState(
            conversation.conversation_id,
            CONVERSATION_STATES.PRODUCT_SELECTED,
            { products: products, current_product_index: 0 }
          );
          response = this.formatProductList(products, language);
        } else {
          response = MESSAGES[language].invalid_input;
        }
        break;

      case CONVERSATION_STATES.PRODUCT_SELECTED:
        // User should select a product number
        const productIndex = parseInt(message) - 1;
        const selectedProducts = conversationData.products || [];
        if (productIndex >= 0 && productIndex < selectedProducts.length) {
          await this.updateConversationState(
            conversation.conversation_id,
            CONVERSATION_STATES.AWAITING_QUANTITY,
            { selected_product: products[productIndex] }
          );
          response = MESSAGES[language].quantity;
        } else {
          response = this.formatProductList(selectedProducts, language);
        }
        break;

      case CONVERSATION_STATES.AWAITING_QUANTITY:
        const quantity = parseInt(message);
        if (quantity > 0) {
          await this.updateConversationState(
            conversation.conversation_id,
            CONVERSATION_STATES.AWAITING_TIMING,
            { quantity: quantity }
          );
          response = MESSAGES[language].timing;
        } else {
          response = MESSAGES[language].invalid_input;
        }
        break;

      case CONVERSATION_STATES.AWAITING_TIMING:
        // Process timing selection
        const timing = this.parseTiming(message);
        if (timing) {
          await this.updateConversationState(
            conversation.conversation_id,
            CONVERSATION_STATES.AWAITING_ADDRESS,
            { timing: timing }
          );
          response = MESSAGES[language].address;
        } else {
          response = MESSAGES[language].invalid_input;
        }
        break;

      case CONVERSATION_STATES.AWAITING_ADDRESS:
        // Store address
        await this.updateConversationState(
          conversation.conversation_id,
          CONVERSATION_STATES.AWAITING_PAYMENT_MODE,
          { address: message }
        );
        response = MESSAGES[language].payment_mode;
        break;

      case CONVERSATION_STATES.AWAITING_PAYMENT_MODE:
        if (message.includes('1') || message.toLowerCase().includes('cash')) {
          // Cash on delivery - confirm order
          await this.createWhatsAppOrder(conversation);
          await this.updateConversationState(
            conversation.conversation_id,
            CONVERSATION_STATES.ORDER_CONFIRMED
          );
          response = MESSAGES[language].order_confirmed;
        } else if (message.includes('2') || message.toLowerCase().includes('online')) {
          // Online payment - redirect to Razorpay
          await this.updateConversationState(
            conversation.conversation_id,
            CONVERSATION_STATES.PAYMENT_PENDING
          );
          response = MESSAGES[language].payment_redirect;
          // Would need to integrate Razorpay here
        } else {
          response = MESSAGES[language].invalid_input;
        }
        break;

      default:
        response = MESSAGES[language].greeting;
    }

    return response;
  }

  /**
   * Detect language from message
   */
  static detectLanguage(message) {
    const langCodes = Object.keys(LANGUAGES);
    for (const lang of langCodes) {
      if (message.toLowerCase().includes(lang)) {
        return lang;
      }
    }
    return null;
  }

  /**
   * Search products
   */
  static async searchProducts(query, language) {
    const result = await db.query(
      `SELECT id, name, price, unit, category
       FROM products
       WHERE is_active = true
         AND (name ILIKE $1 OR category ILIKE $1)
       LIMIT 10`,
      [`%${query}%`]
    );
    return result.rows;
  }

  /**
   * Format product list for WhatsApp
   */
  static formatProductList(products, language) {
    if (products.length === 0) {
      return "No products found. Please try a different search term.";
    }

    let message = "📦 Products found:\n\n";
    products.forEach((product, index) => {
      message += `${index + 1}. ${product.name}\n   ₹${product.price} / ${product.unit}\n\n`;
    });
    message += "Reply with the number to select a product.";
    return message;
  }

  /**
   * Parse timing selection
   */
  static parseTiming(message) {
    const timingMap = {
      '1': 'today_morning',
      '2': 'today_evening',
      '3': 'tomorrow_morning',
      '4': 'tomorrow_evening',
      '5': 'custom'
    };

    const key = message.trim();
    return timingMap[key] || null;
  }

  /**
   * Create order from WhatsApp conversation
   */
  static async createWhatsAppOrder(conversation) {
    const data = conversation.conversation_data;
    const { selected_product, quantity, timing, address } = data;

    // Parse address (would need better parsing in production)
    const addressLines = address.split('\n').filter(line => line.trim());

    // Create order (simplified - would need full implementation)
    const orderResult = await db.query(
      `INSERT INTO orders (user_id, address_id, status, total, delivery_date, delivery_slot)
       VALUES ($1, NULL, 'pending', $2, NOW(), $3)
       RETURNING id`,
      [null, selected_product.price * quantity, timing]
    );

    return orderResult.rows[0];
  }
}

module.exports = WhatsAppConversationService;
