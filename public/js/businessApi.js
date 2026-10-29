/**
 * DDevUltraHome — Business Client API & Dispatcher
 * Dual-Mode: Communicates with backend HTTP REST server or executes in-process offline
 */

export const BusinessApi = {
  activeUser: {
    id: 'usr-owner-1',
    email: 'owner@ddevultrahomes.com',
    fullName: 'Vignesh (Managing Director)',
    role: 'OWNER'
  },

  setActiveUser(user) {
    this.activeUser = user;
    localStorage.setItem('ddev_active_user', JSON.stringify(user));
  },

  getActiveUser() {
    const saved = localStorage.getItem('ddev_active_user');
    if (saved) {
      try {
        this.activeUser = JSON.parse(saved);
      } catch (e) {}
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
          'X-User-Id': this.activeUser.id,
          'X-User-Role': this.activeUser.role
        }
      };

      if (data && (method === 'POST' || method === 'PUT')) {
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

  // Fallback offline responses for APK when backend server is detached
  _offlineFallback(endpoint, method, data) {
    if (endpoint === '/dashboard/summary') {
      return {
        success: true,
        dashboard: {
          companyName: 'D DEV ULTRA HOMES',
          tagline: 'Building your dreams',
          liquidCash: 5250000.00,
          totalLiquidFunds: 5250000.00,
          accountsPayable: 185000.00,
          unearnedAdvanceLiabilities: 450000.00,
          netOperatingCashflow: 4615000.00,
          activeProjects: 3,
          totalClients: 4,
          pendingOcrCount: 1
        }
      };
    }

    if (endpoint === '/projects') {
      return {
        success: true,
        projects: [
          {
            id: 'prj-kun-01',
            project_code: 'PRJ-KUN-2026',
            name: 'Kundrathur Residence (G+1 Villa)',
            client_name: 'Mr. Thiumani P.',
            client_phone: '+91 98400 99887',
            site_address: 'Kundrathur, Chennai - 600069',
            district: 'Chennai',
            contract_value: 4227400.00,
            current_stage: 'STRUCTURE',
            status: 'ACTIVE'
          },
          {
            id: 'prj-gnd-01',
            project_code: 'PRJ-GND-01',
            name: 'Guindy Residence (G+1 Villa)',
            client_name: 'Mr. JAS Guindy',
            client_phone: '+91 98400 12345',
            site_address: 'Guindy, Chennai',
            district: 'Chennai',
            contract_value: 8500000.00,
            current_stage: 'FOUNDATION',
            status: 'ACTIVE'
          }
        ]
      };
    }

    if (endpoint.startsWith('/projects/')) {
      const prjId = endpoint.replace('/projects/', '');
      return {
        success: true,
        project: {
          id: prjId,
          project_code: prjId === 'prj-kun-01' ? 'PRJ-KUN-2026' : 'PRJ-GND-01',
          name: prjId === 'prj-kun-01' ? 'Kundrathur Residence (G+1 Villa)' : 'Guindy Residence (G+1 Villa)',
          client_name: prjId === 'prj-kun-01' ? 'Mr. Thiumani P.' : 'Mr. JAS Guindy',
          client_phone: prjId === 'prj-kun-01' ? '+91 98400 99887' : '+91 98400 12345',
          site_address: prjId === 'prj-kun-01' ? 'Kundrathur, Chennai - 600069' : 'Guindy, Chennai',
          district: 'Chennai',
          contract_value: prjId === 'prj-kun-01' ? 4227400.00 : 8500000.00,
          current_stage: prjId === 'prj-kun-01' ? 'STRUCTURE' : 'FOUNDATION',
          status: 'ACTIVE'
        },
        financials: {
          totalCashReceived: prjId === 'prj-kun-01' ? 800000.00 : 850000.00,
          earnedRevenue: prjId === 'prj-kun-01' ? 600000.00 : 0.00,
          unearnedAdvanceLiability: prjId === 'prj-kun-01' ? 200000.00 : 850000.00,
          totalIncurredCost: prjId === 'prj-kun-01' ? 515000.00 : 250000.00,
          operatingProfit: prjId === 'prj-kun-01' ? 85000.00 : 0.00,
          profitMarginPercentage: prjId === 'prj-kun-01' ? 14.17 : 0.00
        },
        milestones: [
          { id: 'ms-1', milestone_code: 'MS-01', title: 'Mobilization Advance', description: 'Advance cash deposit as per agreement clause 2', target_percentage: 18.92, invoice_amount: 800000.00, status: 'BILLED' },
          { id: 'ms-2', milestone_code: 'MS-02', title: 'Ground Floor Roof Level Brickwork', description: '9" flyash bricks in CM 1:5 & 4.5" partitions', target_percentage: 14.19, invoice_amount: 600000.00, status: 'COMPLETED' },
          { id: 'ms-3', milestone_code: 'MS-03', title: 'Ground Floor Roof Slab Concrete', description: '5" RCC framed slab, beams & columns', target_percentage: 16.56, invoice_amount: 700000.00, status: 'IN_PROGRESS' },
          { id: 'ms-4', milestone_code: 'MS-04', title: 'First Floor Roof Level Brickwork', description: 'First floor 9" & 4.5" brickwork up to roof beam', target_percentage: 14.19, invoice_amount: 600000.00, status: 'NOT_STARTED' },
          { id: 'ms-5', milestone_code: 'MS-05', title: 'First Floor Roof Slab Concrete', description: 'First floor 5" RCC roof slab & sunshades', target_percentage: 16.56, invoice_amount: 700000.00, status: 'NOT_STARTED' },
          { id: 'ms-6', milestone_code: 'MS-06', title: 'Outer & Inner Plastering', description: 'Internal CM 1:4 and external CM 1:5 plastering', target_percentage: 11.83, invoice_amount: 500000.00, status: 'NOT_STARTED' },
          { id: 'ms-7', milestone_code: 'MS-07', title: 'Plumbing, Painting & Electrical Fittings', description: 'Orbit 3-phase wiring, Parryware & Asian Paints', target_percentage: 7.10, invoice_amount: 300000.00, status: 'NOT_STARTED' },
          { id: 'ms-8', milestone_code: 'MS-08', title: 'Handover & Final Settlement', description: 'Pre-handover final snag clearance & delivery', target_percentage: 0.65, invoice_amount: 27400.00, status: 'NOT_STARTED' }
        ]
      };
    }

    if (endpoint === '/clients') {
      return {
        success: true,
        clients: [
          { id: 'cli-thiumani-01', name: 'Mr. Thiumani P.', phone: '+91 98400 99887', email: 'thiumani.p@gmail.com', project_count: 1 },
          { id: 'cli-1', name: 'Mr. JAS Guindy', phone: '+91 98400 12345', email: 'client.guindy@gmail.com', project_count: 1 },
          { id: 'cli-2', name: 'Arunachalam & Co', phone: '+91 98401 22334', email: 'arun@example.com', project_count: 1 }
        ]
      };
    }

    if (endpoint === '/suppliers') {
      const stored = localStorage.getItem('ddev_offline_suppliers');
      let suppliers = stored ? JSON.parse(stored) : [
        { id: 'sup-1', name: 'Chennai TMT Traders (Fe550D Steel)', category: 'STEEL', contact_person: 'Mr. Balan', phone: '+91 94440 99887', outstanding_dues: 150000.00 },
        { id: 'sup-2', name: 'Dalmia & UltraTech Depot Velachery', category: 'CEMENT', contact_person: 'Mr. Senthil', phone: '+91 98402 11223', outstanding_dues: 35000.00 },
        { id: 'sup-3', name: 'Kag & Anuj Tiles Gallery', category: 'TILES_SANITARY', contact_person: 'Mr. Murugan', phone: '+91 94450 33445', outstanding_dues: 45000.00 }
      ];

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
        localStorage.setItem('ddev_offline_suppliers', JSON.stringify(suppliers));
        return { success: true, supplier: newSup };
      }

      return { success: true, suppliers };
    }

    if (endpoint === '/suppliers/invoices') {
      const stored = localStorage.getItem('ddev_offline_supplier_invoices');
      let invoices = stored ? JSON.parse(stored) : [
        {
          id: 'sinv-01',
          invoice_number: 'INV-TMT-9920',
          supplier_id: 'sup-1',
          supplier_name: 'Chennai TMT Traders (Fe550D Steel)',
          project_id: 'prj-kun-01',
          project_name: 'Kundrathur Residence (G+1 Villa)',
          invoice_date: '2026-10-10',
          total_amount: 150000.00,
          paid_amount: 0.00,
          balance_amount: 150000.00,
          payment_status: 'UNPAID',
          notes: 'Schedule A Fe550D TMT Steel 16mm & 12mm delivery'
        },
        {
          id: 'sinv-02',
          invoice_number: 'INV-DLM-401',
          supplier_id: 'sup-2',
          supplier_name: 'Dalmia & UltraTech Depot Velachery',
          project_id: 'prj-kun-01',
          project_name: 'Kundrathur Residence (G+1 Villa)',
          invoice_date: '2026-10-15',
          total_amount: 35000.00,
          paid_amount: 0.00,
          balance_amount: 35000.00,
          payment_status: 'UNPAID',
          notes: 'UltraTech OPC 53 Grade Cement 70 bags'
        },
        {
          id: 'sinv-03',
          invoice_number: 'INV-KAG-112',
          supplier_id: 'sup-3',
          supplier_name: 'Kag & Anuj Tiles Gallery',
          project_id: 'prj-kun-01',
          project_name: 'Kundrathur Residence (G+1 Villa)',
          invoice_date: '2026-10-18',
          total_amount: 45000.00,
          paid_amount: 0.00,
          balance_amount: 45000.00,
          payment_status: 'UNPAID',
          notes: '4x2 Double Charged Vitrified Tiles advance delivery'
        }
      ];

      if (method === 'POST' && data) {
        const total = parseFloat(data.totalAmount) || 0;
        const newInv = {
          id: `sinv_${Date.now()}`,
          invoice_number: data.invoiceNumber || `BILL-${Date.now().toString().slice(-4)}`,
          supplier_id: data.supplierId,
          supplier_name: data.supplierName || 'Material Vendor',
          project_id: data.projectId,
          project_name: data.projectName || 'Kundrathur Residence',
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
        localStorage.setItem('ddev_offline_supplier_invoices', JSON.stringify(invoices));

        // Update supplier dues
        const supRes = this._offlineFallback('/suppliers', 'GET', null);
        const sups = supRes.suppliers || [];
        const sup = sups.find(s => s.id === data.supplierId);
        if (sup) {
          sup.outstanding_dues = (sup.outstanding_dues || 0) + total;
          localStorage.setItem('ddev_offline_suppliers', JSON.stringify(sups));
        }

        return { success: true, invoice: newInv };
      }

      return { success: true, invoices };
    }

    if (endpoint === '/suppliers/payments' && method === 'POST') {
      const { supplierId, invoiceId, amount, paymentMode, referenceNumber, paymentDate, notes } = data || {};
      const amt = parseFloat(amount) || 0;

      // Update supplier dues
      const supRes = this._offlineFallback('/suppliers', 'GET', null);
      const sups = supRes.suppliers || [];
      const sup = sups.find(s => s.id === supplierId);
      if (sup) {
        sup.outstanding_dues = Math.max(0, (sup.outstanding_dues || 0) - amt);
        localStorage.setItem('ddev_offline_suppliers', JSON.stringify(sups));
      }

      // Update invoice if targeted
      if (invoiceId) {
        const invRes = this._offlineFallback('/suppliers/invoices', 'GET', null);
        const invs = invRes.invoices || [];
        const inv = invs.find(i => i.id === invoiceId);
        if (inv) {
          inv.paid_amount = (inv.paid_amount || 0) + amt;
          inv.balance_amount = Math.max(0, inv.total_amount - inv.paid_amount);
          inv.payment_status = inv.balance_amount <= 0 ? 'PAID' : 'PARTIALLY_PAID';
          localStorage.setItem('ddev_offline_supplier_invoices', JSON.stringify(invs));
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

    if (endpoint === '/documents') {
      const stored = localStorage.getItem('ddev_offline_documents');
      let documents = stored ? JSON.parse(stored) : [
        {
          id: 'doc-kun-contract',
          file_name: 'Kundrathur_Construction_Deed_Signed.pdf',
          file_path: '/storage/documents/Kundrathur_Construction_Deed_Signed.pdf',
          document_type: 'CONTRACT',
          file_size: 2450000,
          mime_type: 'application/pdf',
          sha256_hash: 'c8f1e095a4325cbb4631bbde1566cf2c009c9535d8df28e21bc0473215266cb2',
          watermark_text: 'D DEV ULTRA HOMES — CONFIDENTIAL — 2026-04-04',
          ocr_status: 'HUMAN_VERIFIED',
          project_id: 'prj-kun-01',
          created_at: '2026-04-04 10:30:00'
        },
        {
          id: 'doc-kun-drawing',
          file_name: 'Kundrathur_Architectural_Floor_Plan_R0.pdf',
          file_path: '/storage/documents/Kundrathur_Architectural_Floor_Plan_R0.pdf',
          document_type: 'DRAWING',
          file_size: 4210000,
          mime_type: 'application/pdf',
          sha256_hash: '9a3d42bc7190d65b128562fe9f8b417efda531065ba23069138615d86ca4b967',
          watermark_text: 'D DEV ULTRA HOMES — CONFIDENTIAL — 2026-04-04',
          ocr_status: 'HUMAN_VERIFIED',
          project_id: 'prj-kun-01',
          created_at: '2026-04-04 11:15:00'
        },
        {
          id: 'doc-tmt-01',
          file_name: 'Chennai_TMT_Rebars_Tax_Invoice_9921.pdf',
          file_path: '/storage/uploads/Chennai_TMT_Rebars_Tax_Invoice_9921.pdf',
          document_type: 'INVOICE',
          file_size: 852000,
          mime_type: 'application/pdf',
          sha256_hash: '7b2e11893320f9c2d1b54a3e21c32a76f2d4e7a835b62b083e9b1f7d2358cb91',
          watermark_text: 'D DEV ULTRA HOMES — CONFIDENTIAL — 2026-10-25',
          ocr_status: 'PENDING',
          project_id: 'prj-kun-01',
          created_at: '2026-10-25 15:45:00'
        }
      ];

      if (method === 'POST' && data) {
        const newDoc = {
          id: `doc_${Date.now()}`,
          file_name: data.fileName || 'Uploaded_Document.pdf',
          file_path: data.filePath || `/storage/documents/${data.fileName}`,
          document_type: data.documentType || 'OTHER',
          file_size: data.fileSize || 102400,
          mime_type: data.mimeType || 'application/pdf',
          sha256_hash: data.sha256Hash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          watermark_text: data.watermarkText || `D DEV ULTRA HOMES — CONFIDENTIAL — ${new Date().toISOString().split('T')[0]}`,
          ocr_status: data.documentType === 'INVOICE' || data.documentType === 'RECEIPT' ? 'PENDING' : 'NOT_APPLICABLE',
          project_id: data.projectId || 'prj-kun-01',
          created_at: new Date().toISOString()
        };
        documents.unshift(newDoc);
        localStorage.setItem('ddev_offline_documents', JSON.stringify(documents));
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

    if (endpoint === '/ocr/reviews') {
      const stored = localStorage.getItem('ddev_offline_ocr_reviews');
      let reviews = stored ? JSON.parse(stored) : [
        {
          id: 'ocr-rev-01',
          document_id: 'doc-tmt-01',
          file_name: 'Chennai_TMT_Rebars_Tax_Invoice_9921.pdf',
          document_type: 'INVOICE',
          project_id: 'prj-kun-01',
          verification_status: 'UNVERIFIED',
          raw_extracted_text: 'CHENNAI TMT TRADERS\nTax Invoice No: INV-TMT-9921\nDate: 2026-10-25\nTotal: 159,300.00',
          extractedFields: {
            invoiceNumber: 'INV-TMT-9921',
            totalAmount: 159300.00,
            date: '2026-10-25',
            vendor: 'Chennai TMT Traders (Fe550D Steel)'
          },
          verifiedFields: null,
          created_at: '2026-10-25 15:45:00'
        }
      ];
      return { success: true, reviews };
    }

    if (endpoint === '/ocr/extract' && method === 'POST') {
      const stored = localStorage.getItem('ddev_offline_ocr_reviews');
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
      localStorage.setItem('ddev_offline_ocr_reviews', JSON.stringify(reviews));

      // Update doc ocr_status to EXTRACTED
      const docRes = this._offlineFallback('/documents', 'GET', null);
      const docs = docRes.documents || [];
      const doc = docs.find(d => d.id === data.documentId);
      if (doc) {
        doc.ocr_status = 'EXTRACTED';
        localStorage.setItem('ddev_offline_documents', JSON.stringify(docs));
      }

      return { success: true, review: newRev };
    }

    if (endpoint === '/ocr/verify' && method === 'POST') {
      const { reviewId, action, verifiedFields, notes, financialAction } = data || {};
      const stored = localStorage.getItem('ddev_offline_ocr_reviews');
      let reviews = stored ? JSON.parse(stored) : [];
      const rev = reviews.find(r => r.id === reviewId);

      if (rev) {
        rev.verification_status = action;
        rev.verified_fields_json = JSON.stringify(verifiedFields || {});
        rev.verifiedFields = verifiedFields;
        rev.verification_notes = notes;
        rev.verified_at = new Date().toISOString();
        localStorage.setItem('ddev_offline_ocr_reviews', JSON.stringify(reviews));

        // Update doc
        const docRes = this._offlineFallback('/documents', 'GET', null);
        const docs = docRes.documents || [];
        const doc = docs.find(d => d.id === rev.document_id);
        if (doc) {
          doc.ocr_status = action === 'REJECTED' ? 'REJECTED' : 'HUMAN_VERIFIED';
          localStorage.setItem('ddev_offline_documents', JSON.stringify(docs));
        }

        // If financial action requested, record invoice
        if (action !== 'REJECTED' && financialAction === 'SUPPLIER_INVOICE' && verifiedFields) {
          this._offlineFallback('/suppliers/invoices', 'POST', {
            invoiceNumber: verifiedFields.invoiceNumber,
            supplierId: verifiedFields.supplierId || 'sup-1',
            projectId: verifiedFields.projectId || 'prj-kun-01',
            invoiceDate: verifiedFields.date,
            totalAmount: verifiedFields.totalAmount,
            notes: `[OCR-Verified] ${notes || ''}`
          });
        }
      }

      return { success: true, review: rev };
    }

    if (endpoint === '/settings/company') {
      return {
        success: true,
        company: {
          id: 'company-main',
          company_name: 'D DEV ULTRA HOMES',
          tagline: 'Building your dreams',
          phone: '+91 98414 24271',
          email: 'info@ddevultrahomes.com',
          address: '6a MGR Nagar, 2nd Cross Street, Velachery, Chennai - 600042',
          gstin: '33AABCD1234E1Z5',
          pan: 'AABCD1234E'
        },
        accounts: [
          { id: 'acc-hdfc-current', account_name: 'HDFC Construction Main Current A/C', account_type: 'BANK', current_balance: 5250000.00, is_active: 1 },
          { id: 'acc-icici-escrow', account_name: 'ICICI Project Escrow A/C', account_type: 'BANK', current_balance: 1500000.00, is_active: 1 },
          { id: 'acc-petty-cash', account_name: 'Site Petty Cash Box', account_type: 'CASH', current_balance: 50000.00, is_active: 1 }
        ]
      };
    }

    if (endpoint === '/backup/status') {
      return {
        success: true,
        status: {
          cloudProviders: [
            { cloud_provider: 'LOCAL_SNAPSHOT', sync_status: 'SUCCESS', last_synced_at: new Date().toISOString() }
          ],
          totalDocuments: 3
        }
      };
    }

    if (endpoint === '/quotations') {
      const stored = localStorage.getItem('ddev_offline_quotations');
      let quotations = stored ? JSON.parse(stored) : [
        {
          id: 'quo-kun-01',
          quotation_number: 'QUO-2026-001',
          revision_number: 0,
          project_id: 'prj-kun-01',
          client_id: 'cli-thiumani-01',
          title: 'Residential Villa Construction — Kundrathur (G+1 Villa + Headroom)',
          project_name: 'Kundrathur Residence (G+1 Villa)',
          client_name: 'Mr. Thiumani P.',
          subtotal: 4227400.00,
          tax_rate: 0.00,
          total_amount: 4227400.00,
          status: 'DRAFT',
          created_at: '2026-04-04'
        }
      ];

      if (method === 'POST' && data) {
        const newQ = {
          id: `quo_off_${Date.now()}`,
          quotation_number: `QUO-2026-${(quotations.length + 1).toString().padStart(3, '0')}`,
          revision_number: 0,
          title: data.title || 'Construction Estimate',
          total_amount: data.items ? data.items.reduce((s, itm) => s + (parseFloat(itm.totalPrice) || 0), 0) : 0,
          status: 'DRAFT',
          created_at: new Date().toISOString(),
          client_name: 'Assigned Client',
          ...data
        };
        quotations.unshift(newQ);
        localStorage.setItem('ddev_offline_quotations', JSON.stringify(quotations));
        return { success: true, quotation: newQ };
      }

      return { success: true, quotations };
    }

    if (endpoint.startsWith('/quotations/') && endpoint.endsWith('/html')) {
      return {
        success: true,
        html: `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:30px;"><div style="border-bottom:2px solid #0B192C;padding-bottom:10px;"><h2 style="color:#0B192C;margin:0;">D DEV ULTRA HOMES</h2><p style="color:#D97706;font-weight:bold;margin:2px 0;">Building your dreams</p><p style="color:#64748B;font-size:12px;margin:2px 0;">6a MGR Nagar, 2nd Cross Street, Velachery, Chennai - 600042</p></div><h3 style="margin-top:20px;">OFFICIAL ESTIMATE &amp; PROPOSAL: QUO-2026-001 (Rev 0)</h3><p>Client: <strong>Mr. Thiumani P.</strong> (Anakaputhur, Chennai)</p><p>Project: <strong>Kundrathur Residence (G+1 Villa)</strong></p><p>Total Proposal: <strong style="color:#0B192C;font-size:16px;">₹42,27,400</strong></p><p style="font-size:12px;color:#475569;">Schedule A Engineering Specifications &amp; Schedule B 8-Stage Payment Terms Apply.</p><div style="margin-top:50px;display:flex;justify-content:space-between;"><div style="border-top:1px solid #333;padding-top:6px;font-size:12px;">Authorized Builder Signatory</div><div style="border-top:1px solid #333;padding-top:6px;font-size:12px;">Client / House Owner Signature</div></div></body></html>`
      };
    }

    return { success: true, offline: true, endpoint, data };
  }
};
