# Brzytwa Barber

Учебный, но рассчитанный на реальное развёртывание сайт польского барбершопа в
Катовице. Проект строится поэтапно: текущая версия содержит статическую
Astro-основу, готовую схему Cloudflare D1, Cloudflare Pages Functions и рабочую
публичную форму бронирования. Динамические маршруты предоставляют каталоги,
availability, атомарное создание записи, Turnstile-проверку и отправку писем
через Resend. Защищённый Cloudflare Access Admin API управляет записями,
каталогами, рабочими часами и блокировками через noindex admin panel.

Интерфейс и пользовательские сообщения написаны на польском языке. Техническая
документация в этом репозитории — на русском.

## Текущий статус

**Этап 1 — завершён.** Реализованы:

- статическая генерация Astro SSG;
- строгая проверка TypeScript;
- десять обязательных маршрутов;
- общие layouts, Header, Footer, breadcrumbs и SEO-компонент;
- адаптивный дизайн от 320 px;
- локальные изображения с оптимизацией через Astro Image;
- sitemap и генерируемый `robots.txt`;
- конфигурация Cloudflare Pages для Wrangler;
- статические польские шаблоны политики приватности и правил записи.

**Этап 2 — завершён.** Добавлены:

- схема D1 для услуг, мастеров, графика, блокировок и записей;
- миграции начальной схемы и демонстрационных данных;
- пять демонстрационных услуг, три мастера, их специализации и график;
- binding `DB` и локальное состояние Wrangler;
- команды локальных и удалённых миграций;
- ограничения, индексы и database-level защита от двойного бронирования.

**Подготовительный этап 2.5 — завершён.** Перед началом backend-разработки:

- подтверждена воспроизводимая чистая установка через `npm ci`;
- проверен и синхронизирован `package-lock.json` штатной командой npm;
- добавлен `.gitattributes` с LF для текста и явным исключением бинарных файлов;
- подтверждено отсутствие содержательного или EOL-изменения `LICENSE`;
- добавлена миграция `0003_appointment_slot_integrity.sql`;
- пара appointment–barber защищена составным foreign key;
- проверены отклонение неправильного мастера и повторного временного слота;
- hero-изображение перенесено в `src/assets/images` и подключено через Astro Image;
- технические номера этапов удалены из польского пользовательского интерфейса;
- все три миграции успешно применены к чистой local D1.

**Этап 3 — завершён.** Реализованы:

- корневая файловая маршрутизация Pages Functions;
- отдельная строгая TypeScript-конфигурация и generated runtime types;
- типизированный D1 binding `DB`;
- middleware только для `/api/*`;
- единый JSON-формат, `ApiError`, request ID и безопасное логирование;
- безопасный JSON body parser и общие Zod schemas;
- функции времени `Europe/Warsaw` с явной обработкой DST;
- HTML escaping, UUID, booking code и минимальные D1 helpers;
- `GET /api/health`;
- unit tests общей backend-логики.

**Этап 4 — завершён.** Реализованы:

- `GET /api/public/services` с активными услугами в стабильном порядке;
- `GET /api/public/barbers` с активными мастерами и сгруппированными услугами;
- фильтр мастеров по положительному integer `serviceId`;
- prepared statements и `.bind()` для пользовательского параметра;
- mock-D1 тесты маршрутов, преобразования snake_case в camelCase и ошибок.

**Этап 5 — завершён.** Реализованы:

- `GET /api/public/availability`;
- проверка активных услуги, мастера и связи между ними;
- расчёт 15-минутных начал с учётом длительности, графика, блокировок и занятых
  участков;
- lead time 120 минут и горизонт записи 45 дней;
- преобразование локальных часов через `Europe/Warsaw` без ручных UTC offset;
- unit tests чистого engine и route с mock D1.

**Этап 6 — завершён.** Реализованы:

- `POST /api/public/bookings`;
- нормализация и строгая Zod validation данных клиента;
- повторная server-side availability-проверка;
- подготовка записи и всех 15-минутных slot locks чистыми helpers;
- атомарный D1 batch с rollback при ошибке;
- 409 `SLOT_TAKEN` при гонке и ограниченный retry коллизии booking code.

**Этап 7 — завершён.** Реализованы:

- server-side Turnstile Siteverify перед обращением к D1;
- timeout и безопасные `TURNSTILE_FAILED` / `TURNSTILE_UNAVAILABLE`;
- клиентское подтверждение и admin-уведомление через Resend после D1 batch;
- отдельные HTML/plain-text templates с обязательным `escapeHtml()`;
- независимые email statuses и безопасный `email_error`;
- отсутствие email-конфигурации и сбой доставки не отменяют созданную запись.

**Этап 8 — завершён.** Реализованы:

- рабочая форма `/rezerwacja` на Astro, обычном TypeScript и CSS;
- последовательная загрузка услуг, мастеров и доступных терминов из public API;
- доступные radio-группы, состояния loading/disabled и адаптивный интерфейс;
- Turnstile widget только на странице записи и безопасная передача token в API;
- обработка field errors, `SLOT_TAKEN` и повторная загрузка availability;
- success state с booking code и полным резюме визита.

**Этап 9 — завершён.** Реализованы:

- защищённый Cloudflare Access middleware для `/api/admin/*`;
- просмотр записей с фильтрами, сортировкой и pagination;
- detail записи с customer data и 15-минутными slot locks;
- обновление статуса и атомарное освобождение slots при отмене;
- просмотр и PATCH услуг, мастеров и рабочих часов без физического удаления;
- создание, просмотр и удаление блокировок мастеров;
- mock-D1 тесты Access boundary, CRUD-операций, validation и безопасных ошибок.

**Этап 10 — завершён.** Реализованы:

