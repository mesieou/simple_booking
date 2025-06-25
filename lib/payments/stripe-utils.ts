import Stripe from 'stripe';
import { Business } from '@/lib/database/models/business';
import { Quote } from '@/lib/database/models/quote';
import { User } from '@/lib/database/models/user';
import { Service } from '@/lib/database/models/service';

let stripe: Stripe;

function getStripe(): Stripe {
  if (!stripe) {
    console.log('[DEBUG] NODE_ENV:', process.env.NODE_ENV);
    console.log('[DEBUG] All env keys count:', Object.keys(process.env).length);
    console.log('[DEBUG] Available env vars starting with STRIPE:', Object.keys(process.env).filter(key => key.startsWith('STRIPE')));
    console.log('[DEBUG] Available env vars starting with NEXT:', Object.keys(process.env).filter(key => key.startsWith('NEXT')));
    console.log('[DEBUG] STRIPE_SECRET_KEY exists:', !!process.env.STRIPE_SECRET_KEY);
    console.log('[DEBUG] STRIPE_SECRET_KEY length:', process.env.STRIPE_SECRET_KEY?.length || 0);
    console.log('[DEBUG] STRIPE_SECRET_KEY value preview:', process.env.STRIPE_SECRET_KEY?.substring(0, 10) + '...');
    console.log('[DEBUG] STRIPE_SECRET_KEY typeof:', typeof process.env.STRIPE_SECRET_KEY);
    console.log('[DEBUG] STRIPE_SECRET_KEY raw value check:', JSON.stringify(process.env.STRIPE_SECRET_KEY?.substring(0, 20)));
    
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey || stripeKey.trim() === '') {
      console.error('[ERROR] STRIPE_SECRET_KEY is missing or empty from environment');
      console.log('[DEBUG] Available vars with SECRET:', Object.keys(process.env).filter(key => key.includes('SECRET')));
      console.log('[DEBUG] Available vars with STRIPE:', Object.keys(process.env).filter(key => key.includes('STRIPE')));
      console.log('[DEBUG] All environment variables:', Object.keys(process.env).sort());
      throw new Error('STRIPE_SECRET_KEY is required');
    }
    console.log('[DEBUG] Creating Stripe instance with key length:', stripeKey.length);
    console.log('[DEBUG] Key starts with sk_:', stripeKey.startsWith('sk_'));
    stripe = new Stripe(stripeKey.trim(), {
      apiVersion: '2025-02-24.acacia',
    });
    console.log('[DEBUG] Stripe instance created successfully');
  }
  return stripe;
}

export interface PaymentLinkData {
  quoteId: string;
  customerId: string;
  businessId: string;
  serviceDescription: string;
  businessName: string;
  customerName: string;
  depositAmount: number;
  totalAmount: number; // depositAmount + 4 AUD Skedy fee
}

export interface CreatePaymentLinkResult {
  success: boolean;
  paymentLink?: string;
  error?: string;
}

export class StripePaymentService {
  // Skedy AI booking fee in cents
  static readonly SKEDY_BOOKING_FEE = 400; // 4.00 AUD

  /**
   * Creates a Stripe Payment Link for a quote with split payment
   * 4 AUD goes to Skedy, remainder goes to business via Stripe Connect
   */
  private static async _createStripePaymentLink(data: PaymentLinkData): Promise<CreatePaymentLinkResult> {
    try {
      // Validate business has Stripe Connect account
      const business = await Business.getById(data.businessId);
      if (!business.stripeConnectAccountId || business.stripeAccountStatus !== 'active') {
        return {
          success: false,
          error: 'Business payment account not configured'
        };
      }

      const depositAmountCents = Math.round(data.depositAmount * 100);
      const totalAmountCents = depositAmountCents + this.SKEDY_BOOKING_FEE;

      // Create a price first, then use it in the payment link
      const price = await getStripe().prices.create({
        currency: 'aud',
        product_data: {
          name: `${data.serviceDescription} - Booking Deposit`,
          metadata: {
            quoteId: data.quoteId,
            businessId: data.businessId,
            customerId: data.customerId,
            businessName: data.businessName,
            serviceDescription: data.serviceDescription,
            depositAmount: data.depositAmount.toString(),
            totalAmount: data.totalAmount.toString(),
          },
        },
        unit_amount: totalAmountCents,
      });

      // Create payment link with application fee (split payment)
      const paymentLink = await getStripe().paymentLinks.create({
        line_items: [
          {
            price: price.id,
            quantity: 1,
          },
        ],
        application_fee_amount: this.SKEDY_BOOKING_FEE, // 4 AUD goes to Skedy
        on_behalf_of: business.stripeConnectAccountId, // Business gets the rest
        transfer_data: {
          destination: business.stripeConnectAccountId,
        },
        metadata: {
          quoteId: data.quoteId,
          businessId: data.businessId,
          customerId: data.customerId,
          businessName: data.businessName,
          customerName: data.customerName,
          serviceDescription: data.serviceDescription,
          depositAmount: data.depositAmount.toString(),
          totalAmount: data.totalAmount.toString(),
          type: 'booking_deposit',
        },
        after_completion: {
          type: 'redirect',
          redirect: {
            url: `https://wa.me/${business.whatsappNumber}?text=PAYMENT_COMPLETED_${data.quoteId}`,
          },
        },
      });

      return {
        success: true,
        paymentLink: paymentLink.url,
      };
    } catch (error) {
      console.error('Error creating Stripe payment link:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create payment link',
      };
    }
  }

