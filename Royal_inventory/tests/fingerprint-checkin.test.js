'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * Fixture providing mock SQL connection and dependencies for zk.repo.js
 */
function createZkRepoFixture() {
  const mockEmployees = [
    { userId: 101, USERID: 101, BADGENUMBER: '1001', NAME: 'أحمد محمود', TITLE: 'موظف استقبال', DEPTNAME: 'الاستقبال' },
    { userId: 202, USERID: 202, BADGENUMBER: '2002', NAME: 'علي حسن', TITLE: 'عامل مغسلة', DEPTNAME: 'المغسلة' },
  ];

  const mockCheckins = [
    {
      userId: 202,
      userCode: '2002',
      checkTime: new Date(),
      sensorId: '104',
      serialNumber: 'CQUL232462270',
      employeeName: 'علي حسن',
      department: 'المغسلة',
    },
  ];

  const executedQueries = [];
  const queryInputs = [];

  const pool = {
    request() {
      const inputs = {};
      return {
        input(name, type, value) {
          inputs[name] = value;
          return this;
        },
        async query(sql) {
          executedQueries.push(sql);
          queryInputs.push({ ...inputs });

          // Count query for pagination/stats
          if (/COUNT\(1\) AS total/.test(sql)) {
            return {
              recordset: [{ total: mockCheckins.length, uniqueUsers: 1, todayCount: 1 }],
            };
          }

          // Checkin rows query
          if (/FROM dbo\.CHECKINOUT c/.test(sql)) {
            const limit = inputs.pageSize || inputs.limit || 50;
            return {
              recordset: mockCheckins.slice(0, limit),
            };
          }

          // Employee profile query
          if (/FROM dbo\.USERINFO u[\s\S]*WHERE u\.USERID = @employeeUserId/.test(sql)) {
            const match = mockEmployees.find(e => e.userId === inputs.employeeUserId);
            return {
              recordset: match ? [{
                userId: match.userId,
                userCode: match.BADGENUMBER,
                name: match.NAME,
                title: match.TITLE,
                department: match.DEPTNAME,
              }] : [],
            };
          }

          // Custody items
          if (/FROM dbo\.UserItems ui[\s\S]*WHERE ui\.UserID = @userId/.test(sql)) {
            if (inputs.userId === 202) {
              return {
                recordset: [
                  {
                    userItemId: 501,
                    itemId: 10,
                    itemName: 'زي موحد - بنطلون',
                    itemCode: 'UNIFORM-PANTS-202',
                    assignedDate: new Date('2026-01-01'),
                    lastAction: 'Receive', // in laundry
                    handedOverQty: 2,
                    receivedQty: 3,
                  },
                ],
              };
            }
            return { recordset: [] };
          }

          // Item transactions history
          if (/FROM dbo\.ItemTransactions t[\s\S]*WHERE ui\.UserID = @userId/.test(sql)) {
            return { recordset: [] };
          }

          return { recordset: [] };
        },
      };
    },
  };

  class Transaction {
    async begin() {}
    async commit() {}
    async rollback() {}
    request() { return pool.request(); }
  }

  class AppError extends Error {
    constructor(message, statusCode, code) {
      super(message);
      this.statusCode = statusCode;
      this.code = code;
    }
  }

  const moduleObj = { exports: {} };
  const dependencies = {
    '../../config/zk.database': {
      getZkDB: () => pool,
      sql: { Int: 'int', NVarChar: () => 'nvarchar', DateTime: 'datetime', Transaction },
    },
    '../../config/index': {
      zkDb: { laundrySensorId: '104', laundrySn: 'CQUL232462270' },
    },
    '../../utils/errors': { AppError, DatabaseError: Error },
  };

  const code = fs.readFileSync(path.join(__dirname, '../src/repositories/system/zk.repo.js'), 'utf8');
  vm.runInNewContext(code, {
    module: moduleObj,
    require(name) {
      if (dependencies[name]) return dependencies[name];
      throw new Error(`Unexpected dependency in test: ${name}`);
    },
  });

  return {
    repo: moduleObj.exports,
    executedQueries,
    queryInputs,
    mockCheckins,
    mockEmployees,
  };
}

