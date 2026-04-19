# Plaid Token Encryption — Spec

## Goal

Remove plaintext Plaid `access_token` storage from FinWin and replace it with application-layer encrypted storage that is safe enough for real-bank rollout.

This spec is intentionally narrow. It is not a general secrets platform for the whole app. It only covers the storage, decryption, migration, and rotation model for Plaid connection tokens.

## Scope

**In scope**
- Encrypt Plaid `access_token` values before writing them to Postgres.
- Decrypt tokens only inside server-side Plaid code paths that need them.
- Add versioned key handling so key rotation is possible later.
- Fail closed when encryption configuration is missing or invalid.

**Out of scope**
- Encrypting every sensitive app field.
- Full KMS integration in the first pass.
- Browser-side secret handling changes.
- Broader auth/session hardening beyond what is needed for token encryption.
- Re-encrypting historical transaction data or account metadata.

## Current State

Today FinWin stores Plaid `access_token` in plaintext in `bank_connections.access_token`.

That token is then read back for:
- `plaid.linkTokenCreate` update mode
- `plaid.accountsGet`
- `plaid.transactionsSync`
- `plaid.itemRemove`
- webhook-driven sync paths

This is the blocking security gap between "working" and "safe enough for real-bank use."

## Product Definition

After this change:
- the database must never hold a newly-created Plaid `access_token` in plaintext
- only server-side code may decrypt the token
- decryption should happen as late as possible and stay local to the call site
- an app instance without the encryption key must be unable to use stored tokens

## Primary Decision

Use **application-layer symmetric encryption** in the Next.js server/runtime, not database-side encryption.

### Why this is the right first step

- It works with the current Neon + Drizzle stack without adding a DB extension dependency.
- It keeps plaintext tokens out of SQL logs, DB dumps, and routine table inspection.
- It is straightforward to test locally and in deployment.
- It leaves room for KMS-backed key loading later without changing the DB contract again.

## Encryption Strategy

### Cipher

Use `AES-256-GCM` via Node `crypto`.

Required properties:
- 32-byte symmetric key
- fresh random IV per encryption
- authenticated decryption

### Storage format

Store a single serialized encrypted payload, not multiple partial crypto fields spread across the schema.

Recommended encoded payload contents:
- format version
- IV
- auth tag
- ciphertext

Example logical shape:

```text
v1:<iv_b64>:<tag_b64>:<ciphertext_b64>
```

Keep the **key version** outside the blob so the app can choose the correct decryption key without parsing policy from ciphertext.

### Key management

Use environment-provided keys with explicit versioning.

Required env:
- `PLAID_TOKEN_ENCRYPTION_CURRENT_KEY_VERSION`
- `PLAID_TOKEN_ENCRYPTION_KEYS`

Recommended format for `PLAID_TOKEN_ENCRYPTION_KEYS`:
- JSON object mapping key version → base64-encoded 32-byte key

Example:

```json
{
  "2026-04-16": "base64-32-byte-key-here"
}
```

Rules:
- the current key version must exist in the key map
- encryption always uses the current key version
- decryption may use any configured key version still present in the key map
- startup should fail if the key config is malformed

This keeps the first implementation simple while making future rotation possible.

## Data Model Changes

Replace plaintext token storage with encrypted token storage on `bank_connections`.

### Target schema shape

Add:
- `access_token_encrypted: text not null`
- `access_token_key_version: text not null`

Remove after migration:
- plaintext `access_token`

### Rollout shape

For the current FinWin repo state, use a disposable-db rollout:

1. change the schema to encrypted-only storage
2. run `bun run dbreset`
3. run `bun run seed`
4. create a fresh user
5. connect a fresh Plaid item and verify sync paths

This is the right tradeoff for the current environment because the existing database can be thrown away safely.

## Server Runtime Contract

Add a small server-only utility module, for example:
- `src/server/plaid/crypto.ts`

That module should expose:
- `encryptPlaidAccessToken(plaintext: string)`
- `decryptPlaidAccessToken(encrypted: string, keyVersion: string)`

### Rules for usage

- Never return decrypted tokens from the helper.
- Never log plaintext tokens.
- Never log the encrypted payload.
- Decrypt only immediately before a Plaid SDK call that requires the token.
- Keep decrypted values in local function scope only.

## Write Paths

### New connection exchange

In `plaid.exchangeToken`:
- exchange `public_token` for Plaid `access_token`
- encrypt immediately
- write only encrypted token + key version to the DB
- do not persist plaintext token

### Reconnect/update mode

Any path that currently reads `bankConnections.accessToken` must:
- load encrypted token payload + key version
- decrypt server-side
- pass plaintext token directly into the Plaid SDK call

## Read Paths That Must Change

All current access-token consumers need to switch to decryption:
- `plaid.createLinkToken` update mode
- `plaid.exchangeToken` follow-up account fetch
- `syncConnection`
- `syncUserConnections`
- `plaid.unlinkConnection`
- any webhook path that triggers sync for a stored connection

The goal is one consistent helper path rather than per-call crypto logic.

## Migration

No backfill is required for the current implementation because the database will be reset before testing.

If FinWin later needs to preserve existing linked connections, add a separate backfill spec and one-time migration path then.

## Rotation Model

The first pass only needs **manual rotation**, not automatic background rotation.

Supported flow:
1. add a new key to `PLAID_TOKEN_ENCRYPTION_KEYS`
2. set `PLAID_TOKEN_ENCRYPTION_CURRENT_KEY_VERSION` to the new version
3. new writes use the new key
4. run an explicit re-encryption script later if desired
5. remove old key only after all rows using it have been re-encrypted

This is enough for v0.1 and avoids building a full secret-management subsystem.

## Failure Modes

### Missing key config

- app startup should fail
- do not silently fall back to plaintext behavior

### Unknown key version on decrypt

- treat connection as unusable
- surface a recoverable server error
- never substitute another key version

### Auth tag / ciphertext failure

- treat as decryption failure
- do not continue with Plaid calls
- log connection id only, never token material

### Partial migration

- app may support reading from plaintext only during the temporary staged rollout
- once encrypted reads are cut over, plaintext fallback must be removed

## Logging And Observability

Safe to log:
- connection id
- user id
- key version
- operation name
- migration counts

Never log:
- plaintext token
- encrypted payload
- IV
- auth tag
- env key material

## Testing Requirements

Minimum verification:
- encryption helper round-trip test
- decryption fails with wrong key
- decryption fails on tampered payload
- `exchangeToken` persists encrypted token only
- `syncConnection` can decrypt and sync successfully
- migration script is idempotent
- unlink path still works with encrypted tokens

## Non-Goals

This spec does not require:
- KMS before shipping
- field-level encryption for all banking tables
- client-side encrypted storage
- changing the unlink model

It only closes the specific `access_token` plaintext gap with a versioned, maintainable server-side approach.

## Implementation Notes

This spec aligns with current FinWin constraints:
- tRPC + server-side Plaid calls stay the only token consumers
- Postgres remains a storage layer, not the trust boundary for secrets
- the encryption layer should stay thin and boring

That is the right tradeoff here. The product needs a concrete security fix, not a generalized secrets architecture project.
