import { SLOT_DURATION_MINUTES } from './constants';
import { addMinutesToUtc, formatUtcInWarsaw } from './time';
import type { BookingDetails } from './types';
import type { BookingRequest } from './validation';

export interface PrepareBookingInput {
  id: string;
  bookingCode: string;
  request: BookingRequest;
  serviceName: string;
  barberName: string;
  durationMinutes: number;
  priceGrosze: number;
  acceptedAt: string;
}

export interface PreparedBooking {
  id: string;
  bookingCode: string;
  serviceId: number;
  barberId: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerNotes: string | null;
  startsAt: string;
  endsAt: string;
  privacyNoticeAcceptedAt: string;
  slotStarts: string[];
  response: BookingDetails;
}

export type BookingWriteConflict = 'booking-code' | 'slot' | 'unknown';

export function createAppointmentSlotStarts(startsAt: string, durationMinutes: number): string[] {
  if (
    !Number.isSafeInteger(durationMinutes) ||
    durationMinutes <= 0 ||
    durationMinutes % SLOT_DURATION_MINUTES !== 0
  ) {
    throw new RangeError('Service duration must be a positive multiple of the slot duration.');
  }

  const slotStarts: string[] = [];

  for (let offset = 0; offset < durationMinutes; offset += SLOT_DURATION_MINUTES) {
    slotStarts.push(addMinutesToUtc(startsAt, offset));
  }

  return slotStarts;
}

export function prepareBooking(input: PrepareBookingInput): PreparedBooking {
  const endsAt = addMinutesToUtc(input.request.startsAt, input.durationMinutes);
  const local = formatUtcInWarsaw(input.request.startsAt);

  return {
    id: input.id,
    bookingCode: input.bookingCode,
    serviceId: input.request.serviceId,
    barberId: input.request.barberId,
    customerName: input.request.customerName,
    customerPhone: input.request.customerPhone,
    customerEmail: input.request.customerEmail,
    customerNotes: input.request.customerNotes,
    startsAt: input.request.startsAt,
    endsAt,
    privacyNoticeAcceptedAt: input.acceptedAt,
    slotStarts: createAppointmentSlotStarts(input.request.startsAt, input.durationMinutes),
    response: {
      bookingCode: input.bookingCode,
      serviceName: input.serviceName,
      barberName: input.barberName,
      startsAt: input.request.startsAt,
      endsAt,
      localDate: local.localDate,
      localTime: local.localTime,
      durationMinutes: input.durationMinutes,
      priceGrosze: input.priceGrosze,
    },
  };
}

export function classifyBookingWriteError(error: unknown): BookingWriteConflict {
  if (!(error instanceof Error)) {
    return 'unknown';
  }

  const normalizedMessage = error.message.toLowerCase();

  if (
    normalizedMessage.includes('unique constraint failed') &&
    normalizedMessage.includes('appointments.booking_code')
  ) {
    return 'booking-code';
  }

  if (
    normalizedMessage.includes('unique constraint failed') &&
    normalizedMessage.includes('appointment_slots.barber_id') &&
    normalizedMessage.includes('appointment_slots.slot_start_utc')
  ) {
    return 'slot';
  }

  return 'unknown';
}
