/**
 * WhatsApp Direct Ordering Service
 * Handles WhatsApp deep-link generation and message payload formatting
 */

class WhatsAppService {
  /**
   * Generate WhatsApp deep-link URL
   */
  static generateWhatsAppLink(phoneNumber, message) {
    if (!phoneNumber) {
      throw new Error('Phone number is required');
    }

    // Remove any non-numeric characters from phone number
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    
    // Add country code if not present (assuming India)
    const formattedPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;

    // Encode message for URL
    const encodedMessage = encodeURIComponent(message);

    return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
  }

  /**
   * Generate WhatsApp order message payload
   */
  static generateOrderMessagePayload(orderDetails) {
    const {
      customer_name,
      address,
      items,
      preferred_slot,
      order_type,
      subscription_frequency,
      total_amount
    } = orderDetails;

    let message = `DailyBloom - New Order Request\n\n`;
    message += `Customer Name: ${customer_name || 'Customer'}\n`;
    message += `Delivery Address: ${address.flat_house_number || ''}, ${address.landmark || ''}, ${address.locality || ''}\n`;
    message += `Delivery Locality: ${address.locality_name || address.locality || ''}\n\n`;
    
    message += `Items Ordered:\n`;
    items.forEach(item => {
      message += `• ${item.name} × ${item.quantity} (₹${item.price})\n`;
    });
    
    message += `\nPreferred Slot: ${preferred_slot}\n`;
    
    if (order_type === 'subscription') {
      message += `Order Type: Subscription: ${subscription_frequency}\n`;
    } else {
      message += `Order Type: One-Time Drop\n`;
    }
    
    message += `Order Subtotal: ₹${total_amount}`;

    return message;
  }

  /**
   * Generate WhatsApp message for single product order
   */
  static generateProductOrderMessage(product, customerDetails, address, preferredSlot) {
    const message = `DailyBloom - New Order Request\n\n`;
    message += `Customer Name: ${customerDetails.name || 'Customer'}\n`;
    message += `Delivery Address: ${address.flat_house_number || ''}, ${address.landmark || ''}, ${address.locality || ''}\n`;
    message += `Delivery Locality: ${address.locality_name || address.locality || ''}\n\n`;
    
    message += `Item Ordered:\n`;
    message += `• ${product.name} × 1 (₹${product.price})\n\n`;
    
    message += `Preferred Slot: ${preferredSlot}\n`;
    message += `Order Type: One-Time Drop\n`;
    message += `Order Subtotal: ₹${product.price}`;

    return message;
  }

  /**
   * Generate WhatsApp message for subscription order
   */
  static generateSubscriptionMessage(product, customerDetails, address, frequency, preferredSlot) {
    const message = `DailyBloom - New Subscription Request\n\n`;
    message += `Customer Name: ${customerDetails.name || 'Customer'}\n`;
    message += `Delivery Address: ${address.flat_house_number || ''}, ${address.landmark || ''}, ${address.locality || ''}\n`;
    message += `Delivery Locality: ${address.locality_name || address.locality || ''}\n\n`;
    
    message += `Subscription Details:\n`;
    message += `• ${product.name} - ${frequency}\n`;
    message += `• Price per unit: ₹${product.price}\n\n`;
    
    message += `Preferred Slot: ${preferredSlot}\n`;
    message += `Order Type: Subscription\n`;

    return message;
  }

  /**
   * Get business WhatsApp number from environment
   */
  static getBusinessWhatsAppNumber() {
    return process.env.WHATSAPP_BUSINESS_NUMBER || '919876543210';
  }

  /**
   * Generate complete WhatsApp link for product order
   */
  static generateProductWhatsAppLink(product, customerDetails, address, preferredSlot) {
    const phoneNumber = this.getBusinessWhatsAppNumber();
    const message = this.generateProductOrderMessage(product, customerDetails, address, preferredSlot);
    return this.generateWhatsAppLink(phoneNumber, message);
  }

  /**
   * Generate complete WhatsApp link for subscription
   */
  static generateSubscriptionWhatsAppLink(product, customerDetails, address, frequency, preferredSlot) {
    const phoneNumber = this.getBusinessWhatsAppNumber();
    const message = this.generateSubscriptionMessage(product, customerDetails, address, frequency, preferredSlot);
    return this.generateWhatsAppLink(phoneNumber, message);
  }

  /**
   * Format delivery slot for display
   */
  static formatDeliverySlot(slotId) {
    const slotMap = {
      'morning_630_830': 'Morning 6:30–8:30 AM',
      'mid_morning_1000_1300': 'Mid-Morning Bakery 10:00 AM–1:00 PM',
      'evening_600_830': 'Evening 6:00–8:30 PM'
    };
    return slotMap[slotId] || slotId;
  }

  /**
   * Format subscription frequency for display
   */
  static formatSubscriptionFrequency(frequency) {
    const frequencyMap = {
      'daily': 'Daily',
      'alternate_days': 'Alternate Days',
      'custom': 'Custom Days'
    };
    return frequencyMap[frequency] || frequency;
  }
}

module.exports = WhatsAppService;
