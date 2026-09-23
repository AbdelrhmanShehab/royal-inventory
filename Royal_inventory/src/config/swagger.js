'use strict';

/**
 * Swagger / OpenAPI 3.0 specifications for the entire API.
 * Updated: 2026-07-05 — Added full laundry module (34 endpoints) + complete transaction workflow
 */
const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'نظام إدارة وتتبع المخزون — API',
    version: '2.0.0',
    description: [
      'دليل مرجعي تفاعلي لمطوري الواجهة الأمامية.',
      '',
      '## الوحدات',
      '- **Auth** — تسجيل الدخول',
      '- **Users** — المستخدمين',
      '- **Permissions** — الصلاحيات',
      '- **Hierarchy** — شجرة المستودعات',
      '- **Transfers** — دورة حياة الحركات',
      '- **Laundry/Machines** — الغسالات وبرامجها',
      '- **Laundry/Recipes** — الوصفات الكيميائية',
      '- **Laundry/Transfers** — شحن واستلام الكتان',
      '- **Laundry/Batches** — دورات الغسيل',
      '- **Laundry/Returns** — مرتجعات المستودع',
      '- **Laundry/Losses** — الهوالك والتلف',
      '- **Laundry/Tickets** — تذاكر النزلاء والموظفين',
      '- **Laundry/POS Sync** — مزامنة كومسيس',
      '- **Laundry/Reports** — الربحية والمطابقة',
      '- **Laundry/Stock** — أرصدة المغسلة',
    ].join('\n'),
    contact: { name: 'فريق التطوير الفني' }
  },
  servers: [{ url: '/api/v1', description: 'الخادم الرئيسي' }],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'أدخل: `Bearer <token>`'
      }
    },
    schemas: {
      StandardResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'تمت العملية بنجاح' }
        }
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'رسالة الخطأ' },
          errors: { type: 'array', items: { type: 'object', properties: { field: { type: 'string' }, message: { type: 'string' } } } }
        }
      }
    }
  },
  security: [{ BearerAuth: [] }],
  paths: {

    // ─── AUTH ─────────────────────────────────────────────────────────────────
    '/auth/login': {
      post: {
        tags: ['المصادقة (Auth)'],
        summary: 'تسجيل الدخول للنظام',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password'],
                properties: {
                  username: { type: 'string', example: 'msamir' },
                  password: { type: 'string', example: 'UserPass@123' }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'تم تسجيل الدخول',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        user: { type: 'object', properties: { id: { type: 'integer' }, username: { type: 'string' }, role: { type: 'string' }, nodeId: { type: 'integer' } } },
                        token: { type: 'string', example: 'eyJhbGci...' }
                      }
                    }
                  }
                }
              }
            }
          },
          400: { description: 'بيانات غير صحيحة' }
        }
      }
    },
    '/auth/me': {
      get: {
        tags: ['المصادقة (Auth)'],
        summary: 'بيانات المستخدم الحالي',
        responses: { 200: { description: 'بيانات الجلسة' } }
      }
    },

    // ─── USERS ────────────────────────────────────────────────────────────────
    '/users': {
      get: {
        tags: ['إدارة المستخدمين (Users)'],
        summary: 'قائمة المستخدمين',
        responses: { 200: { description: 'قائمة المستخدمين' } }
      },
      post: {
        tags: ['إدارة المستخدمين (Users)'],
        summary: 'إضافة مستخدم جديد',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'fullNameAr', 'password', 'role'],
                properties: {
                  username: { type: 'string', example: 'ahmed.ali' },
                  fullNameAr: { type: 'string', example: 'أحمد علي' },
                  password: { type: 'string', example: 'SecurePass@123' },
                  role: { type: 'string', enum: ['admin', 'manager', 'warehouse_manager', 'warehouse_head', 'accountant', 'staff'], example: 'warehouse_head' },
                  warehouseNodeId: { type: 'integer', example: 12 }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'تم إنشاء المستخدم' } }
      }
    },
    '/users/{id}': {
      put: {
        tags: ['إدارة المستخدمين (Users)'],
        summary: 'تعديل مستخدم',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { fullNameAr: { type: 'string' }, role: { type: 'string' }, warehouseNodeId: { type: 'integer' } } } } } },
        responses: { 200: { description: 'تم التعديل' } }
      },
      delete: {
        tags: ['إدارة المستخدمين (Users)'],
        summary: 'حذف مستخدم',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'تم الحذف' } }
      }
    },

    // ─── PERMISSIONS ──────────────────────────────────────────────────────────
    '/admin/permissions': {
      get: {
        tags: ['إدارة الصلاحيات (Permissions)'],
        summary: 'جلب مصفوفة الصلاحيات',
        description: 'مصفوفة role × permission_key. مُحمَّلة من DB ومُخزَّنة في Cache 5 دقائق.',
        responses: { 200: { description: 'مصفوفة الصلاحيات' } }
      },
      put: {
        tags: ['إدارة الصلاحيات (Permissions)'],
        summary: 'حفظ تعديلات الصلاحيات',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['updates'],
                properties: {
                  updates: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['role', 'permissionKey', 'allowed'],
                      properties: {
                        role: { type: 'string', example: 'warehouse_head' },
                        permissionKey: { type: 'string', example: 'submit_approval' },
                        allowed: { type: 'boolean', example: true }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'تم الحفظ وإعادة تحميل الـ Cache' } }
      }
    },

    // ─── HIERARCHY ────────────────────────────────────────────────────────────
    '/hierarchy/tree': {
      get: {
        tags: ['شجرة المستودعات (Hierarchy)'],
        summary: 'شجرة المستودعات المتاحة للمستخدم',
        responses: { 200: { description: 'الشجرة الهرمية' } }
      }
    },
    '/hierarchy/nodes/{id}/stock': {
      get: {
        tags: ['شجرة المستودعات (Hierarchy)'],
        summary: 'أرصدة مستودع محدد',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, example: 12 }],
        responses: { 200: { description: 'أرصدة المستودع' } }
      }
    },

    // ─── TRANSFERS: FULL 6-STEP WORKFLOW ──────────────────────────────────────
    '/transactions/transfers': {
      get: {
        tags: ['التحويلات والعمليات (Transfers)'],
        summary: 'قائمة الحركات والمعاملات',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['draft', 'pending_approval', 'approved', 'dispatched', 'completed', 'cancelled'] } },
          { name: 'txnType', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', example: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', example: 50 } }
        ],
        responses: { 200: { description: 'قائمة الحركات' } }
      },
      post: {
        tags: ['التحويلات والعمليات (Transfers)'],
        summary: 'إنشاء مسودة حركة جديدة',
        description: 'إنشاء طلب تحويل أو صرف داخلي أو إهلاك كمسودة.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['txnType', 'fromNodeId', 'lines'],
                properties: {
                  txnType: { type: 'string', enum: ['internal_transfer', 'consumption', 'return', 'damage', 'waste', 'disposal'], example: 'internal_transfer' },
                  fromNodeId: { type: 'integer', example: 11 },
                  toNodeId: { type: 'integer', example: 12 },
                  notes: { type: 'string', example: 'طلب تحويل' },
                  reason: { type: 'string', example: 'سد عجز' },
                  lines: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['itemCode', 'quantity'],
                      properties: {
                        itemCode: { type: 'string', example: '32510' },
                        quantity: { type: 'number', example: 150 },
                        unitCost: { type: 'number', example: 1.25 }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'تم إنشاء المسودة' } }
      }
    },
    '/transactions/transfers/{id}': {
      get: {
        tags: ['التحويلات والعمليات (Transfers)'],
        summary: 'تفاصيل حركة محددة',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, example: 45 }],
        responses: { 200: { description: 'التفاصيل الكاملة' }, 404: { description: 'غير موجودة' } }
      }
    },
    '/transactions/transfers/{id}/submit-approval': {
      post: {
        tags: ['التحويلات والعمليات (Transfers)'],
        summary: '① إرسال للموافقة الإدارية',
        description: 'draft → pending_approval\n\n**الصلاحية:** submit_approval\n\n**الأدوار:** admin, manager, warehouse_manager, warehouse_head',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, example: 45 }],
        responses: {
          200: { description: 'تم الإرسال بنجاح' },
          403: { description: 'صلاحية submit_approval غير ممنوحة' },
          409: { description: 'الحركة ليست في حالة draft' }
        }
      }
    },
    '/transactions/transfers/{id}/approve': {
      post: {
        tags: ['التحويلات والعمليات (Transfers)'],
        summary: '② اعتماد الطلب — مدير/أدمن',
        description: 'pending_approval → approved. يُسجَّل اسم المعتمد والتوقيت.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, example: 45 }],
        responses: { 200: { description: 'تم الاعتماد' }, 403: { description: 'صلاحية approve_transfer مطلوبة' } }
      }
    },
    '/transactions/transfers/{id}/dispatch': {
      post: {
        tags: ['التحويلات والعمليات (Transfers)'],
        summary: '③ شحن البضاعة — خصم رصيد المصدر',
        description: 'approved → dispatched. يخصم الكميات في transaction موحد بعد التحقق من الأرصدة.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, example: 45 }],
        responses: { 200: { description: 'تم الشحن' }, 400: { description: 'عجز في الرصيد' } }
      }
    },
    '/transactions/transfers/{id}/receive': {
      post: {
        tags: ['التحويلات والعمليات (Transfers)'],
        summary: '④ استلام البضاعة — إضافة رصيد الوجهة',
        description: 'dispatched → completed. يضيف الكميات لمستودع الوجهة.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, example: 45 }],
        responses: { 200: { description: 'اكتمل التحويل' } }
      }
    },
    '/transactions/transfers/{id}/cancel': {
      post: {
        tags: ['التحويلات والعمليات (Transfers)'],
        summary: '⑤ إلغاء الطلب في أي مرحلة',
        description: 'يلغي الحركة. إذا كانت dispatched، يعكس الخصم تلقائياً.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, example: 45 }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { reason: { type: 'string', example: 'إلغاء بقرار الإدارة' } } } } } },
        responses: { 200: { description: 'تم الإلغاء وعكس الأرصدة' } }
      }
    },
    '/transactions/transfers/{id}/confirm': {
      post: {
        tags: ['التحويلات والعمليات (Transfers)'],
        summary: '⑥ تأكيد فوري للعمليات الأحادية',
        description: 'للعمليات بدون موافقة (consumption, waste, damage, disposal). يخصم المخزن مباشرة.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, example: 45 }],
        responses: { 200: { description: 'تم التأكيد والخصم الفوري' } }
      }
    },

    // ─── LAUNDRY: MACHINES ────────────────────────────────────────────────────
    '/laundry/machines': {
      post: {
        tags: ['المغسلة — الغسالات (Machines)'],
        summary: 'إضافة غسالة جديدة',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['machineName', 'machineCode', 'capacity'],
                properties: {
                  machineName: { type: 'string', example: 'غسالة صناعية A1' },
                  machineCode: { type: 'string', example: 'MACH-001' },
                  capacity: { type: 'number', example: 50 },
                  notes: { type: 'string' }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'تم إضافة الغسالة', content: { 'application/json': { schema: { type: 'object', properties: { machineId: { type: 'integer', example: 30 } } } } } } }
      },
      get: {
        tags: ['المغسلة — الغسالات (Machines)'],
        summary: 'قائمة الغسالات النشطة',
        responses: { 200: { description: 'الغسالات مع برامجها' } }
      }
    },
    '/laundry/machines/programs': {
      post: {
        tags: ['المغسلة — الغسالات (Machines)'],
        summary: 'إضافة برنامج تشغيل',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['machineId', 'programName', 'programCode', 'durationMinutes'],
                properties: {
                  machineId: { type: 'integer', example: 30 },
                  programName: { type: 'string', example: 'برنامج القطن 90°' },
                  programCode: { type: 'string', example: 'PROG-COTTON-90' },
                  durationMinutes: { type: 'integer', example: 60 },
                  tempCelsius: { type: 'number', example: 90 }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'تم إضافة البرنامج' } }
      }
    },
    '/laundry/machines/{machineId}/programs': {
      get: {
        tags: ['المغسلة — الغسالات (Machines)'],
        summary: 'برامج غسالة محددة',
        parameters: [{ name: 'machineId', in: 'path', required: true, schema: { type: 'integer' }, example: 30 }],
        responses: { 200: { description: 'قائمة البرامج' } }
      }
    },
    '/laundry/machines/programs/{id}': {
      put: {
        tags: ['المغسلة — الغسالات (Machines)'],
        summary: 'تعديل برنامج تشغيل',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, example: 32 }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { programName: { type: 'string' }, durationMinutes: { type: 'integer' }, tempCelsius: { type: 'number' } } } } } },
        responses: { 200: { description: 'تم التعديل' } }
      },
      delete: {
        tags: ['المغسلة — الغسالات (Machines)'],
        summary: 'حذف برنامج تشغيل',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, example: 32 }],
        responses: { 200: { description: 'تم الحذف' } }
      }
    },

    // ─── LAUNDRY: RECIPES ─────────────────────────────────────────────────────
    '/laundry/recipes': {
      post: {
        tags: ['المغسلة — الوصفات الكيميائية (Recipes)'],
        summary: 'إضافة وصفة كيميائية',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['recipeName', 'programId'],
                properties: {
                  recipeName: { type: 'string', example: 'وصفة القطن الأبيض' },
                  programId: { type: 'integer', example: 32 },
                  chemicals: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['itemCode', 'quantityPerKg'],
                      properties: {
                        itemCode: { type: 'string', example: 'CHEM-DETERGENT-01' },
                        quantityPerKg: { type: 'number', example: 0.05 }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'تم إضافة الوصفة' } }
      },
      get: {
        tags: ['المغسلة — الوصفات الكيميائية (Recipes)'],
        summary: 'قائمة الوصفات الكيميائية',
        responses: { 200: { description: 'قائمة الوصفات' } }
      }
    },
    '/laundry/recipes/{id}': {
      get: {
        tags: ['المغسلة — الوصفات الكيميائية (Recipes)'],
        summary: 'تفاصيل وصفة محددة',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, example: 1 }],
        responses: { 200: { description: 'تفاصيل الوصفة مع المكونات' } }
      },
      delete: {
        tags: ['المغسلة — الوصفات الكيميائية (Recipes)'],
        summary: 'حذف وصفة',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, example: 1 }],
        responses: { 200: { description: 'تم الحذف' } }
      }
    },

    // ─── LAUNDRY: TRANSFERS (Warehouse → Laundry) ────────────────────────────
    '/laundry/transfers': {
      post: {
        tags: ['المغسلة — الشحن والاستلام (Transfers)'],
        summary: 'إنشاء شحنة من المستودع للمغسلة',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['fromNodeId', 'items'],
                properties: {
                  fromNodeId: { type: 'integer', example: 11 },
                  notes: { type: 'string' },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['itemCode', 'quantity'],
                      properties: {
                        itemCode: { type: 'string', example: 'L-TOWEL-001' },
                        quantity: { type: 'integer', example: 200 }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'تم إنشاء مستند الشحن' } }
      },
      get: {
        tags: ['المغسلة — الشحن والاستلام (Transfers)'],
        summary: 'قائمة مستندات شحن المغسلة',
        responses: { 200: { description: 'قائمة المستندات' } }
      }
    },
    '/laundry/transfers/{id}': {
      get: {
        tags: ['المغسلة — الشحن والاستلام (Transfers)'],
        summary: 'تفاصيل مستند شحن',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, example: 1 }],
        responses: { 200: { description: 'تفاصيل المستند' } }
      }
    },
    '/laundry/transfers/{id}/send': {
      post: {
        tags: ['المغسلة — الشحن والاستلام (Transfers)'],
        summary: 'تأكيد الشحن — خصم من المستودع وإضافة للمغسلة',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, example: 1 }],
        responses: { 200: { description: 'تم الشحن وخصم المستودع' } }
      }
    },
    '/laundry/transfers/receive': {
      post: {
        tags: ['المغسلة — الشحن والاستلام (Transfers)'],
        summary: 'تأكيد استلام شحنة في المغسلة',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['transferId'],
                properties: {
                  transferId: { type: 'integer', example: 1 },
                  notes: { type: 'string' },
                  receivedItems: { type: 'array', items: { type: 'object', properties: { itemCode: { type: 'string', example: 'L-TOWEL-001' }, quantityReceived: { type: 'integer', example: 198 } } } }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'تم الاستلام بنجاح' } }
      }
    },

    // ─── LAUNDRY: BATCHES ─────────────────────────────────────────────────────
    '/laundry/batches': {
      post: {
        tags: ['المغسلة — دورات الغسيل (Batches)'],
        summary: 'إنشاء دورة غسيل تشغيلية',
        description: 'تسجيل دورة غسيل مع الغسالة والبرنامج والوصفة. يحسب ويستهلك الكيماويات تلقائياً من الوصفة.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['runType', 'batchNumber', 'machineId', 'weight', 'pieces', 'items'],
                properties: {
                  runType: { type: 'string', enum: ['PROGRAM', 'MANUAL'], example: 'PROGRAM' },
                  batchNumber: { type: 'string', example: 'LB-2026-07-001' },
                  machineId: { type: 'integer', example: 30 },
                  programId: { type: 'integer', example: 32, description: 'مطلوب مع PROGRAM' },
                  recipeId: { type: 'integer', example: 32 },
                  weight: { type: 'number', example: 45 },
                  pieces: { type: 'integer', example: 340 },
                  guestWeight: { type: 'number', example: 0 },
                  staffWeight: { type: 'number', example: 0 },
                  specialWeight: { type: 'number', example: 0 },
                  spotWeight: { type: 'number', example: 0 },
                  notes: { type: 'string' },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['itemCode', 'quantity', 'role'],
                      properties: {
                        itemCode: { type: 'string', example: 'L-TOWEL-001' },
                        quantity: { type: 'integer', example: 200 },
                        role: { type: 'string', enum: ['INPUT', 'OUTPUT', 'LOSS'], example: 'INPUT' }
                      }
                    }
                  },
                  consumptions: {
                    type: 'array',
                    items: { type: 'object', properties: { itemCode: { type: 'string', example: 'CHEM-DETERGENT-01' }, quantity: { type: 'number', example: 2.25 } } }
                  }
                }
              }
            }
          }
        },
        responses: {
          201: {
            description: 'تم إنشاء الدورة',
            content: { 'application/json': { schema: { type: 'object', properties: { batchId: { type: 'integer', example: 40 }, batchNumber: { type: 'string' }, status: { type: 'string', example: 'in_progress' } } } } }
          }
        }
      },
      get: {
        tags: ['المغسلة — دورات الغسيل (Batches)'],
        summary: 'قائمة دورات الغسيل',
        responses: { 200: { description: 'قائمة الدورات' } }
      }
    },
    '/laundry/batches/{id}': {
      get: {
        tags: ['المغسلة — دورات الغسيل (Batches)'],
        summary: 'تفاصيل دورة غسيل',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, example: 39 }],
        responses: { 200: { description: 'تفاصيل الدورة مع الأصناف والاستهلاكات' } }
      }
    },
    '/laundry/batches/{id}/status': {
      put: {
        tags: ['المغسلة — دورات الغسيل (Batches)'],
        summary: 'تحديث حالة دورة الغسيل',
        description: 'in_progress → completed أو cancelled. عند الإكمال تُحدَّث أرصدة المغسلة.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, example: 39 }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['completed', 'cancelled'], example: 'completed' }, notes: { type: 'string' } } } } }
        },
        responses: { 200: { description: 'تم التحديث وأرصدة المغسلة محدَّثة' } }
      }
    },

    // ─── LAUNDRY: RETURNS ─────────────────────────────────────────────────────
    '/laundry/returns': {
      post: {
        tags: ['المغسلة — المرتجعات للمستودع (Returns)'],
        summary: 'إنشاء مستند إرجاع للمستودع',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['toNodeId', 'items'],
                properties: {
                  toNodeId: { type: 'integer', example: 11 },
                  notes: { type: 'string' },
                  items: { type: 'array', items: { type: 'object', required: ['itemCode', 'quantity'], properties: { itemCode: { type: 'string', example: 'L-TOWEL-001' }, quantity: { type: 'integer', example: 190 } } } }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'تم إنشاء مستند الإرجاع' } }
      },
      get: {
        tags: ['المغسلة — المرتجعات للمستودع (Returns)'],
        summary: 'قائمة مستندات المرتجعات',
        responses: { 200: { description: 'قائمة المرتجعات' } }
      }
    },
    '/laundry/returns/{id}': {
      get: {
        tags: ['المغسلة — المرتجعات للمستودع (Returns)'],
        summary: 'تفاصيل مستند مرتجع',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, example: 1 }],
        responses: { 200: { description: 'تفاصيل المستند' } }
      }
    },
    '/laundry/returns/{id}/verify': {
      put: {
        tags: ['المغسلة — المرتجعات للمستودع (Returns)'],
        summary: 'تأكيد استلام المرتجعات في المستودع',
        description: 'يضيف الكميات لمخزون المستودع المستلم.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, example: 1 }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  notes: { type: 'string' },
                  verifiedItems: { type: 'array', items: { type: 'object', properties: { itemCode: { type: 'string', example: 'L-TOWEL-001' }, quantityVerified: { type: 'integer', example: 188 } } } }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'تم التأكيد وإضافة المخزون' } }
      }
    },

    // ─── LAUNDRY: LOSSES ──────────────────────────────────────────────────────
    '/laundry/losses': {
      post: {
        tags: ['المغسلة — الهوالك والخسائر (Losses)'],
        summary: 'تسجيل هدر أو تلف',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['lossType', 'items'],
                properties: {
                  lossType: { type: 'string', enum: ['damage', 'loss', 'shrinkage'], example: 'damage' },
                  batchId: { type: 'integer', example: 39 },
                  notes: { type: 'string', example: 'تلف بسبب حرارة مرتفعة' },
                  items: { type: 'array', items: { type: 'object', required: ['itemCode', 'quantity'], properties: { itemCode: { type: 'string', example: 'L-TOWEL-001' }, quantity: { type: 'integer', example: 5 } } } }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'تم تسجيل الهدر' } }
      },
      get: {
        tags: ['المغسلة — الهوالك والخسائر (Losses)'],
        summary: 'سجل الهوالك والخسائر',
        responses: { 200: { description: 'قائمة الهوالك' } }
      }
    },

    // ─── LAUNDRY: TICKETS ─────────────────────────────────────────────────────
    '/laundry/tickets': {
      post: {
        tags: ['المغسلة — تذاكر النزلاء والموظفين (Tickets)'],
        summary: 'إنشاء تذكرة غسيل نزيل أو موظف',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['ticketType', 'guestName', 'items'],
                properties: {
                  ticketType: { type: 'string', enum: ['guest', 'staff'], example: 'guest' },
                  guestName: { type: 'string', example: 'Ahmed Ali' },
                  guestRoomNumber: { type: 'string', example: '204' },
                  comsysOrderId: { type: 'string', example: 'POS-2026-0701-001' },
                  notes: { type: 'string' },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['serviceItemCode', 'quantity'],
                      properties: {
                        serviceItemCode: { type: 'string', example: 'LAUN-SHIRT' },
                        quantity: { type: 'integer', example: 3 },
                        unitPrice: { type: 'number', example: 15.0 }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          201: {
            description: 'تم إنشاء التذكرة',
            content: { 'application/json': { schema: { type: 'object', properties: { ticketId: { type: 'integer', example: 191 }, ticketNumber: { type: 'string', example: 'LT-2026-07-001' }, totalAmount: { type: 'number', example: 45.0 } } } } }
          }
        }
      },
      get: {
        tags: ['المغسلة — تذاكر النزلاء والموظفين (Tickets)'],
        summary: 'قائمة تذاكر الغسيل',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'in_progress', 'ready', 'delivered', 'cancelled'] } },
          { name: 'ticketType', in: 'query', schema: { type: 'string', enum: ['guest', 'staff'] } },
          { name: 'fromDate', in: 'query', schema: { type: 'string', format: 'date', example: '2026-07-01' } },
          { name: 'toDate', in: 'query', schema: { type: 'string', format: 'date', example: '2026-07-05' } }
        ],
        responses: { 200: { description: 'قائمة التذاكر' } }
      }
    },
    '/laundry/tickets/{id}': {
      get: {
        tags: ['المغسلة — تذاكر النزلاء والموظفين (Tickets)'],
        summary: 'تفاصيل تذكرة محددة',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, example: 191 }],
        responses: { 200: { description: 'التفاصيل مع الأصناف والمبلغ الإجمالي' } }
      }
    },
    '/laundry/tickets/{id}/status': {
      put: {
        tags: ['المغسلة — تذاكر النزلاء والموظفين (Tickets)'],
        summary: 'تحديث حالة تذكرة الغسيل',
        description: 'pending → in_progress → ready → delivered',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, example: 191 }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['in_progress', 'ready', 'delivered', 'cancelled'], example: 'ready' } } } } }
        },
        responses: { 200: { description: 'تم التحديث' } }
      }
    },

    // ─── LAUNDRY: POS SYNC ────────────────────────────────────────────────────
    '/laundry/pos-sync': {
      post: {
        tags: ['المغسلة — مزامنة كومسيس (POS Sync)'],
        summary: 'مزامنة أوامر بيع المغسلة من كومسيس',
        description: 'يستورد أوامر البيع من كومسيس وينشئ تذاكر تلقائياً. آخر وقت مزامنة يُحفظ لتفادي التكرار.',
        responses: {
          200: {
            description: 'نتيجة المزامنة',
            content: { 'application/json': { schema: { type: 'object', properties: { newTickets: { type: 'integer', example: 12 }, skipped: { type: 'integer', example: 3 }, lastSyncAt: { type: 'string', format: 'date-time' } } } } }
          }
        }
      }
    },
    '/laundry/pos-sync/status': {
      get: {
        tags: ['المغسلة — مزامنة كومسيس (POS Sync)'],
        summary: 'حالة آخر مزامنة مع كومسيس',
        responses: { 200: { description: 'آخر مزامنة', content: { 'application/json': { schema: { type: 'object', properties: { lastSyncAt: { type: 'string', format: 'date-time', example: '2026-07-05T12:00:00Z' }, totalSynced: { type: 'integer', example: 45 } } } } } } }
      }
    },

    // ─── LAUNDRY: REPORTS ─────────────────────────────────────────────────────
    '/laundry/reports/profitability': {
      get: {
        tags: ['المغسلة — التقارير والتحليلات (Reports)'],
        summary: 'تقرير ربحية المغسلة',
        description: 'الإيرادات من التذاكر ناقص تكلفة الكيماويات المستهلكة وهامش الربح.',
        parameters: [
          { name: 'fromDate', in: 'query', required: true, schema: { type: 'string', format: 'date', example: '2026-07-01' } },
          { name: 'toDate', in: 'query', required: true, schema: { type: 'string', format: 'date', example: '2026-07-31' } }
        ],
        responses: {
          200: {
            description: 'تقرير الربحية',
            content: { 'application/json': { schema: { type: 'object', properties: { totalRevenue: { type: 'number', example: 18500.5 }, totalChemicalCost: { type: 'number', example: 3200 }, grossProfit: { type: 'number', example: 15300.5 }, profitMarginPct: { type: 'number', example: 82.7 } } } } }
          }
        }
      }
    },
    '/laundry/reports/reconciliation': {
      get: {
        tags: ['المغسلة — التقارير والتحليلات (Reports)'],
        summary: 'تقرير مطابقة أرصدة الكتان',
        description: 'مقارنة الكميات المشحونة مقابل المُعادة لحساب نسبة الفاقد.',
        responses: {
          200: {
            description: 'تقرير المطابقة',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          itemCode: { type: 'string', example: 'L-TOWEL-001' },
                          itemNameAr: { type: 'string', example: 'منشفة حمام' },
                          totalSent: { type: 'integer', example: 500 },
                          totalReturned: { type: 'integer', example: 480 },
                          totalLost: { type: 'integer', example: 20 },
                          lossRate: { type: 'number', example: 4.0 }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },

    // ─── LAUNDRY: STOCK ───────────────────────────────────────────────────────
    '/laundry/stock': {
      get: {
        tags: ['المغسلة — مخزون المغسلة (Stock)'],
        summary: 'أرصدة مخزون المغسلة الحالية',
        description: 'رصيد كل صنف (كتان + كيماويات) في مخزون المغسلة محسوباً من الشحن والإرجاع والاستهلاك.',
        responses: {
          200: {
            description: 'أرصدة المغسلة',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          itemCode: { type: 'string', example: 'L-TOWEL-001' },
                          itemNameAr: { type: 'string', example: 'منشفة حمام كبيرة' },
                          category: { type: 'string', enum: ['linen', 'chemical'], example: 'linen' },
                          currentQty: { type: 'integer', example: 320 },
                          unitNameAr: { type: 'string', example: 'قطعة' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },

    // ─── Operational Distribution Layer ───────────────────────────────────────────
    '/operational/nodes/{nodeId}/locations': {
      get: {
        tags: ['التوزيع التشغيلي (Operational Distribution)'],
        summary: 'جلب المواقع التشغيلية لعهدة معينة',
        parameters: [
          { name: 'nodeId', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: { 200: { description: 'قائمة المواقع التشغيلية' } }
      },
      post: {
        tags: ['التوزيع التشغيلي (Operational Distribution)'],
        summary: 'إنشاء موقع تشغيلي جديد',
        parameters: [
          { name: 'nodeId', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, displayOrder: { type: 'integer' } } } } }
        },
        responses: { 201: { description: 'تم إنشاء الموقع' } }
      }
    },
    '/operational/locations/{id}': {
      put: {
        tags: ['التوزيع التشغيلي (Operational Distribution)'],
        summary: 'تعديل بيانات الموقع التشغيلي',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, isActive: { type: 'boolean' }, displayOrder: { type: 'integer' } } } } }
        },
        responses: { 200: { description: 'تم التعديل' } }
      },
      delete: {
        tags: ['التوزيع التشغيلي (Operational Distribution)'],
        summary: 'حذف موقع تشغيلي (إذا لم يكن مرتبطاً بحركات)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: { 200: { description: 'تم الحذف' } }
      }
    },
    '/operational/nodes/{nodeId}/summary': {
      get: {
        tags: ['التوزيع التشغيلي (Operational Distribution)'],
        summary: 'جلب خلاصة أرصدة التوزيع التشغيلي لعهدة معينة',
        parameters: [
          { name: 'nodeId', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: { 200: { description: 'خلاصة الأرصدة والمطابقة لجميع الأصناف' } }
      }
    },
    '/operational/nodes/{nodeId}/summary/{itemCode}': {
      get: {
        tags: ['التوزيع التشغيلي (Operational Distribution)'],
        summary: 'جلب خلاصة أرصدة التوزيع التشغيلي لصنف معين داخل العهدة',
        parameters: [
          { name: 'nodeId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'itemCode', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: { 200: { description: 'خلاصة الأرصدة والمطابقة للصنف المحدد' } }
      }
    },
    '/operational/locations/{locationId}/allocate': {
      post: {
        tags: ['التوزيع التشغيلي (Operational Distribution)'],
        summary: 'صرف رصيد من العهدة الرسمية إلى موقع تشغيلي (Allocate)',
        parameters: [
          { name: 'locationId', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { itemCode: { type: 'string' }, quantity: { type: 'number' }, notes: { type: 'string' }, referenceDoc: { type: 'string' } } } } }
        },
        responses: { 200: { description: 'تم الصرف بنجاح' } }
      }
    },
    '/operational/locations/{locationId}/consume': {
      post: {
        tags: ['التوزيع التشغيلي (Operational Distribution)'],
        summary: 'تسجيل إهلاك/استهلاك لكميات من موقع تشغيلي (Consume)',
        parameters: [
          { name: 'locationId', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { itemCode: { type: 'string' }, quantity: { type: 'number' }, notes: { type: 'string' }, referenceDoc: { type: 'string' }, reason: { type: 'string' } } } } }
        },
        responses: { 200: { description: 'تم الاستهلاك بنجاح' } }
      }
    },
    '/operational/locations/{locationId}/return': {
      post: {
        tags: ['التوزيع التشغيلي (Operational Distribution)'],
        summary: 'إرجاع كميات فائضة من موقع تشغيلي إلى العهدة الرسمية (Return)',
        parameters: [
          { name: 'locationId', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { itemCode: { type: 'string' }, quantity: { type: 'number' }, notes: { type: 'string' }, referenceDoc: { type: 'string' } } } } }
        },
        responses: { 200: { description: 'تم الإرجاع بنجاح' } }
      }
    },
    '/operational/locations/{locationId}/adjustment': {
      post: {
        tags: ['التوزيع التشغيلي (Operational Distribution)'],
        summary: 'تسوية رصيد موقع تشغيلي (Adjustment)',
        parameters: [
          { name: 'locationId', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { itemCode: { type: 'string' }, quantity: { type: 'number' }, notes: { type: 'string' }, referenceDoc: { type: 'string' }, reason: { type: 'string' } } } } }
        },
        responses: { 200: { description: 'تمت التسوية بنجاح' } }
      }
    },
    '/laundry/zk/checkins': {
      get: {
        tags: ['المغسلة والبصمة (Laundry & ZK)'],
        summary: 'جلب آخر عمليات البصمة لجهاز المغسلة',
        description: 'يعيد قائمة بأحدث عمليات البصمة التي تمت على جهاز المغسلة (فلترة بـ SensorID و SN المحددين).',
        parameters: [
          { name: 'limit', in: 'query', description: 'الحد الأقصى لعدد السجلات المطلوبة', required: false, schema: { type: 'integer', default: 10 } }
        ],
        responses: {
          200: {
            description: 'نجاح جلب السجلات',
            content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { type: 'object', properties: { userCode: { type: 'string' }, checkTime: { type: 'string' }, sensorId: { type: 'string' }, serialNumber: { type: 'string' }, employeeName: { type: 'string' } } } } } } } }
          }
        }
      }
    },
    '/laundry/zk/employee/{userCode}': {
      get: {
        tags: ['المغسلة والبصمة (Laundry & ZK)'],
        summary: 'جلب تفاصيل الموظف والعهدة وحركة المعاملات بالبصمة',
        description: 'يعيد تفاصيل الملف الشخصي للموظف، وقائمة العهد المخصصة له مع عدد القطع المستلمة والمسلمة، وسجل آخر 20 حركة.',
        parameters: [
          { name: 'userCode', in: 'path', description: 'كود الموظف (BADGENUMBER)', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: {
            description: 'نجاح جلب تفاصيل الموظف',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        employee: { type: 'object', properties: { userCode: { type: 'string' }, name: { type: 'string' } } },
                        custody: { type: 'array', items: { type: 'object', properties: { userItemId: { type: 'integer' }, itemId: { type: 'integer' }, itemName: { type: 'string' }, itemCode: { type: 'string' }, assignedDate: { type: 'string' }, handedOverQty: { type: 'integer' }, receivedQty: { type: 'integer' }, pendingQty: { type: 'integer' } } } },
                        history: { type: 'array', items: { type: 'object', properties: { txnId: { type: 'integer' }, itemCode: { type: 'string' }, itemName: { type: 'string' }, action: { type: 'string' }, quantity: { type: 'integer' }, transactionDate: { type: 'string' }, notes: { type: 'string' } } } }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/laundry/zk/transactions': {
      post: {
        tags: ['المغسلة والبصمة (Laundry & ZK)'],
        summary: 'تسجيل عملية تسليم أو استلام عهدة (Handover / Receive)',
        description: 'يسجل حركة جديدة لتسليم أو استلام قطعة عهدة لموظف. إذا كانت الكمية أكبر من 1 يقوم النظام بالتكرار التلقائي لحفظ الحركات.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['userCode', 'itemCode', 'action', 'quantity'],
                properties: {
                  userCode: { type: 'string', description: 'كود الموظف', example: '709' },
                  itemCode: { type: 'string', description: 'كود الصنف أو اسمه', example: '709-4' },
                  action: { type: 'string', enum: ['Handover', 'Receive'], description: 'نوع الحركة', example: 'Receive' },
                  quantity: { type: 'integer', minimum: 1, default: 1, description: 'الكمية المراد تسليمها/استلامها', example: 1 },
                  notes: { type: 'string', description: 'ملاحظات اختيارية', example: 'ملاحظات حول الحالة' }
                }
              }
            }
          }
        },
        responses: {
          201: {
            description: 'تم تسجيل الحركة بنجاح',
            content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { type: 'object', properties: { transactionId: { type: 'integer' } } } } } } }
          }
        }
      }
    },
    '/laundry/zk/dashboard': {
      get: {
        tags: ['المغسلة والبصمة (Laundry & ZK)'],
        summary: 'لوحة تحكم حركات العهد البصمة',
        description: 'تعيد إحصائيات عامة لحركات العهد وقائمة بأحدث 10 معاملات عهدة، وبيانات المخطط البياني لآخر 7 أيام.',
        responses: {
          200: {
            description: 'نجاح جلب بيانات لوحة التحكم',
            content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { stats: { type: 'object', properties: { totalHandovers: { type: 'integer' }, totalReceives: { type: 'integer' }, totalPending: { type: 'integer' } } }, recentTransactions: { type: 'array', items: { type: 'object' } }, chartData: { type: 'array', items: { type: 'object' } } } } } } } }
          }
        }
      }
    },
    '/laundry/reports/dashboard-summary': {
      get: {
        tags: ['تقارير المغسلة (Laundry Reports)'],
        summary: 'لوحة التحكم المالية والتشغيلية الموحدة للمغسلة',
        description: 'تدمج بين بيانات إيرادات الـ POS للمغسلة وتكلفة الكيماويات المستهلكة في دورات الغسيل مع نشاط البصمة والعهد لليوم الحالي.',
        parameters: [
          { name: 'startDate', in: 'query', description: 'تاريخ البداية (YYYY-MM-DD)', required: false, schema: { type: 'string' } },
          { name: 'endDate', in: 'query', description: 'تاريخ النهاية (YYYY-MM-DD)', required: false, schema: { type: 'string' } }
        ],
        responses: {
          200: {
            description: 'نجاح جلب لوحة التحكم الموحدة',
            content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { period: { type: 'object' }, financials: { type: 'object' }, batches: { type: 'object' }, tickets: { type: 'object' }, todayZKActivity: { type: 'object' } } } } } } }
          }
        }
      }
    }
  }
};

module.exports = swaggerSpec;