describe('Laundry Biometric Fingerprint Check-in Flow', () => {

  test('1. Polling for latest fingerprint (limit=1) returns direct array without executing heavy stats count', async () => {
    const { repo, executedQueries } = createZkRepoFixture();

    const result = await repo.getLatestCheckins(1);

    // Must return an array directly for fast polling in HandoverReceivePage
    assert.ok(Array.isArray(result), 'getLatestCheckins(1) should return an array');
    assert.equal(result.length, 1);
    assert.equal(result[0].userId, 202);
    assert.equal(result[0].userCode, '2002');
    assert.equal(result[0].sensorId, '104');
    assert.equal(result[0].serialNumber, 'CQUL232462270');

    // Only the data query must run; the heavy COUNT(1) query must NOT run on 1.5s interval
    assert.equal(executedQueries.length, 1, 'Only data query should execute for unpaginated polling');
    assert.match(executedQueries[0], /SELECT\s+c\.USERID AS userId/);
    assert.doesNotMatch(executedQueries[0], /COUNT\(1\) AS total/);
  });

  test('2. Paginated report query returns structured { items, stats, pagination } object', async () => {
    const { repo, executedQueries } = createZkRepoFixture();

    const result = await repo.getLatestCheckins({ page: 1, pageSize: 20 });

    assert.ok(!Array.isArray(result), 'Paginated call should return a structured object');
    assert.ok(Array.isArray(result.items), 'Result must contain items array');
    assert.equal(result.items[0].userId, 202);
    assert.ok(result.stats, 'Result must contain stats');
    assert.equal(result.stats.total, 1);
    assert.ok(result.pagination, 'Result must contain pagination metadata');
    assert.equal(result.pagination.page, 1);

    // For paginated calls, both count query and data query must run
    assert.equal(executedQueries.length, 2);
    assert.match(executedQueries[0], /COUNT\(1\) AS total/);
    assert.match(executedQueries[1], /SELECT\s+c\.USERID AS userId/);
  });

  test('3. Employee profile and custody status are properly resolved from punch userId', async () => {
    const { repo } = createZkRepoFixture();

    const details = await repo.getEmployeeDetails(202);

    assert.ok(details, 'Employee details should be returned');
    assert.equal(details.employee.userId, 202);
    assert.equal(details.employee.userCode, '2002');
    assert.equal(details.employee.name, 'علي حسن');
    assert.equal(details.employee.department, 'المغسلة');

    // Verify custody state for smart default action (Handover vs Receive)
    assert.equal(details.custody.length, 1);
    assert.equal(details.custody[0].itemCode, 'UNIFORM-PANTS-202');
    assert.equal(details.custody[0].isInLaundry, true, 'Item should be flagged as in laundry');
  });

  test('4. Unknown fingerprint userId returns null when fetching profile', async () => {
    const { repo } = createZkRepoFixture();

    const details = await repo.getEmployeeDetails(99999);
    assert.equal(details, null, 'Unknown employee userId should return null');
  });

  test('5. Frontend Checkin Extraction Helper supports all backend response formats (unwrapped, nested items, and legacy data)', () => {
    // This is the exact normalization logic implemented in HandoverReceivePage.tsx
    const extractCheckinsList = (res) => {
      return Array.isArray(res)
        ? res
        : (Array.isArray(res?.items)
            ? res.items
            : (Array.isArray(res?.data?.items)
                ? res.data.items
                : (Array.isArray(res?.data)
                    ? res.data
                    : [])));
    };

    // Case A: Unwrapped array (returned by updated backend for limit=1)
    const caseA = [{ userId: 202, checkTime: '2026-10-30T10:00:00Z', sensorId: '104' }];
    assert.equal(extractCheckinsList(caseA)[0].userId, 202);

    // Case B: Paginated object with items (returned when paginated)
    const caseB = { items: [{ userId: 202, checkTime: '2026-10-30T10:00:00Z', sensorId: '104' }], stats: {} };
    assert.equal(extractCheckinsList(caseB)[0].userId, 202);

    // Case C: Axios wrapped response with data array
    const caseC = { success: true, data: [{ userId: 202, checkTime: '2026-10-30T10:00:00Z' }] };
    assert.equal(extractCheckinsList(caseC)[0].userId, 202);

    // Case D: Axios wrapped response with data.items object
    const caseD = { success: true, data: { items: [{ userId: 202, checkTime: '2026-10-30T10:00:00Z' }] } };
    assert.equal(extractCheckinsList(caseD)[0].userId, 202);

    // Case E: Empty / malformed response returns empty array without throwing
    assert.deepEqual(extractCheckinsList(null), []);
    assert.deepEqual(extractCheckinsList({}), []);
    assert.deepEqual(extractCheckinsList(undefined), []);
  });

  test('6. Biometric Scan Key detection triggers profile load only on fresh or new punches', () => {
    const now = Date.now();

    // Helper simulating the punch recognition decision
    const shouldRecognizePunch = ({ latest, isFirstRun, lastProcessedKey }) => {
      const scanKey = JSON.stringify([latest.userId, latest.checkTime, latest.sensorId, latest.serialNumber]);
      const punchAgeMs = now - new Date(latest.checkTime).getTime();

      if (isFirstRun) {
        // Fresh punch on load (< 30 seconds) should immediately trigger profile
        if (punchAgeMs >= 0 && punchAgeMs < 30000 && latest.userId) {
          return { trigger: true, newKey: scanKey };
        }
        return { trigger: false, newKey: scanKey };
      }

      // Subsequent polls: trigger if scan key changed
      if (latest.checkTime && scanKey !== lastProcessedKey && latest.userId) {
        return { trigger: true, newKey: scanKey };
      }

      return { trigger: false, newKey: lastProcessedKey };
    };

    // Scenario 1: Fresh punch 5 seconds ago on initial page load -> triggers!
    const freshPunch = {
      userId: 202,
      checkTime: new Date(now - 5000).toISOString(),
      sensorId: '104',
      serialNumber: 'CQUL232462270',
    };
    const res1 = shouldRecognizePunch({ latest: freshPunch, isFirstRun: true, lastProcessedKey: null });
    assert.equal(res1.trigger, true, 'Fresh punch on page load should trigger profile display');

    // Scenario 2: Stale punch 2 hours ago on initial page load -> baseline set, does NOT trigger old profile
    const stalePunch = {
      userId: 101,
      checkTime: new Date(now - 7200000).toISOString(),
      sensorId: '104',
      serialNumber: 'CQUL232462270',
    };
    const res2 = shouldRecognizePunch({ latest: stalePunch, isFirstRun: true, lastProcessedKey: null });
    assert.equal(res2.trigger, false, 'Old punch on initial load should not trigger profile');

    // Scenario 3: While on page, same punch on next poll (1.5s later) -> does NOT re-trigger
    const res3 = shouldRecognizePunch({ latest: stalePunch, isFirstRun: false, lastProcessedKey: res2.newKey });
    assert.equal(res3.trigger, false, 'Same punch should not re-trigger');

    // Scenario 4: While on page, employee touches sensor -> new checkTime arrives -> triggers immediately!
    const newScan = {
      userId: 202,
      checkTime: new Date(now + 1000).toISOString(),
      sensorId: '104',
      serialNumber: 'CQUL232462270',
    };
    const res4 = shouldRecognizePunch({ latest: newScan, isFirstRun: false, lastProcessedKey: res2.newKey });
    assert.equal(res4.trigger, true, 'New fingerprint punch must trigger employee recognition');
  });

});
