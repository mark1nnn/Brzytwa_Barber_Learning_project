interface Env {
  PUBLIC_TURNSTILE_SITE_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  ADMIN_NOTIFICATION_EMAIL: string;
}

declare namespace Cloudflare {
  interface Env {
    PUBLIC_TURNSTILE_SITE_KEY: string;
    TURNSTILE_SECRET_KEY: string;
    RESEND_API_KEY: string;
    RESEND_FROM_EMAIL: string;
    ADMIN_NOTIFICATION_EMAIL: string;
  }
}
