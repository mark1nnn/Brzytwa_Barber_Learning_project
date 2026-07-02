# Brzytwa Barber

Учебный, но рассчитанный на реальное развёртывание сайт польского барбершопа в
Катовице. Проект строится поэтапно: текущая версия содержит статическую
Astro-основу и готовую схему Cloudflare D1 с локально проверенными миграциями.
Pages Functions, API, рабочая запись, Turnstile, Resend и административные
операции будут добавляться отдельными завершёнными этапами.

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
- миграции `0001_initial.sql` и `0002_seed.sql`;
- пять демонстрационных услуг, три мастера, их специализации и график;
- binding `DB` и локальное состояние Wrangler;
- команды локальных и удалённых миграций;
- ограничения, индексы и database-level защита от двойного бронирования.

**Этап 3 — ещё не реализован.** В проекте по-прежнему отсутствуют Pages
Functions, публичное и административное API, Turnstile, Resend, рабочая форма
записи и рабочая административная панель.

## Архитектура

```text
Пользователь
    ↓
Статические страницы Astro
    ↓
Cloudflare Pages
```

После следующих этапов схема будет расширена:

```text
Пользователь
    ↓
Astro SSG на Cloudflare Pages
    ↓
Cloudflare Pages Functions /api/*
    ↓
Cloudflare D1
    ↓
Resend
```

Astro отвечает только за статические страницы, компоненты, SEO, CSS и небольшой
клиентский TypeScript для мобильной навигации. Проект не использует Astro SSR и
не устанавливает `@astrojs/cloudflare`.

D1 на этапе 2 не читается во время Astro build и пока не подключён к
пользовательскому интерфейсу:

```text
Wrangler CLI
    ↓
migrations/*.sql
    ↓
Local D1 или явно выбранная remote D1
```

Доступ приложения к binding `DB` появится только через Pages Functions на этапе
3. Статическая сборка остаётся независимой от локальной и remote базы.

## Технологии

- Astro 7.0.5;
- TypeScript 6.0.3 и `astro/tsconfigs/strictest`;
- обычные HTML, CSS и TypeScript;
- `@astrojs/sitemap` 3.7.3;
- Wrangler 4.106.0;
- Cloudflare D1 / SQLite-совместимый SQL;
- Cloudflare Pages;
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

Проверенная локальная среда на момент этапа 2: Node.js 24.13.0, npm 11.6.2 и
Wrangler 4.106.0.

## Установка

```powershell
git clone <REPOSITORY_URL>
cd Brzytwa_Barber_Learning_project
npm.cmd install
```

В обычном терминале, где PowerShell execution policy не блокирует `npm.ps1`,
можно использовать `npm` вместо `npm.cmd`.

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
- `wrangler pages dev dist` — окружение Cloudflare Pages, которое понадобится
  для проверки Pages Functions и binding’ов;
- `npm run pages:dev` сначала выполняет чистую проверку и сборку, затем запускает
  Wrangler.

## D1 architecture

Схема состоит из семи бизнес-таблиц:

| Таблица | Назначение |
| --- | --- |
| `services` | Услуги, длительность, цена в грошах и порядок отображения |
| `barbers` | Мастера и логический ключ изображения |
| `barber_services` | Связь many-to-many между мастерами и услугами |
| `working_hours` | Один локальный рабочий интервал мастера на ISO weekday |
| `blocked_periods` | Отпуска, перерывы и другие интервалы недоступности в UTC |
| `appointments` | История записей, контакты клиента и статусы email |
| `appointment_slots` | 15-минутные занятые слоты и финальная защита от гонок |

`services`, `barbers` и `working_hours` используют INTEGER primary key.
`appointments` и `blocked_periods` используют UUID в `TEXT`; UUID будет
генерировать серверный TypeScript через Web Crypto API на следующих этапах.
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

Проверка Astro и TypeScript:

```powershell
npm.cmd run check
```

Production-сборка:

