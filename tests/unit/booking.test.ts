import { describe, expect, it } from 'vitest';

import {
  classifyBookingWriteError,
  createAppointmentSlotStarts,
  prepareBooking,
} from '../../functions/_shared/booking';
import type { BookingRequest } from '../../functions/_shared/validation';

const NORMALIZED_REQUEST: BookingRequest = {
  serviceId: 1,
  barberId: 1,
  startsAt: '2026-07-15T08:00:00.000Z',
  customerName: 'Jan Kowalski',
  customerPhone: '+48123456789',
  customerEmail: 'jan@example.com',
  customerNotes: null,
  privacyNoticeAccepted: true,
};

describe('booking preparation', () => {
  it.each([
    { durationMinutes: 30, expectedSlots: 2, expectedEnd: '2026-07-15T08:30:00.000Z' },
    { durationMinutes: 45, expectedSlots: 3, expectedEnd: '2026-07-15T08:45:00.000Z' },
    { durationMinutes: 75, expectedSlots: 5, expectedEnd: '2026-07-15T09:15:00.000Z' },
  ])(
    'creates $expectedSlots slot locks for a $durationMinutes-minute service',
    ({ durationMinutes, expectedSlots, expectedEnd }) => {
      const slotStarts = createAppointmentSlotStarts(NORMALIZED_REQUEST.startsAt, durationMinutes);

      expect(slotStarts).toHaveLength(expectedSlots);
      expect(slotStarts[0]).toBe(NORMALIZED_REQUEST.startsAt);
      expect(slotStarts.at(-1)).toBe(
        `2026-07-15T${durationMinutes === 30 ? '08:15' : durationMinutes === 45 ? '08:30' : '09:00'}:00.000Z`,
      );

      const prepared = prepareBooking({
        id: '00000000-0000-4000-8000-000000000001',
        bookingCode: 'BK-ABC234',
        request: NORMALIZED_REQUEST,
        serviceName: 'Strzyżenie męskie',
        barberName: 'Michał',
        durationMinutes,
        priceGrosze: 7000,
        acceptedAt: '2026-07-01T10:00:00.000Z',
      });

      expect(prepared.endsAt).toBe(expectedEnd);
      expect(prepared.response).toMatchObject({
        localDate: '15.07.2026',
        localTime: '10:00',
        durationMinutes,
      });
    },
  );
});

describe('booking write error classification', () => {
  it('distinguishes booking code and slot conflicts without exposing them', () => {
    expect(
      classifyBookingWriteError(
        new Error('D1_ERROR: UNIQUE constraint failed: appointments.booking_code'),
      ),
    ).toBe('booking-code');
    expect(
      classifyBookingWriteError(
        new Error(
          'D1_ERROR: UNIQUE constraint failed: appointment_slots.barber_id, appointment_slots.slot_start_utc',
        ),
      ),
    ).toBe('slot');
    expect(classifyBookingWriteError(new Error('D1_ERROR: database unavailable'))).toBe('unknown');
  });
});
