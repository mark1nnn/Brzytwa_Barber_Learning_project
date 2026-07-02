-- D1 enforces foreign keys during migrations. Deferring them allows the
-- appointment_slots table to be rebuilt safely inside the migration transaction.
PRAGMA defer_foreign_keys = ON;

-- A composite parent key is required by the appointment_slots foreign key.
-- The existing primary key still guarantees that appointments.id is unique.
CREATE UNIQUE INDEX idx_appointments_id_barber
  ON appointments(id, barber_id);

CREATE TABLE appointment_slots_new (
  appointment_id TEXT NOT NULL,
  barber_id INTEGER NOT NULL,
  slot_start_utc TEXT NOT NULL,
  PRIMARY KEY (appointment_id, slot_start_utc),
  UNIQUE (barber_id, slot_start_utc),
  FOREIGN KEY (appointment_id, barber_id)
    REFERENCES appointments(id, barber_id)
    ON DELETE CASCADE
);

-- Valid existing rows are preserved. A pre-existing mismatched appointment/barber
-- pair makes the migration fail instead of silently copying inconsistent data.
INSERT INTO appointment_slots_new (
  appointment_id,
  barber_id,
  slot_start_utc
)
SELECT
  appointment_id,
  barber_id,
  slot_start_utc
FROM appointment_slots;

DROP TABLE appointment_slots;
ALTER TABLE appointment_slots_new RENAME TO appointment_slots;

CREATE INDEX idx_appointment_slots_slot_start
  ON appointment_slots(slot_start_utc);

PRAGMA defer_foreign_keys = OFF;
