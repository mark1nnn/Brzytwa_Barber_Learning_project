# Brzytwa Barber

Учебный, но рассчитанный на реальное развёртывание сайт польского барбершопа в
Катовице. Проект строится поэтапно: текущая версия содержит статическую
Astro-основу, а запись, Cloudflare D1, Pages Functions, Turnstile, Resend и
административные операции будут добавляться отдельными завершёнными этапами.

Интерфейс и пользовательские сообщения написаны на польском языке. Техническая
документация в этом репозитории — на русском.

## Текущий статус

Реализован **этап 1**:

- статическая генерация Astro SSG;
- строгая проверка TypeScript;
- десять обязательных маршрутов;
- общие layouts, Header, Footer, breadcrumbs и SEO-компонент;
- адаптивный дизайн от 320 px;
- локальные изображения с оптимизацией через Astro Image;
- sitemap и генерируемый `robots.txt`;
- конфигурация Cloudflare Pages для Wrangler;
- статические польские шаблоны политики приватности и правил записи.

Сейчас отсутствуют D1, Pages Functions, публичное и административное API,
Turnstile, Resend, рабочая форма записи и рабочая административная панель.

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

## Технологии

- Astro 7.0.5;
- TypeScript 6.0.3 и `astro/tsconfigs/strictest`;
- обычные HTML, CSS и TypeScript;
- `@astrojs/sitemap` 3.7.3;
- Wrangler 4.106.0;
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

Проверенная локальная среда на момент этапа 1: Node.js 24.13.0 и npm 11.6.2.

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

Vitest и Playwright не подключены на этапе 1. Unit, integration и E2E тесты
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

`wrangler.jsonc` содержит только конфигурацию текущего этапа:

```jsonc
{
  "name": "brzytwa-barber",
  "pages_build_output_dir": "./dist",
  "compatibility_date": "2026-07-01"
}
```

D1 binding `DB` и compatibility flags отсутствуют намеренно.

Для Git-интеграции Cloudflare Pages:

- production branch: `main`;
- build command: `npm run build`;
- build output directory: `dist`;
- environment variable: `PUBLIC_SITE_URL` с реальным production-доменом.

Preview deployments должны получать собственный preview URL либо осознанно
использовать production canonical URL. Это решение нужно принять до
публикации.

## D1 и миграции

D1 не подключён. В репозитории пока нет каталога `migrations`, binding `DB`,
локальной базы и команд миграции.

Этап 2 должен добавить:

- `0001_initial.sql` со схемой и ограничениями;
- `0002_seed.sql` с демонстрационными услугами, мастерами и графиком;
- индексы и уникальность временных слотов;
- отдельные команды локальной и удалённой миграции;
- документированное разделение local, preview и production D1.

Production D1 нельзя подключать к обычной локальной разработке.

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

Каталоги `functions`, `migrations` и `tests` будут созданы только на
соответствующих этапах.

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

## Ограничения MVP

В MVP не планируются онлайн-оплата, SMS, регистрация клиентов, личный кабинет,
несколько филиалов, сложные роли, CMS, Google Calendar sync, recurring
appointments, промокоды, loyalty system, push-уведомления и самостоятельный
перенос записи клиентом.

## Следующие этапы

1. D1 schema и seed.
2. Общая backend-инфраструктура Pages Functions.
3. Public services и barbers API.
4. Серверный availability engine.
5. Создание записи и атомарное slot locking.
6. Turnstile и Resend.
7. Многошаговый booking UI.
8. Admin API и admin UI.
9. Security headers, Access и WAF-документация.
10. Финальные SEO, RODO, тесты и deployment-документация.

## Лицензия

Существующий файл `LICENSE` содержит Apache License 2.0 и не изменялся в рамках
этапа 1.
