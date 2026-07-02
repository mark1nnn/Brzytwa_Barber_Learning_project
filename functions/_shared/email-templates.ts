import { escapeHtml } from './html';
import type { BookingDetails } from './types';

export interface BookingEmailTemplateInput {
  booking: BookingDetails;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerNotes: string | null;
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

function formatPrice(priceGrosze: number): string {
  return `${(priceGrosze / 100).toFixed(2).replace('.', ',')} zł`;
}

function escapedTemplateValues(input: BookingEmailTemplateInput) {
  return {
    bookingCode: escapeHtml(input.booking.bookingCode),
    serviceName: escapeHtml(input.booking.serviceName),
    barberName: escapeHtml(input.booking.barberName),
    localDate: escapeHtml(input.booking.localDate),
    localTime: escapeHtml(input.booking.localTime),
    customerName: escapeHtml(input.customerName),
    customerPhone: escapeHtml(input.customerPhone),
    customerEmail: escapeHtml(input.customerEmail),
    customerNotes: escapeHtml(input.customerNotes ?? 'Brak'),
    price: escapeHtml(formatPrice(input.booking.priceGrosze)),
  };
}

export function buildCustomerBookingEmail(input: BookingEmailTemplateInput): EmailContent {
  const value = escapedTemplateValues(input);

  return {
    subject: `Potwierdzenie rezerwacji ${input.booking.bookingCode}`,
    html: `
      <h1>Rezerwacja potwierdzona</h1>
      <p>Dzień dobry, ${value.customerName}.</p>
      <p>Kod rezerwacji: <strong>${value.bookingCode}</strong></p>
      <ul>
        <li>Usługa: ${value.serviceName}</li>
        <li>Barber: ${value.barberName}</li>
        <li>Termin: ${value.localDate}, ${value.localTime}</li>
        <li>Czas: ${input.booking.durationMinutes} min</li>
        <li>Cena: ${value.price}</li>
      </ul>
    `.trim(),
    text: [
      `Dzień dobry, ${input.customerName}.`,
      'Rezerwacja została potwierdzona.',
      `Kod rezerwacji: ${input.booking.bookingCode}`,
      `Usługa: ${input.booking.serviceName}`,
      `Barber: ${input.booking.barberName}`,
      `Termin: ${input.booking.localDate}, ${input.booking.localTime}`,
      `Czas: ${input.booking.durationMinutes} min`,
      `Cena: ${formatPrice(input.booking.priceGrosze)}`,
    ].join('\n'),
  };
}

export function buildAdminBookingEmail(input: BookingEmailTemplateInput): EmailContent {
  const value = escapedTemplateValues(input);

  return {
    subject: `Nowa rezerwacja ${input.booking.bookingCode}`,
    html: `
      <h1>Nowa rezerwacja</h1>
      <p>Kod: <strong>${value.bookingCode}</strong></p>
      <ul>
        <li>Klient: ${value.customerName}</li>
        <li>Telefon: ${value.customerPhone}</li>
        <li>Email: ${value.customerEmail}</li>
        <li>Uwagi: ${value.customerNotes}</li>
        <li>Usługa: ${value.serviceName}</li>
        <li>Barber: ${value.barberName}</li>
        <li>Termin: ${value.localDate}, ${value.localTime}</li>
      </ul>
    `.trim(),
    text: [
      `Kod: ${input.booking.bookingCode}`,
      `Klient: ${input.customerName}`,
      `Telefon: ${input.customerPhone}`,
      `Email: ${input.customerEmail}`,
      `Uwagi: ${input.customerNotes ?? 'Brak'}`,
      `Usługa: ${input.booking.serviceName}`,
      `Barber: ${input.booking.barberName}`,
      `Termin: ${input.booking.localDate}, ${input.booking.localTime}`,
    ].join('\n'),
  };
}