- рабочая noindex-страница `/admin` на Astro, обычном TypeScript и CSS;
- dashboard с текущими, будущими и отменёнными записями;
- фильтры, pagination, detail и смена статуса записей;
- редактирование услуг, мастеров и рабочих часов;
- создание и удаление блокировок с отображением времени Europe/Warsaw;
- loading/disabled states, aria-live сообщения и подтверждение опасных операций;
- персональные данные отображаются только в appointment detail и не сохраняются
  в Web Storage.

**Этап 11 — завершён.** Добавлены:

- явные preview/production D1 bindings и безопасные именованные migration scripts;
- локальные `verify` и `verify:deploy` без remote-операций;
- отдельные deployment, local testing, security и production checklists;
- полный порядок Cloudflare Pages, Access, Turnstile и Resend setup;
- обязательный preview gate перед production migration;
- проверяемые требования к secrets, canonical, sitemap и robots.

## Эксплуатационная документация

- [Deployment и порядок выпуска](docs/deployment.md)
- [Локальная проверка](docs/local-testing.md)
- [Security checklist](docs/security-checklist.md)
- [Production go/no-go checklist](docs/production-checklist.md)

Production запуск запрещён без Cloudflare Access на `/admin`, `/admin/*` и
`/api/admin/*`. Реальные secrets не должны находиться в Git, `.env.example`,
`.dev.vars.example` или frontend bundle.

## Архитектура

```text
Пользователь
    ↓
Astro SSG на Cloudflare Pages
    ├── статические страницы и assets
    └── Cloudflare Pages Functions /api/*
            ↓
        Cloudflare D1
```

Astro отвечает только за статические страницы, компоненты, SEO, CSS и обычный
клиентский TypeScript для навигации и формы бронирования. Проект не использует Astro SSR и
не устанавливает `@astrojs/cloudflare`.

D1 не читается во время Astro build и не подключён к пользовательскому
интерфейсу:

```text
Wrangler CLI
    ↓
migrations/*.sql
    ↓
Local D1 или явно выбранная remote D1
```

Доступ приложения к binding `DB` выполняется только из Pages Functions. На этапе
3 D1 используется исключительно запросом `SELECT 1 AS ok` в health endpoint.
Статическая сборка остаётся независимой от локальной и remote базы.

## Технологии

- Astro 7.0.5;
- TypeScript 6.0.3 и `astro/tsconfigs/strictest`;
- обычные HTML, CSS и TypeScript;
- `@astrojs/sitemap` 3.7.3;
- Wrangler 4.106.0;
- Cloudflare D1 / SQLite-совместимый SQL;
- Cloudflare Pages и Pages Functions;
- Zod 4.4.3;
- `@js-temporal/polyfill` 0.5.1;
- Vitest 4.1.9;
- Node.js и npm только для разработки и сборки.

В проекте нет React, Vue, Svelte, Tailwind CSS, Bootstrap, jQuery, Axios,
отдельного Node.js-сервера или CMS.

`package.json` содержит узкий npm override для `yaml@2.8.3` внутри
`yaml-language-server`. Он устраняет advisory транзитивной dev-зависимости
`@astrojs/check`, не откатывая актуальную версию инструмента.

## Требования

- Node.js `>=22.12.0`;
- npm `>=9.6.5`;
- Windows 11, macOS или Linux для локальной разработки;
- аккаунт Cloudflare потребуется только для реального preview/deployment.

Проверенная локальная среда на момент этапа 3: Node.js 24.13.0, npm 11.6.2 и
Wrangler 4.106.0.

## Установка

```powershell
git clone <REPOSITORY_URL>
cd Brzytwa_Barber_Learning_project
npm.cmd ci
```

В обычном терминале, где PowerShell execution policy не блокирует `npm.ps1`,
можно использовать `npm` вместо `npm.cmd`.

`package-lock.json` является частью репозитория. Изменять его вручную нельзя:
после осознанного изменения зависимостей используйте `npm.cmd install`, а для
проверки состояния, максимально близкого к чистому клону, — `npm.cmd ci`.

## Переменные окружения

Публичные build-time переменные:

```text
PUBLIC_SITE_URL
PUBLIC_TURNSTILE_SITE_KEY
```

Создайте локальный файл:

```powershell
Copy-Item .env.example .env
```

Затем замените значения:

```dotenv
PUBLIC_SITE_URL=https://example.invalid
PUBLIC_TURNSTILE_SITE_KEY=replace-with-turnstile-site-key
```

`https://example.invalid` — специально зарезервированный безопасный fallback.
Перед публикацией его обязательно нужно заменить реальным HTTPS-доменом.
Переменная используется для canonical URL, Open Graph URL, sitemap и
`robots.txt`.

Префикс `PUBLIC_` означает, что значение может попасть в клиентскую сборку.
`TURNSTILE_SECRET_KEY` и `RESEND_API_KEY` нельзя называть с этим префиксом или
читать из клиентского кода.

`PUBLIC_TURNSTILE_SITE_KEY` встраивается только в страницу `/rezerwacja` и не
является секретом. Пока переменная отсутствует или содержит значение
`replace-with-turnstile-site-key`, форма показывает dev-сообщение и блокирует
отправку. Для локальной ручной проверки используйте site key из тестовой либо
локальной конфигурации Turnstile; secret остаётся только в `.dev.vars`.

Server-only переменные Pages Functions:

```text
PUBLIC_TURNSTILE_SITE_KEY
TURNSTILE_SECRET_KEY
RESEND_API_KEY
RESEND_FROM_EMAIL
ADMIN_NOTIFICATION_EMAIL
```

Для локального Pages runtime:

```powershell
Copy-Item .dev.vars.example .dev.vars
```

