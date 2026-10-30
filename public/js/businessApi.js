/**
 * DDevUltraHome — Business Client API & Dispatcher
 * Dual-Mode: Communicates with backend HTTP REST server or executes in-process offline
 */

export function sha256Hex(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i, j;
  let result = '';
  const words = [];
  let hash = [];
  const k = [];
  let primeCounter = 0;
  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = candidate * candidate; i < 312; i += candidate) {
        isComposite[i] = true;
      }
      if (primeCounter < 8) {
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      }
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter++;
    }
  }

  let utf8 = unescape(encodeURIComponent(ascii));
  const utf8BitLength = utf8[lengthProperty] * 8;
  for (i = 0; i < utf8[lengthProperty]; i++) {
    words[i >> 2] |= (utf8.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
  }
  words[utf8BitLength >> 5] |= 0x80 << (24 - (utf8BitLength % 32));
  words[(((utf8BitLength + 64) >> 9) << 4) + 14] = Math.floor(utf8BitLength / maxWord);
  words[(((utf8BitLength + 64) >> 9) << 4) + 15] = utf8BitLength & 0xffffffff;

  for (j = 0; j < words[lengthProperty]; j += 16) {
    const w = words.slice(j, j + 16);
    const oldHash = hash.slice(0);
    for (i = 0; i < 64; i++) {
      const i2 = i + j;
      const w15 = w[i - 15], w2 = w[i - 2];
      const a = hash[0], e = hash[4];
      const temp1 = hash[7]
        + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
        + ((e & hash[5]) ^ (~e & hash[6]))
        + k[i]
        + (w[i] = (i < 16) ? (w[i] | 0) : (
            w[i - 16]
            + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
            + w[i - 7]
            + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
          ) | 0
        );
      const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
        + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash = [(temp1 + temp2) | 0, a, hash[1], hash[2], (hash[3] + temp1) | 0, hash[4], hash[5], hash[6]];
    }
    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (8 * j)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

export const BusinessApi = {
  activeUser: {
    id: 'usr-owner-1',
    email: 'owner@ddevultrahomes.com',
    fullName: 'Vignesh (Managing Director)',
    role: 'OWNER'
  },

  setActiveUser(user) {
    this.activeUser = user;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('ddev_active_user', JSON.stringify(user));
    }
  },

  getActiveUser() {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('ddev_active_user');
      if (saved) {
        try {
          this.activeUser = JSON.parse(saved);
        } catch (e) {}
      }
    }
    return this.activeUser;
  },

  async request(endpoint, method = 'GET', data = null) {
    const url = `/api/business${endpoint}`;
    try {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': this.activeUser?.id || 'usr-owner-1',
          'X-User-Role': this.activeUser?.role || 'OWNER'
        }
      };

      const token = this.activeToken || (typeof localStorage !== 'undefined' && localStorage.getItem('ddev_auth_token'));
      if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
      }

      if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE')) {
        options.body = JSON.stringify(data);
      }

      const res = await fetch(url, options);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}: ${res.statusText}`);
      }

      return await res.json();
    } catch (err) {
      console.warn(`API call ${method} ${endpoint} network fallback:`, err.message);
      // Fallback for demonstration / offline standalone mock
      return this._offlineFallback(endpoint, method, data);
    }
  },

  /**
   * Compute live dashboard figures strictly from stored accounts, receipts, and expenses.
   * When data is empty, figures are strictly 0.
   */
  _dashboardFromBooks() {
    const accounts = this._getOfflineAccounts();
    const liquidCash = accounts
      .filter(a => a.is_active !== 0)
      .reduce((sum, a) => sum + (parseFloat(a.current_balance) || 0), 0);

    const storedInvoices = typeof localStorage !== 'undefined' ? localStorage.getItem('ddev_offline_supplier_invoices') : null;
    const invoices = storedInvoices ? JSON.parse(storedInvoices) : [];
    const accountsPayable = invoices
      .filter(inv => inv.payment_status !== 'PAID' && inv.payment_status !== 'VOIDED')
      .reduce((sum, inv) => sum + (parseFloat(inv.balance_amount) || 0), 0);

    const receipts = this._getOfflineReceipts();
    const unearnedAdvanceLiabilities = receipts
      .filter(r => r.is_advance)
      .reduce((sum, r) => sum + (parseFloat(r.unallocated_balance) || 0), 0);

    const earnedRevenue = receipts
      .reduce((sum, r) => sum + (r.is_advance ? (parseFloat(r.allocated_amount) || 0) : (parseFloat(r.amount) || 0)), 0);

    const expenses = this._getOfflineExpenses();
    const totalExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    const netOperatingCashflow = earnedRevenue - totalExpenses;

    const projects = this._getOfflineProjects();
    const clients = this._getOfflineClients();

    const storedReviews = typeof localStorage !== 'undefined' ? localStorage.getItem('ddev_offline_ocr_reviews') : null;
    const reviews = storedReviews ? JSON.parse(storedReviews) : [];
    const pendingOcrCount = reviews.filter(r => r.verification_status === 'UNVERIFIED').length;

    const company = this._getOfflineCompany();

    return {
      success: true,
      dashboard: {
        companyName: company.company_name || 'D DEV ULTRA HOMES',
        tagline: company.tagline || 'Building your dreams',
        liquidCash: Math.round(liquidCash * 100) / 100,
        totalLiquidFunds: Math.round(liquidCash * 100) / 100,
        accountsPayable: Math.round(accountsPayable * 100) / 100,
        unearnedAdvanceLiabilities: Math.round(unearnedAdvanceLiabilities * 100) / 100,
        netOperatingCashflow: Math.round(netOperatingCashflow * 100) / 100,
        activeProjects: projects.filter(p => p.status === 'ACTIVE').length,
        totalClients: clients.length,
        pendingOcrCount
      }
    };
  },

  // Fallback offline responses for APK when backend server is detached
  _offlineFallback(endpoint, method, data) {
    if (endpoint === '/dashboard/summary') {
      return this._dashboardFromBooks();
    }

    // Projects CRUD
    if (endpoint === '/projects' && method === 'GET') {
      return { success: true, projects: this._getOfflineProjects() };
    }

    if (endpoint === '/projects' && method === 'POST' && data) {
      const projects = this._getOfflineProjects();
      const newPrj = {
        id: `prj_${Date.now()}`,
        project_code: data.project_code || `PRJ-${Date.now().toString().slice(-4)}`,
        name: data.name,
        client_name: data.client_name || 'Assigned Client',
        client_phone: data.client_phone || '',
        site_address: data.site_address || '',
        district: data.district || 'Chennai',
        contract_value: parseFloat(data.contract_value) || 0,
        budgeted_cost: parseFloat(data.budgeted_cost) || 0,
        current_stage: 'FOUNDATION',
        status: 'ACTIVE'
      };
      projects.unshift(newPrj);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ddev_offline_projects', JSON.stringify(projects));
      }
      return { status: 201, success: true, project: newPrj };
    }

    if (endpoint.startsWith('/projects/') && method === 'PUT' && data) {
      const prjId = endpoint.replace('/projects/', '');
      const projects = this._getOfflineProjects();
      const prj = projects.find(p => p.id === prjId);
      if (prj) {
        Object.assign(prj, data);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('ddev_offline_projects', JSON.stringify(projects));
        }
        return { success: true, project: prj };
      }
      return { success: false, error: 'Project not found' };
    }

    if (endpoint.startsWith('/projects/') && method === 'DELETE') {
      const prjId = endpoint.replace('/projects/', '');
      const projects = this._getOfflineProjects().filter(p => p.id !== prjId);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ddev_offline_projects', JSON.stringify(projects));
      }
      return { success: true, archivedId: prjId };
    }

    if (endpoint.startsWith('/projects/') && method === 'GET') {
      const prjId = endpoint.replace('/projects/', '');
      const projects = this._getOfflineProjects();
      const prj = projects.find(p => p.id === prjId) || { id: prjId, name: 'Project' };

      const receipts = this._getOfflineReceipts().filter(r => r.project_id === prjId);
      const expenses = this._getOfflineExpenses().filter(e => e.project_id === prjId);
      const totalCashReceived = receipts.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
      const earnedRevenue = receipts.reduce((sum, r) => sum + (r.is_advance ? (parseFloat(r.allocated_amount) || 0) : (parseFloat(r.amount) || 0)), 0);
      const unearnedAdvanceLiability = receipts.filter(r => r.is_advance).reduce((sum, r) => sum + (parseFloat(r.unallocated_balance) || 0), 0);
      const totalIncurredCost = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      const operatingProfit = earnedRevenue - totalIncurredCost;
      const profitMarginPercentage = earnedRevenue > 0 ? Math.round((operatingProfit / earnedRevenue) * 10000) / 100 : 0;

      return {
        success: true,
        project: prj,
        financials: {
          totalCashReceived,
          earnedRevenue,
          unearnedAdvanceLiability,
          totalIncurredCost,
          operatingProfit,
          profitMarginPercentage
        },
        milestones: this._getOfflineMilestones(prjId),
        recentProgress: this._getOfflineProgress(prjId)
      };
    }

    // Clients CRUD
    if (endpoint === '/clients' && method === 'GET') {
      return { success: true, clients: this._getOfflineClients() };
    }

    if (endpoint === '/clients' && method === 'POST' && data) {
      const clients = this._getOfflineClients();
      const newCli = {
        id: `cli_${Date.now()}`,
        name: data.name,
        company_name: data.company_name || null,
        phone: data.phone,
        email: data.email || null,
        billing_address: data.billing_address || null,
        gstin: data.gstin || null,
        pan: data.pan || null,
        project_count: 0,
        total_contract_value: 0
      };
      clients.unshift(newCli);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ddev_offline_clients', JSON.stringify(clients));
      }
      return { status: 201, success: true, client: newCli };
    }

    if (endpoint.startsWith('/clients/') && method === 'PUT' && data) {
      const cliId = endpoint.replace('/clients/', '');
      const clients = this._getOfflineClients();
      const cli = clients.find(c => c.id === cliId);
      if (cli) {
        Object.assign(cli, data);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('ddev_offline_clients', JSON.stringify(clients));
        }
        return { success: true, client: cli };
      }
      return { success: false, error: 'Client not found' };
    }

    if (endpoint.startsWith('/clients/') && method === 'DELETE') {
      const cliId = endpoint.replace('/clients/', '');
      const clients = this._getOfflineClients().filter(c => c.id !== cliId);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ddev_offline_clients', JSON.stringify(clients));
      }
      return { success: true, archivedId: cliId };
    }

    // Suppliers CRUD
    if (endpoint === '/suppliers') {
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('ddev_offline_suppliers') : null;
      let suppliers = stored ? JSON.parse(stored) : [];

      if (method === 'POST' && data) {
        const newSup = {
          id: `sup_${Date.now()}`,
          name: data.name,
          category: data.category || 'GENERAL',
          contact_person: data.contact_person || '',
          phone: data.phone || '',
          gstin: data.gstin || '',
          outstanding_dues: 0.00
        };
        suppliers.push(newSup);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('ddev_offline_suppliers', JSON.stringify(suppliers));
        }
        return { success: true, supplier: newSup };
      }

      return { success: true, suppliers };
    }

    if (endpoint === '/suppliers/invoices') {
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('ddev_offline_supplier_invoices') : null;
      let invoices = stored ? JSON.parse(stored) : [];

      if (method === 'POST' && data) {
        const total = parseFloat(data.totalAmount) || 0;
        const newInv = {
          id: `sinv_${Date.now()}`,
          invoice_number: data.invoiceNumber || `BILL-${Date.now().toString().slice(-4)}`,
          supplier_id: data.supplierId,
          supplier_name: data.supplierName || 'Material Vendor',
          project_id: data.projectId,
          project_name: data.projectName || 'Site Project',
          invoice_date: data.invoiceDate || new Date().toISOString().split('T')[0],
          due_date: data.dueDate || data.invoiceDate,
          subtotal: data.subtotal || total,
          tax_amount: data.taxAmount || 0,
          total_amount: total,
          paid_amount: 0.00,
          balance_amount: total,
          payment_status: 'UNPAID',
          notes: data.notes || ''
        };
        invoices.unshift(newInv);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('ddev_offline_supplier_invoices', JSON.stringify(invoices));
        }

        // Update supplier dues
        const sups = this._getOfflineSuppliers();
        const sup = sups.find(s => s.id === data.supplierId);
        if (sup) {
          sup.outstanding_dues = (parseFloat(sup.outstanding_dues) || 0) + total;
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('ddev_offline_suppliers', JSON.stringify(sups));
          }
        }

        return { success: true, invoice: newInv };
      }

      return { success: true, invoices };
    }

    if (endpoint === '/suppliers/payments' && method === 'POST') {
      const { supplierId, invoiceId, amount, paymentMode, referenceNumber, paymentDate, notes, accountId } = data || {};
      const amt = parseFloat(amount) || 0;

      // Update supplier dues
      const sups = this._getOfflineSuppliers();
      const sup = sups.find(s => s.id === supplierId);
      if (sup) {
        sup.outstanding_dues = Math.max(0, (parseFloat(sup.outstanding_dues) || 0) - amt);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('ddev_offline_suppliers', JSON.stringify(sups));
        }
      }

      // Update invoice if targeted
      if (invoiceId) {
        const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('ddev_offline_supplier_invoices') : null;
        let invs = stored ? JSON.parse(stored) : [];
        const inv = invs.find(i => i.id === invoiceId);
        if (inv) {
          inv.paid_amount = (parseFloat(inv.paid_amount) || 0) + amt;
          inv.balance_amount = Math.max(0, (parseFloat(inv.total_amount) || 0) - inv.paid_amount);
          inv.payment_status = inv.balance_amount <= 0 ? 'PAID' : 'PARTIALLY_PAID';
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('ddev_offline_supplier_invoices', JSON.stringify(invs));
          }
        }
      }

      // Deduct from bank/account balance if accountId specified
      if (accountId) {
        const accounts = this._getOfflineAccounts();
        const acc = accounts.find(a => a.id === accountId);
        if (acc) {
          acc.current_balance = Math.max(0, (parseFloat(acc.current_balance) || 0) - amt);
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('ddev_offline_accounts', JSON.stringify(accounts));
          }
        }
      }

      const payment = {
        id: `spay_${Date.now()}`,
        payment_number: `SPAY-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
        supplier_id: supplierId,
        invoice_id: invoiceId,
        amount: amt,
        payment_mode: paymentMode || 'BANK_TRANSFER',
        reference_number: referenceNumber || 'OFFLINE-REF',
        payment_date: paymentDate || new Date().toISOString().split('T')[0],
        notes: notes || 'Settlement payment recorded offline'
      };

      return { success: true, payment };
    }

    if (endpoint.startsWith('/suppliers/') && !endpoint.includes('invoices') && !endpoint.includes('payments') && method === 'PUT' && data) {
      const supId = endpoint.replace('/suppliers/', '');
      const suppliers = this._getOfflineSuppliers();
      const sup = suppliers.find(s => s.id === supId);
      if (sup) {
        Object.assign(sup, data);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('ddev_offline_suppliers', JSON.stringify(suppliers));
        }
        return { success: true, supplier: sup };
      }
      return { success: false, error: 'Supplier not found' };
    }

    if (endpoint.startsWith('/suppliers/') && !endpoint.includes('invoices') && !endpoint.includes('payments') && method === 'DELETE') {
      const supId = endpoint.replace('/suppliers/', '');
      const suppliers = this._getOfflineSuppliers().filter(s => s.id !== supId);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ddev_offline_suppliers', JSON.stringify(suppliers));
      }
      return { success: true, archivedId: supId };
    }

    if (endpoint.startsWith('/suppliers/invoices/') && endpoint.endsWith('/void') && method === 'POST') {
      const invId = endpoint.replace('/suppliers/invoices/', '').replace('/void', '');
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('ddev_offline_supplier_invoices') : null;
      let invoices = stored ? JSON.parse(stored) : [];
      const inv = invoices.find(i => i.id === invId);
      if (inv) {
        inv.payment_status = 'VOIDED';
        inv.balance_amount = 0;
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('ddev_offline_supplier_invoices', JSON.stringify(invoices));
        }
        const suppliers = this._getOfflineSuppliers();
        const sup = suppliers.find(s => s.id === inv.supplier_id);
        if (sup) {
          sup.outstanding_dues = Math.max(0, (parseFloat(sup.outstanding_dues) || 0) - (parseFloat(inv.total_amount) || 0));
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('ddev_offline_suppliers', JSON.stringify(suppliers));
          }
        }
      }
      return { success: true, voided: true };
    }

    // Expenses CRUD
    if (endpoint === '/expenses' && method === 'GET') {
      return { success: true, expenses: this._getOfflineExpenses() };
    }

    if (endpoint === '/expenses' && method === 'POST' && data) {
      const expenses = this._getOfflineExpenses();
      const newExp = {
        id: `exp_${Date.now()}`,
        expense_number: `EXP-${new Date().getFullYear()}-${(expenses.length + 1).toString().padStart(4, '0')}`,
        project_id: data.projectId,
        project_name: data.projectName || 'Site Project',
        category: data.category,
        amount: parseFloat(data.amount) || 0,
        paid_to: data.paidTo,
        expense_date: data.expenseDate || new Date().toISOString().split('T')[0],
        payment_mode: data.paymentMode || 'BANK_TRANSFER',
        account_name: data.accountName || 'Primary Account',
        notes: data.notes || ''
      };
      expenses.unshift(newExp);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ddev_offline_expenses', JSON.stringify(expenses));
      }
      return { status: 201, success: true, expense: newExp };
    }

    if (endpoint.startsWith('/expenses/') && endpoint.endsWith('/void') && method === 'POST') {
      const expId = endpoint.replace('/expenses/', '').replace('/void', '');
      let expenses = this._getOfflineExpenses().filter(e => e.id !== expId);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ddev_offline_expenses', JSON.stringify(expenses));
      }
      return { success: true, voided: true };
    }

    if (endpoint.startsWith('/expenses/') && !endpoint.endsWith('/void') && method === 'PUT' && data) {
      const expId = endpoint.replace('/expenses/', '');
      const expenses = this._getOfflineExpenses();
      const exp = expenses.find(e => e.id === expId);
      if (exp) {
        Object.assign(exp, data);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('ddev_offline_expenses', JSON.stringify(expenses));
        }
        return { success: true, expense: exp };
      }
      return { success: false, error: 'Expense not found' };
    }

    // Income / Receipts CRUD
    if (endpoint === '/income/receipts' && method === 'GET') {
      return { success: true, receipts: this._getOfflineReceipts() };
    }

    if (endpoint === '/income/receipts' && method === 'POST' && data) {
      const receipts = this._getOfflineReceipts();
      const amt = parseFloat(data.amount) || 0;
      const newRec = {
        id: `rec_${Date.now()}`,
        receipt_number: `REC-${new Date().getFullYear()}-${(receipts.length + 1).toString().padStart(4, '0')}`,
        project_id: data.projectId,
        project_name: data.projectName || 'Site Project',
        client_id: data.clientId,
        client_name: data.clientName || 'Direct Client',
        amount: amt,
        receipt_date: data.receiptDate || new Date().toISOString().split('T')[0],
        account_name: data.accountName || 'Primary Account',
        is_advance: data.isAdvance ? 1 : 0,
        allocated_amount: 0,
        unallocated_balance: data.isAdvance ? amt : 0,
        notes: data.notes || ''
      };
      receipts.unshift(newRec);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ddev_offline_receipts', JSON.stringify(receipts));
      }
      return { status: 201, success: true, receipt: newRec };
    }

    if (endpoint.startsWith('/income/receipts/') && endpoint.endsWith('/void') && method === 'POST') {
      const recId = endpoint.replace('/income/receipts/', '').replace('/void', '');
      let receipts = this._getOfflineReceipts().filter(r => r.id !== recId);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ddev_offline_receipts', JSON.stringify(receipts));
      }
      return { success: true, voided: true };
    }

    // Milestones CRUD
    if (endpoint.startsWith('/milestones')) {
      const prjId = data?.projectId || 'default';
      const key = `ddev_offline_milestones_${prjId}`;
      const milestones = this._getOfflineMilestones(prjId);

      if (method === 'GET') {
        return { success: true, milestones };
      }

      if ((method === 'PATCH' || method === 'PUT') && data) {
        const mId = endpoint.replace('/milestones/', '');
        const m = milestones.find(item => item.id === mId);
        if (m) {
          Object.assign(m, data);
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(key, JSON.stringify(milestones));
          }
          return { success: true, milestone: m };
        }
        return { success: false, error: 'Milestone not found' };
      }

      if (method === 'DELETE') {
        const mId = endpoint.replace('/milestones/', '');
        const filtered = milestones.filter(item => item.id !== mId);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(key, JSON.stringify(filtered));
        }
        return { success: true, deletedId: mId };
      }
    }

    // Progress Reports (DPR) CRUD
    if (endpoint.startsWith('/progress')) {
      const prjId = data?.projectId || 'default';
      const key = `ddev_offline_progress_${prjId}`;
      const progress = this._getOfflineProgress(prjId);

      if (method === 'GET') {
        return { success: true, updates: progress };
      }

      if (method === 'POST' && data) {
        const newEntry = {
          id: `prog_${Date.now()}`,
          project_id: prjId,
          milestone_id: data.milestoneId || null,
          report_date: data.reportDate || new Date().toISOString().split('T')[0],
          completion_percentage: parseFloat(data.completionPercentage) || 0,
          site_notes: data.siteNotes || '',
          weather_condition: data.weatherCondition || 'Clear',
          workforce_count: parseInt(data.workforceCount, 10) || 0,
          delay_reason: data.delayReason || null,
          recorded_by: this.activeUser?.id || 'usr-owner-1'
        };
        progress.unshift(newEntry);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(key, JSON.stringify(progress));
        }
        return { status: 201, success: true, id: newEntry.id };
      }

      if (method === 'DELETE') {
        const progId = endpoint.replace('/progress/', '');
        const filtered = progress.filter(p => p.id !== progId);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(key, JSON.stringify(filtered));
        }
        return { success: true, deletedId: progId };
      }
    }

    // Documents CRUD
    if (endpoint.startsWith('/documents/') && method === 'DELETE') {
      const docId = endpoint.replace('/documents/', '');
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('ddev_offline_documents') : null;
      let docs = stored ? JSON.parse(stored) : [];
      docs = docs.filter(d => d.id !== docId);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ddev_offline_documents', JSON.stringify(docs));
      }
      return { success: true, deletedId: docId };
    }

    if (endpoint === '/documents') {
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('ddev_offline_documents') : null;
      let documents = stored ? JSON.parse(stored) : [];

      if (method === 'POST' && data) {
        const newDoc = {
          id: `doc_${Date.now()}`,
          file_name: data.fileName || 'Uploaded_Document.pdf',
          file_path: data.filePath || `/storage/documents/${data.fileName || 'doc.pdf'}`,
          document_type: data.documentType || 'OTHER',
          file_size: data.fileSize || 102400,
          mime_type: data.mimeType || 'application/pdf',
          sha256_hash: data.sha256Hash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          watermark_text: data.watermarkText || `D DEV ULTRA HOMES — CONFIDENTIAL — ${new Date().toISOString().split('T')[0]}`,
          ocr_status: data.documentType === 'INVOICE' || data.documentType === 'RECEIPT' ? 'PENDING' : 'NOT_APPLICABLE',
          project_id: data.projectId || null,
          created_at: new Date().toISOString()
        };
        documents.unshift(newDoc);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('ddev_offline_documents', JSON.stringify(documents));
        }
        return { success: true, document: newDoc };
      }

      return { success: true, documents };
    }

    if (endpoint === '/documents/watermark-svg') {
      const today = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
      return {
        success: true,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><style>.wm-t{font-family:sans-serif;fill:#0B192C;opacity:0.12;font-weight:800;text-anchor:middle;letter-spacing:0.15em;}.wm-s{font-family:sans-serif;fill:#D97706;opacity:0.18;font-weight:600;text-anchor:middle;letter-spacing:0.1em;}</style><g transform="translate(400, 300) rotate(-35)"><text y="-35" class="wm-t" font-size="42">D DEV ULTRA HOMES</text><text y="15" class="wm-s" font-size="22">BUILDING YOUR DREAMS</text><text y="50" class="wm-t" font-size="16">CONFIDENTIAL &amp; PROPRIETARY • ${today}</text></g></svg>`
      };
    }

    // OCR Reviews
    if (endpoint === '/ocr/reviews') {
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('ddev_offline_ocr_reviews') : null;
      let reviews = stored ? JSON.parse(stored) : [];
      return { success: true, reviews };
    }

    if (endpoint === '/ocr/extract' && method === 'POST') {
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('ddev_offline_ocr_reviews') : null;
      let reviews = stored ? JSON.parse(stored) : [];
      const newRev = {
        id: `ocr_${Date.now()}`,
        document_id: data.documentId,
        verification_status: 'UNVERIFIED',
        raw_extracted_text: data.rawText || '',
        extractedFields: data.provisionalFields || {
          invoiceNumber: `INV-${Date.now().toString().slice(-4)}`,
          totalAmount: 0,
          date: new Date().toISOString().split('T')[0]
        },
        verifiedFields: null,
        created_at: new Date().toISOString()
      };
      reviews.unshift(newRev);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ddev_offline_ocr_reviews', JSON.stringify(reviews));
      }

      // Update doc ocr_status to EXTRACTED
      const docRes = this._offlineFallback('/documents', 'GET', null);
      const docs = docRes.documents || [];
      const doc = docs.find(d => d.id === data.documentId);
      if (doc) {
        doc.ocr_status = 'EXTRACTED';
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('ddev_offline_documents', JSON.stringify(docs));
        }
      }

      return { success: true, review: newRev };
    }

    if (endpoint === '/ocr/verify' && method === 'POST') {
      const { reviewId, action, verifiedFields, notes, financialAction } = data || {};
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('ddev_offline_ocr_reviews') : null;
      let reviews = stored ? JSON.parse(stored) : [];
      const rev = reviews.find(r => r.id === reviewId);

      if (rev) {
        rev.verification_status = action;
        rev.verified_fields_json = JSON.stringify(verifiedFields || {});
        rev.verifiedFields = verifiedFields;
        rev.verification_notes = notes;
        rev.verified_at = new Date().toISOString();
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('ddev_offline_ocr_reviews', JSON.stringify(reviews));
        }

        // Update doc
        const docRes = this._offlineFallback('/documents', 'GET', null);
        const docs = docRes.documents || [];
        const doc = docs.find(d => d.id === rev.document_id);
        if (doc) {
          doc.ocr_status = action === 'REJECTED' ? 'REJECTED' : 'HUMAN_VERIFIED';
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('ddev_offline_documents', JSON.stringify(docs));
          }
        }

        // If financial action requested, record invoice
        if (action !== 'REJECTED' && financialAction === 'SUPPLIER_INVOICE' && verifiedFields) {
          this._offlineFallback('/suppliers/invoices', 'POST', {
            invoiceNumber: verifiedFields.invoiceNumber,
            supplierId: verifiedFields.supplierId || 'sup-1',
            projectId: verifiedFields.projectId,
            invoiceDate: verifiedFields.date,
            totalAmount: verifiedFields.totalAmount,
            notes: `[OCR-Verified] ${notes || ''}`
          });
        }
      }

      return { success: true, review: rev };
    }

    // Company Settings
    if (endpoint === '/settings/company') {
      if (method === 'PUT' && data) {
        const company = this._getOfflineCompany();
        Object.assign(company, data);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('ddev_offline_company', JSON.stringify(company));
        }
        return { success: true, company };
      }

      return {
        success: true,
        company: this._getOfflineCompany(),
        accounts: this._getOfflineAccounts()
      };
    }

    // Financial Account update
    if (endpoint.startsWith('/settings/accounts/') && method === 'PUT' && data) {
      const accId = endpoint.replace('/settings/accounts/', '');
      const accounts = this._getOfflineAccounts();
      const acc = accounts.find(a => a.id === accId);
      if (!acc) {
        return { success: false, error: 'Account not found' };
      }
      if (!data.account_name || !data.account_name.trim()) {
        return { success: false, error: 'Account name cannot be blank' };
      }
      const bal = parseFloat(data.current_balance);
      if (isNaN(bal) || bal < 0) {
        return { success: false, error: 'Current balance must be a non-negative number' };
      }
      if (data.branch_ifsc && data.branch_ifsc.trim() && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(data.branch_ifsc.trim())) {
        return { success: false, error: 'Invalid IFSC code format (must match ^[A-Z]{4}0[A-Z0-9]{6}$)' };
      }

      acc.account_name = data.account_name.trim();
      if (data.account_type) acc.account_type = data.account_type;
      acc.bank_name = data.bank_name !== undefined ? data.bank_name.trim() : acc.bank_name;
      acc.account_number = data.account_number !== undefined ? data.account_number.trim() : acc.account_number;
      acc.branch_ifsc = data.branch_ifsc ? data.branch_ifsc.trim().toUpperCase() : '';
      acc.current_balance = bal;
      if (data.is_active !== undefined) acc.is_active = data.is_active;
      acc.updated_at = new Date().toISOString();

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ddev_offline_accounts', JSON.stringify(accounts));
      }
      return { success: true, account: acc };
    }

    // Backup & Restore
    if (endpoint === '/backup/snapshot' && method === 'GET') {
      const exportedAt = new Date().toISOString();
      const tablesData = {
        company_settings: [this._getOfflineCompany()],
        financial_accounts: this._getOfflineAccounts(),
        projects: this._getOfflineProjects(),
        clients: this._getOfflineClients(),
        suppliers: this._getOfflineSuppliers(),
        supplier_invoices: typeof localStorage !== 'undefined' && localStorage.getItem('ddev_offline_supplier_invoices') ? JSON.parse(localStorage.getItem('ddev_offline_supplier_invoices')) : [],
        client_receipts: this._getOfflineReceipts(),
        expenses: this._getOfflineExpenses(),
        documents: typeof localStorage !== 'undefined' && localStorage.getItem('ddev_offline_documents') ? JSON.parse(localStorage.getItem('ddev_offline_documents')) : [],
        ocr_reviews: typeof localStorage !== 'undefined' && localStorage.getItem('ddev_offline_ocr_reviews') ? JSON.parse(localStorage.getItem('ddev_offline_ocr_reviews')) : [],
        quotations: typeof localStorage !== 'undefined' && localStorage.getItem('ddev_offline_quotations') ? JSON.parse(localStorage.getItem('ddev_offline_quotations')) : []
      };

      let totalRecords = 0;
      const tableCounts = {};
      for (const [tbl, rows] of Object.entries(tablesData)) {
        const count = Array.isArray(rows) ? rows.length : 0;
        tableCounts[tbl] = count;
        totalRecords += count;
      }

      const meta = {
        app: 'DDevUltraHome',
        version: '1.0.0',
        company: 'D DEV ULTRA HOMES',
        tagline: 'Building your dreams',
        exportedAt,
        totalRecords,
        tableCounts
      };

      const stableBody = JSON.stringify({ meta, data: tablesData });
      const dataHash = sha256Hex(stableBody);
      const payload = {
        meta,
        data: tablesData,
        dataHash
      };

      return {
        success: true,
        payload,
        serialized: JSON.stringify(payload, null, 2),
        dataHash,
        summary: {
          exportedAt,
          totalRecords,
          tableCounts,
          dataHash
        }
      };
    }

    if (endpoint === '/backup/restore' && method === 'POST') {
      const snapshot = data?.snapshot;
      let payload = snapshot;
      if (typeof snapshot === 'string') {
        try {
          payload = JSON.parse(snapshot);
        } catch (e) {
          return { success: false, error: `Invalid JSON format: ${e.message}` };
        }
      }

      if (!payload || !payload.meta || !payload.data) {
        return { success: false, error: 'Invalid snapshot structure. Expected "meta" and "data".' };
      }

      if (payload.dataHash) {
        const stableBody = JSON.stringify({ meta: payload.meta, data: payload.data });
        const computedHash = sha256Hex(stableBody);
        if (computedHash !== payload.dataHash) {
          return {
            success: false,
            error: `Integrity check failed: Data hash mismatch! (Expected: ${payload.dataHash.slice(0, 10)}..., Computed: ${computedHash.slice(0, 10)}...)`
          };
        }
      }

      if (typeof localStorage !== 'undefined') {
        if (payload.data.projects) localStorage.setItem('ddev_offline_projects', JSON.stringify(payload.data.projects));
        if (payload.data.clients) localStorage.setItem('ddev_offline_clients', JSON.stringify(payload.data.clients));
        if (payload.data.suppliers) localStorage.setItem('ddev_offline_suppliers', JSON.stringify(payload.data.suppliers));
        if (payload.data.supplier_invoices) localStorage.setItem('ddev_offline_supplier_invoices', JSON.stringify(payload.data.supplier_invoices));
        if (payload.data.client_receipts) localStorage.setItem('ddev_offline_receipts', JSON.stringify(payload.data.client_receipts));
        if (payload.data.expenses) localStorage.setItem('ddev_offline_expenses', JSON.stringify(payload.data.expenses));
        if (payload.data.financial_accounts) localStorage.setItem('ddev_offline_accounts', JSON.stringify(payload.data.financial_accounts));
        if (payload.data.documents) localStorage.setItem('ddev_offline_documents', JSON.stringify(payload.data.documents));
        if (payload.data.ocr_reviews) localStorage.setItem('ddev_offline_ocr_reviews', JSON.stringify(payload.data.ocr_reviews));
        if (payload.data.quotations) localStorage.setItem('ddev_offline_quotations', JSON.stringify(payload.data.quotations));
        if (payload.data.company_settings && payload.data.company_settings[0]) {
          localStorage.setItem('ddev_offline_company', JSON.stringify(payload.data.company_settings[0]));
        }
      }

      let totalRestored = 0;
      const tableCounts = {};
      for (const [tbl, rows] of Object.entries(payload.data)) {
        const count = Array.isArray(rows) ? rows.length : 0;
        tableCounts[tbl] = count;
        totalRestored += count;
      }

      return {
        success: true,
        result: {
          success: true,
          restoredAt: new Date().toISOString(),
          totalRestored,
          tableCounts
        }
      };
    }

    if (endpoint === '/backup/status') {
      return {
        success: true,
        status: {
          cloudProviders: [
            { cloud_provider: 'LOCAL_SNAPSHOT', sync_status: 'SUCCESS', last_synced_at: new Date().toISOString() }
          ],
          totalDocuments: this._getOfflineProjects().length
        }
      };
    }

    // Quotations CRUD
    if (endpoint === '/quotations') {
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('ddev_offline_quotations') : null;
      let quotations = stored ? JSON.parse(stored) : [];

      if (method === 'POST' && data) {
        const newQ = {
          id: `quo_off_${Date.now()}`,
          quotation_number: `QUO-${new Date().getFullYear()}-${(quotations.length + 1).toString().padStart(3, '0')}`,
          revision_number: 0,
          title: data.title || 'Construction Estimate',
          total_amount: data.items ? data.items.reduce((s, itm) => s + (parseFloat(itm.totalPrice) || 0), 0) : 0,
          status: 'DRAFT',
          created_at: new Date().toISOString(),
          client_name: data.client_name || 'Direct Client',
          ...data
        };
        quotations.unshift(newQ);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('ddev_offline_quotations', JSON.stringify(quotations));
        }
        return { success: true, quotation: newQ };
      }

      return { success: true, quotations };
    }

    if (endpoint.startsWith('/quotations/') && !endpoint.includes('html') && !endpoint.includes('revision') && !endpoint.includes('status') && method === 'PUT' && data) {
      const qId = endpoint.replace('/quotations/', '');
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('ddev_offline_quotations') : null;
      let quotes = stored ? JSON.parse(stored) : [];
      const q = quotes.find(item => item.id === qId);
      if (q) {
        Object.assign(q, data);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('ddev_offline_quotations', JSON.stringify(quotes));
        }
        return { success: true, quotation: q };
      }
      return { success: false, error: 'Quotation not found' };
    }

    if (endpoint.startsWith('/quotations/') && !endpoint.includes('html') && !endpoint.includes('revision') && !endpoint.includes('status') && method === 'DELETE') {
      const qId = endpoint.replace('/quotations/', '');
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('ddev_offline_quotations') : null;
      let quotes = stored ? JSON.parse(stored) : [];
      quotes = quotes.filter(item => item.id !== qId);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ddev_offline_quotations', JSON.stringify(quotes));
      }
      return { success: true, deletedId: qId };
    }

    if (endpoint.startsWith('/quotations/') && endpoint.endsWith('/status') && (method === 'POST' || method === 'PATCH') && data) {
      const qId = endpoint.replace('/quotations/', '').replace('/status', '');
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('ddev_offline_quotations') : null;
      let quotes = stored ? JSON.parse(stored) : [];
      const q = quotes.find(item => item.id === qId);
      if (q) {
        q.status = data.status;
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('ddev_offline_quotations', JSON.stringify(quotes));
        }
        return { success: true, quotation: q };
      }
      return { success: false, error: 'Quotation not found' };
    }

    if (endpoint.startsWith('/quotations/') && endpoint.endsWith('/html')) {
      const qId = endpoint.replace('/quotations/', '').replace('/html', '');
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('ddev_offline_quotations') : null;
      const quotes = stored ? JSON.parse(stored) : [];
      const q = quotes.find(item => item.id === qId) || {
        quotation_number: 'QUO-DRAFT',
        revision_number: 0,
        title: 'Construction Estimate',
        client_name: 'Direct Client',
        total_amount: 0
      };

      const company = this._getOfflineCompany();
      return {
        success: true,
        html: `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:30px;"><div style="border-bottom:2px solid #0B192C;padding-bottom:10px;"><h2 style="color:#0B192C;margin:0;">${company.company_name}</h2><p style="color:#D97706;font-weight:bold;margin:2px 0;">${company.tagline}</p><p style="color:#64748B;font-size:12px;margin:2px 0;">${company.address}</p></div><h3 style="margin-top:20px;">OFFICIAL ESTIMATE &amp; PROPOSAL: ${q.quotation_number} (Rev ${q.revision_number})</h3><p>Client: <strong>${q.client_name || 'Client'}</strong></p><p>Proposal: <strong>${q.title || 'Estimate'}</strong></p><p>Total Proposal: <strong style="color:#0B192C;font-size:16px;">₹${(parseFloat(q.total_amount) || 0).toLocaleString('en-IN')}</strong></p><p style="font-size:12px;color:#475569;">Schedule A Engineering Specifications &amp; Schedule B Milestone Payment Terms Apply.</p><div style="margin-top:50px;display:flex;justify-content:space-between;"><div style="border-top:1px solid #333;padding-top:6px;font-size:12px;">Authorized Builder Signatory</div><div style="border-top:1px solid #333;padding-top:6px;font-size:12px;">Client / House Owner Signature</div></div></body></html>`
      };
    }

    return { success: true, offline: true, endpoint, data };
  },

  _getOfflineCompany() {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('ddev_offline_company') : null;
    return stored ? JSON.parse(stored) : {
      id: 'company-main',
      company_name: 'D DEV ULTRA HOMES',
      tagline: 'Building your dreams',
      phone: '+91 98414 24271',
      email: 'info@ddevultrahomes.com',
      address: '6a MGR Nagar, 2nd Cross Street, Velachery, Chennai - 600042',
      gstin: '33AABCD1234E1Z5',
      pan: 'AABCD1234E'
    };
  },

  _getOfflineAccounts() {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('ddev_offline_accounts') : null;
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {}
    }
    return [
      { id: 'acc-hdfc-current', account_name: 'HDFC Construction Main Current A/C', account_type: 'BANK', bank_name: 'HDFC Bank', account_number: '', branch_ifsc: '', current_balance: 0.00, is_active: 1 },
      { id: 'acc-icici-escrow', account_name: 'ICICI Project Escrow A/C', account_type: 'BANK', bank_name: 'ICICI Bank', account_number: '', branch_ifsc: '', current_balance: 0.00, is_active: 1 },
      { id: 'acc-petty-site', account_name: 'Site Petty Cash Box', account_type: 'PETTY_CASH', bank_name: 'Cash in Hand', account_number: '', branch_ifsc: '', current_balance: 0.00, is_active: 1 }
    ];
  },

  _getOfflineProjects() {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('ddev_offline_projects') : null;
    return stored ? JSON.parse(stored) : [];
  },

  _getOfflineClients() {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('ddev_offline_clients') : null;
    return stored ? JSON.parse(stored) : [];
  },

  _getOfflineSuppliers() {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('ddev_offline_suppliers') : null;
    return stored ? JSON.parse(stored) : [];
  },

  _getOfflineExpenses() {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('ddev_offline_expenses') : null;
    return stored ? JSON.parse(stored) : [];
  },

  _getOfflineReceipts() {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('ddev_offline_receipts') : null;
    return stored ? JSON.parse(stored) : [];
  },

  _getOfflineMilestones(prjId) {
    const key = `ddev_offline_milestones_${prjId || 'default'}`;
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    return stored ? JSON.parse(stored) : [];
  },

  _getOfflineProgress(prjId) {
    const key = `ddev_offline_progress_${prjId || 'default'}`;
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    return stored ? JSON.parse(stored) : [];
  }
};
