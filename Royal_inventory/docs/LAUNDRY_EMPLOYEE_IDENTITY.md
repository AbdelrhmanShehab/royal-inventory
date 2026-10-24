# Laundry employee identity

ZK `USERINFO.USERID` is the permanent employee identity. `BADGENUMBER` is a reusable badge code, for display/search only. Fingerprint enrollment remains in ZK; this application does not change the device or fingerprint templates.

## Flow

- Read the scan's `CHECKINOUT.USERID` directly. Never re-resolve its badge number.
- Employee API: `GET /api/v1/laundry/zk/employees/by-id/:userId`.
- Movements: POST `/api/v1/laundry/zk/transactions` with `userId`, `itemCode`, `action`, `quantity`, optional `notes`.
- Custody/history remain linked through `UserItems.UserID` and `ItemTransactions.UserItemID`; no rewrite is necessary.
- Search may return multiple people with the same badge. Select the person by name, department, and permanent ID.
- Reports and CSV exports carry `userId`; employee counts and navigation use that identity.
- Old badge lookup API returns HTTP 410; old badge-only movement payloads are rejected. Refresh all clients when updating.
- Inquiry links never grant fingerprint verification. Loading a different employee clears the previous verification; concurrent responses cannot replace a newer employee selection.

## Staff tickets and existing records

New staff tickets require `zkUserId`, validated against ZK, persisted as `ops.laundry_tickets.zk_user_id`. Existing `employee_id`, names and room numbers are not assumed to contain this identity.

Migration leaves old tickets unlinked. They remain visible in Tickets but do not appear under an employee based on a reused badge or name. Open an unlinked staff ticket, verify its actual owner, search/select that employee, and confirm the link. The authorized `PUT /api/v1/laundry/tickets/:id/employee` endpoint accepts `zkUserId` and only links an unassigned STAFF ticket; it cannot silently reassign a linked ticket. The operator and IDs are logged.

## Rollout

1. Back up the operational database.
2. Apply `migrations/102_laundry_employee_identity.sql` to the system database before starting this backend. It is rerunnable and adds a nullable indexed column; no existing ownership is guessed or changed.
3. Deploy the updated backend and frontend together, then refresh client browsers. The checked-in `deploy/` tree is generated packaging output, not the source of these changes. Repackage using the established deployment process when ready.
4. Verify on the actual ZK system: scan the replacement employee sharing a former employee's badge. Check that the returned `userId` matches the replacement's `USERINFO.USERID`; confirm only their custody appears. Open the former employee via search and confirm their history remains separate. Test receiving and handing over one assigned item and staff-ticket ownership.

This code trusts the `USERID` stored in each ZK scan. If the device/importer itself records a new employee's scan under the former employee's `USERID`, that upstream association must be corrected in ZK. Badge-only data cannot reconstruct ownership. Existing incorrectly recorded movements likewise require verified correction; this change does not guess historical owners.

## Validation

Run `npm test` in Royal_inventory, and `npm run build` at repository root. Regression tests use a simulated database with two different USERIDs sharing badge 709; they do not modify a live database or device.
