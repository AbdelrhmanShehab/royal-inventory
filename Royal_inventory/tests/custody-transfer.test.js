'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { transferCustodySchema } = require('../src/api/v1/laundry/laundry.validation');

test('transferCustodySchema validates required fields', () => {
  const valid = {
    itemCode: 'SHIRT-101',
    fromUserId: 11,
    toUserId: 22,
    reason: 'استبدال مقاس',
  };
  const { error, value } = transferCustodySchema.validate(valid);
  assert.equal(error, undefined);
  assert.equal(value.itemCode, 'SHIRT-101');
  assert.equal(value.fromUserId, 11);
  assert.equal(value.toUserId, 22);
});

test('transferCustodySchema rejects missing itemCode', () => {
  const invalid = {
    fromUserId: 11,
    toUserId: 22,
  };
  const { error } = transferCustodySchema.validate(invalid);
  assert.ok(error);
  assert.match(error.message, /كود الصنف مطلوب/);
});

test('transferCustodySchema rejects invalid user IDs', () => {
  const invalid = {
    itemCode: 'SHIRT-101',
    fromUserId: -5,
    toUserId: 22,
  };
  const { error } = transferCustodySchema.validate(invalid);
  assert.ok(error);
});
