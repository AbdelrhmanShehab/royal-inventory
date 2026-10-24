'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Two employees deliberately share a badge. Fake SQL only resolves permanent IDs.
function fixture() {
  const employees = [
    { userId: 11, USERID: 11, userCode: '709', name: 'Former employee' },
    { userId: 22, USERID: 22, userCode: '709', name: 'Replacement employee' },
  ];
  const writes = [];
  const queries = [];
  const pool = { request };
  function request() {
    const args = {};
    return {
      input(name, _type, value) { args[name] = value; return this; },
      async query(sql) {
        queries.push(sql);
        if (/FROM dbo.CHECKINOUT c/.test(sql)) return { recordset: [{ userId: 22, userCode: '709' }] };
        if (/WHERE (u\.)?USERID = @employeeUserId/.test(sql)) {
          return { recordset: employees.filter(e => e.userId === args.employeeUserId) };
        }
        if (/SELECT TOP 1 ui.UserItemID/.test(sql)) return { recordset: [{ UserItemID: args.userId * 10 }] };
        if (/dupUserItemId/.test(sql)) return { recordset: [] };
        if (/INSERT INTO dbo.ItemTransactions/.test(sql)) {
          writes.push(args.userItemId); return { recordset: [{ txnId: writes.length }] };
        }
        if (/WHERE ui.UserID = @userId/.test(sql)) {
          return { recordset: [{ userItemId: args.userId * 10, itemCode: 'shared-item', lastAction: 'Receive' }] };
        }
        if (/WHERE lastTxn.TransactionType = 'Receive'/.test(sql)) {
          return { recordset: employees.map(e => ({ ...e, itemName: 'Shirt', department: 'Laundry' })) };
        }
        return { recordset: employees };
      },
    };
  }
  class Transaction {
    async begin() {} async commit() {} async rollback() {}
    request() { return request(); }
  }
  class AppError extends Error {}
  const module = { exports: {} };
  const dependencies = {
    '../../config/zk.database': { getZkDB: () => pool, sql: { Int: 'int', NVarChar: () => 'string', Transaction } },
    '../../config/index': { zkDb: { laundrySensorId: '104', laundrySn: 'device' } },
    '../../utils/errors': { AppError, DatabaseError: Error },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/repositories/system/zk.repo.js'), 'utf8'), {
    module, require(name) { assert.ok(dependencies[name], name); return dependencies[name]; },
  });
  return { repo: module.exports, writes, queries };
}

test('reused badges resolve to separate employee profiles, custody and histories', async () => {
  const { repo } = fixture();
  const former = await repo.getEmployeeDetails(11);
  const replacement = await repo.getEmployeeDetails(22);
  assert.equal(former.employee.userCode, replacement.employee.userCode);
  assert.equal(former.employee.userId, 11);
  assert.equal(replacement.employee.userId, 22);
  assert.equal(former.custody[0].userItemId, 110);
  assert.equal(replacement.custody[0].userItemId, 220);
  assert.equal(former.history[0].userItemId, 110);
  assert.equal(replacement.history[0].userItemId, 220);
});
test('badge value is never accepted as a permanent employee ID', async () => {
  const { repo } = fixture();
  assert.equal(await repo.getEmployeeDetails(709), null);
});
test('fingerprint events retain their original USERID', async () => {
  const { repo, queries } = fixture();
  const scans = await repo.getLatestCheckins(1);
  assert.equal(scans[0].userId, 22);
  assert.match(queries[0], /c.USERID AS userId/);
});
test('writes target the selected employee custody despite identical badge and item codes', async () => {
  const { repo, writes } = fixture();
  await repo.createHandoverReceiveTxn({ userId: 22, itemCode: 'shared-item', action: 'Receive', createdBy: 'operator' });
  await repo.createHandoverReceiveTxn({ userId: 11, itemCode: 'shared-item', action: 'Handover', createdBy: 'operator' });
  assert.deepEqual(writes, [220, 110]);
});
test('unknown permanent employee cannot create a laundry transaction', async () => {
  const { repo, writes } = fixture();
  await assert.rejects(repo.createHandoverReceiveTxn({ userId: 709, itemCode: 'shared-item', action: 'Receive' }));
  assert.equal(writes.length, 0);
});
test('employee search retains both employees sharing the badge', async () => {
  const { repo } = fixture();
  const result = await repo.searchEmployees('709');
  assert.equal(result.length, 2);
  assert.equal(result[0].userCode, result[1].userCode);
  assert.notEqual(result[0].userId, result[1].userId);
});
test('in-laundry employee counts use permanent identity', async () => {
  const { repo } = fixture();
  const report = await repo.getInLaundryInventory();
  assert.equal(report.summary.totalEmployees, 2);
});

