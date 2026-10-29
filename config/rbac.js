/**
 * DDevUltraHome — Role-Based Access Control (RBAC) Permissions Matrix
 * Defines distinct capabilities for Owner, Accountant, Site Manager, Engineer, and Client.
 */

export const Roles = {
  OWNER: 'OWNER',
  ACCOUNTANT: 'ACCOUNTANT',
  SITE_MANAGER: 'SITE_MANAGER',
  ENGINEER: 'ENGINEER',
  CLIENT: 'CLIENT'
};

export const Permissions = {
  // Financial & Executive
  VIEW_EXECUTIVE_DASHBOARD: 'VIEW_EXECUTIVE_DASHBOARD',
  VIEW_COMPANY_FINANCIALS: 'VIEW_COMPANY_FINANCIALS',
  VIEW_PROFIT_LOSS: 'VIEW_PROFIT_LOSS',
  MANAGE_COMPANY_SETTINGS: 'MANAGE_COMPANY_SETTINGS',

  // Projects & Contracts
  CREATE_PROJECT: 'CREATE_PROJECT',
  EDIT_PROJECT: 'EDIT_PROJECT',
  DELETE_PROJECT: 'DELETE_PROJECT',
  VIEW_ALL_PROJECTS: 'VIEW_ALL_PROJECTS',
  VIEW_ASSIGNED_PROJECTS: 'VIEW_ASSIGNED_PROJECTS',

  // Clients
  MANAGE_CLIENTS: 'MANAGE_CLIENTS',
  VIEW_CLIENTS: 'VIEW_CLIENTS',

  // Quotations
  CREATE_QUOTATION: 'CREATE_QUOTATION',
  EDIT_QUOTATION: 'EDIT_QUOTATION',
  APPROVE_QUOTATION: 'APPROVE_QUOTATION',
  VIEW_QUOTATIONS: 'VIEW_QUOTATIONS',

  // Income & Receipts
  RECORD_CLIENT_RECEIPT: 'RECORD_CLIENT_RECEIPT',
  ALLOCATE_ADVANCE: 'ALLOCATE_ADVANCE',
  VIEW_RECEIPTS: 'VIEW_RECEIPTS',

  // Expenses & Purchases
  RECORD_EXPENSE: 'RECORD_EXPENSE',
  APPROVE_EXPENSE: 'APPROVE_EXPENSE',
  VIEW_ALL_EXPENSES: 'VIEW_ALL_EXPENSES',
  VIEW_ASSIGNED_EXPENSES: 'VIEW_ASSIGNED_EXPENSES',

  // Suppliers & Payables
  MANAGE_SUPPLIERS: 'MANAGE_SUPPLIERS',
  RECORD_SUPPLIER_INVOICE: 'RECORD_SUPPLIER_INVOICE',
  RECORD_SUPPLIER_PAYMENT: 'RECORD_SUPPLIER_PAYMENT',
  VIEW_SUPPLIER_DUES: 'VIEW_SUPPLIER_DUES',

  // Site Progress & Milestones
  UPDATE_SITE_PROGRESS: 'UPDATE_SITE_PROGRESS',
  APPROVE_MILESTONE: 'APPROVE_MILESTONE',
  VIEW_SITE_PROGRESS: 'VIEW_SITE_PROGRESS',

  // Documents & OCR
  UPLOAD_DOCUMENT: 'UPLOAD_DOCUMENT',
  VERIFY_OCR_TRANSACTION: 'VERIFY_OCR_TRANSACTION',
  DELETE_DOCUMENT: 'DELETE_DOCUMENT',

  // Backup & Sync
  EXPORT_LOCAL_BACKUP: 'EXPORT_LOCAL_BACKUP',
  TRIGGER_CLOUD_SYNC: 'TRIGGER_CLOUD_SYNC',

  // Client Portal Exclusive
  VIEW_OWN_PROJECT_PORTAL: 'VIEW_OWN_PROJECT_PORTAL'
};

export const ROLE_PERMISSIONS = {
  [Roles.OWNER]: [
    // Owner has unrestricted access to all operations
    ...Object.values(Permissions)
  ],

  [Roles.ACCOUNTANT]: [
    Permissions.VIEW_EXECUTIVE_DASHBOARD,
    Permissions.VIEW_COMPANY_FINANCIALS,
    Permissions.VIEW_PROFIT_LOSS,
    Permissions.VIEW_ALL_PROJECTS,
    Permissions.MANAGE_CLIENTS,
    Permissions.VIEW_CLIENTS,
    Permissions.CREATE_QUOTATION,
    Permissions.EDIT_QUOTATION,
    Permissions.VIEW_QUOTATIONS,
    Permissions.RECORD_CLIENT_RECEIPT,
    Permissions.ALLOCATE_ADVANCE,
    Permissions.VIEW_RECEIPTS,
    Permissions.RECORD_EXPENSE,
    Permissions.APPROVE_EXPENSE,
    Permissions.VIEW_ALL_EXPENSES,
    Permissions.MANAGE_SUPPLIERS,
    Permissions.RECORD_SUPPLIER_INVOICE,
    Permissions.RECORD_SUPPLIER_PAYMENT,
    Permissions.VIEW_SUPPLIER_DUES,
    Permissions.VIEW_SITE_PROGRESS,
    Permissions.UPLOAD_DOCUMENT,
    Permissions.VERIFY_OCR_TRANSACTION,
    Permissions.EXPORT_LOCAL_BACKUP,
    Permissions.TRIGGER_CLOUD_SYNC
  ],

  [Roles.SITE_MANAGER]: [
    Permissions.VIEW_ASSIGNED_PROJECTS,
    Permissions.RECORD_EXPENSE,
    Permissions.VIEW_ASSIGNED_EXPENSES,
    Permissions.UPDATE_SITE_PROGRESS,
    Permissions.VIEW_SITE_PROGRESS,
    Permissions.UPLOAD_DOCUMENT
  ],

  [Roles.ENGINEER]: [
    Permissions.VIEW_ASSIGNED_PROJECTS,
    Permissions.UPDATE_SITE_PROGRESS,
    Permissions.APPROVE_MILESTONE,
    Permissions.VIEW_SITE_PROGRESS,
    Permissions.UPLOAD_DOCUMENT
  ],

  [Roles.CLIENT]: [
    // Client is restricted to viewing progress, invoices, and receipts for their designated project
    Permissions.VIEW_OWN_PROJECT_PORTAL,
    Permissions.VIEW_SITE_PROGRESS
  ]
};

/**
 * Checks whether a given role has a specific permission
 * @param {string} role
 * @param {string} permission
 * @returns {boolean}
 */
export function roleHasPermission(role, permission) {
  if (!role || !permission) return false;
  const list = ROLE_PERMISSIONS[role.toUpperCase()];
  return Array.isArray(list) && list.includes(permission);
}
