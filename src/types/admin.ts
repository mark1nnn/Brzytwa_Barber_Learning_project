export type AppointmentStatus = 'confirmed' | 'cancelled' | 'completed' | 'no_show';

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string>;
  };
}

export interface Appointment {
  id: string;
  bookingCode: string;
  barber: EntityReference;
  service: EntityReference;
  customer: {
    name: string;
    phone: string;
    email: string;
    notes: string | null;
  };
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  privacyNoticeAcceptedAt: string;
  emailStatus: {
    customer: string;
    admin: string;
    error: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export type AppointmentListItem = Pick<
  Appointment,
  'id' | 'bookingCode' | 'barber' | 'service' | 'startsAt' | 'endsAt' | 'status'
>;

export interface AppointmentDetail extends Appointment {
  slotLocks: string[];
}

export interface AppointmentsResponse {
  appointments: Appointment[];
  pagination: {
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export interface EntityReference {
  id: number;
  name: string;
}

export interface AdminService {
  id: number;
  slug: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceGrosze: number;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminBarber {
  id: number;
  slug: string;
  name: string;
  bio: string;
  imagePath: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkingHours {
  id: number;
  barber: EntityReference;
  weekday: number;
  startTime: string;
  endTime: string;
  active: boolean;
  timezone: 'Europe/Warsaw';
}

export interface BlockedPeriod {
  id: string;
  barber: EntityReference;
  startsAt: string;
  endsAt: string;
  reason: string;
  createdAt: string;
}