Замените все placeholder-значения. `.dev.vars` исключён из Git. В Cloudflare
секреты задаются через Dashboard/Secrets, а не коммитятся в `wrangler.jsonc`.

## Локальный запуск

Astro dev-сервер с горячей перезагрузкой:

```powershell
npm.cmd run dev
```

Откройте адрес, указанный в терминале, обычно
`http://localhost:4321`.

Проверка уже собранного статического результата:

```powershell
npm.cmd run build
npm.cmd run preview
```

Локальный runtime Cloudflare Pages:

```powershell
npm.cmd run pages:dev
```

Различия:

- `astro dev` — быстрая разработка компонентов и страниц;
- `astro preview` — просмотр содержимого `dist` через preview-сервер Astro;
- обе команды Astro не запускают Pages Functions и не предоставляют D1 binding;
- `wrangler pages dev dist` — локальный runtime Cloudflare Pages с Functions и
  local D1 binding;
- `npm run pages:dev` сначала выполняет чистую проверку и сборку, затем запускает
  Wrangler.

Перед запуском Pages runtime примените local migrations:

```powershell
npm.cmd run d1:migrations:apply:local
npm.cmd run pages:dev
```

## Этап 3 — backend-инфраструктура Pages Functions

Cloudflare Pages и Astro используют разные файловые системы маршрутизации:

```text
functions/api/health.ts
→ /api/health

src/pages/kontakt.astro
→ /kontakt
```

Поэтому `functions` находится в корне Pages-проекта, а не внутри `src/pages`.
Astro продолжает генерировать полностью статический `dist`; server modules не
попадают в клиентский bundle.

### TypeScript и runtime types

`functions/tsconfig.json` включает strict mode, современный ESM target,
`noEmit`, Web/Workers runtime declarations и не подключает Node.js APIs.
`nodejs_compat` и `@types/node` не требуются.

Cloudflare declarations генерируются из `wrangler.jsonc`:

```powershell
npm.cmd run cf:types
```

Команду нужно повторять после изменения bindings, Wrangler,
`compatibility_date`, compatibility flags или другой Cloudflare-конфигурации.
`functions/types.d.ts` генерируется Wrangler и не редактируется вручную. В нём
binding имеет тип:

```ts
interface Env {
  DB: D1Database;
}
```

### Middleware и API responses

`functions/api/_middleware.ts` применяется только к `/api/*`. Статические
страницы, изображения, CSS, JavaScript, sitemap и `robots.txt` не проходят через
него.

Успешный ответ:

```json
{
  "success": true,
  "data": {}
}
```

Ошибка:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Nie udało się przetworzyć żądania.",
    "fieldErrors": {
      "customerEmail": "Podaj prawidłowy adres e-mail."
    }
  }
}
```

Все API responses получают `Cache-Control: no-store`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` и
`X-Request-Id`. API является same-origin и не отправляет wildcard CORS.

`ApiError` содержит публичный код, HTTP status и безопасный польский текст.
Внутренняя причина остаётся только в server logs. Middleware не логирует request
body, email, телефон, notes, cookies, authorization headers или будущие
Turnstile/API tokens. Неизвестная ошибка возвращает `INTERNAL_ERROR` без stack
trace; request ID позволяет сопоставить ответ с безопасным server log.

### JSON parser и Zod validation

`readJsonBody()`:

- принимает JSON media types и параметры вроде `charset=utf-8`;
- отклоняет отсутствующий или неверный Content-Type;
- проверяет объявленный и фактический размер body;
- считает реальные UTF-8 bytes через `TextEncoder`;
- ограничивает body до 16 384 байт;
- возвращает `unknown`;
- не включает исходный body в сообщения об ошибках.

Общие Zod schemas пока не образуют booking request. Подготовлены:

- положительный integer ID с безопасным преобразованием query string;
- существующая локальная дата `YYYY-MM-DD`;
- точный UTC timestamp с миллисекундами и `Z`;
- Unicode-имя с пробелом, дефисом и апострофом;
- польский телефон, нормализуемый к `+48123456789`;
- email с trim и lowercase;
- notes с trim и результатом `string | null`;
- privacy acknowledgement, принимающий только literal `true`;
- преобразование первых Zod issues каждого поля в безопасные `fieldErrors`.

Notes остаются plain text. HTML-теги не удаляются из данных; при будущей вставке
в email они должны пройти через `escapeHtml()`.

### Europe/Warsaw и DST

События сохраняются как ISO 8601 UTC, а пользователь работает с
`Europe/Warsaw`. `@js-temporal/polyfill` преобразует время с offset,
соответствующим конкретной дате — вручную прибавлять один или два часа нельзя.

`localDateTimeToUtc()` использует `disambiguation: "reject"`: несуществующее
время весеннего перехода и неоднозначное время осеннего перехода отклоняются, а
не получают молча выбранный offset. Helpers также форматируют UTC как польские
`DD.MM.YYYY` и `HH:MM`, возвращают ISO weekday 1–7 и добавляют точные минуты в
UTC.

### Идентификаторы, HTML и D1

- UUID создаётся через `crypto.randomUUID()`.
- Candidate booking code имеет формат `BK-XXXXXX`, использует
  `crypto.getRandomValues()` и исключает `0`, `O`, `1`, `I`, `L`.
- `escapeHtml()` экранирует `&`, `<`, `>`, `"`, `'` без удаления текста.
- D1 helpers принимают `D1PreparedStatement` и используют `first()`, `all()` и
  `run()`.
- Пользовательские SQL-значения в будущих endpoints должны передаваться через
  `prepare().bind()`, а не интерполяцию.

Candidate booking code сам по себе не гарантирует уникальность. Проверка D1 и
ограниченный retry будут частью booking API, а не этапа 3.