```powershell
npm.cmd run build
```

Команда `build` намеренно запускает `astro check` перед `astro build`, поэтому
деплой не должен продолжаться при ошибках типов.

Vitest и Playwright не подключены на этапах 1–2. Unit, integration и E2E тесты
появятся после реализации бизнес-логики, чтобы в проекте не было пустых test
scripts и неиспользуемых зависимостей.

## Маршруты

| Маршрут | Назначение |
| --- | --- |
| `/` | Главная страница |
| `/uslugi` | Услуги и демонстрационный прайс |
| `/zespol` | Демонстрационный состав команды |
| `/galeria` | Галерея |
| `/rezerwacja` | Описание будущего процесса записи |
| `/kontakt` | Контакты и часы работы |
| `/polityka-prywatnosci` | Рабочий юридический шаблон |
| `/regulamin-rezerwacji` | Рабочий юридический шаблон |
| `/404` | Статическая страница ошибки |
| `/admin` | Неактивная страница будущей панели |

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

Демонстрационные фотографии созданы локально для проекта и находятся в
`src/assets/images`. Это вымышленные люди и пространство, а не фотографии
реального салона или сотрудников.

Astro генерирует responsive WebP-варианты, добавляет размеры и лениво загружает
контент ниже первого экрана. Перед коммерческой публикацией владелец должен
утвердить изображения или заменить их реальными материалами.

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
      "migrations_dir": "migrations"
    }
  ]
}
```

`DB` — имя, под которым будущая Pages Function получит D1 через
`context.env.DB`. `preview_database_id: "DB"` задаёт отдельный идентификатор
локального состояния Pages. `database_id` намеренно содержит явный placeholder:
локальные команды его не используют, а remote-команды нельзя запускать до
замены на ID реально созданной базы.

`nodejs_compat` не включён: на этапе 2 он не требуется.

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

`migrations/0001_initial.sql` создаёт таблицы, foreign keys, CHECK/UNIQUE
constraints и индексы. `migrations/0002_seed.sql` добавляет пять услуг, трёх
мастеров, 13 связей мастер–услуга и 18 строк графика. Воскресенье не имеет
строк, то есть считается закрытым.

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
резервной копии. Этап 2 не запускает remote-команды автоматически.

### Slot locking

`appointment_slots` содержит:

```sql
UNIQUE (barber_id, slot_start_utc)
```

Сервер на следующих этапах обязан сначала рассчитать доступность, но такая
проверка сама по себе не защищает от двух параллельных запросов. UNIQUE
constraint является последней атомарной защитой от race condition: только одна
запись сможет занять конкретный слот мастера.

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
public/
  favicon.svg
src/
  assets/images/       локальные исходники изображений
  components/common/  общие UI-компоненты
  config/site.ts       данные бренда и контактов
  data/content.ts      статический контент этапа 1
  layouts/             публичный и административный layouts
  pages/               файловая маршрутизация Astro
  scripts/site.ts      мобильная навигация
  styles/global.css    tokens, компоненты и responsive-стили
astro.config.mjs
tsconfig.json
wrangler.jsonc
```

Каталоги `functions` и `tests` пока отсутствуют. Пустой каталог `functions` на
этапе 2 намеренно не создаётся.

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

Это ожидаемо. Используйте `npm run pages:dev` после появления каталога
`functions`.

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

Этапы 1 и 2 завершены. Этап 3 ещё не реализован:

1. Общая backend-инфраструктура Pages Functions.
2. Public services и barbers API.
3. Серверный availability engine.
4. Создание записи и атомарное slot locking.
5. Turnstile и Resend.
6. Многошаговый booking UI.
7. Admin API и admin UI.
8. Security headers, Access и WAF-документация.
9. Финальные SEO, RODO, тесты и deployment-документация.

## Лицензия

Существующий файл `LICENSE` содержит Apache License 2.0 и не изменялся в рамках
этапов 1 и 2.
