# Brzytwa Barber

Учебный, но рассчитанный на реальное развёртывание сайт польского барбершопа в
Катовице. Проект строится поэтапно: текущая версия содержит статическую
Astro-основу, готовую схему Cloudflare D1 и фундамент Cloudflare Pages
Functions. Единственный динамический маршрут сейчас — технический
`GET /api/health`. Рабочая запись, business API, Turnstile, Resend и
административные операции будут добавляться отдельными завершёнными этапами.

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

**Этап 4 — ещё не реализован.** Пока отсутствуют services, barbers,
availability, booking и admin API, Turnstile, Resend, рабочая форма записи и
рабочая административная панель.

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

Astro отвечает только за статические страницы, компоненты, SEO, CSS и небольшой
клиентский TypeScript для мобильной навигации. Проект не использует Astro SSR и
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

На этапе 1 используется одна переменная:

```text
PUBLIC_SITE_URL
```

Создайте локальный файл:

```powershell
Copy-Item .env.example .env
```

Затем замените значение:

```dotenv
PUBLIC_SITE_URL=https://example.invalid
```

`https://example.invalid` — специально зарезервированный безопасный fallback.
Перед публикацией его обязательно нужно заменить реальным HTTPS-доменом.
Переменная используется для canonical URL, Open Graph URL, sitemap и
`robots.txt`.

Префикс `PUBLIC_` означает, что значение может попасть в клиентскую сборку. В
будущем секреты `TURNSTILE_SECRET_KEY` и `RESEND_API_KEY` нельзя называть с этим
префиксом или читать из клиентского кода.

Планируемые переменные следующих этапов:

```text
PUBLIC_TURNSTILE_SITE_KEY
TURNSTILE_SECRET_KEY
RESEND_API_KEY
RESEND_FROM_EMAIL
ADMIN_NOTIFICATION_EMAIL
PUBLIC_SITE_URL
```

Секреты должны храниться в Cloudflare Dashboard или локальном
`.dev.vars`, который исключён из Git.

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

### Unit tests

```powershell
npm.cmd run test
npm.cmd run test:unit
npm.cmd run test:unit:watch
```

