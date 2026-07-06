import type {
  AdminBarber,
  AdminService,
  ApiFailure,
  Appointment,
  AppointmentDetail,
  AppointmentListItem,
  AppointmentsResponse,
  AppointmentStatus,
  BlockedPeriod,
  WorkingHours,
} from '../types/admin';

const WARSAW_TIMEZONE = 'Europe/Warsaw';
const APPOINTMENTS_PAGE_SIZE = 20;

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  confirmed: 'Potwierdzona',
  completed: 'Zakończona',
  cancelled: 'Anulowana',
  no_show: 'Nieobecność',
};

const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Poniedziałek',
  2: 'Wtorek',
  3: 'Środa',
  4: 'Czwartek',
  5: 'Piątek',
  6: 'Sobota',
  7: 'Niedziela',
};

class AdminApiError extends Error {
  readonly code: string;
  readonly fieldErrors: Record<string, string> | undefined;

  constructor(code: string, fieldErrors?: Record<string, string>) {
    super(code);
    this.name = 'AdminApiError';
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

function queryRequired<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Missing admin UI element: ${selector}`);
  }

  return element;
}

function isApiFailure(value: unknown): value is ApiFailure {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ApiFailure>;
  return (
    candidate.success === false &&
    typeof candidate.error === 'object' &&
    candidate.error !== null &&
    typeof candidate.error.code === 'string'
  );
}

async function requestData<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...init?.headers,
      },
    });
  } catch {
    throw new AdminApiError('NETWORK_ERROR');
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw new AdminApiError('INVALID_RESPONSE');
  }

  if (isApiFailure(body)) {
    throw new AdminApiError(body.error.code, body.error.fieldErrors);
  }

  if (
    !response.ok ||
    !body ||
    typeof body !== 'object' ||
    !('success' in body) ||
    body.success !== true ||
    !('data' in body)
  ) {
    throw new AdminApiError('INVALID_RESPONSE');
  }

  return body.data as T;
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  name: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(name);

  if (className) {
    element.className = className;
  }

  if (text !== undefined) {
    element.textContent = text;
  }

  return element;
}

function formatPrice(priceGrosze: number): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
  }).format(priceGrosze / 100);
}

const warsawDateTimeFormatter = new Intl.DateTimeFormat('pl-PL', {
  timeZone: WARSAW_TIMEZONE,
  dateStyle: 'medium',
  timeStyle: 'short',
});

const warsawPartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: WARSAW_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function formatWarsawDateTime(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? 'Nieprawidłowa data' : warsawDateTimeFormatter.format(date);
}

function getWarsawParts(date: Date): Record<string, string> {
  return Object.fromEntries(
    warsawPartsFormatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
}

function warsawToday(): string {
  const parts = getWarsawParts(new Date());
  return `${parts.year ?? ''}-${parts.month ?? ''}-${parts.day ?? ''}`;
}

function warsawLocalToUtc(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    throw new RangeError('Invalid local date and time.');
  }

  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const target = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let candidate = target;

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = getWarsawParts(new Date(candidate));
    const represented = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    candidate += target - represented;
  }

  const verified = getWarsawParts(new Date(candidate));
  const isExact =
    Number(verified.year) === year &&
    Number(verified.month) === month &&
    Number(verified.day) === day &&
    Number(verified.hour) === hour &&
    Number(verified.minute) === minute;

  if (!isExact) {
    throw new RangeError('This local time does not exist in Europe/Warsaw.');
  }

  return new Date(candidate).toISOString();
}

function safeAppointment(item: Appointment): AppointmentListItem {
  return {
    id: item.id,
    bookingCode: item.bookingCode,
    barber: item.barber,
    service: item.service,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    status: item.status,
  };
}

const root = document.querySelector<HTMLElement>('[data-admin-app]');

if (root) {
  const adminRoot = root;
  const content = queryRequired<HTMLElement>(adminRoot, '[data-admin-content]');
  const accessState = queryRequired<HTMLElement>(adminRoot, '[data-admin-access-state]');
  const accessMessage = queryRequired<HTMLElement>(adminRoot, '[data-admin-access-message]');
  const retryButton = queryRequired<HTMLButtonElement>(adminRoot, '[data-admin-retry]');
  const alert = queryRequired<HTMLElement>(adminRoot, '[data-admin-alert]');

  const summaryToday = queryRequired<HTMLElement>(adminRoot, '[data-summary-today]');
  const summaryFuture = queryRequired<HTMLElement>(adminRoot, '[data-summary-future]');
  const summaryCancelled = queryRequired<HTMLElement>(adminRoot, '[data-summary-cancelled]');
  const refreshDashboardButton = queryRequired<HTMLButtonElement>(
    adminRoot,
    '[data-refresh-dashboard]',
  );

  const appointmentsFilter = queryRequired<HTMLFormElement>(
    adminRoot,
    '[data-appointments-filter]',
  );
  const appointmentsList = queryRequired<HTMLElement>(adminRoot, '[data-appointments-list]');
  const appointmentsMeta = queryRequired<HTMLElement>(adminRoot, '[data-appointments-meta]');
  const filterBarber = queryRequired<HTMLSelectElement>(adminRoot, '[data-filter-barber]');
  const filterService = queryRequired<HTMLSelectElement>(adminRoot, '[data-filter-service]');
  const previousPageButton = queryRequired<HTMLButtonElement>(adminRoot, '[data-page-prev]');
  const nextPageButton = queryRequired<HTMLButtonElement>(adminRoot, '[data-page-next]');
  const pageLabel = queryRequired<HTMLElement>(adminRoot, '[data-page-label]');

  const servicesList = queryRequired<HTMLElement>(adminRoot, '[data-services-list]');
  const barbersList = queryRequired<HTMLElement>(adminRoot, '[data-barbers-list]');
  const workingHoursList = queryRequired<HTMLElement>(adminRoot, '[data-working-hours-list]');
  const blockedPeriodsList = queryRequired<HTMLElement>(adminRoot, '[data-blocked-periods-list]');
  const blockedPeriodForm = queryRequired<HTMLFormElement>(adminRoot, '[data-blocked-period-form]');
  const blockedBarber = queryRequired<HTMLSelectElement>(adminRoot, '[data-blocked-barber]');

  const appointmentDialog = queryRequired<HTMLDialogElement>(
    adminRoot,
    '[data-appointment-dialog]',
  );
  const statusForm = queryRequired<HTMLFormElement>(adminRoot, '[data-status-form]');
  const cancelWarning = queryRequired<HTMLElement>(adminRoot, '[data-cancel-warning]');

  const serviceDialog = queryRequired<HTMLDialogElement>(adminRoot, '[data-service-dialog]');
  const serviceForm = queryRequired<HTMLFormElement>(adminRoot, '[data-service-form]');
  const barberDialog = queryRequired<HTMLDialogElement>(adminRoot, '[data-barber-dialog]');
  const barberForm = queryRequired<HTMLFormElement>(adminRoot, '[data-barber-form]');
  const workingHoursDialog = queryRequired<HTMLDialogElement>(
    adminRoot,
    '[data-working-hours-dialog]',
  );
  const workingHoursForm = queryRequired<HTMLFormElement>(adminRoot, '[data-working-hours-form]');

  let services: AdminService[] = [];
  let barbers: AdminBarber[] = [];
  let workingHours: WorkingHours[] = [];
  let appointments: AppointmentListItem[] = [];
  let appointmentPage = 1;
  let appointmentHasMore = false;

  function setLoading(container: HTMLElement, message: string): void {
    container.replaceChildren(createElement('p', 'admin-loading', message));
  }

  function showAlert(message: string, variant: 'success' | 'error' = 'success'): void {
    alert.textContent = message;
    alert.className = `admin-alert admin-alert--${variant}`;
    alert.hidden = false;
  }

  function clearAlert(): void {
    alert.textContent = '';
    alert.hidden = true;
  }

  function showAccessState(code: 'ADMIN_UNAUTHORIZED' | 'ADMIN_FORBIDDEN'): void {
    content.hidden = true;
    accessState.hidden = false;
    accessMessage.textContent =
      code === 'ADMIN_FORBIDDEN'
        ? 'Twoje konto nie ma uprawnień do tego panelu.'
        : 'Zaloguj się przez Cloudflare Access, aby wyświetlić dane administracyjne.';
  }

  function handleCommonError(error: unknown, fallback: string): AdminApiError | undefined {
    if (!(error instanceof AdminApiError)) {
      showAlert(fallback, 'error');
      return undefined;
    }

    if (error.code === 'ADMIN_UNAUTHORIZED' || error.code === 'ADMIN_FORBIDDEN') {
      showAccessState(error.code);
      return error;
    }

    if (error.code === 'NETWORK_ERROR') {
      showAlert('Nie udało się połączyć z serwerem. Spróbuj ponownie.', 'error');
      return error;
    }

    showAlert(fallback, 'error');
    return error;
  }

  function clearFieldErrors(form: HTMLFormElement): void {
    form.querySelectorAll<HTMLElement>('[data-field-error]').forEach((element) => {
      element.textContent = '';
    });
    form.querySelectorAll<HTMLElement>('[aria-invalid="true"]').forEach((element) => {
      element.removeAttribute('aria-invalid');
    });
  }

  function showFieldErrors(
    form: HTMLFormElement,
    fieldErrors: Record<string, string> | undefined,
  ): void {
    if (!fieldErrors) {
      return;
    }

    Object.entries(fieldErrors).forEach(([field, message]) => {
      const output = form.querySelector<HTMLElement>(`[data-field-error="${CSS.escape(field)}"]`);
      const input = form.elements.namedItem(field);

      if (output) {
        output.textContent = message;
      }

      if (input instanceof HTMLElement) {
        input.setAttribute('aria-invalid', 'true');
      }
    });
  }

  function setFormBusy(form: HTMLFormElement, busy: boolean): void {
    form.setAttribute('aria-busy', String(busy));
    form.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
      button.disabled = busy;
    });
  }

  function createStateBadge(active: boolean): HTMLElement {
    return createElement(
      'span',
      `admin-chip ${active ? 'admin-chip--active' : 'admin-chip--inactive'}`,
      active ? 'Aktywna' : 'Nieaktywna',
    );
  }

  function createAppointmentStatus(status: AppointmentStatus): HTMLElement {
    return createElement(
      'span',
      `admin-chip admin-chip--${status.replace('_', '-')}`,
      STATUS_LABELS[status],
    );
  }

  function renderAppointments(): void {
    if (appointments.length === 0) {
      appointmentsList.replaceChildren(
        createElement('p', 'admin-empty', 'Brak rezerwacji dla wybranych filtrów.'),
      );
    } else {
      const fragment = document.createDocumentFragment();

      appointments.forEach((appointment) => {
        const article = createElement('article', 'admin-record admin-record--appointment');
        const header = createElement('div', 'admin-record__header');
        const titleGroup = createElement('div');
        const code = createElement('h3', undefined, appointment.bookingCode);
        const date = createElement(
          'p',
          'admin-record__date',
          formatWarsawDateTime(appointment.startsAt),
        );
        titleGroup.append(code, date);
        header.append(titleGroup, createAppointmentStatus(appointment.status));

        const details = createElement('dl', 'admin-record__facts');
        const service = createElement('div');
        service.append(
          createElement('dt', undefined, 'Usługa'),
          createElement('dd', undefined, appointment.service.name),
        );
        const barber = createElement('div');
        barber.append(
          createElement('dt', undefined, 'Barber'),
          createElement('dd', undefined, appointment.barber.name),
        );
        details.append(service, barber);

        const button = createElement(
          'button',
          'button button--secondary button--small',
          'Szczegóły',
        );
        button.type = 'button';
        button.dataset.appointmentDetail = appointment.id;
        article.append(header, details, button);
        fragment.append(article);
      });

      appointmentsList.replaceChildren(fragment);
    }

    appointmentsMeta.textContent = `${appointments.length} na stronie`;
    pageLabel.textContent = `Strona ${appointmentPage}`;
    previousPageButton.disabled = appointmentPage <= 1;
    nextPageButton.disabled = !appointmentHasMore;
  }

  function appointmentQuery(): URLSearchParams {
    const formData = new FormData(appointmentsFilter);
    const query = new URLSearchParams({
      page: String(appointmentPage),
      limit: String(APPOINTMENTS_PAGE_SIZE),
    });

    for (const field of ['dateFrom', 'dateTo', 'barberId', 'serviceId', 'status', 'sort']) {
      const value = String(formData.get(field) ?? '').trim();
      if (value) {
        query.set(field, value);
      }
    }

    return query;
  }

  async function loadAppointments(): Promise<void> {
    setLoading(appointmentsList, 'Ładowanie rezerwacji…');
    appointmentsMeta.textContent = 'Ładowanie…';
    previousPageButton.disabled = true;
    nextPageButton.disabled = true;

    try {
      const data = await requestData<AppointmentsResponse>(
        `/api/admin/appointments?${appointmentQuery().toString()}`,
      );
      appointments = data.appointments.map(safeAppointment);
      appointmentHasMore = data.pagination.hasMore;
      renderAppointments();
    } catch (error) {
      appointments = [];
      appointmentHasMore = false;
      appointmentsList.replaceChildren(
        createElement('p', 'admin-empty admin-empty--error', 'Nie udało się pobrać rezerwacji.'),
      );
      appointmentsMeta.textContent = 'Błąd';
      handleCommonError(error, 'Nie udało się pobrać rezerwacji.');
    }
  }

  function setSummaryValue(element: HTMLElement, count: number, hasMore: boolean): void {
    element.textContent = `${count}${hasMore ? '+' : ''}`;
  }

  async function loadDashboard(): Promise<void> {
    summaryToday.textContent = '…';
    summaryFuture.textContent = '…';
    summaryCancelled.textContent = '…';
    refreshDashboardButton.disabled = true;

    const today = warsawToday();
    const now = Date.now();

    try {
      const [todayData, futureData, cancelledData] = await Promise.all([
        requestData<AppointmentsResponse>(
          `/api/admin/appointments?dateFrom=${today}&dateTo=${today}&limit=100`,
        ),
        requestData<AppointmentsResponse>(
          `/api/admin/appointments?dateFrom=${today}&sort=asc&limit=100`,
        ),
        requestData<AppointmentsResponse>('/api/admin/appointments?status=cancelled&limit=100'),
      ]);
      const futureCount = futureData.appointments.filter(
        (appointment) => Date.parse(appointment.startsAt) > now,
      ).length;
      setSummaryValue(summaryToday, todayData.appointments.length, todayData.pagination.hasMore);
      setSummaryValue(summaryFuture, futureCount, futureData.pagination.hasMore);
      setSummaryValue(
        summaryCancelled,
        cancelledData.appointments.length,
        cancelledData.pagination.hasMore,
      );
    } catch (error) {
      summaryToday.textContent = '—';
      summaryFuture.textContent = '—';
      summaryCancelled.textContent = '—';
      handleCommonError(error, 'Nie udało się odświeżyć podsumowania.');
    } finally {
      refreshDashboardButton.disabled = false;
    }
  }

  function populateEntitySelects(): void {
    const selectedFilterService = filterService.value;
    const selectedFilterBarber = filterBarber.value;
    const selectedBlockedBarber = blockedBarber.value;

    filterService.replaceChildren(new Option('Wszystkie', ''));
    services.forEach((service) => filterService.add(new Option(service.name, String(service.id))));
    filterService.value = selectedFilterService;

    filterBarber.replaceChildren(new Option('Wszyscy', ''));
    barbers.forEach((barber) => filterBarber.add(new Option(barber.name, String(barber.id))));
    filterBarber.value = selectedFilterBarber;

    blockedBarber.replaceChildren(new Option('Wybierz barbera', ''));
    barbers
      .filter((barber) => barber.active)
      .forEach((barber) => blockedBarber.add(new Option(barber.name, String(barber.id))));
    blockedBarber.value = selectedBlockedBarber;
  }

  function renderServices(): void {
    const fragment = document.createDocumentFragment();

    services.forEach((service) => {
      const article = createElement('article', 'admin-record');
      const header = createElement('div', 'admin-record__header');
      const heading = createElement('div');
      heading.append(
        createElement('h3', undefined, service.name),
        createElement('p', 'admin-record__slug', service.slug),
      );
      header.append(heading, createStateBadge(service.active));

      const description = createElement('p', 'admin-record__description', service.description);
      const facts = createElement('p', 'admin-record__meta');
      facts.textContent = `${service.durationMinutes} min · ${formatPrice(service.priceGrosze)} · kolejność ${service.sortOrder}`;
      const button = createElement('button', 'button button--secondary button--small', 'Edytuj');
      button.type = 'button';
      button.dataset.editService = String(service.id);
      article.append(header, description, facts, button);
      fragment.append(article);
    });

    servicesList.replaceChildren(
      fragment.childNodes.length > 0 ? fragment : createElement('p', 'admin-empty', 'Brak usług.'),
    );
  }

  async function loadServices(): Promise<void> {
    setLoading(servicesList, 'Ładowanie usług…');

    try {
      const data = await requestData<{ services: AdminService[] }>('/api/admin/services');
      services = data.services;
      renderServices();
      populateEntitySelects();
    } catch (error) {
      services = [];
      servicesList.replaceChildren(
        createElement('p', 'admin-empty admin-empty--error', 'Nie udało się pobrać usług.'),
      );
      throw error;
    }
  }

  function renderBarbers(): void {
    const fragment = document.createDocumentFragment();

    barbers.forEach((barber) => {
      const article = createElement('article', 'admin-record');
      const header = createElement('div', 'admin-record__header');
      const heading = createElement('div');
      heading.append(
        createElement('h3', undefined, barber.name),
        createElement('p', 'admin-record__slug', barber.slug),
      );
      header.append(heading, createStateBadge(barber.active));
      article.append(
        header,
        createElement('p', 'admin-record__description', barber.bio),
        createElement('p', 'admin-record__meta', `Obraz: ${barber.imagePath}`),
      );
      const button = createElement('button', 'button button--secondary button--small', 'Edytuj');
      button.type = 'button';
      button.dataset.editBarber = String(barber.id);
      article.append(button);
      fragment.append(article);
    });

    barbersList.replaceChildren(
      fragment.childNodes.length > 0
        ? fragment
        : createElement('p', 'admin-empty', 'Brak barberów.'),
    );
  }

  async function loadBarbers(): Promise<void> {
    setLoading(barbersList, 'Ładowanie barberów…');

    try {
      const data = await requestData<{ barbers: AdminBarber[] }>('/api/admin/barbers');
      barbers = data.barbers;
      renderBarbers();
      populateEntitySelects();
    } catch (error) {
      barbers = [];
      barbersList.replaceChildren(
        createElement('p', 'admin-empty admin-empty--error', 'Nie udało się pobrać barberów.'),
      );
      throw error;
    }
  }

  function renderWorkingHours(): void {
    const fragment = document.createDocumentFragment();
    const groups = new Map<number, { barberName: string; rows: WorkingHours[] }>();

    workingHours.forEach((row) => {
      const group = groups.get(row.barber.id) ?? {
        barberName: row.barber.name,
        rows: [],
      };
      group.rows.push(row);
      groups.set(row.barber.id, group);
    });

    groups.forEach((group) => {
      const article = createElement('article', 'admin-schedule-card');
      article.append(createElement('h3', undefined, group.barberName));
      const list = createElement('div', 'admin-schedule-list');

      group.rows.forEach((row) => {
        const item = createElement('div', 'admin-schedule-row');
        const label = createElement('div');
        label.append(
          createElement('strong', undefined, WEEKDAY_LABELS[row.weekday] ?? `Dzień ${row.weekday}`),
          createElement(
            'span',
            undefined,
            row.active ? `${row.startTime}–${row.endTime}` : 'Nieaktywne',
          ),
        );
        const button = createElement('button', 'admin-text-button', 'Edytuj');
        button.type = 'button';
        button.dataset.editHours = String(row.id);
        item.append(label, button);
        list.append(item);
      });

      article.append(list);
      fragment.append(article);
    });

    workingHoursList.replaceChildren(
      fragment.childNodes.length > 0
        ? fragment
        : createElement('p', 'admin-empty', 'Brak godzin pracy.'),
    );
  }

  async function loadWorkingHours(): Promise<void> {
    setLoading(workingHoursList, 'Ładowanie grafiku…');

    try {
      const data = await requestData<{ workingHours: WorkingHours[] }>('/api/admin/working-hours');
      workingHours = data.workingHours;
      renderWorkingHours();
    } catch (error) {
      workingHours = [];
      workingHoursList.replaceChildren(
        createElement('p', 'admin-empty admin-empty--error', 'Nie udało się pobrać grafiku.'),
      );
      handleCommonError(error, 'Nie udało się pobrać godzin pracy.');
    }
  }

  function renderBlockedPeriods(periods: BlockedPeriod[]): void {
    if (periods.length === 0) {
      blockedPeriodsList.replaceChildren(
        createElement('p', 'admin-empty', 'Brak zapisanych blokad.'),
      );
      return;
    }

    const fragment = document.createDocumentFragment();

    periods.forEach((period) => {
      const article = createElement('article', 'admin-record admin-record--blocked');
      const header = createElement('div', 'admin-record__header');
      header.append(
        createElement('h3', undefined, period.barber.name),
        createElement('span', 'admin-chip admin-chip--inactive', 'Blokada'),
      );
      const range = createElement(
        'p',
        'admin-record__date',
        `${formatWarsawDateTime(period.startsAt)} – ${formatWarsawDateTime(period.endsAt)}`,
      );
      const reason = createElement('p', 'admin-record__description', period.reason);
      const button = createElement('button', 'button button--danger button--small', 'Usuń blokadę');
      button.type = 'button';
      button.dataset.deleteBlockedPeriod = period.id;
      article.append(header, range, reason, button);
      fragment.append(article);
    });

    blockedPeriodsList.replaceChildren(fragment);
  }

  async function loadBlockedPeriods(): Promise<void> {
    setLoading(blockedPeriodsList, 'Ładowanie blokad…');

    try {
      const data = await requestData<{ blockedPeriods: BlockedPeriod[] }>(
        '/api/admin/blocked-periods',
      );
      renderBlockedPeriods(data.blockedPeriods);
    } catch (error) {
      blockedPeriodsList.replaceChildren(
        createElement('p', 'admin-empty admin-empty--error', 'Nie udało się pobrać blokad.'),
      );
      handleCommonError(error, 'Nie udało się pobrać blokad.');
    }
  }

  function setFormValue(form: HTMLFormElement, name: string, value: string | boolean): void {
    const input = form.elements.namedItem(name);

    if (input instanceof HTMLInputElement && input.type === 'checkbox') {
      input.checked = Boolean(value);
    } else if (
      input instanceof HTMLInputElement ||
      input instanceof HTMLTextAreaElement ||
      input instanceof HTMLSelectElement
    ) {
      input.value = String(value);
    }
  }

  function formString(form: HTMLFormElement, name: string): string {
    return String(new FormData(form).get(name) ?? '').trim();
  }

  function formNumber(form: HTMLFormElement, name: string): number {
    return Number(formString(form, name));
  }

  function formChecked(form: HTMLFormElement, name: string): boolean {
    const input = form.elements.namedItem(name);
    return input instanceof HTMLInputElement && input.checked;
  }

  function openServiceEditor(id: number): void {
    const service = services.find((item) => item.id === id);
    if (!service) return;

    clearFieldErrors(serviceForm);
    setFormValue(serviceForm, 'id', String(service.id));
    setFormValue(serviceForm, 'name', service.name);
    setFormValue(serviceForm, 'description', service.description);
    setFormValue(serviceForm, 'durationMinutes', String(service.durationMinutes));
    setFormValue(serviceForm, 'priceGrosze', String(service.priceGrosze));
    setFormValue(serviceForm, 'sortOrder', String(service.sortOrder));
    setFormValue(serviceForm, 'active', service.active);
    serviceDialog.showModal();
  }

  function openBarberEditor(id: number): void {
    const barber = barbers.find((item) => item.id === id);
    if (!barber) return;

    clearFieldErrors(barberForm);
    setFormValue(barberForm, 'id', String(barber.id));
    setFormValue(barberForm, 'name', barber.name);
    setFormValue(barberForm, 'bio', barber.bio);
    setFormValue(barberForm, 'imagePath', barber.imagePath);
    setFormValue(barberForm, 'active', barber.active);
    barberDialog.showModal();
  }

  function openHoursEditor(id: number): void {
    const row = workingHours.find((item) => item.id === id);
    if (!row) return;

    clearFieldErrors(workingHoursForm);
    setFormValue(workingHoursForm, 'id', String(row.id));
    setFormValue(workingHoursForm, 'startTime', row.startTime);
    setFormValue(workingHoursForm, 'endTime', row.endTime);
    setFormValue(workingHoursForm, 'active', row.active);
    queryRequired<HTMLElement>(workingHoursDialog, '[data-hours-context]').textContent =
      `${row.barber.name} · ${WEEKDAY_LABELS[row.weekday] ?? `Dzień ${row.weekday}`}`;
    workingHoursDialog.showModal();
  }

  function clearAppointmentDetail(): void {
    appointmentDialog
      .querySelectorAll<HTMLElement>(
        '[data-detail-code], [data-detail-service], [data-detail-barber], [data-detail-date], [data-detail-customer], [data-detail-phone], [data-detail-email], [data-detail-notes]',
      )
      .forEach((element) => {
        element.textContent = '';
      });
    queryRequired<HTMLElement>(appointmentDialog, '[data-detail-slots]').replaceChildren();
    statusForm.reset();
    clearFieldErrors(statusForm);
  }

  async function openAppointmentDetail(id: string): Promise<void> {
    clearAlert();

    try {
      const data = await requestData<{ appointment: AppointmentDetail }>(
        `/api/admin/appointments/${encodeURIComponent(id)}`,
      );
      const detail = data.appointment;
      queryRequired<HTMLElement>(appointmentDialog, '[data-detail-code]').textContent =
        detail.bookingCode;
      queryRequired<HTMLElement>(appointmentDialog, '[data-detail-service]').textContent =
        detail.service.name;
      queryRequired<HTMLElement>(appointmentDialog, '[data-detail-barber]').textContent =
        detail.barber.name;
      queryRequired<HTMLElement>(appointmentDialog, '[data-detail-date]').textContent =
        `${formatWarsawDateTime(detail.startsAt)} – ${formatWarsawDateTime(detail.endsAt)}`;
      queryRequired<HTMLElement>(appointmentDialog, '[data-detail-customer]').textContent =
        detail.customer.name;
      queryRequired<HTMLElement>(appointmentDialog, '[data-detail-phone]').textContent =
        detail.customer.phone;
      queryRequired<HTMLElement>(appointmentDialog, '[data-detail-email]').textContent =
        detail.customer.email;
      queryRequired<HTMLElement>(appointmentDialog, '[data-detail-notes]').textContent =
        detail.customer.notes ?? 'Brak uwag';

      const slotList = queryRequired<HTMLElement>(appointmentDialog, '[data-detail-slots]');
      const slotFragment = document.createDocumentFragment();
      detail.slotLocks.forEach((slot) => {
        slotFragment.append(createElement('li', undefined, formatWarsawDateTime(slot)));
      });
      slotList.replaceChildren(
        slotFragment.childNodes.length > 0
          ? slotFragment
          : createElement('li', undefined, 'Brak aktywnych blokad slotów'),
      );

      setFormValue(statusForm, 'appointmentId', detail.id);
      setFormValue(statusForm, 'status', detail.status);
      cancelWarning.hidden = detail.status !== 'cancelled';
      appointmentDialog.showModal();
    } catch (error) {
      const apiError = handleCommonError(error, 'Nie udało się pobrać szczegółów rezerwacji.');
      if (apiError?.code === 'APPOINTMENT_NOT_FOUND') {
        showAlert('Rezerwacja nie istnieje. Lista została odświeżona.', 'error');
        await loadAppointments();
      }
    }
  }

  async function initialize(): Promise<void> {
    accessState.hidden = true;
    content.hidden = false;
    clearAlert();
    content.setAttribute('aria-busy', 'true');

    try {
      await loadServices();
      await loadBarbers();
    } catch (error) {
      handleCommonError(error, 'Nie udało się uruchomić panelu.');
      content.removeAttribute('aria-busy');
      return;
    }

    await Promise.all([
      loadDashboard(),
      loadAppointments(),
      loadWorkingHours(),
      loadBlockedPeriods(),
    ]);
    content.removeAttribute('aria-busy');
  }

  appointmentsFilter.addEventListener('submit', (event) => {
    event.preventDefault();
    appointmentPage = 1;
    loadAppointments().catch(() => undefined);
  });

  appointmentsFilter.addEventListener('reset', () => {
    window.setTimeout(() => {
      appointmentPage = 1;
      loadAppointments().catch(() => undefined);
    }, 0);
  });

  previousPageButton.addEventListener('click', () => {
    if (appointmentPage <= 1) return;
    appointmentPage -= 1;
    loadAppointments().catch(() => undefined);
  });

  nextPageButton.addEventListener('click', () => {
    if (!appointmentHasMore) return;
    appointmentPage += 1;
    loadAppointments().catch(() => undefined);
  });

  appointmentsList.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>('[data-appointment-detail]');
    if (button?.dataset.appointmentDetail) {
      openAppointmentDetail(button.dataset.appointmentDetail).catch(() => undefined);
    }
  });

  servicesList.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>('[data-edit-service]');
    if (button?.dataset.editService) {
      openServiceEditor(Number(button.dataset.editService));
    }
  });

  barbersList.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>('[data-edit-barber]');
    if (button?.dataset.editBarber) {
      openBarberEditor(Number(button.dataset.editBarber));
    }
  });

  workingHoursList.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>('[data-edit-hours]');
    if (button?.dataset.editHours) {
      openHoursEditor(Number(button.dataset.editHours));
    }
  });

  refreshDashboardButton.addEventListener('click', () => {
    loadDashboard()
      .then(() => showAlert('Podsumowanie zostało odświeżone.'))
      .catch(() => undefined);
  });

  statusForm.addEventListener('change', () => {
    cancelWarning.hidden = formString(statusForm, 'status') !== 'cancelled';
  });

  statusForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFieldErrors(statusForm);
    const id = formString(statusForm, 'appointmentId');
    const status = formString(statusForm, 'status') as AppointmentStatus;

    if (
      status === 'cancelled' &&
      !window.confirm('Anulować rezerwację i zwolnić wszystkie przypisane sloty?')
    ) {
      return;
    }

    setFormBusy(statusForm, true);

    try {
      await requestData(`/api/admin/appointments/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      appointmentDialog.close();
      showAlert(
        status === 'cancelled'
          ? 'Rezerwacja została anulowana, a sloty zwolnione.'
          : 'Status rezerwacji został zapisany.',
      );
      await Promise.all([loadAppointments(), loadDashboard()]);
    } catch (error) {
      const apiError = handleCommonError(error, 'Nie udało się zmienić statusu.');
      showFieldErrors(statusForm, apiError?.fieldErrors);
      if (apiError?.code.endsWith('_NOT_FOUND')) {
        appointmentDialog.close();
        await loadAppointments();
      }
    } finally {
      setFormBusy(statusForm, false);
    }
  });

  serviceForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFieldErrors(serviceForm);

    if (!serviceForm.checkValidity()) {
      serviceForm.reportValidity();
      return;
    }

    const id = formNumber(serviceForm, 'id');
    const payload = {
      name: formString(serviceForm, 'name'),
      description: formString(serviceForm, 'description'),
      durationMinutes: formNumber(serviceForm, 'durationMinutes'),
      priceGrosze: formNumber(serviceForm, 'priceGrosze'),
      active: formChecked(serviceForm, 'active'),
      sortOrder: formNumber(serviceForm, 'sortOrder'),
    };
    setFormBusy(serviceForm, true);

    try {
      await requestData(`/api/admin/services/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      serviceDialog.close();
      showAlert('Usługa została zapisana.');
      await loadServices();
      await loadAppointments();
    } catch (error) {
      const apiError = handleCommonError(error, 'Nie udało się zapisać usługi.');
      showFieldErrors(serviceForm, apiError?.fieldErrors);
      if (apiError?.code.endsWith('_NOT_FOUND')) {
        serviceDialog.close();
        await loadServices();
      }
    } finally {
      setFormBusy(serviceForm, false);
    }
  });

  barberForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFieldErrors(barberForm);

    if (!barberForm.checkValidity()) {
      barberForm.reportValidity();
      return;
    }

    const id = formNumber(barberForm, 'id');
    const payload = {
      name: formString(barberForm, 'name'),
      bio: formString(barberForm, 'bio'),
      imagePath: formString(barberForm, 'imagePath'),
      active: formChecked(barberForm, 'active'),
    };
    setFormBusy(barberForm, true);

    try {
      await requestData(`/api/admin/barbers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      barberDialog.close();
      showAlert('Dane barbera zostały zapisane.');
      await loadBarbers();
      await loadAppointments();
    } catch (error) {
      const apiError = handleCommonError(error, 'Nie udało się zapisać barbera.');
      showFieldErrors(barberForm, apiError?.fieldErrors);
      if (apiError?.code.endsWith('_NOT_FOUND')) {
        barberDialog.close();
        await loadBarbers();
      }
    } finally {
      setFormBusy(barberForm, false);
    }
  });

  workingHoursForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFieldErrors(workingHoursForm);

    if (!workingHoursForm.checkValidity()) {
      workingHoursForm.reportValidity();
      return;
    }

    const id = formNumber(workingHoursForm, 'id');
    const startTime = formString(workingHoursForm, 'startTime');
    const endTime = formString(workingHoursForm, 'endTime');

    if (startTime >= endTime) {
      showFieldErrors(workingHoursForm, {
        endTime: 'Godzina zakończenia musi być późniejsza niż rozpoczęcia.',
      });
      return;
    }

    setFormBusy(workingHoursForm, true);

    try {
      await requestData(`/api/admin/working-hours/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime,
          endTime,
          active: formChecked(workingHoursForm, 'active'),
        }),
      });
      workingHoursDialog.close();
      showAlert('Godziny pracy zostały zapisane.');
      await loadWorkingHours();
    } catch (error) {
      const apiError = handleCommonError(error, 'Nie udało się zapisać godzin pracy.');
      showFieldErrors(workingHoursForm, apiError?.fieldErrors);
      if (apiError?.code.endsWith('_NOT_FOUND')) {
        workingHoursDialog.close();
        await loadWorkingHours();
      }
    } finally {
      setFormBusy(workingHoursForm, false);
    }
  });

  blockedPeriodForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFieldErrors(blockedPeriodForm);

    if (!blockedPeriodForm.checkValidity()) {
      blockedPeriodForm.reportValidity();
      return;
    }

    let startsAt: string;
    let endsAt: string;

    try {
      startsAt = warsawLocalToUtc(formString(blockedPeriodForm, 'startsAt'));
      endsAt = warsawLocalToUtc(formString(blockedPeriodForm, 'endsAt'));
    } catch {
      showFieldErrors(blockedPeriodForm, {
        startsAt: 'Podaj prawidłową datę i godzinę dla Europe/Warsaw.',
      });
      return;
    }

    if (startsAt >= endsAt) {
      showFieldErrors(blockedPeriodForm, {
        endsAt: 'Koniec blokady musi być późniejszy niż początek.',
      });
      return;
    }

    const reason = formString(blockedPeriodForm, 'reason');
    setFormBusy(blockedPeriodForm, true);

    try {
      await requestData('/api/admin/blocked-periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barberId: formNumber(blockedPeriodForm, 'barberId'),
          startsAt,
          endsAt,
          ...(reason ? { reason } : {}),
        }),
      });
      blockedPeriodForm.reset();
      showAlert('Blokada została dodana.');
      await loadBlockedPeriods();
    } catch (error) {
      const apiError = handleCommonError(error, 'Nie udało się dodać blokady.');
      showFieldErrors(blockedPeriodForm, apiError?.fieldErrors);
      if (apiError?.code.endsWith('_NOT_FOUND')) {
        await Promise.all([loadBarbers(), loadBlockedPeriods()]);
      }
    } finally {
      setFormBusy(blockedPeriodForm, false);
    }
  });

  blockedPeriodsList.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>('[data-delete-blocked-period]');
    const id = button?.dataset.deleteBlockedPeriod;
    if (!button || !id) return;

    if (!window.confirm('Usunąć tę blokadę terminów?')) {
      return;
    }

    button.disabled = true;

    try {
      await requestData(`/api/admin/blocked-periods/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      showAlert('Blokada została usunięta.');
      await loadBlockedPeriods();
    } catch (error) {
      const apiError = handleCommonError(error, 'Nie udało się usunąć blokady.');
      if (apiError?.code.endsWith('_NOT_FOUND')) {
        showAlert('Blokada już nie istnieje. Lista została odświeżona.', 'error');
        await loadBlockedPeriods();
      }
    } finally {
      button.disabled = false;
    }
  });

  adminRoot.querySelectorAll<HTMLButtonElement>('[data-dialog-close]').forEach((button) => {
    button.addEventListener('click', () => {
      button.closest<HTMLDialogElement>('dialog')?.close();
    });
  });

  appointmentDialog.addEventListener('close', clearAppointmentDetail);
  [serviceDialog, barberDialog, workingHoursDialog].forEach((dialog) => {
    dialog.addEventListener('close', () => {
      const form = dialog.querySelector<HTMLFormElement>('form');
      form?.reset();
      if (form) clearFieldErrors(form);
    });
  });

  adminRoot.querySelectorAll<HTMLDialogElement>('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) {
        dialog.close();
      }
    });
  });

  retryButton.addEventListener('click', () => {
    initialize().catch(() => undefined);
  });

  initialize().catch(() => {
    showAlert('Nie udało się uruchomić panelu.', 'error');
  });
}

export {};
