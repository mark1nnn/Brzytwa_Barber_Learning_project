interface PublicService {
  id: number;
  name: string;
  description: string;
  durationMinutes: number;
  priceGrosze: number;
}

interface PublicBarber {
  id: number;
  name: string;
  bio: string;
}

interface AvailabilitySlot {
  startsAt: string;
  localTime: string;
}

interface BookingDetails {
  bookingCode: string;
  serviceName: string;
  barberName: string;
  localDate: string;
  localTime: string;
  durationMinutes: number;
  priceGrosze: number;
}

interface BookingResponse {
  booking: BookingDetails;
  emailStatus: {
    customer: 'sent' | 'failed';
    admin: 'sent' | 'failed';
  };
}

interface ApiFailureBody {
  success: false;
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string>;
  };
}

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
      theme: 'dark';
      size: 'flexible';
    },
  ): string;
  reset(widgetId?: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

class ApiClientError extends Error {
  readonly code: string;
  readonly fieldErrors: Record<string, string> | undefined;

  constructor(code: string, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

function queryRequired<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Missing booking UI element: ${selector}`);
  }

  return element;
}

function formatPrice(priceGrosze: number): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: priceGrosze % 100 === 0 ? 0 : 2,
  }).format(priceGrosze / 100);
}

function formatDateForSummary(date: string): string {
  const [year, month, day] = date.split('-');
  return year && month && day ? `${day}.${month}.${year}` : date;
}

function warsawToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year ?? ''}-${values.month ?? ''}-${values.day ?? ''}`;
}

function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);

  if (year === undefined || month === undefined || day === undefined) {
    return date;
  }

  const value = new Date(Date.UTC(year, month - 1, day + days));
  return [
    value.getUTCFullYear(),
    String(value.getUTCMonth() + 1).padStart(2, '0'),
    String(value.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function isApiFailureBody(value: unknown): value is ApiFailureBody {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ApiFailureBody>;
  return (
    candidate.success === false &&
    typeof candidate.error === 'object' &&
    candidate.error !== null &&
    typeof candidate.error.code === 'string' &&
    typeof candidate.error.message === 'string'
  );
}

async function requestData<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...init?.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    throw new ApiClientError('NETWORK_ERROR', 'Nie udało się połączyć z serwerem.');
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw new ApiClientError('INVALID_RESPONSE', 'Serwer zwrócił nieprawidłową odpowiedź.');
  }

  if (isApiFailureBody(body)) {
    throw new ApiClientError(body.error.code, body.error.message, body.error.fieldErrors);
  }

  if (
    !response.ok ||
    !body ||
    typeof body !== 'object' ||
    !('success' in body) ||
    body.success !== true ||
    !('data' in body)
  ) {
    throw new ApiClientError('INVALID_RESPONSE', 'Serwer zwrócił nieprawidłową odpowiedź.');
  }

  return body.data as T;
}

function createChoice(options: {
  group: string;
  value: string;
  title: string;
  meta?: string;
  description?: string;
  className?: string;
}): HTMLLabelElement {
  const label = document.createElement('label');
  label.className = ['booking-choice', options.className].filter(Boolean).join(' ');

  const input = document.createElement('input');
  input.type = 'radio';
  input.name = options.group;
  input.value = options.value;

  const content = document.createElement('span');
  content.className = 'booking-choice__content';

  const header = document.createElement('span');
  header.className = 'booking-choice__header';

  const title = document.createElement('span');
  title.className = 'booking-choice__title';
  title.textContent = options.title;
  header.append(title);

  if (options.meta) {
    const meta = document.createElement('span');
    meta.className = 'booking-choice__meta';
    meta.textContent = options.meta;
    header.append(meta);
  }

  content.append(header);

  if (options.description) {
    const description = document.createElement('span');
    description.className = 'booking-choice__description';
    description.textContent = options.description;
    content.append(description);
  }

  label.append(input, content);
  return label;
}

const app = document.querySelector<HTMLElement>('[data-booking-app]');

if (app) {
  const bookingApp = app;
  const form = queryRequired<HTMLFormElement>(app, '[data-booking-form]');
  const successPanel = queryRequired<HTMLElement>(app, '[data-booking-success]');
  const errorPanel = queryRequired<HTMLElement>(app, '[data-booking-error]');
  const servicesContainer = queryRequired<HTMLElement>(app, '[data-services]');
  const barbersContainer = queryRequired<HTMLElement>(app, '[data-barbers]');
  const slotsContainer = queryRequired<HTMLElement>(app, '[data-slots]');
  const barberFieldset = queryRequired<HTMLFieldSetElement>(app, '[data-barber-fieldset]');
  const dateFieldset = queryRequired<HTMLFieldSetElement>(app, '[data-date-fieldset]');
  const dateInput = queryRequired<HTMLInputElement>(app, '[data-booking-date]');
  const submitButton = queryRequired<HTMLButtonElement>(app, '[data-booking-submit]');
  const submitLabel = queryRequired<HTMLElement>(app, '[data-submit-label]');
  const restartButton = queryRequired<HTMLButtonElement>(app, '[data-booking-restart]');

  const summary = {
    service: queryRequired<HTMLElement>(app, '[data-summary-service]'),
    barber: queryRequired<HTMLElement>(app, '[data-summary-barber]'),
    date: queryRequired<HTMLElement>(app, '[data-summary-date]'),
    time: queryRequired<HTMLElement>(app, '[data-summary-time]'),
    price: queryRequired<HTMLElement>(app, '[data-summary-price]'),
  };

  let services: PublicService[] = [];
  let barbers: PublicBarber[] = [];
  let selectedServiceId: number | undefined;
  let selectedBarberId: number | undefined;
  let selectedStartsAt = '';
  let selectedLocalTime = '';
  let turnstileToken = '';
  let turnstileWidgetId: string | undefined;
  let isSubmitting = false;
  let barbersRequest: AbortController | undefined;
  let availabilityRequest: AbortController | undefined;

  const turnstileEnabled = app.dataset.turnstileEnabled === 'true';
  const turnstileSiteKey = app.dataset.turnstileSiteKey ?? '';
  const scrollBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'auto'
    : 'smooth';

  const getSelectedService = (): PublicService | undefined =>
    services.find((service) => service.id === selectedServiceId);
  const getSelectedBarber = (): PublicBarber | undefined =>
    barbers.find((barber) => barber.id === selectedBarberId);

  function replaceWithStatus(container: HTMLElement, message: string, isError = false): void {
    const status = document.createElement('p');
    status.className = `booking-status${isError ? ' booking-status--error' : ''}`;
    status.textContent = message;
    container.replaceChildren(status);
  }

  function showGlobalError(message: string): void {
    errorPanel.textContent = message;
    errorPanel.hidden = false;
    errorPanel.scrollIntoView({ behavior: scrollBehavior, block: 'center' });
  }

  function clearGlobalError(): void {
    errorPanel.textContent = '';
    errorPanel.hidden = true;
  }

  function clearFieldErrors(): void {
    bookingApp.querySelectorAll<HTMLElement>('[data-field-error]').forEach((element) => {
      element.textContent = '';
    });
    form.querySelectorAll<HTMLElement>('[aria-invalid="true"]').forEach((element) => {
      element.removeAttribute('aria-invalid');
    });
  }

  function showFieldErrors(fieldErrors: Record<string, string> | undefined): void {
    if (!fieldErrors) {
      return;
    }

    Object.entries(fieldErrors).forEach(([field, message]) => {
      const output = bookingApp.querySelector<HTMLElement>(
        `[data-field-error="${CSS.escape(field)}"]`,
      );
      const input = form.elements.namedItem(field);

      if (output) {
        output.textContent = message;
      }

      if (input instanceof HTMLElement) {
        input.setAttribute('aria-invalid', 'true');
      }
    });
  }

  function updateSummary(): void {
    const service = getSelectedService();
    const barber = getSelectedBarber();

    summary.service.textContent = service?.name ?? 'Nie wybrano';
    summary.barber.textContent = barber?.name ?? 'Nie wybrano';
    summary.date.textContent = dateInput.value
      ? formatDateForSummary(dateInput.value)
      : 'Nie wybrano';
    summary.time.textContent = selectedLocalTime || 'Nie wybrano';
    summary.price.textContent = service ? formatPrice(service.priceGrosze) : '—';
  }

  function updateSubmitState(): void {
    const privacy = form.elements.namedItem('privacyNoticeAccepted');
    const hasPrivacy = privacy instanceof HTMLInputElement && privacy.checked;
    const hasRequiredData =
      selectedServiceId !== undefined &&
      selectedBarberId !== undefined &&
      selectedStartsAt.length > 0 &&
      hasPrivacy &&
      form.checkValidity();

    submitButton.disabled =
      isSubmitting || !hasRequiredData || !turnstileEnabled || turnstileToken.length === 0;
  }

  function clearSlot(message = 'Wybierz datę, aby zobaczyć wolne godziny.'): void {
    selectedStartsAt = '';
    selectedLocalTime = '';
    availabilityRequest?.abort();
    replaceWithStatus(slotsContainer, message);
    updateSummary();
    updateSubmitState();
  }

  function resetTurnstile(): void {
    turnstileToken = '';

    if (window.turnstile && turnstileWidgetId) {
      window.turnstile.reset(turnstileWidgetId);
    }

    updateSubmitState();
  }

  function renderServices(): void {
    if (services.length === 0) {
      replaceWithStatus(servicesContainer, 'Brak usług dostępnych do rezerwacji.', true);
      return;
    }

    const fragment = document.createDocumentFragment();

    services.forEach((service) => {
      fragment.append(
        createChoice({
          group: 'serviceId',
          value: String(service.id),
          title: service.name,
          meta: `${service.durationMinutes} min · ${formatPrice(service.priceGrosze)}`,
          description: service.description,
        }),
      );
    });

    servicesContainer.replaceChildren(fragment);
  }

  function renderBarbers(): void {
    if (barbers.length === 0) {
      replaceWithStatus(barbersContainer, 'Brak barberów dostępnych dla tej usługi.', true);
      return;
    }

    const fragment = document.createDocumentFragment();

    barbers.forEach((barber) => {
      fragment.append(
        createChoice({
          group: 'barberId',
          value: String(barber.id),
          title: barber.name,
          description: barber.bio,
          className: 'booking-choice--barber',
        }),
      );
    });

    barbersContainer.replaceChildren(fragment);
  }

  function renderSlots(slots: AvailabilitySlot[]): void {
    if (slots.length === 0) {
      replaceWithStatus(slotsContainer, 'Brak wolnych terminów w tym dniu. Wybierz inną datę.');
      return;
    }

    const fragment = document.createDocumentFragment();

    slots.forEach((slot) => {
      fragment.append(
        createChoice({
          group: 'startsAt',
          value: slot.startsAt,
          title: slot.localTime,
          className: 'booking-choice--slot',
        }),
      );
    });

    slotsContainer.replaceChildren(fragment);
  }

  async function loadServices(): Promise<void> {
    replaceWithStatus(servicesContainer, 'Ładowanie usług…');

    try {
      const data = await requestData<{ services: PublicService[] }>('/api/public/services');
      services = Array.isArray(data.services) ? data.services : [];
      renderServices();
    } catch {
      replaceWithStatus(
        servicesContainer,
        'Nie udało się pobrać usług. Odśwież stronę i spróbuj ponownie.',
        true,
      );
      showGlobalError('Nie udało się uruchomić formularza. Spróbuj ponownie za chwilę.');
    }
  }

  async function loadBarbers(serviceId: number): Promise<void> {
    barbersRequest?.abort();
    barbersRequest = new AbortController();
    barberFieldset.disabled = true;
    replaceWithStatus(barbersContainer, 'Ładowanie barberów…');

    try {
      const data = await requestData<{ barbers: PublicBarber[] }>(
        `/api/public/barbers?serviceId=${encodeURIComponent(serviceId)}`,
        { signal: barbersRequest.signal },
      );
      barbers = Array.isArray(data.barbers) ? data.barbers : [];
      renderBarbers();
      barberFieldset.disabled = false;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      replaceWithStatus(
        barbersContainer,
        'Nie udało się pobrać barberów. Wybierz usługę ponownie.',
        true,
      );
      barberFieldset.disabled = false;
    }
  }

  async function loadAvailability(): Promise<void> {
    if (selectedServiceId === undefined || selectedBarberId === undefined || !dateInput.value) {
      return;
    }

    availabilityRequest?.abort();
    availabilityRequest = new AbortController();
    selectedStartsAt = '';
    selectedLocalTime = '';
    updateSummary();
    updateSubmitState();
    replaceWithStatus(slotsContainer, 'Sprawdzanie wolnych terminów…');

    const query = new URLSearchParams({
      serviceId: String(selectedServiceId),
      barberId: String(selectedBarberId),
      date: dateInput.value,
    });

    try {
      const data = await requestData<{ slots: AvailabilitySlot[] }>(
        `/api/public/availability?${query.toString()}`,
        { signal: availabilityRequest.signal },
      );
      renderSlots(Array.isArray(data.slots) ? data.slots : []);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      replaceWithStatus(
        slotsContainer,
        'Nie udało się sprawdzić dostępności. Zmień datę lub spróbuj ponownie.',
        true,
      );
    }
  }

  function initializeTurnstile(): void {
    if (!turnstileEnabled || !turnstileSiteKey) {
      updateSubmitState();
      return;
    }

    const widgetContainer = bookingApp.querySelector<HTMLElement>('[data-turnstile-widget]');
    const status = bookingApp.querySelector<HTMLElement>('[data-turnstile-status]');
    const script = document.querySelector<HTMLScriptElement>('[data-turnstile-script]');

    if (!widgetContainer || !status) {
      return;
    }

    const renderWidget = (): void => {
      if (!window.turnstile || turnstileWidgetId) {
        return;
      }

      status.textContent = '';
      status.hidden = true;
      turnstileWidgetId = window.turnstile.render(widgetContainer, {
        sitekey: turnstileSiteKey,
        theme: 'dark',
        size: 'flexible',
        callback: (token) => {
          turnstileToken = token;
          clearFieldErrors();
          updateSubmitState();
        },
        'expired-callback': () => {
          turnstileToken = '';
          status.textContent = 'Weryfikacja wygasła. Wykonaj ją ponownie.';
          status.hidden = false;
          updateSubmitState();
        },
        'error-callback': () => {
          turnstileToken = '';
          status.textContent = 'Nie udało się załadować weryfikacji. Spróbuj ponownie.';
          status.hidden = false;
          updateSubmitState();
        },
      });
    };

    if (window.turnstile) {
      renderWidget();
      return;
    }

    script?.addEventListener('load', renderWidget, { once: true });
    script?.addEventListener(
      'error',
      () => {
        status.textContent = 'Weryfikacja jest chwilowo niedostępna. Odśwież stronę później.';
        status.hidden = false;
      },
      { once: true },
    );
  }

  function setSubmitting(submitting: boolean): void {
    isSubmitting = submitting;
    form.setAttribute('aria-busy', String(submitting));
    submitLabel.textContent = submitting ? 'Rezerwowanie…' : 'Rezerwuję wizytę';
    updateSubmitState();
  }

  function bookingErrorMessage(error: ApiClientError): string {
    switch (error.code) {
      case 'VALIDATION_ERROR':
        return 'Popraw zaznaczone pola i spróbuj ponownie.';
      case 'SLOT_TAKEN':
        return 'Ten termin został właśnie zajęty. Wybierz inną dostępną godzinę.';
      case 'TURNSTILE_FAILED':
      case 'INVALID_TURNSTILE':
        return 'Potwierdź ponownie, że jesteś człowiekiem.';
      case 'TURNSTILE_UNAVAILABLE':
        return 'Weryfikacja jest chwilowo niedostępna. Spróbuj ponownie za kilka minut.';
      case 'BOOKING_TOO_EARLY':
        return 'Ten termin jest zbyt bliski. Wybierz późniejszą godzinę.';
      case 'BOOKING_TOO_FAR':
        return 'Wybrany termin wykracza poza okres dostępnych rezerwacji.';
      case 'BLOCKED_PERIOD':
      case 'OUTSIDE_WORKING_HOURS':
        return 'Wybrany termin nie jest już dostępny. Wybierz inną godzinę.';
      case 'NETWORK_ERROR':
        return 'Nie udało się połączyć z serwerem. Sprawdź internet i spróbuj ponownie.';
      default:
        return 'Nie udało się utworzyć rezerwacji. Spróbuj ponownie za chwilę.';
    }
  }

  function showSuccess(data: BookingResponse): void {
    const booking = data.booking;
    queryRequired<HTMLElement>(successPanel, '[data-success-code]').textContent =
      booking.bookingCode;
    queryRequired<HTMLElement>(successPanel, '[data-success-service]').textContent =
      booking.serviceName;
    queryRequired<HTMLElement>(successPanel, '[data-success-barber]').textContent =
      booking.barberName;
    queryRequired<HTMLElement>(successPanel, '[data-success-date]').textContent =
      `${booking.localDate}, ${booking.localTime}`;
    queryRequired<HTMLElement>(successPanel, '[data-success-duration]').textContent =
      `${booking.durationMinutes} min`;
    queryRequired<HTMLElement>(successPanel, '[data-success-price]').textContent = formatPrice(
      booking.priceGrosze,
    );

    const emailMessage =
      data.emailStatus.customer === 'sent'
        ? 'Potwierdzenie wysłaliśmy na podany adres e-mail.'
        : 'Rezerwacja jest ważna. Nie udało się wysłać e-maila, dlatego zachowaj kod rezerwacji.';
    queryRequired<HTMLElement>(successPanel, '[data-success-email]').textContent = emailMessage;

    form.hidden = true;
    successPanel.hidden = false;
    successPanel.focus();
    window.scrollTo({
      top: Math.max(0, successPanel.offsetTop - 120),
      behavior: scrollBehavior,
    });
  }

  form.addEventListener('change', (event) => {
    const target = event.target;

    if (!(target instanceof HTMLInputElement)) {
      updateSubmitState();
      return;
    }

    clearGlobalError();

    if (target.name === 'serviceId') {
      selectedServiceId = Number(target.value);
      selectedBarberId = undefined;
      barbers = [];
      dateFieldset.disabled = true;
      dateInput.value = '';
      clearSlot();
      summary.barber.textContent = 'Nie wybrano';
      loadBarbers(selectedServiceId).catch(() => undefined);
    } else if (target.name === 'barberId') {
      selectedBarberId = Number(target.value);
      dateFieldset.disabled = false;
      clearSlot('Wybierz datę, aby zobaczyć wolne godziny.');

      if (dateInput.value) {
        loadAvailability().catch(() => undefined);
      }
    } else if (target.name === 'date') {
      clearSlot('Sprawdzanie wolnych terminów…');
      loadAvailability().catch(() => undefined);
    } else if (target.name === 'startsAt') {
      selectedStartsAt = target.value;
      const choiceTitle = target
        .closest<HTMLLabelElement>('.booking-choice')
        ?.querySelector<HTMLElement>('.booking-choice__title');
      selectedLocalTime = choiceTitle?.textContent ?? '';
    }

    updateSummary();
    updateSubmitState();
  });

  form.addEventListener('input', () => {
    clearFieldErrors();
    updateSubmitState();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    clearGlobalError();
    clearFieldErrors();

    if (!form.checkValidity()) {
      form.reportValidity();
      showGlobalError('Uzupełnij wszystkie wymagane pola.');
      return;
    }

    if (selectedServiceId === undefined || selectedBarberId === undefined || !selectedStartsAt) {
      showGlobalError('Wybierz usługę, barbera i godzinę wizyty.');
      return;
    }

    if (!turnstileToken) {
      showGlobalError('Potwierdź, że jesteś człowiekiem.');
      return;
    }

    const formData = new FormData(form);
    const payload = {
      serviceId: selectedServiceId,
      barberId: selectedBarberId,
      startsAt: selectedStartsAt,
      customerName: String(formData.get('customerName') ?? ''),
      customerPhone: String(formData.get('customerPhone') ?? ''),
      customerEmail: String(formData.get('customerEmail') ?? ''),
      customerNotes: String(formData.get('customerNotes') ?? ''),
      privacyNoticeAccepted: formData.get('privacyNoticeAccepted') === 'on',
      turnstileToken,
    };

    setSubmitting(true);

    try {
      const data = await requestData<BookingResponse>('/api/public/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      showSuccess(data);
    } catch (error) {
      const clientError =
        error instanceof ApiClientError
          ? error
          : new ApiClientError('UNKNOWN_ERROR', 'Nieznany błąd.');
      showFieldErrors(clientError.fieldErrors);
      showGlobalError(bookingErrorMessage(clientError));

      if (
        clientError.code === 'SLOT_TAKEN' ||
        clientError.code === 'BLOCKED_PERIOD' ||
        clientError.code === 'OUTSIDE_WORKING_HOURS'
      ) {
        clearSlot('Odświeżanie wolnych terminów…');
        await loadAvailability();
      }
    } finally {
      resetTurnstile();
      setSubmitting(false);
    }
  });

  restartButton.addEventListener('click', () => {
    window.location.reload();
  });

  const today = warsawToday();
  dateInput.min = today;
  dateInput.max = addCalendarDays(today, 45);
  updateSummary();
  updateSubmitState();
  initializeTurnstile();
  loadServices().catch(() => undefined);
}

export {};