### Health endpoint

```text
GET /api/health
```

Endpoint проверяет Pages runtime и D1 статическим prepared query
`SELECT 1 AS ok`, после чего возвращает status, database status,
`Europe/Warsaw` и server timestamp. Он не возвращает имя/ID базы, таблицы,
миграции, environment variables или secrets и не является полноценной системой
мониторинга.

`POST /api/health` возвращает HTTP 405, `Allow: GET` и
`METHOD_NOT_ALLOWED`. Ошибка D1 преобразуется в HTTP 503
`DATABASE_UNAVAILABLE`, а внутренняя причина остаётся в server logs.

## Этап 4 — public services и barbers API

### Услуги

```text
GET /api/public/services
```

Endpoint не принимает параметры и возвращает только активные услуги в порядке
`sort_order, id`. Внутренние поля `active`, `sort_order`, timestamps и SQL-имена
в snake_case наружу не передаются.

```json
{
  "success": true,
  "data": {
    "services": [
      {
        "id": 1,
        "slug": "strzyzenie-meskie",
        "name": "Strzyżenie męskie",
        "description": "Konsultacja, precyzyjne cięcie...",
        "durationMinutes": 45,
        "priceGrosze": 7000
      }
    ]
  }
}
```

### Мастера

```text
GET /api/public/barbers
GET /api/public/barbers?serviceId=1
```

Без параметра возвращаются активные мастера и их активные услуги. Положительный
integer `serviceId` ограничивает список мастерами, которые выполняют выбранную
активную услугу; внутри каждого мастера по-прежнему возвращается полный список
его активных услуг.

```json
{
  "success": true,
  "data": {
    "barbers": [
      {
        "id": 1,
        "slug": "michal",
        "name": "Michał",
        "bio": "Ceni klasyczne formy...",
        "imagePath": "barber-michal.png",
        "services": [
          {
            "id": 1,
            "slug": "strzyzenie-meskie",
            "name": "Strzyżenie męskie",
            "durationMinutes": 45,
            "priceGrosze": 7000
          }
        ]
      }
    ]
  }
}
```

Ошибки public API:

- неверный `serviceId` — HTTP 400 `VALIDATION_ERROR`;
- отсутствующая или неактивная услуга — HTTP 404 `SERVICE_NOT_FOUND`;
- любой метод кроме GET — HTTP 405 `METHOD_NOT_ALLOWED` и `Allow: GET`;
- ошибка D1 — безопасный HTTP 500 `INTERNAL_ERROR` через общий middleware.

Для запроса с фильтром выполняется не более двух D1-запросов: проверка активной
услуги и общая выборка мастеров со связями. `serviceId` в обоих случаях
передаётся через `.bind()` и не интерполируется в SQL.

## Этап 5 — availability API

```text
GET /api/public/availability?serviceId=1&barberId=1&date=2026-07-15
```

Все три параметра обязательны. ID должны быть положительными целыми числами,
`date` — существующей локальной датой `YYYY-MM-DD`. Endpoint проверяет активность
услуги и мастера, их связь и активные рабочие часы для ISO weekday. После этого
он получает пересекающие рабочий интервал блокировки и занятые
`appointment_slots`.

Engine генерирует начала каждые 15 минут. Кандидат возвращается, только если вся
длительность услуги помещается до закрытия, каждый её 15-минутный участок
свободен, нет пересечения с `blocked_periods`, а начало не нарушает lead time
120 минут. Последний допустимый день — 45-й локальный календарный день от
текущей даты в `Europe/Warsaw`.

```json
{
  "success": true,
  "data": {
    "date": "2026-07-15",
    "timezone": "Europe/Warsaw",
    "slots": [
      {
        "startsAt": "2026-07-15T08:00:00.000Z",
        "localTime": "10:00"
      }
    ]
  }
}
```

Ошибки: HTTP 400 `VALIDATION_ERROR`, `INVALID_DATE`, `BOOKING_TOO_FAR` или
`BARBER_SERVICE_UNAVAILABLE`; HTTP 404 `SERVICE_NOT_FOUND` или
`BARBER_NOT_FOUND`; HTTP 405 `METHOD_NOT_ALLOWED` с `Allow: GET`. Неизвестная
ошибка D1 проходит через общий middleware как безопасный `INTERNAL_ERROR`.

## Этап 6 — bookings API

```text
POST /api/public/bookings
Content-Type: application/json
```

Body содержит `serviceId`, `barberId`, UTC `startsAt`, имя, польский телефон,
email, необязательные notes, обязательное `privacyNoticeAccepted: true` и
`turnstileToken`. Validation нормализует имя, телефон к `+48XXXXXXXXX`, email к
lowercase и пустые notes к `null`.

Перед записью endpoint повторно проверяет активность услуги и мастера, их связь,
график, lead time, горизонт, блокировки и занятые участки через общий availability
engine. Затем UUID, appointment и все 15-минутные `appointment_slots` записываются
одним D1 `batch()`. Ошибка любого statement откатывает batch. UNIQUE-конфликт
слота возвращает HTTP 409 `SLOT_TAKEN`; коллизия `booking_code` повторяет весь
batch максимум пять раз.

Успешный HTTP 201 возвращает booking code, услугу, мастера, начало и окончание в
UTC, польские локальные дату/время, длительность, цену и итоговые email statuses.
Новая запись получает `confirmed`; email statuses сначала `pending`, затем
независимо обновляются до `sent` или `failed`.

Ошибки body: HTTP 400 `VALIDATION_ERROR`, `INVALID_CONTENT_TYPE` или
`INVALID_JSON`, HTTP 413 `PAYLOAD_TOO_LARGE`. Ошибки каталога и availability
сохраняют публичные коды предыдущих этапов. Необработанная D1-причина не попадает
в response.

