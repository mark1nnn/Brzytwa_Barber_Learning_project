PRAGMA foreign_keys = ON;

CREATE TABLE services (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE
    CHECK (length(trim(slug)) > 0),
  name TEXT NOT NULL
    CHECK (length(trim(name)) > 0),
  description TEXT NOT NULL
    CHECK (length(trim(description)) > 0),
  duration_minutes INTEGER NOT NULL
    CHECK (duration_minutes > 0)
    CHECK (duration_minutes % 15 = 0),
  price_grosze INTEGER NOT NULL
    CHECK (price_grosze >= 0),
  active INTEGER NOT NULL DEFAULT 1
    CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0
    CHECK (sort_order >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE barbers (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE
    CHECK (length(trim(slug)) > 0),
  name TEXT NOT NULL
    CHECK (length(trim(name)) > 0),
  bio TEXT NOT NULL
    CHECK (length(trim(bio)) > 0),
  image_path TEXT NOT NULL
    CHECK (length(trim(image_path)) > 0),
  active INTEGER NOT NULL DEFAULT 1
    CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE barber_services (
  barber_id INTEGER NOT NULL,
  service_id INTEGER NOT NULL,
  PRIMARY KEY (barber_id, service_id),
  FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

CREATE TABLE working_hours (
  id INTEGER PRIMARY KEY,
  barber_id INTEGER NOT NULL,
  weekday INTEGER NOT NULL
    CHECK (weekday BETWEEN 1 AND 7),
  start_time TEXT NOT NULL
    CHECK (
      start_time GLOB '[0-2][0-9]:[0-5][0-9]'
      AND substr(start_time, 1, 2) BETWEEN '00' AND '23'
    ),
  end_time TEXT NOT NULL
    CHECK (
      end_time GLOB '[0-2][0-9]:[0-5][0-9]'
      AND substr(end_time, 1, 2) BETWEEN '00' AND '23'
    ),
  active INTEGER NOT NULL DEFAULT 1
    CHECK (active IN (0, 1)),
  UNIQUE (barber_id, weekday),
  CHECK (start_time < end_time),
  FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE
);

CREATE TABLE blocked_periods (
  id TEXT PRIMARY KEY
    CHECK (length(id) = 36),
  barber_id INTEGER NOT NULL,
  starts_at_utc TEXT NOT NULL,
  ends_at_utc TEXT NOT NULL,
  reason TEXT NOT NULL
    CHECK (length(trim(reason)) > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (starts_at_utc < ends_at_utc),
  FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE
);

CREATE TABLE appointments (
  id TEXT PRIMARY KEY
    CHECK (length(id) = 36),
  booking_code TEXT NOT NULL UNIQUE
    CHECK (length(trim(booking_code)) > 0),
  barber_id INTEGER NOT NULL,
  service_id INTEGER NOT NULL,
  customer_name TEXT NOT NULL
    CHECK (length(trim(customer_name)) > 0),
  customer_phone TEXT NOT NULL
    CHECK (length(trim(customer_phone)) > 0),
  customer_email TEXT NOT NULL
    CHECK (length(trim(customer_email)) > 0),
  customer_notes TEXT,
  starts_at_utc TEXT NOT NULL,
  ends_at_utc TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (
      status IN (
        'confirmed',
        'completed',
        'cancelled',
        'no_show'
      )
    ),
  privacy_notice_accepted_at TEXT NOT NULL,
  customer_email_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (
      customer_email_status IN (
        'pending',
        'sent',
        'failed',
        'not_required'
      )
    ),
  admin_email_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (
      admin_email_status IN (
        'pending',
        'sent',
        'failed',
        'not_required'
      )
    ),
  email_error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (starts_at_utc < ends_at_utc),
  FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE RESTRICT,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT
);

CREATE TABLE appointment_slots (
  appointment_id TEXT NOT NULL,
  barber_id INTEGER NOT NULL,
  slot_start_utc TEXT NOT NULL,
  PRIMARY KEY (appointment_id, slot_start_utc),
  UNIQUE (barber_id, slot_start_utc),
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE RESTRICT
);

CREATE INDEX idx_services_active_sort_order
  ON services(active, sort_order);

CREATE INDEX idx_barbers_active
  ON barbers(active);

CREATE INDEX idx_barber_services_service
  ON barber_services(service_id);

CREATE INDEX idx_blocked_periods_barber_starts_at
  ON blocked_periods(barber_id, starts_at_utc);

CREATE INDEX idx_appointments_starts_at
  ON appointments(starts_at_utc);

CREATE INDEX idx_appointments_barber
  ON appointments(barber_id);

CREATE INDEX idx_appointments_service
  ON appointments(service_id);

CREATE INDEX idx_appointments_status
  ON appointments(status);

CREATE INDEX idx_appointments_customer_email
  ON appointments(customer_email);

CREATE INDEX idx_appointment_slots_slot_start
  ON appointment_slots(slot_start_utc);