const { createHandoverTxnSchema, createTicketSchema } = require('../src/api/v1/laundry/laundry.validation');
test('movement validation rejects badge-only clients and invalid permanent IDs', () => {
  const movement = { itemCode: 'shirt', action: 'Receive', quantity: 1 };
  for (const userId of [undefined, 0, -1, 1.5, 2147483648]) {
    assert.ok(createHandoverTxnSchema.validate({ ...movement, userId }).error);
  }
  assert.ok(createHandoverTxnSchema.validate({ ...movement, userCode: '709' }).error);
  assert.equal(createHandoverTxnSchema.validate({ ...movement, userId: 22 }).error, undefined);
});
test('new staff tickets require explicit permanent identity; guest tickets do not', () => {
  const ticket = { ticketType: 'STAFF', guestName: 'Employee', items: [{ serviceItemCode: 'shirt', quantity: 1, unitPrice: 10 }] };
  assert.ok(createTicketSchema.validate(ticket).error);
  assert.equal(createTicketSchema.validate({ ...ticket, zkUserId: 22 }).error, undefined);
  assert.equal(createTicketSchema.validate({ ...ticket, ticketType: 'GUEST' }).error, undefined);
  assert.ok(createTicketSchema.validate({ ...ticket, ticketType: 'GUEST', zkUserId: 22 }).error);
});
function serviceFixture() {
  let saved;
  let movement;
  let linked;
  class Transaction { async begin() {} async commit() {} async rollback() {} }
  const module = { exports: {} };
  const dependencies = {
    '../../../repositories/system/laundry.repo': {
      async createTicket(data) { saved = data; return 1; },
      async createTicketItem() {},
      async logLaundryAudit() {},
      async linkTicketEmployee(ticketId, userId) { linked = { ticketId, userId }; return ticketId === 1; },
    },
    '../../../repositories/system/zk.repo': {
      async getEmployeeDetails(userId) { return userId === 22 ? { employee: { userId: 22, userCode: '709', name: 'Replacement' } } : null; },
      async createHandoverReceiveTxn(data) { movement = data; return 1; },
    },
    '../../../config/database': { getSystemDB: () => ({}) },
    '../../../utils/errors': { NotFoundError: Error, BadRequestError: Error, DatabaseError: Error },
    '../../../utils/logger': { info() {} },
    mssql: { Transaction },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/api/v1/laundry/laundry.service.js'), 'utf8'), {
    module, require: name => dependencies[name] || {},
  });
  return { service: module.exports, saved: () => saved, movement: () => movement, linked: () => linked };
}
test('ticket service verifies permanent identity and stores the selected employee, not the supplied name', async () => {
  const fixture = serviceFixture();
  await fixture.service.createTicket(5, { ticketType: 'STAFF', zkUserId: 22, guestName: 'Former employee', items: [] });
  assert.equal(fixture.saved().zkUserId, 22);
  assert.equal(fixture.saved().guestName, 'Replacement');
});
test('ticket service rejects missing and unknown identities before saving', async () => {
  const fixture = serviceFixture();
  for (const zkUserId of [undefined, 709]) {
    await assert.rejects(fixture.service.createTicket(5, { ticketType: 'STAFF', zkUserId, items: [] }));
  }
  assert.equal(fixture.saved(), undefined);
});
test('legacy ticket linkage verifies the employee and rejects invalid or already assigned tickets', async () => {
  const fixture = serviceFixture();
  await assert.rejects(fixture.service.linkTicketEmployee(1, 709, 5));
  assert.equal(fixture.linked(), undefined);
  await fixture.service.linkTicketEmployee(1, 22, 5);
  assert.equal(fixture.linked().userId, 22);
  await assert.rejects(fixture.service.linkTicketEmployee(2, 22, 5));
});
test('movement service passes the permanent employee ID unchanged', async () => {
  const fixture = serviceFixture();
  await fixture.service.recordZkHandoverReceive(5, { userId: 22, userCode: '709', itemCode: 'shirt', action: 'Receive', quantity: 1 });
  assert.equal(fixture.movement().userId, 22);
  assert.equal(fixture.movement().userCode, undefined);
});