## Этап 7 — Turnstile и Resend

Booking flow выполняется строго в таком порядке:

```text
validate body
→ Turnstile Siteverify
→ availability recheck
→ atomic D1 booking batch
→ customer/admin Resend requests
→ D1 email status update
→ HTTP 201
```

Siteverify получает `secret`, `response` и `CF-Connecting-IP`, когда заголовок
доступен. Timeout или недоступность сервиса возвращает HTTP 503
`TURNSTILE_UNAVAILABLE`; отсутствующий либо отклонённый token — HTTP 400
`TURNSTILE_FAILED`. Token и secret не включаются в response или logs.

После успешного D1 batch два письма отправляются независимо через Web `fetch`,
без Node SDK и `nodejs_compat`. Каждое содержит HTML и plain text. Пользовательские
значения в HTML проходят через `escapeHtml()`. Ошибка одного или обоих писем не
откатывает booking: API остаётся HTTP 201, а `customer_email_status`,
`admin_email_status` и безопасный короткий `email_error` сохраняются в D1.

Локальная проверка:

```powershell
Copy-Item .dev.vars.example .dev.vars
npm.cmd run d1:migrations:apply:local
npm.cmd run pages:dev
```

Placeholder credentials не выполняют реальные запросы. Изолированная проверка
без внешней сети выполняется через `npm.cmd run test:unit`, где Siteverify и
Resend полностью замоканы.

## Этап 8 — форма бронирования

Страница `/rezerwacja` последовательно вызывает:

```text
GET services
→ GET barbers?serviceId
→ GET availability?serviceId&barberId&date
→ Turnstile token
→ POST bookings
→ booking code и резюме визита
```

При смене услуги, мастера или даты выбранный slot сбрасывается. Во время запросов
интерфейс показывает loading/disabled states, а повторная отправка блокируется.
`VALIDATION_ERROR` привязывается к полям; `SLOT_TAKEN` очищает выбранный термин,
обновляет availability и просит выбрать другую часы. Сообщения Turnstile и
остальные ошибки отображаются на польском через `aria-live`.

Для ручной проверки сначала настройте `.env` и `.dev.vars`, примените локальные
миграции, затем запустите:

```powershell
npm.cmd run d1:migrations:apply:local
npm.cmd run pages:dev
```

Откройте `/rezerwacja`, выберите услугу, мастера, дату и время, заполните данные,
пройдите Turnstile и отправьте форму. Повторная запись на тот же slot должна
вернуть `SLOT_TAKEN`, после чего список доступных часов обновится.

## Этап 9 — Admin API

Admin routes:

```text
GET    /api/admin/appointments
GET    /api/admin/appointments/:id
PATCH  /api/admin/appointments/:id/status
GET    /api/admin/services
PATCH  /api/admin/services/:id
GET    /api/admin/barbers
PATCH  /api/admin/barbers/:id
GET    /api/admin/working-hours
PATCH  /api/admin/working-hours/:id
GET    /api/admin/blocked-periods
POST   /api/admin/blocked-periods
DELETE /api/admin/blocked-periods/:id
```

Перед production-развёртыванием Cloudflare Access Application обязана защищать
`/api/admin/*`. В коде нет логинов или паролей: вложенный middleware принимает
запрос только при наличии `Cf-Access-Jwt-Assertion` и
`Cf-Access-Authenticated-User-Email`, которые выставляет Access. Customer phone,
email и notes возвращаются только appointment endpoints.

Локально Access boundary проверяется тестовыми заголовками:

```powershell
curl.exe http://127.0.0.1:8788/api/admin/services `
  -H "Cf-Access-Jwt-Assertion: local-test" `
  -H "Cf-Access-Authenticated-User-Email: admin@example.invalid"
```

Эти mock headers предназначены только для `wrangler pages dev`. В production
нельзя считать ручную передачу заголовков заменой настроенной Access Application.
Отмена записи выполняет status update и удаление `appointment_slots` одним D1
batch; повторная отмена безопасна.

## Этап 10 — административная панель

Страница `/admin` использует только Admin API этапа 9. Панель содержит dashboard,
rezerwacje, usługi, barberów, godziny pracy и blokady terminów. Appointment list
не показывает персональные данные; имя, телефон, email и notes загружаются
отдельно при открытии detail и очищаются из DOM при закрытии.

Production deployment обязан закрывать Cloudflare Access Application оба пути:

```text
/admin
/api/admin/*
```

В панели нет собственной login form, паролей, JWT или sessions. Без Access
headers API возвращает `ADMIN_UNAUTHORIZED`, а интерфейс показывает экран с
требованием Cloudflare Access.

Локальная проверка API выполняется mock headers из раздела этапа 9. Для проверки
полного UI используйте локальный proxy или browser request interception, которые
добавляют оба заголовка только к `/api/admin/*`:

```text
Cf-Access-Jwt-Assertion: local-test
Cf-Access-Authenticated-User-Email: admin@example.invalid
```

Не добавляйте эти значения в клиентский код, `localStorage`, `sessionStorage`
или production-конфигурацию. Без настроенной Access Application production
запуск `/admin` запрещён.

### Unit tests

```powershell
npm.cmd run test
npm.cmd run test:unit
npm.cmd run test:unit:watch
```

Unit tests выполняются в обычном Node environment и проверяют API responses,
middleware, JSON parser, Zod validation, DST/time helpers, HTML escaping, UUID,
booking code и public routes с mock D1. Availability engine отдельно покрывает
длительности, закрытие, занятые участки, блокировки, lead time, горизонт и
летнее/зимнее время Warsaw. Stateful booking mock проверяет атомарный rollback,
гонку двух запросов, число slot locks и retry booking code. Cloudflare Workers
Тесты stage 7 отдельно проверяют Turnstile, Resend, timeout, templates,
частичные отказы, env validation и D1 email statuses. Cloudflare Workers test
pool и Playwright не подключены.

