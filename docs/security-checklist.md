# Security checklist

Checklist выполняется перед preview acceptance и повторно перед production.

## Secrets

- [ ] `.env` и `.dev.vars` отсутствуют в Git index.
- [ ] `.gitignore` исключает `.env`, `.env.*`, `.dev.vars` и `.wrangler/`.
- [ ] `.env.example` содержит только публичные build-time placeholders.
- [ ] `.dev.vars.example` не содержит реальных credentials.
- [ ] `TURNSTILE_SECRET_KEY` находится только в server runtime configuration.
- [ ] `RESEND_API_KEY` находится только в server runtime configuration.
- [ ] Preview и Production используют разные внешние credentials.
- [ ] Git history проверена secret scanner или ручным `git grep`.

Минимальная ручная проверка:

```powershell
git grep -n -E "TURNSTILE_SECRET_KEY|RESEND_API_KEY|ADMIN_NOTIFICATION_EMAIL"
git check-ignore -v .env .dev.vars .wrangler
```

Первый grep может находить имена переменных и placeholders. Он не должен
находить реальные значения.

## Cloudflare Access

- [ ] Создана Self-hosted Access Application для production hostname.
- [ ] Preview hostname также защищён.
- [ ] Защищены `/admin`, `/admin/*` и `/api/admin/*`.
- [ ] Анонимный браузер не получает HTML `/admin`.
- [ ] Анонимный API request не достигает Admin API.
- [ ] Policy разрешает только утверждённые identities/groups.
- [ ] Admin API отклоняет запрос без Access headers кодом `ADMIN_UNAUTHORIZED`.
- [ ] В коде отсутствуют passwords, login form, собственные JWT и sessions.

Production запуск запрещён, пока этот раздел не выполнен полностью.

## Customer data

- [ ] Customer name/phone/email/notes отображаются только appointment detail.
- [ ] Admin frontend не использует `localStorage` или `sessionStorage`.
- [ ] API middleware не логирует request body.
- [ ] Server logs не содержат phone, email или notes.
- [ ] Ошибки email содержат только безопасную краткую причину.
- [ ] Data retention и доступы к Cloudflare/Resend согласованы владельцем.

## API и database

- [ ] Все пользовательские значения D1 передаются через prepared statements.
- [ ] Response не раскрывает SQL, raw D1 errors или stack trace.
- [ ] Unit-тесты safe error boundary проходят.
- [ ] Booking использует D1 batch и unique slot locks.
- [ ] Cancel удаляет appointment slots атомарно.
- [ ] Preview и Production D1 имеют разные UUID.
- [ ] Remote migration script содержит явное имя базы и `--env`.

## Turnstile

- [ ] Widget ограничен правильными hostnames.
- [ ] Site key находится в `PUBLIC_TURNSTILE_SITE_KEY`.
- [ ] Secret находится в `TURNSTILE_SECRET_KEY`.
- [ ] Secret отсутствует в `dist`.
- [ ] Siteverify выполняется до D1 booking write.
- [ ] Timeout и недоступность возвращают безопасное сообщение.
- [ ] Preview и Production widgets разделены.

Проверка собранных файлов:

```powershell
rg -n "TURNSTILE_SECRET_KEY|RESEND_API_KEY" dist
```

Ожидается отсутствие результатов.

## Email

- [ ] Resend sending domain подтверждён SPF/DKIM.
- [ ] API key имеет `Sending access`, а не Full access.
- [ ] `RESEND_FROM_EMAIL` использует проверенный домен.
- [ ] `ADMIN_NOTIFICATION_EMAIL` подтверждён владельцем.
- [ ] Customer и admin письма проверены.
- [ ] User-controlled HTML проходит `escapeHtml()`.
- [ ] Plain-text versions присутствуют.
- [ ] Ошибка письма не откатывает booking.

## SEO и production identity

- [ ] `PUBLIC_SITE_URL` является production HTTPS URL.
- [ ] Production output не содержит `https://example.invalid`.
- [ ] Canonical URL использует production domain.
- [ ] Sitemap использует production domain.
- [ ] `robots.txt` ссылается на production sitemap.
- [ ] `/admin` имеет `noindex, nofollow`.
- [ ] `/admin` и `/404` исключены из sitemap.
- [ ] Noindex не считается заменой Cloudflare Access.

## Repository

- [ ] `npm.cmd ci` проходит на чистой копии.
- [ ] `npm.cmd run verify:deploy` проходит.
- [ ] `git diff --check` проходит.
- [ ] Нет незапланированных binary/log/generated файлов.
- [ ] `LICENSE` не изменён.
- [ ] Deployment выполняется из утверждённого commit.