  /**
   * Creates a payment link for a specific quote ID
   * Fetches all necessary data and generates the payment link
   */
  static async createPaymentLinkForQuote(quoteId: string): Promise<CreatePaymentLinkResult> {
    try {
      // Fetch quote with all related data
      const quote = await Quote.getById(quoteId);
      const business = await Business.getById(quote.businessId);
      const user = await User.getById(quote.userId);
      const service = await Service.getById(quote.serviceId);

      // Calculate deposit amount if not already calculated
      const depositAmount = await quote.calculateDepositAmount();
      
      // If no deposit amount (business doesn't require deposits), don't create payment link
      if (depositAmount === null || depositAmount === 0) {
        return {
          success: false,
          error: 'This business does not require deposit payments'
        };
      }
      
      const totalAmount = depositAmount + 4; // Add 4 AUD Skedy fee

      const paymentData: PaymentLinkData = {
        quoteId: quote.id!,
        customerId: user.id!,
        businessId: business.id!,
        serviceDescription: service.name,
        businessName: business.name,
        customerName: `${user.firstName} ${user.lastName || ''}`.trim(),
        depositAmount,
        totalAmount,
      };

      return await this._createStripePaymentLink(paymentData);
    } catch (error) {
      console.error('Error creating payment link for quote:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create payment link',
      };
    }
  }



  /**
   * Handles successful payment completion
   */
  private static async _handlePaymentCompleted(session: Stripe.Checkout.Session): Promise<void> {
    try {
      const quoteId = session.metadata?.quoteId;
      if (!quoteId) {
        console.error('No quote ID found in payment session metadata');
        return;
      }

      // Update quote status to indicate payment completed
      const quote = await Quote.getById(quoteId);
      await Quote.update(quoteId, {
        id: quote.id,
        userId: quote.userId,
        pickUp: quote.pickUp,
        dropOff: quote.dropOff,
        businessId: quote.businessId,
        serviceId: quote.serviceId,
        travelTimeEstimate: quote.travelTimeEstimate,
        totalJobDurationEstimation: quote.totalJobDurationEstimation,
        travelCostEstimate: quote.travelCostEstimate,
        totalJobCostEstimation: quote.totalJobCostEstimation,
        depositAmount: quote.depositAmount,
        status: 'payment_completed',
      });

      console.log(`Payment completed for quote: ${quoteId}`);
    } catch (error) {
      console.error('Error handling payment completion:', error);
      throw error;
    }
  }

  /**
   * Handles failed payment
   */
  private static async _handlePaymentFailed(paymentObject: Stripe.PaymentIntent | Stripe.Checkout.Session): Promise<void> {
    try {
      const quoteId = paymentObject.metadata?.quoteId;
      if (!quoteId) {
        console.error('No quote ID found in payment object metadata');
        return;
      }

      console.log(`Payment failed for quote: ${quoteId}`);
      // You might want to update the quote status or send a notification
    } catch (error) {
      console.error('Error handling payment failure:', error);
      throw error;
    }
  }

  /**
   * Creates a Stripe Express account for a business
   */
  static async createExpressAccount(businessId: string, forceNew: boolean = false): Promise<{success: boolean, accountId?: string, error?: string}> {
    try {
      const business = await Business.getById(businessId);
      
      // Check if account already exists (unless forcing new)
      if (business.stripeConnectAccountId && !forceNew) {
        return {
          success: true,
          accountId: business.stripeConnectAccountId
        };
      }

      // Create Express account with required capabilities for payment links with on_behalf_of
      const account = await getStripe().accounts.create({
        type: 'express',
        country: 'AU',
        email: business.email,
        business_profile: {
          name: business.name,
          url: business.websiteUrl,
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          businessId: businessId,
          businessName: business.name,
        },
      });

      // Update business with account ID
      await Business.update(businessId, {
        id: business.id,
        name: business.name,
        email: business.email,
        phone: business.phone,
        timeZone: business.timeZone,
        interfaceType: business.interfaceType,
        websiteUrl: business.websiteUrl,
        whatsappNumber: business.whatsappNumber,
        businessAddress: business.businessAddress,
        depositPercentage: business.depositPercentage,
        stripeConnectAccountId: account.id,
        stripeAccountStatus: 'pending',
      });

      return {
        success: true,
        accountId: account.id
      };
    } catch (error) {
      console.error('Error creating Stripe Express account:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create Express account'
      };
    }
  }

