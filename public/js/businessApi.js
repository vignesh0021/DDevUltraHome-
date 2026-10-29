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
      return {
        success: true,
        suppliers: [
          { id: 'sup-1', name: 'Chennai TMT Traders (Fe550D Steel)', category: 'STEEL', outstanding_dues: 150000.00 },
          { id: 'sup-2', name: 'Dalmia & UltraTech Depot Velachery', category: 'CEMENT', outstanding_dues: 35000.00 },
          { id: 'sup-3', name: 'Kag & Anuj Tiles Gallery', category: 'OTHER', outstanding_dues: 45000.00 }
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

    return { success: true, offline: true, endpoint, data };
  }
};
