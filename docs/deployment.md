# Deployment Brzytwa Barber

Этот документ описывает ручной и проверяемый выпуск preview, а затем production
на Cloudflare Pages. Команды remote D1 намеренно не входят в `verify` или
`verify:deploy`.

Официальные справочные материалы:

- [Cloudflare Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Pages Functions Wrangler configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)
- [Pages D1 bindings](https://developers.cloudflare.com/pages/functions/bindings/)
- [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Cloudflare Access application paths](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/)
- [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/get-started/)
- [Resend domains](https://resend.com/docs/dashboard/domains/introduction)
- [Resend API keys](https://resend.com/docs/dashboard/api-keys/introduction)

## 1. Локальная проверка кандидата

Используйте поддерживаемую версию Node.js из `package.json`. На Windows:

```powershell
npm.cmd ci
npm.cmd run cf:types
npm.cmd run tests:check
npm.cmd run test:unit
npm.cmd run build
```

Полный безопасный gate можно выполнить одной командой:

```powershell
npm.cmd run verify:deploy
```

Она запускает только локальные проверки и сборку. Remote D1, Pages deployment и
создание Cloudflare-ресурсов не выполняются.

Перед продолжением:

- `git status` содержит только ожидаемые изменения;
- `LICENSE` не изменён;
- в `dist` есть `/admin/index.html`, `/rezerwacja/index.html`,
  `robots.txt` и `sitemap-index.xml`;
- production-сборка не содержит `example.invalid`.

## 2. Создание двух remote D1

Вход в Cloudflare выполняется вручную. Следующие команды создают реальные
удалённые ресурсы и не должны находиться в setup/CI-скриптах:

```powershell
npx.cmd wrangler d1 create brzytwa-barber-preview
npx.cmd wrangler d1 create brzytwa-barber-production
```

Сохраните выданные UUID и внесите их в `wrangler.jsonc`:

| Место                         | База                 | Placeholder                              |
| ----------------------------- | -------------------- | ---------------------------------------- |
| top-level `d1_databases`      | preview/local config | `REPLACE_WITH_PREVIEW_D1_DATABASE_ID`    |
| `env.preview.d1_databases`    | preview              | `REPLACE_WITH_PREVIEW_D1_DATABASE_ID`    |
| `env.production.d1_databases` | production           | `REPLACE_WITH_PRODUCTION_D1_DATABASE_ID` |

Database ID не является паролем, но определяет цель операций. Ошибка в нём может
направить миграцию в неправильную базу.

Проверьте соответствие имени и UUID через Dashboard и CLI:

```powershell
npx.cmd wrangler d1 info brzytwa-barber-preview
npx.cmd wrangler d1 info brzytwa-barber-production
```

Local D1 в `.wrangler/` не является ни preview, ни production D1. Флаг `--local`
работает только с локальным состоянием. Флаг `--remote` обращается к Cloudflare.

## 3. Preview migrations

Сначала проверьте выбранную базу и список миграций:

```powershell
npm.cmd run d1:migrations:list:preview
```

До применения подтвердите:

- команда содержит имя `brzytwa-barber-preview`;
- используется `--env preview`;
- UUID preview в `wrangler.jsonc` совпадает с Dashboard;
- production UUID не используется в preview binding.

Только после этого:

```powershell
npm.cmd run d1:migrations:apply:preview
```

Повторите list-команду. Она должна показать отсутствие неприменённых миграций.

## 4. Cloudflare Pages project

Для Git integration:

| Настройка              | Значение                             |
| ---------------------- | ------------------------------------ |
| Production branch      | `main`                               |
| Root directory         | `/`                                  |
| Build command          | `npm run verify:deploy`              |
| Build output directory | `dist`                               |
| Functions directory    | корневой `functions/`, автоматически |
| Node.js                | версия, совместимая с `>=22.12.0`    |

`npm.cmd` используется только локально на Windows. В Linux build environment
Cloudflare Pages команда должна использовать `npm`.

`wrangler.jsonc` содержит `pages_build_output_dir`, поэтому перед первым
deployment все D1 placeholders должны быть заменены и конфигурация должна быть
проверена. Не смешивайте конфликтующие D1 bindings из Dashboard и Wrangler.
После deployment убедитесь, что binding `DB` указывает:

- preview environment → `brzytwa-barber-preview`;
- production environment → `brzytwa-barber-production`.

## 5. Переменные окружения

Настройте значения отдельно для Preview и Production в Pages Settings.

| Переменная                  | Тип                   | Preview                            | Production                    |
| --------------------------- | --------------------- | ---------------------------------- | ----------------------------- |
| `PUBLIC_SITE_URL`           | build-time public     | стабильный preview HTTPS URL       | основной production HTTPS URL |
| `PUBLIC_TURNSTILE_SITE_KEY` | public build/runtime  | site key preview widget            | site key production widget    |
| `TURNSTILE_SECRET_KEY`      | secret runtime        | secret preview widget              | secret production widget      |
| `RESEND_API_KEY`            | secret runtime        | отдельный preview sending key      | production sending key        |
| `RESEND_FROM_EMAIL`         | runtime config        | sender проверенного preview-домена | sender production-домена      |
| `ADMIN_NOTIFICATION_EMAIL`  | secret/runtime config | preview recipient                  | реальный admin recipient      |

Рекомендации:

- Preview и Production используют разные Turnstile widgets и Resend API keys.
- `PUBLIC_SITE_URL` должен быть абсолютным HTTPS URL.
- Для preview лучше использовать стабильный preview custom domain. Не
  устанавливайте случайный deployment URL как canonical production.
- `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY` и адрес администратора не помещаются
  в Git, `.env.example` или client-side JavaScript.
- После изменения переменных выполните новый deployment.

## 6. Cloudflare Access

Создайте Self-hosted Access applications/policies для каждого доступного
preview и production hostname. Обязательные paths:

```text
/admin
/admin/*
/api/admin/*
```

Проверьте `/admin` и `/admin/`, так как статическая страница использует trailing
slash. Policy должна разрешать только утверждённые identities/groups.

До production go-live:

- анонимный запрос к `/admin` получает Access login/challenge;
- анонимный запрос к `/api/admin/services` не достигает JSON API;
- после Access authentication панель загружается;
- Pages Function получает `Cf-Access-Jwt-Assertion` и
  `Cf-Access-Authenticated-User-Email`;
- Admin API по-прежнему возвращает `ADMIN_UNAUTHORIZED`, если identity headers
  отсутствуют.

Собственные passwords, login form, JWT или sessions добавлять нельзя.

## 7. Turnstile

В Cloudflare Dashboard создайте отдельные widgets для preview и production:

1. Укажите понятные имена окружений.
2. Ограничьте разрешённые hostnames.
3. Скопируйте site key в `PUBLIC_TURNSTILE_SITE_KEY`.
4. Сохраните secret key как `TURNSTILE_SECRET_KEY`.
5. Выполните новый Pages deployment.

Site key публичный и присутствует в `/rezerwacja`. Secret используется только
Pages Function при Siteverify и не должен встречаться в `dist` или browser
DevTools sources.

Проверьте успешную запись, отклонённый/просроченный token и безопасное сообщение
при недоступности Siteverify.

## 8. Resend

1. Добавьте отдельный sending domain или subdomain.
2. Настройте и дождитесь проверки SPF/DKIM; при необходимости добавьте DMARC.
3. Создайте API key с `Sending access`, по возможности ограниченный доменом.
4. Сохраните key как `RESEND_API_KEY`.
5. Установите `RESEND_FROM_EMAIL` на адрес проверенного домена.
6. Установите `ADMIN_NOTIFICATION_EMAIL` на контролируемый recipient.

После preview booking подтвердите:

- клиент получил customer confirmation;
- администратор получил notification;
- From соответствует проверенному домену;
- booking остаётся созданным при симулированном отказе одного письма;
- email statuses в detail Admin API корректны.

## 9. Preview acceptance

На preview выполните:

- public navigation и responsive layout;
- `/rezerwacja`: services → barbers → availability → Turnstile → booking;
- повторная запись на тот же slot → `SLOT_TAKEN`;
- customer/admin emails;
- `/admin` через Access;
- appointment detail и status update;
- cancel освобождает slots;
- service, barber и working-hours update;
- blocked period create/delete;
- 404, robots, sitemap и canonical.

Preview acceptance должен быть подписан до production migration.

## 10. Production migration

Production migration выполняется отдельно и вручную. Используйте
[production checklist](./production-checklist.md).

Сначала:

```powershell
npm.cmd run d1:migrations:list:production
```

Проверьте имя базы, UUID, список файлов, backup/restore plan и успешный preview.
Только после явного подтверждения:

```powershell
npm.cmd run d1:migrations:apply:production
```

Ни `verify`, ни Pages build не запускают эту команду.

## 11. Production go-live

После production migration:

1. Запустите production deployment с утверждённого commit.
2. Проверьте D1 binding `DB`.
3. Проверьте Access до открытия panel URL.
4. Выполните одну контролируемую booking.
5. Проверьте оба письма.
6. Откройте запись в Admin panel и проверьте slot locks.
7. Убедитесь, что canonical, sitemap и robots используют production domain.
8. Сохраните deployment ID, commit SHA и результат checklist.