  /**
   * Creates an onboarding link for Express account setup
   * Automatically creates a fresh account if current one is disabled
   */
  static async createOnboardingLink(businessId: string): Promise<{success: boolean, url?: string, error?: string}> {
    try {
      const business = await Business.getById(businessId);
      
      let accountId = business.stripeConnectAccountId;
      let needsFreshAccount = false;
      
      // Check if existing account is disabled
      if (accountId) {
        try {
          const account = await getStripe().accounts.retrieve(accountId);
          if (account.requirements?.disabled_reason) {
            console.log(`Account ${accountId} is disabled: ${account.requirements.disabled_reason}. Creating fresh account.`);
            needsFreshAccount = true;
          }
        } catch (error) {
          console.log(`Account ${accountId} not found or error retrieving. Creating fresh account.`);
          needsFreshAccount = true;
        }
      }
      
      // Create account if it doesn't exist or if current one is disabled
      if (!accountId || needsFreshAccount) {
        const accountResult = await this.createExpressAccount(businessId, true); // Force new account
        if (!accountResult.success) {
          return accountResult;
        }
        accountId = accountResult.accountId!;
        console.log(`Created fresh Stripe account: ${accountId}`);
      }

             // Create onboarding link
       const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://simple-booking-git-main-skedys-projects.vercel.app';
       const accountLink = await getStripe().accountLinks.create({
         account: accountId,
         refresh_url: `${baseUrl}/onboarding?refresh=true&businessId=${businessId}`,
         return_url: `${baseUrl}/onboarding?success=true&businessId=${businessId}`,
         type: 'account_onboarding',
       });

      return {
        success: true,
        url: accountLink.url
      };
    } catch (error) {
      console.error('Error creating onboarding link:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create onboarding link'
      };
    }
  }

  /**
   * Checks and updates account status
   */
  static async updateAccountStatus(businessId: string): Promise<{success: boolean, status?: string, error?: string}> {
    try {
      const business = await Business.getById(businessId);
      
      if (!business.stripeConnectAccountId) {
        return {
          success: false,
          error: 'No Stripe account found for business'
        };
      }

      // Retrieve account details from Stripe
      const account = await getStripe().accounts.retrieve(business.stripeConnectAccountId);
      
      let status: 'pending' | 'active' | 'disabled' = 'pending';
      
      if (account.details_submitted && account.charges_enabled && account.payouts_enabled) {
        status = 'active';
      } else if (account.requirements?.disabled_reason) {
        status = 'disabled';
      }

      // Update business with new status
      await Business.update(businessId, {
        id: business.id,
        name: business.name,
        email: business.email,
        phone: business.phone,
        timeZone: business.timeZone,
        interfaceType: business.interfaceType,
        websiteUrl: business.websiteUrl,
        whatsappNumber: business.whatsappNumber,
        businessAddress: business.businessAddress,
        depositPercentage: business.depositPercentage,
        stripeConnectAccountId: business.stripeConnectAccountId,
        stripeAccountStatus: status,
      });

      return {
        success: true,
        status: status
      };
    } catch (error) {
      console.error('Error updating account status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update account status'
      };
    }
  }

  /**
   * Handles Stripe webhook events
   */
  static async handleStripeWebhook(event: Stripe.Event): Promise<void> {
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this._handlePaymentCompleted(event.data.object as Stripe.Checkout.Session);
          break;
        case 'payment_intent.payment_failed':
          await this._handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
          break;
        case 'checkout.session.expired':
          await this._handlePaymentFailed(event.data.object as Stripe.Checkout.Session);
          break;
        case 'account.updated':
          await this._handleAccountUpdated(event.data.object as Stripe.Account);
          break;
        default:
          console.log(`Unhandled Stripe event type: ${event.type}`);
      }
    } catch (error) {
      console.error('Error handling Stripe webhook event:', error);
      throw error;
    }
  }

  /**
   * Handles account status updates from webhooks
   */
  private static async _handleAccountUpdated(account: Stripe.Account): Promise<void> {
    try {
      const businessId = account.metadata?.businessId;
      if (!businessId) {
        console.error('No business ID found in account metadata');
        return;
      }

      let status: 'pending' | 'active' | 'disabled' = 'pending';
      
      if (account.details_submitted && account.charges_enabled && account.payouts_enabled) {
        status = 'active';
      } else if (account.requirements?.disabled_reason) {
        status = 'disabled';
      }

      // Update business status
      const business = await Business.getById(businessId);
      await Business.update(businessId, {
        id: business.id,
        name: business.name,
        email: business.email,
        phone: business.phone,
        timeZone: business.timeZone,
        interfaceType: business.interfaceType,
        websiteUrl: business.websiteUrl,
        whatsappNumber: business.whatsappNumber,
        businessAddress: business.businessAddress,
        depositPercentage: business.depositPercentage,
        stripeConnectAccountId: business.stripeConnectAccountId,
        stripeAccountStatus: status,
      });

      console.log(`Updated business ${businessId} Stripe account status to: ${status}`);
    } catch (error) {
      console.error('Error handling account update:', error);
      throw error;
    }
  }

  /**
   * Verifies webhook signature from Stripe
   */
  static verifyStripeWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event | null {
    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error('STRIPE_WEBHOOK_SECRET is not configured');
        return null;
      }

      return getStripe().webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      console.error('Error verifying Stripe webhook signature:', error);
      return null;
    }
  }
}

export default StripePaymentService; 