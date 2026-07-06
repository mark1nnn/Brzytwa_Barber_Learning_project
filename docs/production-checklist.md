# Production checklist

Этот checklist является go/no-go gate. Отметки должны относиться к конкретному
commit и deployment.

## Release identity

- [ ] Commit SHA: `________________`
- [ ] Ответственный: `________________`
- [ ] Дата/время окна: `________________`
- [ ] Preview deployment URL: `________________`
- [ ] Production domain: `________________`
- [ ] Rollback owner: `________________`

## Build gate

- [ ] Выполнен чистый `npm.cmd ci`.
- [ ] `npm.cmd run verify:deploy` завершился без ошибок.
- [ ] `npm.cmd run d1:migrations:apply:local` завершился без ошибок.
- [ ] `dist` содержит все обязательные HTML routes, sitemap и robots.
- [ ] `dist` не содержит secrets.
- [ ] `dist` не содержит `example.invalid`.
- [ ] `LICENSE` не изменён.

## Preview gate

- [ ] Preview D1 называется `brzytwa-barber-preview`.
- [ ] Preview UUID сверён с Dashboard.
- [ ] Preview migrations применены.
- [ ] Preview booking создаётся.
- [ ] Duplicate booking возвращает `SLOT_TAKEN`.
- [ ] Customer confirmation доставляется.
- [ ] Admin notification доставляется.
- [ ] Admin panel защищена Access.
- [ ] Appointment cancel освобождает slots.
- [ ] Services/barbers/working-hours/blocked-periods проверены.
- [ ] Preview acceptance зафиксирован.

## Production D1 preflight

Перед любой production migration:

- [ ] База называется `brzytwa-barber-production`.
- [ ] UUID production скопирован из Dashboard и дважды сверён.
- [ ] UUID production отличается от preview UUID.
- [ ] `wrangler.jsonc` не содержит D1 placeholders.
- [ ] Команда использует `--env production`.
- [ ] Команда использует имя `brzytwa-barber-production`.
- [ ] Выполнен `npm.cmd run d1:migrations:list:production`.
- [ ] Список ожидающих файлов просмотрен вручную.
- [ ] Миграции уже успешно прошли preview.
- [ ] Подготовлен backup/restore или D1 recovery plan.
- [ ] Нет активного инцидента или параллельной миграции.
- [ ] Владелец дал явное разрешение.

Production migration:

```powershell
npm.cmd run d1:migrations:apply:production
```

Эта команда никогда не запускается автоматически из npm install, build, verify
или CI без отдельного approval gate.

После применения:

```powershell
npm.cmd run d1:migrations:list:production
```

- [ ] Неприменённых миграций нет.
- [ ] Health/API smoke test проходит.

## Cloudflare Pages

- [ ] Production branch — `main`.
- [ ] Build command — `npm run verify:deploy`.
- [ ] Output directory — `dist`.
- [ ] Node version удовлетворяет `package.json`.
- [ ] Binding `DB` указывает на production D1.
- [ ] Preview binding по-прежнему указывает на preview D1.
- [ ] Deployment создан из утверждённого SHA.

## Production env

- [ ] `PUBLIC_SITE_URL` — production HTTPS URL.
- [ ] `PUBLIC_TURNSTILE_SITE_KEY` — production widget.
- [ ] `TURNSTILE_SECRET_KEY` — matching production secret.
- [ ] `RESEND_API_KEY` — production sending-only key.
- [ ] `RESEND_FROM_EMAIL` — verified production sender.
- [ ] `ADMIN_NOTIFICATION_EMAIL` — утверждённый recipient.
- [ ] Preview и Production values не перепутаны.
- [ ] Secrets скрыты в Dashboard и отсутствуют в logs.

## Access gate

- [ ] `/admin` защищён.
- [ ] `/admin/` защищён.
- [ ] `/api/admin/*` защищён.
- [ ] Проверен anonymous/incognito access.
- [ ] Проверен разрешённый admin identity.
- [ ] Проверен запрещённый identity.
- [ ] Собственная login form отсутствует.

Без выполненного Access gate production go-live запрещён.

## Turnstile и Resend

- [ ] Production hostname разрешён Turnstile widget.
- [ ] Siteverify успешно принимает production token.
- [ ] Secret отсутствует во frontend bundle.
- [ ] Sending domain имеет verified SPF/DKIM.
- [ ] Выполнена одна контролируемая booking.
- [ ] Customer email получен.
- [ ] Admin email получен.
- [ ] From/Reply behavior проверены.

## SEO

- [ ] Главная canonical указывает production domain.
- [ ] Sitemap содержит production domain.
- [ ] Robots содержит production sitemap URL.
- [ ] Sitemap не содержит `/admin` и `/404`.
- [ ] `/admin` содержит `noindex, nofollow`.
- [ ] Нет `example.invalid`.

## Functional smoke

- [ ] Services и barbers загружаются.
- [ ] Availability учитывает Europe/Warsaw.
- [ ] Booking возвращает booking code.
- [ ] Повторный slot отклоняется.
- [ ] Admin appointments list/detail работают.
- [ ] Status update работает.
- [ ] Cancel освобождает slots.
- [ ] Blocked period влияет на availability.
- [ ] 404 работает.
- [ ] Mobile navigation и формы проверены.

## Завершение

- [ ] Deployment ID сохранён.
- [ ] Commit SHA сохранён.
- [ ] Результаты checklist сохранены вне public repository.
- [ ] Временные test bookings/blocks удалены или явно помечены.
- [ ] Monitoring/log review выполнен без PII.
- [ ] Rollback procedure остаётся доступной.
