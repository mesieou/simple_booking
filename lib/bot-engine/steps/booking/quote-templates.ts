import type { QuoteEstimation } from '@/lib/general-helpers/quote-cost-calculator';

export interface QuoteTemplateData {
  customerName: string;
  services: any[];
  quoteEstimation: QuoteEstimation;
  currentGoalData: any;
  paymentDetails: any;
  businessInfo: any;
  language: string;
  quoteId: string;
}

export class QuoteTemplateRenderer {
  private static readonly BOOKING_FEE = 4;

  static generateQuoteMessage(data: QuoteTemplateData): string {
    const { businessInfo } = data;
    const businessCategory = businessInfo.type?.toLowerCase() || 'salon';

    switch (businessCategory) {
      case 'removalist':
        return this.renderRemovalistTemplate(data);
      case 'salon':
      case 'beauty':
      case 'spa':
        return this.renderSalonTemplate(data);
      default:
        return this.renderDefaultTemplate(data);
    }
  }

  /**
   * Template for removalist businesses - shows detailed breakdown of travel vs labor
   */
  private static renderRemovalistTemplate(data: QuoteTemplateData): string {
    const { customerName, services, quoteEstimation, currentGoalData, paymentDetails, language, quoteId } = data;
    
    let message = `📋 *Quote Summary*\n\n`;
    
    // Service details
    if (services.length === 1) {
      message += `🏠 Service: ${services[0].name}\n\n`;
    } else {
      message += `🏠 Services:\n`;
      services.forEach((service, index) => {
        message += `   ${index + 1}. ${service.name}\n`;
      });
      message += `\n`;
    }

    // Time breakdown for removalists
    if (quoteEstimation.travelTime > 0) {
      message += `🚛 Estimated Travel Time: ${quoteEstimation.travelTime} minutes\n`;
    }
    message += `⚡ Estimated Labour Time: ${quoteEstimation.totalJobDuration - quoteEstimation.travelTime} minutes\n`;
    message += `⏱️ Total Estimated Duration: ${quoteEstimation.totalJobDuration} minutes\n\n`;

    // Cost breakdown for removalists
    if (quoteEstimation.travelCost > 0) {
      message += `💪 Estimated Labour Cost: $${quoteEstimation.serviceCost.toFixed(2)}\n`;
      message += `🚛 Estimated Travel Cost: $${quoteEstimation.travelCost.toFixed(2)}\n`;
    } else {
      message += `💪 Estimated Labour Cost: $${quoteEstimation.serviceCost.toFixed(2)}\n`;
    }
    message += `💰 Estimated Total Cost: $${quoteEstimation.totalJobCost.toFixed(2)}\n\n`;

    // Location details for removalists
    const pickup = currentGoalData.finalServiceAddress || currentGoalData.pickupAddress;
    const dropoff = currentGoalData.finalDropoffAddress || currentGoalData.dropoffAddress;
    
    if (pickup) {
      message += `📦 Pickup: ${pickup}\n`;
    }
    if (dropoff && dropoff !== pickup) {
      message += `🏁 Delivery: ${dropoff}\n`;
    }

    // Date and time for removalist appointments
    const selectedDate = currentGoalData.selectedDate;
    const selectedTime = currentGoalData.selectedTime;
    
    if (selectedDate && selectedTime) {
      const dateObj = new Date(selectedDate);
      const formattedDate = dateObj.toLocaleDateString('en-US', { 
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
      });
      const formattedTime = this.formatTime(selectedTime);
      const estimatedEndTime = this.calculateEndTime(selectedTime, quoteEstimation.totalJobDuration);
      
      message += `\n📅 Date: ${formattedDate}\n`;
      message += `⏰ Time: ${formattedTime} (${quoteEstimation.totalJobDuration} minutes)\n`;
    }

    // Payment details
    if (paymentDetails.requiresDeposit && paymentDetails.depositAmount) {
      message += `\n💳 *Payment Breakdown*\n`;
      message += `• Deposit (percentage) to pay now: $${paymentDetails.depositAmount.toFixed(2)}\n`;
      message += `• Estimate Remaining Balance after the job: $${paymentDetails.remainingBalance?.toFixed(2) || '0.00'}\n`;
      
      if (data.businessInfo.paymentMethod) {
        message += `• Payment method: ${data.businessInfo.paymentMethod}\n`;
      }
    }

    // Quote ID and confirmation
    message += `\n📄 Quote ID: ${quoteId}\n\n`;
    
    const confirmationPrompt = paymentDetails.requiresDeposit && paymentDetails.depositAmount
      ? (language === 'es' ? '🔒 ¿Listo para asegurar tu reserva?' : '🔒 Ready to secure your booking?')
      : (language === 'es' ? '✅ ¿Te gustaría confirmar esta cotización?' : '✅ Would you like to confirm this quote?');
    
    message += confirmationPrompt;

    return message;
  }

