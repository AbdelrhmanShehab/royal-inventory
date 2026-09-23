# Coding Guidelines — inventory_tracking_system

> Version 1.0 | Node.js + Express + SQL Server | Arabic RTL System

---

## 1. Architecture — Clean Modular Layers

```
src/
├── config/          ← Configuration ONLY (DB, cache, env validation)
├── utils/           ← Pure utilities (logger, encryption, token, errors, response)
├── middleware/       ← Express middleware (auth, rbac, validate, rateLimit, errorHandler)
├── repositories/    ← Database access ONLY (no business logic)
│   ├── comsys/      ← Read-only Comsys DB queries
│   └── system/      ← Our system DB queries
├── api/v1/          ← Feature modules
│   └── [feature]/
│       ├── [feature].validation.js   ← Joi schemas
│       ├── [feature].repository.js   ← DB queries for this feature
│       ├── [feature].service.js      ← Business logic
│       ├── [feature].controller.js   ← Request/Response only
│       └── [feature].routes.js       ← Route definitions
├── jobs/            ← Scheduled background tasks
├── app.js           ← Express configuration
└── server.js        ← HTTP server + startup/shutdown
```

### Layer Rules (strict)
| Layer | Can call | Cannot call |
|---|---|---|
| `routes` | middleware, controller | service, repo, utils directly |
| `controller` | service, response.helper | repo, db directly |
| `service` | repository, utils | db directly, res/req objects |
| `repository` | db pool, sql | service, controller |
| `middleware` | utils, config | service, repository |

---

## 2. Naming Conventions

| What | Convention | Example |
|---|---|---|
| Files | `camelCase.type.js` | `auth.service.js` |
| Variables | `camelCase` | `const userId = 1` |
| Constants | `UPPER_SNAKE_CASE` | `const MAX_RETRIES = 3` |
| Classes | `PascalCase` | `class AppError` |
| DB columns | `snake_case` (SQL) → `camelCase` (JS) | `user_id` → `userId` |
| Route paths | `kebab-case` | `/api/v1/hotel-groups` |
| Error codes | `UPPER_SNAKE_CASE` | `'INSUFFICIENT_STOCK'` |

---

## 3. Security Rules

### Passwords
- **ALWAYS** hash with `bcrypt` (12 rounds minimum)
- **NEVER** store plaintext passwords
- **NEVER** log passwords or tokens
- Use timing-safe compare: `bcrypt.compare()` even when user not found

### JWT
- Access token: 15 minutes maximum
- Refresh token: stored in `httpOnly` + `secure` + `sameSite=strict` cookie
- On logout: blacklist the JTI in cache
- Refresh token rotation: issue new refresh token on every refresh

### Database
- **ALWAYS** use parameterized queries — never string concatenation
- `mssql` `.input()` for ALL user inputs
- Comsys DB: always open with `readOnlyIntent: true`
- Validate table names before dynamic queries (whitelist or regex)

### Input Validation
- Validate with Joi on EVERY route that accepts input
- `stripUnknown: true` always (remove unexpected fields)
- Set max lengths on all string fields

### HTTP Headers
- Helmet is always on
- CORS allows only `CORS_ORIGIN` from config

---

## 4. Error Handling

```javascript
// ✅ CORRECT — throw typed errors from services
throw new InsufficientStockError('الكمية المطلوبة أكبر من الرصيد');

// ✅ CORRECT — use asyncHandler in controllers
const myController = asyncHandler(async (req, res) => {
  const data = await myService.doSomething();
  return R.success(res, data);
});

// ❌ WRONG — raw try/catch in controller
const myController = async (req, res) => {
  try { ... } catch (e) { res.status(500).json({ error: e.message }); }
};

// ❌ WRONG — generic Error
throw new Error('something went wrong');
```

### Never:
- `console.log` in production code — always use `logger`
- `res.send()` directly — always use `R.success()` / `R.error()`
- Expose stack traces in production responses

---

## 5. Async / Promise Rules

```javascript
// ✅ Always await — never fire-and-forget unless intentional
const result = await myRepo.findById(id);

// ✅ All controller functions wrapped in asyncHandler
router.get('/', asyncHandler(async (req, res) => { ... }));

// ❌ Never mix callbacks and async/await
pool.request().query(..., (err, result) => { ... }); // NO
```

---

## 6. Database (mssql) Rules

```javascript
// ✅ CORRECT — parameterized query
const result = await pool.request()
  .input('userId', sql.Int,       userId)
  .input('name',   sql.NVarChar,  name)
  .query('SELECT * FROM users WHERE user_id = @userId AND name = @name');

// ❌ WRONG — string interpolation = SQL injection risk
const result = await pool.request()
  .query(`SELECT * FROM users WHERE user_id = ${userId}`);

// ✅ Always map DB column names to camelCase in the repo
// DB:  user_id, full_name_ar
// JS:  { userId, fullNameAr }
```

---

## 7. Caching Rules

```javascript
// ✅ Use getOrSet for cache-or-fetch pattern
const warehouses = await getOrSet(
  CACHE_KEYS.COMSYS_WAREHOUSES,
  () => comsysRepo.getAllWarehouses(),
  TTL.COMSYS_MASTER
);

// ✅ Invalidate cache after writes
await repo.updateStock(nodeId, itemId, qty);
invalidateByPrefix(`system:stock:node:${nodeId}`);

// ❌ Never cache sensitive auth data in node-cache
// (blacklisted tokens are the exception — short TTL only)
```

---

## 8. Response Format (mandatory)

ALL API responses must use `response.helper.js`:

```javascript
// Success
R.success(res, data, 'رسالة بالعربي');
R.created(res, newRecord, 'تم الإنشاء');

// Errors
R.badRequest(res, 'بيانات غير صحيحة', validationErrors);
R.unauthorized(res);
R.notFound(res, 'المستخدم غير موجود');
R.serverError(res);
```

---

## 9. Environment Variables

- **NEVER** hardcode credentials — always from `config/index.js`
- **NEVER** access `process.env` directly outside `config/index.js`
- All env vars are validated at startup with Joi — app exits if any is missing

---

## 10. Logging

```javascript
// ✅ Structured logging with context
logger.info('[SyncJob] Transfer sync complete', { count: 450, duration: '2.3s' });
logger.error('[AuthService] Login failed', { username, reason: 'invalid_password' });
logger.warn('[ComsysDB] Reconnecting...', { attempt: 3 });

// ❌ Never
console.log('something happened');
logger.info('Login failed: ' + username + ' password: ' + password); // NEVER log passwords
```

---

## 11. Comments & Documentation

- Write comments explaining **WHY**, not **WHAT**
- Mark all Comsys table names needing verification with `// ⚠️ Verify table name`
- JSDoc for all exported functions in utilities and services
- Arabic comments are allowed for business logic explanations

---

## 12. Git Rules

- Commit messages: `type(scope): description`
  - `feat(auth): add refresh token rotation`
  - `fix(sync): handle Comsys timeout gracefully`
  - `chore(config): add ENCRYPTION_KEY validation`
- Never commit `.env` — it's in `.gitignore`
- Never commit `node_modules/`
