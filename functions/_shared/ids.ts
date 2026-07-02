const BOOKING_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const BOOKING_CODE_LENGTH = 6;
const BOOKING_CODE_PREFIX = "BK-";
const MAX_UNBIASED_BYTE =
  Math.floor(256 / BOOKING_CODE_ALPHABET.length) *
  BOOKING_CODE_ALPHABET.length;

export function generateUuid(): string {
  return crypto.randomUUID();
}

export function generateBookingCode(): string {
  let candidate = "";

  while (candidate.length < BOOKING_CODE_LENGTH) {
    const randomBytes = new Uint8Array(
      BOOKING_CODE_LENGTH - candidate.length,
    );
    crypto.getRandomValues(randomBytes);

    for (const byte of randomBytes) {
      if (byte >= MAX_UNBIASED_BYTE) {
        continue;
      }

      candidate += BOOKING_CODE_ALPHABET.charAt(
        byte % BOOKING_CODE_ALPHABET.length,
      );

      if (candidate.length === BOOKING_CODE_LENGTH) {
        break;
      }
    }
  }

  return `${BOOKING_CODE_PREFIX}${candidate}`;
}
