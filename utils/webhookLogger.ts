export interface WebhookAPIBody {
  object: string;
  entry?: {
    id: string;
    changes?: {
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: {
          profile: {
            name: string;
          };
          wa_id: string;
        }[];
        errors?: {
          code: number;
          title: string;
          message: string;
          error_data: {
            details: string;
          };
        }[];
        messages?: {
          context?: {
            from: string;
            id: string;
          };
          from: string;
          id: string;
          timestamp: string;
          text?: {
            body: string;
          };
          type:
            | "audio"
            | "contacts"
            | "document"
            | "image"
            | "interactive"
            | "location"
            | "sticker"
            | "system"
            | "text"
            | "unknown"
            | "video"
            | "button";
          image?: {
            caption?: string;
            mime_type: string;
            sha256: string;
            id: string;
          };
          video?: {
            caption?: string;
            mime_type: string;
            sha256: string;
            id: string;
          };
          audio?: {
            mime_type: string;
            sha256: string;
            id: string;
            voice: boolean;
          };
          document?: {
            caption?: string;
            filename: string;
            mime_type: string;
            sha256: string;
            id: string;
          };
          sticker?: {
            mime_type: string;
            sha256: string;
            id: string;
            animated: boolean;
          };
          location?: {
            latitude: number;
            longitude: number;
            name?: string;
            address?: string;
          };
          contacts?: {
            name: {
              first_name: string;
              last_name?: string;
              formatted_name: string;
            };
            phones?: {
              phone?: string;
              wa_id?: string;
              type?: string;
            }[];
          }[];
          system?: {
            body: string;
            identity: string;
            new_wa_id?: string;
            wa_id?: string;
            type: string;
            customer: string;
          };
          interactive?: {
            type: {
              button_reply?: {
                id: string;
                title: string;
              };
              list_reply?: {
                id: string;
                title: string;
                description?: string;
              };
            };
            nfm_reply?: {
              response_json: string;
              body: string;
              name: string;
            };
          };
          errors?: {
            code: number;
            title: string;
            message: string;
            error_data: {
              details: string;
            };
          }[];
        }[];
        statuses?: {
          id: string;
          status: string;
          timestamp: string;
          recipient_id: string;
          conversation?: {
            id: string;
            origin: {
              type: string;
            };
            expiration_timestamp?: string;
          };
          pricing?: {
            billable: boolean;
            pricing_model: string;
            category: string;
          };
        }[];
      };
      field: string;
    }[];
  }[];
}

export const logIncomingMessage = (payload: WebhookAPIBody): void => {
  console.log("--- Incoming WhatsApp Message ---");
  if (payload.entry && payload.entry.length > 0) {
    payload.entry.forEach((entryItem) => {
      if (entryItem.changes && entryItem.changes.length > 0) {
        entryItem.changes.forEach((change) => {
          console.log("Change Value:", JSON.stringify(change.value, null, 2));
          if (change.value.messages && change.value.messages.length > 0) {
            change.value.messages.forEach((message) => {
              console.log(`  Message from: ${message.from}`);
              console.log(`  Message ID: ${message.id}`);
              console.log(`  Timestamp: ${message.timestamp}`);
              console.log(`  Type: ${message.type}`);
              if (message.text) {
                console.log(`  Text: ${message.text.body}`);
              }
              // Add more specific logging for other message types if needed
            });
          }
          if (change.value.statuses && change.value.statuses.length > 0) {
            change.value.statuses.forEach((status) => {
              console.log(`  Status for: ${status.recipient_id}`);
              console.log(`  Status: ${status.status}`);
              console.log(`  Status ID: ${status.id}`);
              console.log(`  Timestamp: ${status.timestamp}`);
            });
          }
          if (change.value.errors && change.value.errors.length > 0) {
            change.value.errors.forEach((error) => {
              console.error(`  Error Code: ${error.code}`);
              console.error(`  Error Title: ${error.title}`);
              console.error(`  Error Message: ${error.message}`);
              console.error(`  Error Details: ${error.error_data?.details}`);
            });
          }
        });
      }
    });
  } else {
    console.log("Received payload without entry or changes:", JSON.stringify(payload, null, 2));
  }
  console.log("--- End of WhatsApp Message ---");
}; 