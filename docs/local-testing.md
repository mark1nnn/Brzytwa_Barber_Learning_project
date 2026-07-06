# Локальная проверка

Локальный режим изолирован от remote D1. Wrangler хранит D1 state внутри
`.wrangler/`, а `.env` и `.dev.vars` исключены из Git.

## Установка и env

```powershell
npm.cmd ci
Copy-Item .env.example .env
Copy-Item .dev.vars.example .dev.vars
```

Назначение файлов:

- `.env` — build-time `PUBLIC_SITE_URL` и `PUBLIC_TURNSTILE_SITE_KEY` для Astro;
- `.dev.vars` — runtime values Pages Functions;
- `.env.example` и `.dev.vars.example` — только безопасные placeholders.

Site key в обоих локальных файлах должен относиться к одному Turnstile widget.
Secret key хранится только в `.dev.vars`.

## Проверки и local D1

```powershell
npm.cmd run cf:types
npm.cmd run functions:check
npm.cmd run tests:check
npm.cmd run test:unit
npm.cmd run check
npm.cmd run build
npm.cmd run d1:migrations:apply:local
```

Либо:

```powershell
npm.cmd run verify:deploy
npm.cmd run d1:migrations:apply:local
```

`verify` и `verify:deploy` не содержат `--remote`.

Проверить ожидающие local migrations:

```powershell
npm.cmd run d1:migrations:list:local
```

Local D1 не копирует данные preview/production и не подтверждает, что remote
migrations применены.

## Запуск

```powershell
npm.cmd run pages:dev
```

Обычно Wrangler открывает `http://127.0.0.1:8788`. В отличие от `astro preview`,
эта команда запускает корневой каталог `functions` и binding `DB`.

Проверить health:

```powershell
curl.exe http://127.0.0.1:8788/api/health
```

## Public booking

Проверяемый flow:

1. Открыть `/rezerwacja`.
2. Выбрать услугу.
3. Выбрать мастера.
4. Выбрать дату и slot.
5. Заполнить контакты и privacy checkbox.
6. Пройти Turnstile.
7. Получить booking code.
8. Повторить POST для того же slot и получить `SLOT_TAKEN`.

Для безопасной автоматической проверки внешние Turnstile/Resend fetch уже
мокаются unit-тестами. Для ручного локального E2E используйте официальные
[Turnstile testing keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
или отдельные preview credentials. Не используйте production keys в локальных
файлах.

## Admin API и Admin UI

Без identity headers Admin API должен вернуть 401:

```powershell
curl.exe http://127.0.0.1:8788/api/admin/services
```

Локальный API smoke test:

```powershell
curl.exe http://127.0.0.1:8788/api/admin/services `
  -H "Cf-Access-Jwt-Assertion: local-test" `
  -H "Cf-Access-Authenticated-User-Email: admin@example.invalid"
```

Для полного UI `/admin` используйте локальный reverse proxy или browser request
interception, добавляющие эти mock headers только к `/api/admin/*`. Не
встраивайте mock headers в `src/scripts/admin.ts` и не сохраняйте их в
`localStorage`/`sessionStorage`.

Проверьте:

- dashboard counts;
- appointments filters и pagination;
- detail с customer data;
- confirmed/completed/no_show;
- cancel и освобождение slot locks;
- повторный cancel;
- service/barber/working-hours update;
- blocked period create/delete;
- отсутствие customer data вне appointment detail.

## SEO smoke test

Соберите с тестовым HTTPS URL, не равным `example.invalid`, затем:

```powershell
Select-String -Path dist\robots.txt -Pattern "Sitemap:"
Select-String -Path dist\sitemap-index.xml -Pattern "https://"
Select-String -Path dist\index.html -Pattern 'rel="canonical"'
Select-String -Path dist\admin\index.html -Pattern "noindex"
```

`/admin` и `/404` не должны присутствовать в sitemap. `robots.txt` должен
запрещать `/admin`.

## После теста

- удалите временные записи и blocked periods;
- восстановите изменённые service/barber/working-hours values;
- убедитесь, что `.env`, `.dev.vars`, `.wrangler/` и логи не добавлены в Git;
- остановите `pages:dev`;
- выполните `git status --short`.