Unit tests выполняются в обычном Node environment и проверяют API responses,
middleware, JSON parser, Zod validation, DST/time helpers, HTML escaping, UUID и
booking code. Cloudflare Workers test pool и Playwright не подключены.

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
уже генерирует UUID через Web Crypto API, но создание записей ещё не реализовано.
Деньги хранятся целым числом грошов, boolean — как `0` или `1`, события — как
ISO 8601 UTC, а рабочие часы — как локальное время `Europe/Warsaw` в формате
`HH:MM`.

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
npm.cmd run cf:types
npm.cmd run d1:migrations:apply:local
npm.cmd run test:unit
npm.cmd run build
```

## Маршруты

| Маршрут                 | Назначение                                                 |
| ----------------------- | ---------------------------------------------------------- |
| `/`                     | Главная страница                                           |
| `/uslugi`               | Услуги и демонстрационный прайс                            |
| `/zespol`               | Демонстрационный состав команды                            |
| `/galeria`              | Галерея                                                    |
| `/rezerwacja`           | Описание будущего процесса записи                          |
| `/kontakt`              | Контакты и часы работы                                     |
| `/polityka-prywatnosci` | Рабочий юридический шаблон                                 |
| `/regulamin-rezerwacji` | Рабочий юридический шаблон                                 |
| `/404`                  | Статическая страница ошибки                                |
| `/admin`                | Неактивная страница будущей панели                         |
| `/api/health`           | Единственный endpoint этапа 3: проверка Pages runtime и D1 |

`/admin` и `/404` получают `noindex, nofollow` и исключаются из sitemap.
Это не является механизмом безопасности. Настоящий `/admin` должен быть закрыт
Cloudflare Access до подключения административного API.

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

`wrangler.jsonc` сохраняет Pages-конфигурацию и добавляет D1 binding:

```jsonc
{
  "name": "brzytwa-barber",
  "pages_build_output_dir": "./dist",
  "compatibility_date": "2026-07-01",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "brzytwa-barber-preview",
      "database_id": "REPLACE_WITH_D1_DATABASE_ID",
      "preview_database_id": "DB",
      "migrations_dir": "migrations",
    },
  ],
}
```

`DB` — имя, под которым Pages Function получает D1 через
`context.env.DB`. `preview_database_id: "DB"` оставлен намеренно: актуальная
документация Cloudflare требует это поле для локальной разработки Pages с D1,
а значение отделяет local preview state от remote database ID. `database_id`
намеренно содержит явный placeholder: локальные команды его не используют, а
remote-команды нельзя запускать до замены на ID реально созданной базы.

`nodejs_compat` не включён: используемые Web API, D1, Zod и Temporal polyfill
работают без него.

Для Git-интеграции Cloudflare Pages:

- production branch: `main`;
- build command: `npm run build`;
- build output directory: `dist`;
- environment variable: `PUBLIC_SITE_URL` с реальным production-доменом.

Preview deployments должны получать собственный preview URL либо осознанно
использовать production canonical URL. Это решение нужно принять до
публикации.

## Preview и production D1

Нужны две независимые remote-базы:

```text
brzytwa-barber-preview
brzytwa-barber-production
```

Создание выполняется вручную после входа в Cloudflare:

```powershell
npx.cmd wrangler d1 create brzytwa-barber-preview --binding DB
npx.cmd wrangler d1 create brzytwa-barber-production --binding DB
```

`wrangler d1 create` действует на remote D1. Команды нельзя запускать из
автоматического setup-скрипта: они требуют аккаунт и создают реальные ресурсы.
Wrangler вернёт `database_name` и `database_id`. Перед remote-операцией
вставьте данные выбранной базы в binding `DB` или настройте соответствующий D1
binding в Cloudflare Pages Dashboard.

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

Remote-команды:

```powershell
npm.cmd run d1:migrations:list:remote
npm.cmd run d1:migrations:apply:remote
```

Remote scripts используют binding `DB`. Перед запуском проверьте, что
`database_name` и `database_id` указывают именно на нужную preview или production
базу. Production migration выполняется отдельно, после проверки preview и
резервной копии. Этап 3 не запускает remote-команды автоматически.

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

Эти интеграции ещё не активны.

- Cloudflare Access должен защищать `/admin` и `/api/admin/*` до появления
  реальных административных данных.
- Turnstile будет проверяться только в Pages Function через Siteverify.
- Resend будет вызываться только на сервере; API key не попадёт в HTML или
  клиентский JavaScript.
- Текущая страница `/admin` не является панелью и не содержит аутентификации.

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
  _shared/             responses, errors, validation, time, IDs и D1 helpers
  tsconfig.json        отдельная strict TypeScript-конфигурация
  types.d.ts           generated Cloudflare runtime types
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
  styles/global.css    tokens, компоненты и responsive-стили
tests/unit/             Vitest tests чистой backend-логики
astro.config.mjs
tsconfig.json
vitest.config.ts
wrangler.jsonc
.gitattributes         LF для текста, binary для изображений и шрифтов
```

Business endpoints этапа 4 в `functions` отсутствуют: нет services, barbers,
availability, booking и admin routes.

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

### Wrangler показывает `REPLACE_WITH_D1_DATABASE_ID`

Это ожидаемый placeholder remote-базы. Команды с `--local` используют
`preview_database_id` и локальное состояние `.wrangler/`. Для remote-команд
сначала создайте preview или production D1 и вставьте ID выбранной базы.

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

Этапы 1, 2, подготовительный этап 2.5 и этап 3 завершены. Этап 4 ещё не
реализован:

1. Public services и barbers API.
2. Серверный availability engine.
3. Создание записи и атомарное slot locking.
4. Turnstile и Resend.
5. Многошаговый booking UI.
6. Admin API и admin UI.
7. Security headers, Access и WAF-документация.
8. Финальные SEO, RODO, integration/E2E tests и deployment-документация.

## Лицензия

Существующий файл `LICENSE` содержит Apache License 2.0 и не изменялся в рамках
этапов 1, 2, 2.5 и 3. `.gitattributes` предотвращает бессмысленные EOL-diff и не
применяет текстовую нормализацию к изображениям и шрифтам.