## D1 architecture

Схема состоит из семи бизнес-таблиц:

| Таблица             | Назначение                                                |
| ------------------- | --------------------------------------------------------- |
| `services`          | Услуги, длительность, цена в грошах и порядок отображения |
| `barbers`           | Мастера и логический ключ изображения                     |
| `barber_services`   | Связь many-to-many между мастерами и услугами             |
| `working_hours`     | Один локальный рабочий интервал мастера на ISO weekday    |
| `blocked_periods`   | Отпуска, перерывы и другие интервалы недоступности в UTC  |
| `appointments`      | История записей, контакты клиента и статусы email         |
| `appointment_slots` | 15-минутные занятые слоты и финальная защита от гонок     |

`services`, `barbers` и `working_hours` используют INTEGER primary key.
`appointments` и `blocked_periods` используют UUID в `TEXT`; общий server helper
генерирует UUID через Web Crypto API. Деньги хранятся целым числом грошов,
boolean — как `0` или `1`, события — как ISO 8601 UTC, а рабочие часы — как
локальное время `Europe/Warsaw` в формате `HH:MM`.

В `barbers.image_path` сейчас хранится стабильный логический ключ файла:
`barber-michal.png`, `barber-kamil.png` или `barber-adrian.png`. Он однозначно
сопоставляется с импортами из `src/assets/images` через frontend mapper. Это не
публичный URL, и изображения не копируются в `public`.

### Политика удаления и деактивации

Связи справочников, график и блокировки удаляются каскадно вместе с мастером.
Слоты каскадно удаляются вместе с записью. История записей защищена:
`appointments.barber_id` и `appointments.service_id` используют
`ON DELETE RESTRICT`.

В рабочем приложении мастеров и услуги нужно деактивировать через `active = 0`,
а не удалять физически. Это сохраняет ссылки из исторических записей.

## Local D1

Локальная база создаётся только Wrangler и хранится внутри:

```text
.wrangler/state/v3/d1/
```

Каталог `.wrangler/` исключён из Git. Local D1 не является копией preview или
production D1 и не выполняет сетевые запросы к аккаунту Cloudflare при командах
с `--local`.

Проверить ожидающие миграции и применить их:

```powershell
npm.cmd run d1:migrations:list:local
npm.cmd run d1:migrations:apply:local
```

Выполнить произвольный локальный запрос:

```powershell
npm.cmd run d1:query:local -- --command "SELECT * FROM services ORDER BY sort_order"
```

Для полного локального сброса удалите только локальное состояние D1 и повторно
примените миграции:

```powershell
Remove-Item -Recurse -Force .wrangler\state\v3\d1
npm.cmd run d1:migrations:apply:local
```

Перед удалением убедитесь, что путь находится внутри этого репозитория.
Миграции применяются один раз и регистрируются в таблице `d1_migrations`.

## Проверка и сборка

Общая проверка Astro, frontend TypeScript и Pages Functions TypeScript:

```powershell
npm.cmd run check
```

Production-сборка:

```powershell
npm.cmd run build
```

Команда `build` намеренно запускает общий `check` перед `astro build`, поэтому
деплой не должен продолжаться при ошибках frontend или Functions.

Перед deployment рекомендуется выполнить:

```powershell
npm.cmd ci
npm.cmd run d1:migrations:apply:local
npm.cmd run verify:deploy
```

`verify` и `verify:deploy` не создают Cloudflare-ресурсы, не выполняют deployment
и не запускают remote migrations.

## Маршруты

| Маршрут                    | Назначение                                       |
| -------------------------- | ------------------------------------------------ |
| `/`                        | Главная страница                                 |
| `/uslugi`                  | Услуги и демонстрационный прайс                  |
| `/zespol`                  | Демонстрационный состав команды                  |
| `/galeria`                 | Галерея                                          |
| `/rezerwacja`              | Рабочая публичная форма записи                   |
| `/kontakt`                 | Контакты и часы работы                           |
| `/polityka-prywatnosci`    | Рабочий юридический шаблон                       |
| `/regulamin-rezerwacji`    | Рабочий юридический шаблон                       |
| `/404`                     | Статическая страница ошибки                      |
| `/admin`                   | Защищённая административная панель               |
| `/api/health`              | Проверка Pages runtime и D1                      |
| `/api/public/services`     | Активные услуги                                  |
| `/api/public/barbers`      | Активные мастера и их услуги; фильтр `serviceId` |
| `/api/public/availability` | Доступные начала по услуге, мастеру и дате       |
| `/api/public/bookings`     | Создание записи и атомарное резервирование       |

`/admin` и `/404` получают `noindex, nofollow` и исключаются из sitemap.
Это не является механизмом безопасности. `/admin` и `/api/admin/*` должны быть
закрыты Cloudflare Access в каждом production/preview окружении.

## Центральная конфигурация и данные

Название, город, язык, часовой пояс, часы работы, навигация и контактные
placeholder’ы находятся в `src/config/site.ts`.

Обязательные значения до публикации:

```text
[NUMER_TELEFONU]
[EMAIL]
[ADRES]
[NIP]
[DOMENA]
[INSTAGRAM_URL]
[FACEBOOK_URL]
[GOOGLE_MAPS_URL]
```

Пока значение остаётся placeholder’ом, сайт не создаёт для него активный
`tel:`, `mailto:` или внешний URL.

