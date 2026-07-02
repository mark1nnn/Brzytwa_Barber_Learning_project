import { describe, expect, it } from 'vitest';

import {
  buildAdminBookingEmail,
  buildCustomerBookingEmail,
  type BookingEmailTemplateInput,
} from '../../functions/_shared/email-templates';

const TEMPLATE_INPUT: BookingEmailTemplateInput = {
  booking: {
    bookingCode: 'BK-ABC234',
    serviceName: 'Strzyżenie <premium>',
    barberName: 'Michał & Zespół',
    startsAt: '2026-07-15T08:00:00.000Z',
    endsAt: '2026-07-15T08:45:00.000Z',
    localDate: '15.07.2026',
    localTime: '10:00',
    durationMinutes: 45,
    priceGrosze: 7000,
  },
  customerName: '<script>alert("name")</script>',
  customerPhone: '<strong>+48123456789</strong>',
  customerEmail: 'jan&test@example.com',
  customerNotes: '<img src=x onerror="alert(1)">',
};

describe('booking email templates', () => {
  it('escapes all interpolated customer and booking values in customer HTML', () => {
    const content = buildCustomerBookingEmail(TEMPLATE_INPUT);

    expect(content.html).not.toContain('<script>');
    expect(content.html).not.toContain('<premium>');
    expect(content.html).toContain('&lt;script&gt;');
    expect(content.html).toContain('Strzyżenie &lt;premium&gt;');
    expect(content.text).toContain('<script>alert("name")</script>');
  });

  it('escapes customer name, contact data and notes in admin HTML', () => {
    const content = buildAdminBookingEmail(TEMPLATE_INPUT);

    expect(content.html).not.toContain('<script>');
    expect(content.html).not.toContain('<img');
    expect(content.html).not.toContain('<strong>+48');
    expect(content.html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(content.html).toContain('jan&amp;test@example.com');
    expect(content.text).toContain('<img src=x onerror="alert(1)">');
  });
});