  /**
   * Template for salon/beauty businesses - shows appointment details with time scheduling
   */
  private static renderSalonTemplate(data: QuoteTemplateData): string {
    const { customerName, services, quoteEstimation, currentGoalData, paymentDetails, language, quoteId } = data;
    const selectedDate = currentGoalData.selectedDate;
    const selectedTime = currentGoalData.selectedTime;
    
    // Format date and time
    const dateObj = new Date(selectedDate);
    const formattedDate = dateObj.toLocaleDateString('en-US', { 
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
    const formattedTime = this.formatTime(selectedTime);
    const estimatedEndTime = this.calculateEndTime(selectedTime, quoteEstimation.totalJobDuration);
    
    let message = `💄 ${customerName}, here's your Booking Quote Summary\n\n`;
    
    // Services section for salon
    if (services.length === 1) {
      const service = services[0];
      message += `✨ Service:\n   ${service.name} - $${service.fixedPrice.toFixed(2)}`;
      if (quoteEstimation.travelCost > 0) {
        message += `\n🚗 Travel: $${quoteEstimation.travelCost.toFixed(2)}`;
      }
      message += `\n💰 Total Cost: $${quoteEstimation.totalJobCost.toFixed(2)}`;
    } else {
      message += `✨ Services:\n`;
      services.forEach((service, index) => {
        message += `   ${index + 1}. ${service.name} - $${service.fixedPrice.toFixed(2)}\n`;
      });
      if (quoteEstimation.travelCost > 0) {
        message += `🚗 Travel: $${quoteEstimation.travelCost.toFixed(2)}\n`;
      }
      message += `💰 Total Cost: $${quoteEstimation.totalJobCost.toFixed(2)}`;
    }
    
    // Date and time for salon appointments
    message += `\n\n📅 Date: ${formattedDate}\n`;
    message += `⏰ Time: ${formattedTime} (${quoteEstimation.totalJobDuration} minutes)\n`;
    message += `🏁 Estimated completion: ${estimatedEndTime}`;

    // Payment details for salon
    if (paymentDetails.requiresDeposit && paymentDetails.depositAmount) {
      const totalPayNow = paymentDetails.depositAmount + this.BOOKING_FEE;
      
      const labels = language === 'es' ? {
        paymentDetails: 'Detalles de Pago',
        deposit: 'Depósito',
        bookingFee: 'Tarifa de Reserva',
        payNow: 'Pagar Ahora',
        balanceDue: 'Saldo Pendiente'
      } : {
        paymentDetails: 'Payment Details',
        deposit: 'Deposit',
        bookingFee: 'Booking Fee',
        payNow: 'Pay Now',
        balanceDue: 'Balance Due'
      };
      
      message += `\n💳 *${labels.paymentDetails}:*\n`;
      message += `   • ${labels.deposit}: $${paymentDetails.depositAmount.toFixed(2)}\n`;
      message += `   • ${labels.bookingFee}: $${this.BOOKING_FEE.toFixed(2)}\n`;
      message += `   • ${labels.payNow}: $${totalPayNow.toFixed(2)}\n`;
      
      if (paymentDetails.remainingBalance !== undefined && paymentDetails.remainingBalance >= 0) {
        const paymentMethodDisplay = data.businessInfo.paymentMethod || (language === 'es' ? 'efectivo/tarjeta' : 'cash/card');
        message += `   • ${labels.balanceDue}: $${paymentDetails.remainingBalance.toFixed(2)} (${paymentMethodDisplay})`;
      }
    }

    // Quote ID and confirmation
    message += `\n\n📄 Quote ID: ${quoteId}\n\n`;
    
    const confirmationPrompt = paymentDetails.requiresDeposit && paymentDetails.depositAmount
      ? (language === 'es' ? '🔒 ¿Listo para asegurar tu reserva?' : '🔒 Ready to secure your booking?')
      : (language === 'es' ? '✅ ¿Te gustaría confirmar esta cotización?' : '✅ Would you like to confirm this quote?');
    
    message += confirmationPrompt;

    return message;
  }

  /**
   * Default template for other business types
   */
  private static renderDefaultTemplate(data: QuoteTemplateData): string {
    // Use salon template as default
    return this.renderSalonTemplate(data);
  }

  private static formatTime(time24: string): string {
    const [hour24, minute] = time24.split(':');
    const hour12 = parseInt(hour24) === 0 ? 12 : parseInt(hour24) > 12 ? parseInt(hour24) - 12 : parseInt(hour24);
    const ampm = parseInt(hour24) >= 12 ? 'PM' : 'AM';
    return `${hour12}:${minute} ${ampm}`;
  }

  private static calculateEndTime(startTime: string, durationMinutes: number): string {
    const [hours, minutes] = startTime.split(':').map(Number);
    const startDate = new Date();
    startDate.setHours(hours, minutes, 0, 0);
    const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
    return `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
  }
} 