Услуги, мастера и галерея типизированы отдельно в `src/data/content.ts`. На
этапах API компоненты смогут получать те же структуры от сервера без
переписывания визуального слоя.

## Изображения

Демонстрационные фотографии и изображение ножниц в hero находятся в
`src/assets/images`. Это вымышленные люди и пространство, а не фотографии
реального салона или сотрудников.

Astro генерирует responsive WebP-варианты, добавляет размеры и лениво загружает
контент ниже первого экрана. Hero является содержательным LCP-изображением,
поэтому загружается eager с `fetchpriority="high"`; для него генерируются только
три ширины. Исходник больше не копируется из `public` в production без
оптимизации. Перед коммерческой публикацией владелец должен утвердить изображения
или заменить их реальными материалами.

## SEO

Сейчас реализованы:

- уникальные title и meta description;
- canonical URL;
- Open Graph и Twitter card;
- `lang="pl"`;
- одна H1 на страницу;
- семантические H2/H3;
- breadcrumbs и внутренние ссылки;
- sitemap;
- генерируемый `robots.txt`;
- alt-тексты;
- `noindex` для `/admin` и `/404`.

Schema.org JSON-LD намеренно не публикуется с вымышленным адресом и контактами.
После получения реальных NAP-данных на этапе 12 можно добавить существующий тип
`HairSalon`.

## Cloudflare Pages

`wrangler.jsonc` содержит `pages_build_output_dir`, локальный D1 binding и
раздельные `env.preview` / `env.production` bindings. Перед первым deployment
обязательно замените:

```text
REPLACE_WITH_PREVIEW_D1_DATABASE_ID
REPLACE_WITH_PRODUCTION_D1_DATABASE_ID
```

`DB` — имя, под которым Pages Function получает D1 через `context.env.DB`.
`preview_database_id: "DB"` используется только для local Pages development и
отделяет `.wrangler/` state от remote D1.

`nodejs_compat` не включён: используемые Web API, D1, Zod и Temporal polyfill
работают без него.

Для Git-интеграции Cloudflare Pages:

- production branch: `main`;
- build command: `npm run verify:deploy`;
- build output directory: `dist`;
- root directory: `/`;
- переменные и secrets настраиваются отдельно для Preview и Production.

Полный порядок настройки описан в [deployment guide](docs/deployment.md).

## Preview и production D1

Нужны две независимые remote-базы:

```text
brzytwa-barber-preview
brzytwa-barber-production
```

Создание выполняется вручную после входа в Cloudflare:

```powershell
npx.cmd wrangler d1 create brzytwa-barber-preview
npx.cmd wrangler d1 create brzytwa-barber-production
```

`wrangler d1 create` действует на remote D1. Команды нельзя запускать из
автоматического setup-скрипта: они требуют аккаунт и создают реальные ресурсы.
Wrangler вернёт `database_name` и `database_id`. Вставьте preview и production
UUID в соответствующие секции `wrangler.jsonc`, затем ещё раз сверьте их с
Dashboard.

Не направляйте локальную разработку на production. Preview и production
получают одинаковые миграции, но применяются отдельно и осознанно.

Официальная документация:

