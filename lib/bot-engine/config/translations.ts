export const BOOKING_TRANSLATIONS = {
  en: {
    ADDRESS_REQUEST_MESSAGE: '📍 {name}, to show you accurate pricing and availability, I need your address first.',
    ERROR_MESSAGES: {
      BUSINESS_CONFIG_ERROR: 'Sorry {name}, there was a configuration error with our business system',
      NO_SERVICES_AVAILABLE: 'Sorry {name}, no services are currently available', 
      SERVICES_LOAD_ERROR: 'Sorry {name}, I\'m unable to load services at the moment',
      SERVICE_SELECTION_ERROR: 'Sorry {name}, I couldn\'t process your service selection',
      INVALID_SERVICE_SELECTION: '{name}, please select a valid service from the options provided or type the name of the service you\'d like',
      NO_SERVICES_TO_CHOOSE: 'Sorry {name}, no services are currently available to choose from',
      INVALID_ADDRESS: '{name}, please provide a valid address with street, suburb, and postcode',
      SYSTEM_ERROR_ADDRESS_VALIDATION: 'Sorry {name}, we\'re experiencing technical difficulties with our address validation service. Our developers have been notified and will fix this shortly. Please try again later or contact support.',
      INVALID_DATE_FORMAT: 'I couldn\'t understand that date. Please try "tomorrow", "next Friday", "august 20", "20/8", or select from the options above.',
      INVALID_DATE_SELECTION: 'Please select a valid day or type a date like "tomorrow" or "next Friday".'
    },
    BUTTONS: {
      SYSTEM_ERROR: '❌ System Error',
      CONTACT_SERVICES: '📞 Contact us',
      SERVICES_UNAVAILABLE: '⚠️ Service Error',
      ADDRESS_CORRECT: '✅ Yes, that\'s correct',
      ADDRESS_EDIT: '✏️ No, let me edit it',
      CONTACT_DIRECTLY: '📞 Contact us',
      OTHER_DAYS: '📅 Other days',
      CHOOSE_ANOTHER_DAY: '📅 Other days',
      NO_AVAILABILITY: '📞 No times',
      CONTACT_US: '📞 Contact us',
      CHOOSE_DATE_FIRST: '📅 Choose date',
      TRY_AGAIN: '🔄 Try again',
      CONFIRM: 'Confirm',
      EDIT: 'Edit',
      CHANGE_SERVICE: 'Change Service',
      CHANGE_TIME: 'Change Date/Time',
      CHANGE_ADDRESS: 'Change Address',
      CHANGE_PICKUP: 'Change Pickup',
      CHANGE_DROPOFF: 'Change Dropoff',
      SELECT: 'Select',
      ADD_ANOTHER_SERVICE: '➕ Add Another Service',
      CONTINUE_WITH_SERVICES: '✅ Continue'
    },
    MESSAGES: {
      AVAILABLE_TIMES: '{name}, here are the next available times:',
      CONFIGURATION_ERROR: 'Sorry {name}, there was a configuration error. Please contact us directly.',
      CONFIGURATION_ERROR_SUPPORT: 'Sorry {name}, there was a configuration error. Please try again or contact support.',
      NO_AVAILABILITY_10_DAYS: 'Sorry {name}, no availability found in the next 10 days. Please contact us directly to check for other options.',
      AVAILABLE_DAYS: '{name}, here are the available days:',
      SELECT_DAY_OR_TYPE: 'Select one of these days, or if not here type (example: July 30):',
      GETTING_TIMES: 'Got it {name}. Let me get available times...',
      ERROR_LOADING_TIMES: 'Sorry {name}, there was an error loading times. Please try again.',
      NO_APPOINTMENTS_DATE: 'Sorry {name}, no appointments are available on this date. Please choose another day.',
      SELECT_TIME: '{name}, please select a time:',
      ERROR_LOADING_AVAILABLE_TIMES: 'Sorry {name}, there was an error loading available times. Please try selecting a date again.',
      SELECT_DATE_FIRST: '{name}, please select a date first to see available times.',
      SELECTED_TIME_CONFIRM: 'Great {name}! You\'ve selected {time}. Let\'s confirm your details.',
      BOOK_SERVICE: 'Great {name}! Let\'s book a {service} appointment.',
      SERVICE_NOT_AVAILABLE: 'Sorry {name}, that service is not available. Please use the buttons below.',
      ISSUE_PREPARING_QUOTE: 'Sorry {name}, there was an issue preparing your quote. Let me try again.',
      QUOTE_CONFIRMED: 'Perfect {name}! Your quote is confirmed. Let\'s create your booking.',
      WHAT_TO_CHANGE: '{name}, what would you like to change?',
      CHOOSE_DIFFERENT_SERVICE: 'Alright {name}, let\'s choose a different service...',
      PICK_DIFFERENT_TIME: 'Alright {name}, let\'s pick a different time...',
      WELCOME_BACK: 'Welcome back, {name}! I found your account.',
      WELCOME_BACK_PERSONALIZED: '👋 Hello {name}! Great to see you again! How can I help you today?',
      NOT_IN_SYSTEM: 'I don\'t see you in our system yet.',
      CREATE_ACCOUNT: 'Let me create your account. Please provide me with your first name.',
      FIRST_NAME_PROMPT: 'What\'s your first name so I can create your account?',
      FIRST_NAME_VALIDATION: 'Please provide your first name (at least 2 characters).',
      THANKS_CREATING: 'Thanks {name}! Creating your account...',
      ACCOUNT_CREATED: 'Perfect! I\'ve created your account, {name}. Let\'s continue with your booking.',
      ACCOUNT_EXISTS: 'This WhatsApp number may already have an account. Please contact support.',
      ACCOUNT_CREATION_FAILED: 'Failed to create user account. Please try again.',
      SELECT_SERVICE: 'Please select a service from the list below:',
      SELECT_SERVICE_PERSONALIZED: '⭐ {name}, please select which service you\'d like to book:',
      MOBILE_SERVICE_LOCATION: '🚗 Excellent {name}! We\'ll come to you at:\n📍 {address}',
      BOOKING_PROBLEM: 'Sorry {name}, there was a problem confirming your booking. Please contact us.',
      PROVIDE_ADDRESS: '{name}, please provide the correct address:',
      EMAIL_PROMPT: '{name}, please provide your email address for booking confirmation:',
      EMAIL_VALIDATION: '{name}, please provide a valid email address.',
      VALIDATING_ADDRESS: '{name}, let me validate your address...',
      CREATING_BOOKING: '{name}, creating your booking...',
      CHECKING_SYSTEM: '{name}, let me check if you\'re in our system...',
      CHECKING_STATUS: '{name}, checking your account status...',
      CREATING_ACCOUNT: 'Creating your account...',
      PROCESSING_CHOICE: '{name}, processing your choice...',
      CONFIRMING_DETAILS: 'Perfect {name}! Let me confirm your service details...',
      SERVICE_SELECTED: '✅ {name}, selected: {serviceName}',
      SERVICES_SELECTED: '✅ {name}, selected services:\n{servicesList}',
      ADD_MORE_SERVICES: '{name}, would you like to add another service or continue with the booking?',
      MULTIPLE_SERVICES_CONFIRMED: 'Great {name}! You\'ve selected {count} services. Let\'s continue with your booking.',
      BOOKING_AVAILABILITY_PERSONALIZED: '📅 Hello {name}! Of course, I\'d be happy to help you book another appointment. We have excellent availability today with slots at {times}. If you\'re looking for another day, we have openings tomorrow and this Monday with times starting at 7:00 AM.\n\nPlease let me know what date and time work best for you, and I\'ll get that booked right away! 😊',
      BOOKING_REQUEST_PERSONALIZED: '😊 Perfect {name}! I\'d love to help you with your booking.',
      PICKUP_ADDRESS_REQUEST: '🚚 {name}, please provide the PICKUP address for your move. This is where our team will collect your items.',
      DROPOFF_ADDRESS_REQUEST: '📦 {name}, please provide the DROP-OFF address for your move. This is where our team will deliver your items.',
      CLARIFICATION_REQUEST: 'Could you tell me more clearly what you\'d like to do?',
      BOOKING_COMPLETED_FALLBACK: 'Great! Your booking request has been processed.',
      CONTINUE_BOOKING_FALLBACK: 'Let\'s continue with your booking.',
      GETTING_STARTED_FALLBACK: 'Let\'s get started with your booking.',
      REQUEST_COMPLETED_FALLBACK: 'Your request has been completed.',
      CONTINUING_BOOKING_FALLBACK: 'Continuing with your booking...'
    },
    // Reusable message components for scalable templates
    MESSAGE_COMPONENTS: {
      JOB_DETAILS: {
        REMOVALIST: {
          SERVICE_SINGLE: '🏠 Service: {serviceName}',
          SERVICE_MULTIPLE: '🏠 Services:',
          SERVICE_ITEM: '   {index}. {serviceName}',
          PICKUP_LOCATION: '📦 Pickup: {address}',
          DROPOFF_LOCATION: '🏁 Delivery: {address}'
        },
        MOBILE: {
          SERVICE_SINGLE: '✨ Service: {serviceName}',
          SERVICE_MULTIPLE: '✨ Services:',
          SERVICE_ITEM: '   {index}. {serviceName}',
          CUSTOMER_ADDRESS: '📍 Service Location: {address}'
        },
        NON_MOBILE: {
          SERVICE_SINGLE: '✨ Service: {serviceName}',
          SERVICE_MULTIPLE: '✨ Services:',
          SERVICE_ITEM: '   {index}. {serviceName}',
          BUSINESS_ADDRESS: '📍 Location: {address}'
        }
      },
      BREAKDOWN_DURATIONS: {
        TRAVEL_TIME: '🚛 Estimated Travel Time: {time}',
        LABOUR_TIME: '⚡ Estimated Work Time: {time}',
        TOTAL_DURATION: '⏱️ Total Estimated Duration: {time}'
      },
      BREAKDOWN_COSTS: {
        PER_MINUTE: {
          LABOUR_COST: '💪 Estimated Work Cost: ${cost}',
          TRAVEL_COST: '🚛 Estimated Travel Cost: ${cost}',
          TOTAL_COST: '💰 Estimated Total Cost: ${cost}'
        },
        FIXED_PRICE: {
          TOTAL_COST: '💰 Total Cost: ${cost}'
        }
      },
      DATE_TIME: {
        DATE: '📅 Date: {date}',
        TIME: '⏰ Time: {time}',
        DURATION: ' ({duration})',
        ESTIMATED_COMPLETION: '🏁 Estimated completion: {time}'
      },
      PAYMENT_BREAKDOWN: {
        TITLE: '💳 *Payment Breakdown*',
        TOTAL_COST: '• Total Cost: ${amount}',
        ESTIMATED_TOTAL_COST: '• Estimated Total Cost: ${amount}',
        DEPOSIT: '• Deposit ({percentage}%): ${amount}',
        BOOKING_FEE: '• Booking Fee: ${amount}',
        REMAINING_BALANCE: '• Remaining Balance: ${amount}',
        ESTIMATED_REMAINING_BALANCE: '• Estimated Remaining Balance: ${amount}',
        PAYMENT_METHOD: '• Payment Method: {method}',
        PAY_NOW: '• *Total to Pay Now: ${amount}*',
        PAY_AT_SERVICE: '💳 Pay at service ({method})',
        PAY_AFTER_JOB: '💳 Pay after job completion ({method})'
      }
    },
    // Business-specific payment templates
    PAYMENT_TEMPLATES: {
      REMOVALIST: {
        READY_TO_BOOK: '🚛 *Ready to Secure Your Move!*',
        INTRO: 'To secure your moving appointment, please complete your booking deposit payment:',
        PAYMENT_LINK_TITLE: '🔗 *Payment Link:*',
        REDIRECT_INFO: 'After payment, you\'ll be redirected back to WhatsApp and your move will be confirmed automatically!',
        SECURITY_LINE: '✅ Safe & secure payment powered by Stripe',
        BUSINESS_LINE: '🔒 Your payment goes directly to {businessName}'
      },
      SALON: {
        READY_TO_BOOK: '💳 *Ready to Book!*',
        INTRO: 'To secure your appointment, please complete your booking deposit payment:',
        PAYMENT_LINK_TITLE: '🔗 *Payment Link:*',
        REDIRECT_INFO: 'After payment, you\'ll be redirected back to WhatsApp and your booking will be confirmed automatically!',
        SECURITY_LINE: '✅ Safe & secure payment powered by Stripe',
        BUSINESS_LINE: '🔒 Your payment goes directly to {businessName}'
      }
    },
    // Business-specific confirmation templates  
    CONFIRMATION_TEMPLATES: {
      REMOVALIST: {
        TITLE: '🚛 {name}, your move is confirmed!',
        PAYMENT_THANKS: '💳 Thank you for your payment!',
        ARRIVAL_INSTRUCTIONS: '🗺️ *{name}, what to expect:*',
        MOBILE_INSTRUCTIONS: '{name}, our moving team will arrive at your pickup location at the scheduled time. Please ensure someone is available to provide access and oversee the move.',
        ESTIMATE_NOTICE: 'Note: Final costs may vary based on actual time and materials used during your move.',
        LOOKING_FORWARD: '{name}, we look forward to helping you with your move! You can ask me anything else if you have questions.'
      },
      SALON: {
        TITLE: '💄 {name}, your appointment is confirmed!',
        PAYMENT_THANKS: '💳 Thank you for your payment!',
        ARRIVAL_INSTRUCTIONS: '🗺️ *{name}, how to arrive:*',
        MOBILE_INSTRUCTIONS: '{name}, we will arrive at your location at the scheduled time. Please ensure someone is available to receive our service.',
        SALON_INSTRUCTIONS: '{name}, please arrive 5-10 minutes early to find parking and locate our business. Once you arrive, please contact us to let us know you\'re here. If you need directions or have any questions, feel free to reach out!',
        ESTIMATE_NOTICE: 'Note: Final costs may vary based on actual services provided during your appointment.',
        LOOKING_FORWARD: '{name}, we look forward to seeing you! You can ask me anything else if you have more questions.'
      }
    },
    // Composed message templates using components
    QUOTE_TEMPLATES: {
      TITLE: '📋 *Quote Summary*',
      CONFIRM_WITH_DEPOSIT: 'Ready to secure your booking',
      CONFIRM_NO_DEPOSIT: '✅ Would you like to confirm this quote?',
      QUOTE_ID: '📄 Quote ID: {id}'
    },
    ESCALATION: {
      USER_RESPONSE: "Your request has been sent to our team. Someone will contact you shortly via WhatsApp.",
      FRUSTRATION_DETECTED: "I apologize for any inconvenience. It seems you're having some difficulty with our automated system. A member of our staff will contact you shortly to assist you personally.",
      MEDIA_REDIRECT_RESPONSE: "I cannot process media files (images, videos, documents, audios) at the moment. I'm connecting you with a staff member who will review your content and assist you shortly. Please wait to be attended."
    },

    TIME_LABELS: {
      TODAY: 'Today',
      TOMORROW: 'Tomorrow',
      AM: 'AM',
      PM: 'PM'
    },

    BOOKING_CONFIRMATION: {
      CONTACT_INFO: '📞 Contact Information:',
      BOOKING_ID: '📄 Booking ID:',
      SALON_INSTRUCTIONS: 'Please arrive 5-10 minutes early to find parking and locate our business. Once you arrive, please contact us to let us know you\'re here. If you need directions or have any questions, feel free to reach out!'
    }
  },
  es: {
    ADDRESS_REQUEST_MESSAGE: '📍 {name}, para mostrarte precios y disponibilidad precisos, necesito tu dirección primero.',
    ERROR_MESSAGES: {
      BUSINESS_CONFIG_ERROR: 'Lo siento {name}, hubo un error de configuración con nuestro sistema de negocio',
      NO_SERVICES_AVAILABLE: 'Lo siento {name}, no hay servicios disponibles actualmente', 
      SERVICES_LOAD_ERROR: 'Lo siento {name}, no puedo cargar los servicios en este momento',
      SERVICE_SELECTION_ERROR: 'Lo siento {name}, no pude procesar tu selección de servicio',
      INVALID_SERVICE_SELECTION: '{name}, por favor selecciona un servicio válido de las opciones proporcionadas o escribe el nombre del servicio que te gustaría',
      NO_SERVICES_TO_CHOOSE: 'Lo siento {name}, no hay servicios disponibles para elegir en este momento',
      INVALID_ADDRESS: '{name}, por favor proporciona una dirección válida con calle, barrio y código postal',
      SYSTEM_ERROR_ADDRESS_VALIDATION: 'Lo siento {name}, estamos experimentando dificultades técnicas con nuestro servicio de validación de direcciones. Nuestros desarrolladores han sido notificados y lo resolverán pronto. Por favor intenta más tarde o contacta a soporte.',
      INVALID_DATE_FORMAT: 'No pude entender esa fecha. Por favor intenta "mañana", "próximo viernes", "15/7", o selecciona de las opciones arriba.',
      INVALID_DATE_SELECTION: 'Por favor selecciona un día válido o escribe una fecha como "mañana" o "próximo viernes".'
    },
    BUTTONS: {
      SYSTEM_ERROR: '❌ Error Sistema',
      CONTACT_SERVICES: '📞 Contáctanos',
      SERVICES_UNAVAILABLE: '⚠️ Error Servicio',
      ADDRESS_CORRECT: '✅ Sí, es correcto',
      ADDRESS_EDIT: '✏️ No, editarlo',
      CONTACT_DIRECTLY: '📞 Contactar',
      OTHER_DAYS: '📅 Otros días',
      CHOOSE_ANOTHER_DAY: '📅 Otros días',
      NO_AVAILABILITY: '📞 Sin citas',
      CONTACT_US: '📞 Contáctanos',
      CHOOSE_DATE_FIRST: '📅 Elige fecha',
      TRY_AGAIN: '🔄 Intentar otra vez',
      CONFIRM: 'Confirmar',
      EDIT: 'Editar',
      CHANGE_SERVICE: 'Cambiar Servicio',
      CHANGE_TIME: 'Cambiar Fecha/Hora',
      CHANGE_ADDRESS: 'Cambiar Dirección',
      CHANGE_PICKUP: 'Cambiar Recogida',
      CHANGE_DROPOFF: 'Cambiar Entrega',
      SELECT: 'Seleccionar',
      ADD_ANOTHER_SERVICE: '➕ Agregar Otro Servicio',
      CONTINUE_WITH_SERVICES: '✅ Continuar'
    },
    MESSAGES: {
      AVAILABLE_TIMES: '{name}, aquí están los próximos horarios disponibles:',
      CONFIGURATION_ERROR: 'Lo siento {name}, hubo un error de configuración. Por favor contáctanos directamente.',
      CONFIGURATION_ERROR_SUPPORT: 'Lo siento {name}, hubo un error de configuración. Por favor intenta de nuevo o contacta soporte.',
      NO_AVAILABILITY_10_DAYS: 'Lo siento {name}, no se encontró disponibilidad en los próximos 10 días. Por favor contáctanos directamente para verificar otras opciones.',
      AVAILABLE_DAYS: '{name}, aquí están los días disponibles:',
      SELECT_DAY_OR_TYPE: 'Selecciona uno de estos días, o si no está aquí escribe (ejemplo: 30 de julio):',
      GETTING_TIMES: 'Entendido {name}. Déjame obtener los horarios disponibles...',
      ERROR_LOADING_TIMES: 'Lo siento {name}, hubo un error cargando los horarios. Por favor intenta de nuevo.',
      NO_APPOINTMENTS_DATE: 'Lo siento {name}, no hay citas disponibles en esta fecha. Por favor elige otro día.',
      SELECT_TIME: '{name}, por favor selecciona un horario:',
      ERROR_LOADING_AVAILABLE_TIMES: 'Lo siento {name}, hubo un error cargando los horarios disponibles. Por favor intenta seleccionar otra fecha.',
      SELECT_DATE_FIRST: '{name}, por favor selecciona una fecha primero para ver los horarios disponibles.',
      SELECTED_TIME_CONFIRM: '¡Excelente {name}! Has seleccionado {time}. Confirmemos tus detalles.',
      BOOK_SERVICE: '¡Excelente {name}! Reservemos una cita de {service}.',
      SERVICE_NOT_AVAILABLE: 'Lo siento {name}, ese servicio no está disponible. Por favor usa los botones de abajo.',
      ISSUE_PREPARING_QUOTE: 'Lo siento {name}, hubo un problema preparando tu cotización. Déjame intentar de nuevo.',
      QUOTE_CONFIRMED: '¡Perfecto {name}! Tu cotización está confirmada. Creemos tu reserva.',
      WHAT_TO_CHANGE: '{name}, ¿qué te gustaría cambiar?',
      CHOOSE_DIFFERENT_SERVICE: 'Muy bien {name}, elijamos un servicio diferente...',
      PICK_DIFFERENT_TIME: 'Muy bien {name}, elijamos un horario diferente...',
      WELCOME_BACK: '¡Bienvenido de vuelta, {name}! Encontré tu cuenta.',
      WELCOME_BACK_PERSONALIZED: '👋 ¡Hola {name}! ¡Qué bueno verte de nuevo! ¿En qué puedo ayudarte hoy?',
      NOT_IN_SYSTEM: 'No te veo en nuestro sistema aún.',
      CREATE_ACCOUNT: 'Déjame crear tu cuenta.',
      FIRST_NAME_PROMPT: '¿Cuál es tu nombre para crear tu cuenta?',
      FIRST_NAME_VALIDATION: 'Por favor proporciona tu nombre (al menos 2 caracteres).',
      THANKS_CREATING: '¡Gracias {name}! Creando tu cuenta...',
      ACCOUNT_CREATED: '¡Perfecto! He creado tu cuenta, {name}. Continuemos con tu reserva.',
      ACCOUNT_EXISTS: 'Este número de WhatsApp ya puede tener una cuenta. Por favor contacta soporte.',
      ACCOUNT_CREATION_FAILED: 'Falló la creación de la cuenta de usuario. Por favor intenta de nuevo.',
      SELECT_SERVICE: 'Por favor selecciona un servicio de la lista de abajo:',
      SELECT_SERVICE_PERSONALIZED: '⭐ {name}, por favor selecciona cuál servicio te gustaría reservar:',
      MOBILE_SERVICE_LOCATION: '🚗 ¡Excelente {name}! Iremos a ti a:\n📍 {address}',
      BOOKING_PROBLEM: 'Lo siento {name}, hubo un problema confirmando tu reserva. Por favor contáctanos.',
      PROVIDE_ADDRESS: '{name}, por favor proporciona la dirección correcta:',
      EMAIL_PROMPT: '{name}, por favor proporciona tu dirección de correo electrónico para confirmación de la reserva:',
      EMAIL_VALIDATION: '{name}, por favor proporciona una dirección de correo electrónico válida.',
      VALIDATING_ADDRESS: '{name}, déjame validar tu dirección...',
      CREATING_BOOKING: '{name}, creando tu reserva...',
      CHECKING_SYSTEM: '{name}, déjame verificar si estás en nuestro sistema...',
      CHECKING_STATUS: '{name}, verificando el estado de tu cuenta...',
      CREATING_ACCOUNT: 'Creando tu cuenta...',
      PROCESSING_CHOICE: '{name}, procesando tu elección...',
      CONFIRMING_DETAILS: '¡Perfecto {name}! Déjame confirmar los detalles de tu servicio...',
      SERVICE_SELECTED: '✅ {name}, seleccionado: {serviceName}',
      SERVICES_SELECTED: '✅ {name}, servicios seleccionados:\n{servicesList}',
      ADD_MORE_SERVICES: '{name}, ¿te gustaría agregar otro servicio o continuar con la reserva?',
      MULTIPLE_SERVICES_CONFIRMED: '¡Excelente {name}! Has seleccionado {count} servicios. Continuemos con tu reserva.',
      BOOKING_AVAILABILITY_PERSONALIZED: '📅 ¡Hola {name}! Por supuesto, me encantaría ayudarte a reservar otra cita. Tenemos excelente disponibilidad hoy con espacios a las {times}. Si buscas otro día, tenemos aperturas mañana y este lunes con horarios desde las 7:00 AM.\n\n¡Por favor déjame saber qué fecha y hora te funcionan mejor y te lo reservo enseguida! 😊',
      BOOKING_REQUEST_PERSONALIZED: '😊 ¡Perfecto {name}! Me encantaría ayudarte con tu reserva.',
      PICKUP_ADDRESS_REQUEST: '🚚 {name}, por favor proporciona la dirección de RECOGIDA para tu mudanza. Aquí es donde nuestro equipo recogerá tus artículos.',
      DROPOFF_ADDRESS_REQUEST: '📦 {name}, por favor proporciona la dirección de ENTREGA para tu mudanza. Aquí es donde nuestro equipo entregará tus artículos.',
      CLARIFICATION_REQUEST: '¿Podrías decirme más claramente qué te gustaría hacer?',
      BOOKING_COMPLETED_FALLBACK: '¡Excelente! Tu solicitud de reserva ha sido procesada.',
      CONTINUE_BOOKING_FALLBACK: 'Continuemos con tu reserva.',
      GETTING_STARTED_FALLBACK: 'Comencemos con tu reserva.',
      REQUEST_COMPLETED_FALLBACK: 'Tu solicitud ha sido completada.',
      CONTINUING_BOOKING_FALLBACK: 'Continuando con tu reserva...'
    },
    // Reusable message components for scalable templates
    MESSAGE_COMPONENTS: {
      JOB_DETAILS: {
        REMOVALIST: {
          SERVICE_SINGLE: '🏠 Servicio: {serviceName}',
          SERVICE_MULTIPLE: '🏠 Servicios:',
          SERVICE_ITEM: '   {index}. {serviceName}',
          PICKUP_LOCATION: '📦 Recogida: {address}',
          DROPOFF_LOCATION: '🏁 Entrega: {address}'
        },
        MOBILE: {
          SERVICE_SINGLE: '✨ Servicio: {serviceName}',
          SERVICE_MULTIPLE: '✨ Servicios:',
          SERVICE_ITEM: '   {index}. {serviceName}',
          CUSTOMER_ADDRESS: '📍 Ubicación del Servicio: {address}'
        },
        NON_MOBILE: {
          SERVICE_SINGLE: '✨ Servicio: {serviceName}',
          SERVICE_MULTIPLE: '✨ Servicios:',
          SERVICE_ITEM: '   {index}. {serviceName}',
          BUSINESS_ADDRESS: '📍 Ubicación: {address}'
        }
      },
      BREAKDOWN_DURATIONS: {
        TRAVEL_TIME: '🚛 Tiempo Estimado de Viaje: {time}',
        LABOUR_TIME: '⚡ Tiempo Estimado de Trabajo: {time}',
        TOTAL_DURATION: '⏱️ Duración Total Estimada: {time}'
      },
      BREAKDOWN_COSTS: {
        PER_MINUTE: {
          LABOUR_COST: '💪 Costo Estimado de Trabajo: ${cost}',
          TRAVEL_COST: '🚛 Costo Estimado de Viaje: ${cost}',
          TOTAL_COST: '💰 Costo Total Estimado: ${cost}'
        },
        FIXED_PRICE: {
          TOTAL_COST: '💰 Costo Total: ${cost}'
        }
      },
      DATE_TIME: {
        DATE: '📅 Fecha: {date}',
        TIME: '⏰ Hora: {time}',
        DURATION: '({duration})',
        ESTIMATED_COMPLETION: '🏁 Finalización estimada: {time}'
      },
      PAYMENT_BREAKDOWN: {
        TITLE: '💳 *Desglose de Pago*',
        TOTAL_COST: '• Costo Total: ${amount}',
        ESTIMATED_TOTAL_COST: '• Costo Total Estimado: ${amount}',
        DEPOSIT: '• Depósito ({percentage}%): ${amount}',
        BOOKING_FEE: '• Tarifa de Reserva: ${amount}',
        REMAINING_BALANCE: '• Saldo Restante: ${amount}',
        ESTIMATED_REMAINING_BALANCE: '• Saldo Restante Estimado: ${amount}',
        PAYMENT_METHOD: '• Método de Pago: {method}',
        PAY_NOW: '• *Total a Pagar Ahora: ${amount}*',
        PAY_AT_SERVICE: '💳 Pagar en el servicio ({method})',
        PAY_AFTER_JOB: '💳 Pagar después de completar el trabajo ({method})'
      }
    },
    // Business-specific payment templates
    PAYMENT_TEMPLATES: {
      REMOVALIST: {
        READY_TO_BOOK: '🚛 *¡Listo para Asegurar tu Mudanza!*',
        INTRO: 'Para asegurar tu cita de mudanza, por favor completa el pago del depósito de reserva:',
        PAYMENT_BREAKDOWN_TITLE: '💰 *Desglose del Pago:*',
        SERVICE_TOTAL: '• Total del servicio de mudanza: ${serviceTotal}',
        DEPOSIT_NOW: '• Depósito (ahora): ${depositAmount}',
        BOOKING_FEE: '• Tarifa de reserva: ${amount}',
        TOTAL_PAY_NOW: '• *Total a pagar ahora: ${totalAmount}*',
        REMAINING_BALANCE: '📍 *Balance Restante Estimado: ${remainingBalance}*',
        PAY_AT_JOB: '💳 Pagar después de completar el trabajo ({paymentMethod})',
        PAYMENT_LINK_TITLE: '🔗 *Enlace de Pago:*',
        REDIRECT_INFO: '¡Después del pago, serás redirigido de vuelta a WhatsApp y tu mudanza será confirmada automáticamente!',
        SECURITY_LINE: '✅ Pago seguro y protegido por Stripe',
        BUSINESS_LINE: '🔒 Tu pago va directamente a {businessName}'
      },
      SALON: {
        READY_TO_BOOK: '💳 *¡Listo para Reservar!*',
        INTRO: 'Para asegurar tu cita, por favor completa el pago del depósito de reserva:',
        PAYMENT_BREAKDOWN_TITLE: '💰 *Desglose del Pago:*',
        SERVICE_TOTAL: '• Servicio total: ${serviceTotal}',
        DEPOSIT_NOW: '• Depósito (ahora): ${depositAmount}',
        BOOKING_FEE: '• Tarifa de reserva: ${amount}',
        TOTAL_PAY_NOW: '• *Total a pagar ahora: ${totalAmount}*',
        REMAINING_BALANCE: '📍 *Saldo restante: ${remainingBalance}*',
        PAY_AT_APPOINTMENT: '💳 A pagar en la cita ({paymentMethod})',
        PAYMENT_LINK_TITLE: '🔗 *Enlace de Pago:*',
        REDIRECT_INFO: '¡Después del pago, serás redirigido de vuelta a WhatsApp y tu reserva será confirmada automáticamente!',
        SECURITY_LINE: '✅ Pago seguro y protegido por Stripe',
        BUSINESS_LINE: '🔒 Tu pago va directamente a {businessName}'
      }
    },
    // Business-specific confirmation templates  
    CONFIRMATION_TEMPLATES: {
      REMOVALIST: {
        TITLE: '🚛 ¡{name}, tu mudanza está confirmada!',
        PAYMENT_THANKS: '💳 ¡Gracias por tu pago!',
        SERVICE_LABEL: '📦 Servicio de Mudanza:',
        SERVICES_LABEL: '📦 Servicios de Mudanza:',
        PICKUP_LABEL: '📦 Lugar de Recogida:',
        DROPOFF_LABEL: '🏁 Lugar de Entrega:',
        ARRIVAL_INSTRUCTIONS: '🗺️ *{name}, qué esperar:*',
        MOBILE_INSTRUCTIONS: '{name}, nuestro equipo de mudanza llegará a tu lugar de recogida a la hora programada. Por favor asegúrate de que alguien esté disponible para proporcionar acceso y supervisar la mudanza.',
        ESTIMATE_NOTICE: 'Nota: Los costos finales pueden variar según el tiempo real y los materiales utilizados durante tu mudanza.',
        LOOKING_FORWARD: '¡{name}, esperamos ayudarte con tu mudanza! Puedes preguntarme cualquier otra cosa si tienes preguntas.'
      },
      SALON: {
        TITLE: '💄 ¡{name}, tu cita está confirmada!',
        PAYMENT_THANKS: '💳 ¡Gracias por tu pago!',
        SERVICE_LABEL: '✨ Servicio:',
        SERVICES_LABEL: '✨ Servicios:',
        LOCATION_LABEL: '📍 Ubicación:',
        ARRIVAL_INSTRUCTIONS: '🗺️ *{name}, cómo llegar:*',
        MOBILE_INSTRUCTIONS: '{name}, llegaremos a tu ubicación a la hora programada. Por favor asegúrate de que alguien esté disponible para recibir nuestro servicio.',
        SALON_INSTRUCTIONS: '{name}, por favor llega 5-10 minutos antes para encontrar estacionamiento y ubicar nuestro negocio. Una vez que llegues, contáctanos para que sepamos que estás aquí. Si necesitas indicaciones o tienes preguntas, ¡no dudes en comunicarte!',
        ESTIMATE_NOTICE: 'Nota: Los costos finales pueden variar según los servicios reales proporcionados durante tu cita.',
        LOOKING_FORWARD: '¡{name}, esperamos verte! Puedes preguntarme cualquier otra cosa si tienes más preguntas.'
      }
    },
    // Composed message templates using components
    QUOTE_TEMPLATES: {
      TITLE: '📋 *Resumen de Cotización*',
      CONFIRM_WITH_DEPOSIT: 'Listo para asegurar tu mudanza',
      CONFIRM_NO_DEPOSIT: '✅ ¿Te gustaría confirmar esta cotización?',
      QUOTE_ID: '📄 ID de Cotización: {id}'
    },
    ESCALATION: {
      USER_RESPONSE: "Tu solicitud ha sido enviada a nuestro equipo. Alguien se pondrá en contacto contigo en breve a través de WhatsApp.",
      FRUSTRATION_DETECTED: "Disculpe las molestias. Parece que está teniendo algunas complicaciones con nuestro sistema automatizado. Pronto un miembro de nuestro personal se comunicará con usted para asistirle personalmente.",
      MEDIA_REDIRECT_RESPONSE: "No puedo procesar archivos multimedia (imágenes, videos, documentos, audios) en este momento. Te estoy conectando con un miembro del personal que revisará tu contenido y te asistirá en breve. Por favor espera a ser atendido."
    },

    TIME_LABELS: {
      TODAY: 'Hoy',
      TOMORROW: 'Mañana',
      AM: 'AM',
      PM: 'PM'
    },

    BOOKING_CONFIRMATION: {
      CONTACT_INFO: '📞 Información de Contacto:',
      BOOKING_ID: '📄 ID de Reserva:',
      SALON_INSTRUCTIONS: 'Por favor llega 5-10 minutos antes para encontrar estacionamiento y ubicar nuestro negocio. Una vez que llegues, contáctanos para que sepamos que estás aquí. Si necesitas indicaciones o tienes preguntas, ¡no dudes en comunicarte!'
    }
  }
} as const; 