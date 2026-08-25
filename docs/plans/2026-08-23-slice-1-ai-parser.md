# JoPoJo Slice 1：收料模型同 AI Parser 實作計劃

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立第一個可測試後端切片，將場地貼文文字轉成結構化 venue draft。

**Architecture:** 用 npm workspaces monorepo。`packages/ai` 提供純函數 parser，透過 dependency injection 接收 LLM JSON completion，令單元測試唔需要真 API 呼叫。Supabase migration 儲存 raw intake 同 parsed draft，之後 Telegram webhook 同審核頁會重用呢個模型。

**Tech Stack:** TypeScript, npm workspaces, Vitest, Supabase PostgreSQL, OpenAI-compatible structured output.

## Global Constraints

- 程式碼、指令、資料庫 identifier 用英文。
- 文件同用戶文案用繁體中文／廣東話。
- 唔可以 commit raw chat export、電話號碼、API keys、tokens。
- 唔做金流、合約、站內 chat、Verified Badge、全自動 IG 發布。
- Parser 唔可以靜默猜測；唔確定欄位要進入 `low_confidence_fields`。
- 每個 task 完成後要跑相關測試同 commit。

---

## File Structure

- `package.json`
- `tsconfig.base.json`
- `.env.example`
- `packages/ai/package.json`
- `packages/ai/tsconfig.json`
- `packages/ai/src/types.ts`
- `packages/ai/src/prompt.ts`
- `packages/ai/src/parser.ts`
- `packages/ai/src/index.ts`
- `packages/ai/tests/parser.test.ts`
- `supabase/migrations/202608230001_create_intake_tables.sql`

---

### Task 1: 建立 TypeScript workspace

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.env.example`
- Create: `packages/ai/package.json`
- Create: `packages/ai/tsconfig.json`

**Produces:**
- npm workspace `@jopojo/ai`
- command `npm test`

- [ ] Step 1: 建立 root `package.json`
- [ ] Step 2: 建立 `tsconfig.base.json`
- [ ] Step 3: 建立 `.env.example`
- [ ] Step 4: 建立 `packages/ai/package.json`
- [ ] Step 5: 建立 `packages/ai/tsconfig.json`
- [ ] Step 6: Run `npm install`
- [ ] Step 7: Commit `chore: scaffold TypeScript workspace`

Root `package.json`:

```json
{
  "name": "jopojo",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "test": "npm run test --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present"
  },
  "devDependencies": {
    "typescript": "^5.7.3",
    "vitest": "^2.1.8"
  }
}
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true
  }
}
```

`.env.example`:

```env
LLM_API_KEY=
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=llama-3.3-70b-versatile
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
PUBLIC_SITE_URL=http://localhost:3000
```

`packages/ai/package.json`:

```json
{
  "name": "@jopojo/ai",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

`packages/ai/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
```

---

### Task 2: 定義 parser 型別

**Files:**
- Create: `packages/ai/src/types.ts`

**Produces:**
- `IntakeInput`
- `VenueDraft`
- `ParseResult`

- [ ] Step 1: Write `types.ts`
- [ ] Step 2: Run `npm run typecheck --workspace=@jopojo/ai`
- [ ] Step 3: Commit `feat: add venue parser types`

Required exported types:

```ts
export type SourceType =
  | "telegram"
  | "instagram"
  | "whatsapp_forward"
  | "manual";

export type AreaType =
  | "mall"
  | "market"
  | "street"
  | "industrial"
  | "pop_up_event"
  | "private_venue"
  | "other"
  | "unknown";

export type PriceUnit = "day" | "period" | "unknown";
export type ReviewStatus = "needs_review" | "approved" | "rejected" | "published";
```

`IntakeInput` must include `rawContent`, `sourceType`, `sourceLabel`, optional `sourceUrl`, and `receivedAt`.

`VenueDraft` must include every field listed in section 7 of the MVP spec, including `title`, `district`, `venueName`, dates, price fields, booth size, contact fields, area flags, and `summary`.

`ParseResult` must include `status`, `draft`, `confidenceScore`, `lowConfidenceFields`, `unconfirmedFields`, and `reviewNote`.

---

### Task 3: 用 TDD 做 parser

**Files:**
- Create: `packages/ai/src/prompt.ts`
- Create: `packages/ai/src/parser.ts`
- Create: `packages/ai/src/index.ts`
- Test: `packages/ai/tests/parser.test.ts`

**Interfaces:**
- Consumes: `IntakeInput`, `ParseResult`
- Produces: `buildVenueParseMessages(input)`
- Produces: `parseVenuePost(input, completeJson)`

- [ ] Step 1: Write failing Vitest cases
- [ ] Step 2: Run tests and confirm failure
- [ ] Step 3: Implement `prompt.ts`
- [ ] Step 4: Implement `parser.ts`
- [ ] Step 5: Export public API from `index.ts`
- [ ] Step 6: Run tests and typecheck
- [ ] Step 7: Commit `feat: parse venue posts into structured drafts`

Test cases must cover:

1. A normal急放貼文 returns `needs_review`, extracts district, price, dates, booth size, WhatsApp link, `isUrgent`, and low-confidence fields.
2. Obvious non-venue text returns `rejected` with review note containing `唔似場地貼文`.
3. Missing date or contact keeps those fields `null` and marks them in `lowConfidenceFields`.

Parser behavior:

- `buildVenueParseMessages` must instruct the model to return only JSON, use `YYYY-MM-DD`, avoid guessing, and convert HK phone numbers into `https://wa.me/852xxxxxxxx`.
- `parseVenuePost` must reject obvious non-venue input before calling the injected completer.
- `parseVenuePost` must default missing boolean restriction fields to `null`.
- Any result missing `title`, `venueName`, `startDate`, `endDate`, `priceText`, or `contactText` must be `needs_review`.

---

### Task 4: Supabase intake schema

**Files:**
- Create: `supabase/migrations/202608230001_create_intake_tables.sql`

**Produces:**
- table `intake_items`
- table `venue_drafts`
- enum-like check constraints using text values from TypeScript types

- [ ] Step 1: Write migration
- [ ] Step 2: Manually review column names against `types.ts`
- [ ] Step 3: Commit `feat: add intake database schema`

The migration must store:

- raw source content and metadata in `intake_items`;
- parsed draft fields in `venue_drafts`;
- `status` with values `needs_review`, `approved`, `rejected`, `published`;
- `source_type` with values `telegram`, `instagram`, `whatsapp_forward`, `manual`;
- timestamps `created_at`, `updated_at`, `received_at`, `last_reviewed_at`;
- `confidence_score` as integer 0-100;
- array columns for `low_confidence_fields` and `unconfirmed_fields`.

Do not add RLS policies in this slice. Add a comment: `RLS will be enabled when authenticated review access is introduced.`

---

## Self-Review

Spec coverage:

- Intake source types and raw content: Task 2 and Task 4.
- AI structured extraction: Task 3.
- Required listing fields: Task 2 and Task 4.
- Review status and confidence: Task 2 and Task 4.
- Human review before publishing: Task 3 returns `needs_review`; later slices build UI.

Deferred to later plans:

- Telegram webhook endpoint.
- Public listing page.
- Review UI.
- Social draft generation.
- Image handling.
- OpenAI-compatible LLM live client integration.