- [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/);
- [D1 local development](https://developers.cloudflare.com/d1/best-practices/local-development/);
- [Wrangler D1 commands](https://developers.cloudflare.com/workers/wrangler/commands/d1/);
- [Pages Wrangler configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/).

## Migrations

Миграции применяются по порядку:

- `migrations/0001_initial.sql` создаёт таблицы, foreign keys, CHECK/UNIQUE
  constraints и индексы;
- `migrations/0002_seed.sql` добавляет пять услуг, трёх мастеров, 13 связей
  мастер–услуга и 18 строк графика; воскресенье не имеет строк и считается
  закрытым;
- `migrations/0003_appointment_slot_integrity.sql` перестраивает
  `appointment_slots` и связывает `(appointment_id, barber_id)` с
  `(appointments.id, appointments.barber_id)`.

Исправление добавлено новой миграцией, а не напрямую в `0001_initial.sql`,
потому что `0001` уже могла быть применена к существующим базам. Изменение
истории миграций не обновило бы такие базы и сделало бы состояние окружений
неоднозначным. `0003` сохраняет корректные существующие слоты, а при наличии
несогласованной пары appointment–barber останавливается с foreign key error.
Для безопасной перестройки таблицы используется поддерживаемый D1
`PRAGMA defer_foreign_keys`.

Локальные команды:

```powershell
npm.cmd run d1:migrations:list:local
npm.cmd run d1:migrations:apply:local
```

Preview remote-команды:

```powershell
npm.cmd run d1:migrations:list:preview
npm.cmd run d1:migrations:apply:preview
```

Production remote-команды:

```powershell
npm.cmd run d1:migrations:list:production
npm.cmd run d1:migrations:apply:production
```

Scripts используют явные database names и `--env`. Перед запуском всё равно
необходимо проверить database UUID. Production migration выполняется отдельно,
только после успешного preview и checklist. Никакая build/verify команда не
запускает remote migrations.

### Slot locking

`appointment_slots` содержит:

```sql
PRIMARY KEY (appointment_id, slot_start_utc)
UNIQUE (barber_id, slot_start_utc)
FOREIGN KEY (appointment_id, barber_id)
  REFERENCES appointments(id, barber_id)
  ON DELETE CASCADE
```

Сервер на следующих этапах обязан сначала рассчитать доступность, но такая
проверка сама по себе не защищает от двух параллельных запросов. UNIQUE
constraint является последней атомарной защитой от race condition: только одна
запись сможет занять конкретный слот мастера.

Составной foreign key дополнительно не позволяет записать слот с мастером,
который отличается от `appointments.barber_id`. Для parent key миграция создаёт
уникальный индекс `appointments(id, barber_id)`.

## Cloudflare Access, Turnstile и Resend

- Cloudflare Access должен защищать `/admin` и `/api/admin/*`; Admin API
  дополнительно отклоняет запросы без Access identity headers.
- Turnstile проверяется только в Pages Function через Siteverify.
- Resend вызывается только на сервере; API key не попадает в HTML или
  клиентский JavaScript.
- `/admin` является клиентом Admin API и намеренно не содержит собственной
  аутентификации.

## Юридические шаблоны

`/polityka-prywatnosci` и `/regulamin-rezerwacji` содержат технические польские
шаблоны. Они описывают планируемый процесс и явно отмечены как черновики.

Владелец или юрист обязан проверить и утвердить их перед публикацией. Проект не
утверждает автоматическое соответствие всем требованиям RODO или польского
права.

## Структура

```text
migrations/
  0001_initial.sql   схема, constraints и индексы
  0002_seed.sql      демонстрационные данные
  0003_appointment_slot_integrity.sql
                      целостность пары appointment–barber
functions/
  api/
    _middleware.ts     API error boundary, headers и request ID
    health.ts          GET /api/health
    public/
      services.ts      GET /api/public/services
      barbers.ts       GET /api/public/barbers
      availability.ts  GET /api/public/availability
      bookings.ts      POST /api/public/bookings
    admin/
      _middleware.ts   проверка Cloudflare Access identity headers
      appointments/    список, detail и изменение статуса
      services/        admin list и PATCH
      barbers/          admin list и PATCH
      working-hours/    admin list и PATCH
      blocked-periods/ list, POST и DELETE
  _shared/
    admin.ts           admin parsing, mapping и общие helpers
    availability.ts    чистый engine расчёта доступных слотов
    booking.ts         подготовка записи и 15-минутных slot locks
    turnstile.ts       Siteverify client с timeout
    email.ts           Resend client и независимые статусы
    email-templates.ts безопасные HTML/plain-text письма
                       responses, errors, validation, time, IDs и D1 helpers
  env.d.ts             server-only Env declarations
  tsconfig.json        отдельная strict TypeScript-конфигурация
  types.d.ts           generated Cloudflare runtime types
docs/
  deployment.md        полный preview/production deployment flow
  local-testing.md     локальная D1, Pages и mock Access проверка
  security-checklist.md security gate
  production-checklist.md production go/no-go gate
public/
  favicon.svg
src/
  assets/images/       локальные исходники и оптимизируемый hero
  components/common/  общие UI-компоненты
  config/site.ts       данные бренда и контактов
  data/content.ts      статический контент этапа 1
  layouts/             публичный и административный layouts
  pages/               файловая маршрутизация Astro
  scripts/site.ts      мобильная навигация
  scripts/booking.ts   публичная форма записи
  scripts/admin.ts     интерфейс Admin API без клиентской авторизации
  types/admin.ts       frontend-типы Admin API
  styles/global.css    tokens, компоненты и responsive-стили
tests/unit/             Vitest tests чистой backend-логики
astro.config.mjs
tsconfig.json
vitest.config.ts
wrangler.jsonc
.gitattributes         LF для текста, binary для изображений и шрифтов
```

Public services, barbers, availability и bookings endpoints находятся в
`functions/api/public`. Защищённые административные routes находятся в
`functions/api/admin`.

## Troubleshooting

### Astro пытается записать telemetry config вне workspace

В ограниченной sandbox-среде отключите telemetry для текущего процесса:

```powershell
$env:ASTRO_TELEMETRY_DISABLED = "1"
npm.cmd run check
```

На обычной локальной машине это, как правило, не требуется.

### Canonical содержит `example.invalid`

Создайте `.env` из `.env.example`, задайте реальный `PUBLIC_SITE_URL` и
пересоберите проект. Не публикуйте production-сборку с fallback URL.

### Контакты отображаются в квадратных скобках

Замените значения в `src/config/site.ts`. Placeholder’ы специально не становятся
активными ссылками.

### `astro preview` не проверяет Pages Functions

Это ожидаемо. Используйте `npm run pages:dev`: только Wrangler запускает
корневой каталог `functions` и предоставляет local D1 binding.

### Wrangler показывает D1 placeholder

`REPLACE_WITH_PREVIEW_D1_DATABASE_ID` и
`REPLACE_WITH_PRODUCTION_D1_DATABASE_ID` должны оставаться только до создания
remote-баз. Команды с `--local` используют `preview_database_id` и локальное
состояние `.wrangler/`. Remote-команды запрещены до замены и двойной проверки
обоих UUID.

### Локальная миграция уже применена

Wrangler хранит журнал в `d1_migrations`. Команда list покажет только ещё не
применённые файлы:

```powershell
npm.cmd run d1:migrations:list:local
```

Для чистого повторного прогона удалите локальный каталог
`.wrangler/state/v3/d1` и примените миграции заново. Не удаляйте remote D1.

## Ограничения MVP

В MVP не планируются онлайн-оплата, SMS, регистрация клиентов, личный кабинет,
несколько филиалов, сложные роли, CMS, Google Calendar sync, recurring
appointments, промокоды, loyalty system, push-уведомления и самостоятельный
перенос записи клиентом.

## Следующие этапы

Этапы 1–11 завершены. Дальнейшие этапы могут расширять эксплуатационную
конфигурацию и административные сценарии без добавления собственной авторизации.

## Лицензия

Существующий файл `LICENSE` содержит Apache License 2.0 и не изменялся в рамках
этапов 1, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10 и 11. `.gitattributes` предотвращает бессмысленные
EOL-diff и не применяет текстовую нормализацию к изображениям и шрифтам.
