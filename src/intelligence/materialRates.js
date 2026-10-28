/**
 * Tamil Nadu Material Price Intelligence Module
 * Covers Official TN PWD Schedule of Rates (SOR) and Market Dealer Benchmarks
 * Across Chennai and Tamil Nadu Districts
 */

import { SafeMath } from '../engine/math.js';

export const TN_DISTRICTS = [
  'Ariyalur',
  'Chengalpattu',
  'Chennai',
  'Coimbatore',
  'Cuddalore',
  'Dharmapuri',
  'Dindigul',
  'Erode',
  'Kallakurichi',
  'Kanchipuram',
  'Kanyakumari',
  'Karur',
  'Krishnagiri',
  'Madurai',
  'Mayiladuthurai',
  'Nagapattinam',
  'Namakkal',
  'Nilgiris',
  'Perambalur',
  'Pudukkottai',
  'Ramanathapuram',
  'Ranipet',
  'Salem',
  'Sivaganga',
  'Tenkasi',
  'Thanjavur',
  'Theni',
  'Thoothukudi',
  'Tiruchirappalli',
  'Tirunelveli',
  'Tirupathur',
  'Tiruppur',
  'Tiruvallur',
  'Tiruvannamalai',
  'Tiruvarur',
  'Vellore',
  'Viluppuram',
  'Virudhunagar'
];

/**
 * Standard Material Catalog with Base Benchmarks
 * Baseline reference: Chennai (District index 1.0) with relative district logistics index
 */
export const DISTRICT_PRICE_INDEX = {
  'Ariyalur': 0.95,
  'Chengalpattu': 0.99,
  'Chennai': 1.00,
  'Coimbatore': 1.02,
  'Cuddalore': 0.97,
  'Dharmapuri': 0.97,
  'Dindigul': 0.96,
  'Erode': 0.97,
  'Kallakurichi': 0.97,
  'Kanchipuram': 0.98,
  'Kanyakumari': 1.03,
  'Karur': 0.96,
  'Krishnagiri': 0.98,
  'Madurai': 0.97,
  'Mayiladuthurai': 0.98,
  'Nagapattinam': 0.98,
  'Namakkal': 0.96,
  'Nilgiris': 1.08,
  'Perambalur': 0.95,
  'Pudukkottai': 0.97,
  'Ramanathapuram': 0.99,
  'Ranipet': 0.98,
  'Salem': 0.96,
  'Sivaganga': 0.97,
  'Tenkasi': 0.98,
  'Thanjavur': 0.98,
  'Theni': 0.98,
  'Thoothukudi': 0.99,
  'Tiruchirappalli': 0.97,
  'Tirunelveli': 0.97,
  'Tirupathur': 0.98,
  'Tiruppur': 1.01,
  'Tiruvallur': 0.98,
  'Tiruvannamalai': 0.97,
  'Tiruvarur': 0.98,
  'Vellore': 0.98,
  'Viluppuram': 0.97,
  'Villupuram': 0.97,
  'Virudhunagar': 0.97
};

export const RAW_MATERIAL_BENCHMARKS = [
  {
    id: 'MAT-CEM-OPC53',
    itemCode: 'M-0001-A',
    category: 'Cement',
    standardName: 'Cement OPC 53 Grade',
    spec: 'IS 12269 (UltraTech / Dalmia / Ramco / Coromandel)',
    unit: '50kg Bag',
    marketPrice: 385.00,
    officialSorPrice: 320.00,
    sorEffectiveDate: '2025-07-22',
    sorSource: 'TN PWD Schedule of Rates 2025-26 Vol-I (Code M-0001)',
    sorSourceUrl: 'https://tnpwdea.org/downloads.php?category_id=4',
    taxStatus: 'Exclusive of 18% GST (Basic Rate)',
    transportStatus: 'Ex-dealer yard / site delivery extra at actuals',
    observedDate: '2026-10-25',
    lastVerifiedDate: '2026-10-25',
    verificationStatus: 'VERIFIED_RECENTLY'
  },
  {
    id: 'MAT-CEM-PPC',
    itemCode: 'M-0001-B',
    category: 'Cement',
    standardName: 'Cement PPC (Portland Pozzolana)',
    spec: 'IS 1489 (Flyash based - Chettinad / Zuari / TANCEM)',
    unit: '50kg Bag',
    marketPrice: 355.00,
    officialSorPrice: 295.00,
    sorEffectiveDate: '2025-07-22',
    sorSource: 'TN PWD Schedule of Rates 2025-26 Vol-I',
    sorSourceUrl: 'https://tnpwdea.org/downloads.php?category_id=4',
    taxStatus: 'Exclusive of 18% GST',
    transportStatus: 'Ex-dealer yard',
    observedDate: '2026-10-25',
    lastVerifiedDate: '2026-10-25',
    verificationStatus: 'VERIFIED_RECENTLY'
  },
  {
    id: 'MAT-STL-FE550D',
    itemCode: 'M-0002-A',
    category: 'Steel',
    standardName: 'TMT Steel Rebar Fe 550D (Primary)',
    spec: 'IS 1786 (Tata Tiscon / SAIL / JSW Neosteel)',
    unit: 'Tonne (MT)',
    marketPrice: 64500.00,
    officialSorPrice: 55600.00,
    sorEffectiveDate: '2025-07-22',
    sorSource: 'TN PWD Schedule of Rates 2025-26 Vol-I (Code M-0002)',
    sorSourceUrl: 'https://tnpwdea.org/downloads.php?category_id=4',
    taxStatus: 'Exclusive of 18% GST',
    transportStatus: 'Delivered Chennai municipal limit',
    observedDate: '2026-10-24',
    lastVerifiedDate: '2026-10-24',
    verificationStatus: 'VERIFIED_RECENTLY'
  },
  {
    id: 'MAT-STL-FE500',
    itemCode: 'M-0002-B',
    category: 'Steel',
    standardName: 'TMT Steel Rebar Fe 500 (Secondary / Regional)',
    spec: 'IS 1786 (Kamachi / ARS / Pulkit)',
    unit: 'Tonne (MT)',
    marketPrice: 58500.00,
    officialSorPrice: 51200.00,
    sorEffectiveDate: '2025-07-22',
    sorSource: 'TN PWD Schedule of Rates 2025-26 Vol-I',
    sorSourceUrl: 'https://tnpwdea.org/downloads.php?category_id=4',
    taxStatus: 'Exclusive of 18% GST',
    transportStatus: 'Ex-mill / dealer yard',
    observedDate: '2026-10-24',
    lastVerifiedDate: '2026-10-24',
    verificationStatus: 'VERIFIED_RECENTLY'
  },
  {
    id: 'MAT-SND-MSAND-C',
    itemCode: 'M-0010-A',
    category: 'Sand',
    standardName: 'Manufactured Sand (M-Sand for Concreting)',
    spec: 'Zone-II Graded Crushed Granite Stone',
    unit: 'cft (Cu.Ft)',
    marketPrice: 58.00,
    officialSorPrice: 42.00,
    sorEffectiveDate: '2025-07-22',
    sorSource: 'TN PWD Schedule of Rates 2025-26 Vol-I',
    sorSourceUrl: 'https://tnpwdea.org/downloads.php?category_id=4',
    taxStatus: 'Inclusive of 5% GST & Seigniorage Fee',
    transportStatus: 'Per load basis (1 Unit = 100 cft = ₹5,800)',
    observedDate: '2026-10-26',
    lastVerifiedDate: '2026-10-26',
    verificationStatus: 'VERIFIED_RECENTLY'
  },
  {
    id: 'MAT-SND-PSAND',
    itemCode: 'M-0010-B',
    category: 'Sand',
    standardName: 'Plastering Sand (P-Sand washed)',
    spec: 'Sub-150 micron washed fine sand for wall plastering',
    unit: 'cft (Cu.Ft)',
    marketPrice: 65.00,
    officialSorPrice: 48.00,
    sorEffectiveDate: '2025-07-22',
    sorSource: 'TN PWD Schedule of Rates 2025-26 Vol-I',
    sorSourceUrl: 'https://tnpwdea.org/downloads.php?category_id=4',
    taxStatus: 'Inclusive of GST',
    transportStatus: 'Per load (1 Unit = 100 cft = ₹6,500)',
    observedDate: '2026-10-26',
    lastVerifiedDate: '2026-10-26',
    verificationStatus: 'VERIFIED_RECENTLY'
  },
  {
    id: 'MAT-AGG-20MM',
    itemCode: 'M-0015-A',
    category: 'Aggregate',
    standardName: 'Blue Metal Granite Jelly 20mm',
    spec: 'Hard Broken Granite Stone (HBGS) graded for RCC',
    unit: 'cft (Cu.Ft)',
    marketPrice: 44.00,
    officialSorPrice: 34.00,
    sorEffectiveDate: '2025-07-22',
    sorSource: 'TN PWD Schedule of Rates 2025-26 Vol-I (HBGS Jelly)',
    sorSourceUrl: 'https://tnpwdea.org/downloads.php?category_id=4',
    taxStatus: 'Inclusive of GST & Quarry Seigniorage',
    transportStatus: 'Per load (1 Unit = 100 cft = ₹4,400)',
    observedDate: '2026-10-26',
    lastVerifiedDate: '2026-10-26',
    verificationStatus: 'VERIFIED_RECENTLY'
  },
  {
    id: 'MAT-BRK-COUNTRY',
    itemCode: 'M-0020-A',
    category: 'Bricks',
    standardName: 'Red Country Wire-Cut Brick (9"x4.25"x2.75")',
    spec: 'Kiln burned red clay chamber bricks',
    unit: '1 No (Piece)',
    marketPrice: 11.50,
    officialSorPrice: 8.50,
    sorEffectiveDate: '2025-07-22',
    sorSource: 'TN PWD Schedule of Rates 2025-26 Vol-I',
    sorSourceUrl: 'https://tnpwdea.org/downloads.php?category_id=4',
    taxStatus: 'Exclusive of 12% GST',
    transportStatus: 'Unloading charges extra at site',
    observedDate: '2026-10-23',
    lastVerifiedDate: '2026-10-23',
    verificationStatus: 'VERIFIED_RECENTLY'
  },
  {
    id: 'MAT-BRK-FLYASH',
    itemCode: 'M-0020-B',
    category: 'Bricks',
    standardName: 'Fly-Ash Brick (230x110x70mm)',
    spec: 'Compressed cement-flyash masonry brick',
    unit: '1 No (Piece)',
    marketPrice: 7.20,
    officialSorPrice: 5.80,
    sorEffectiveDate: '2025-07-22',
    sorSource: 'TN PWD Schedule of Rates 2025-26 Vol-I',
    sorSourceUrl: 'https://tnpwdea.org/downloads.php?category_id=4',
    taxStatus: 'Exclusive of 5% GST',
    transportStatus: 'Ex-factory truckload',
    observedDate: '2026-10-23',
    lastVerifiedDate: '2026-10-23',
    verificationStatus: 'VERIFIED_RECENTLY'
  },
  {
    id: 'MAT-BLK-AAC150',
    itemCode: 'M-0025-A',
    category: 'AAC Blocks',
    standardName: 'AAC Block 600x200x150mm (6-inch)',
    spec: 'Autoclaved Aerated Concrete Grade-1 IS 2185 Part 3',
    unit: '1 No (Piece)',
    marketPrice: 68.00,
    officialSorPrice: 56.00,
    sorEffectiveDate: '2025-07-22',
    sorSource: 'TN PWD Schedule of Rates 2025-26 Vol-I',
    sorSourceUrl: 'https://tnpwdea.org/downloads.php?category_id=4',
    taxStatus: 'Exclusive of 18% GST',
    transportStatus: 'Palletized delivered site',
    observedDate: '2026-10-20',
    lastVerifiedDate: '2026-10-20',
    verificationStatus: 'VERIFIED_RECENTLY'
  },
  {
    id: 'MAT-RMC-M20',
    itemCode: 'M-0030-A',
    category: 'RMC',
    standardName: 'Ready-Mix Concrete M20 Grade',
    spec: 'IS 4926 with 120mm slump, pumpable mix',
    unit: 'm³ (Cu.Meter)',
    marketPrice: 4200.00,
    officialSorPrice: 3600.00,
    sorEffectiveDate: '2025-07-22',
    sorSource: 'TN PWD Schedule of Rates 2025-26 Vol-I',
    sorSourceUrl: 'https://tnpwdea.org/downloads.php?category_id=4',
    taxStatus: 'Exclusive of 18% GST',
    transportStatus: 'Transit mixer within 20km radius, concrete pump extra',
    observedDate: '2026-10-22',
    lastVerifiedDate: '2026-10-22',
    verificationStatus: 'VERIFIED_RECENTLY'
  },
  {
    id: 'MAT-RMC-M25',
    itemCode: 'M-0030-B',
    category: 'RMC',
    standardName: 'Ready-Mix Concrete M25 Grade',
    spec: 'IS 4926 design mix with approved chemical admixtures',
    unit: 'm³ (Cu.Meter)',
    marketPrice: 4500.00,
    officialSorPrice: 3850.00,
    sorEffectiveDate: '2025-07-22',
    sorSource: 'TN PWD Schedule of Rates 2025-26 Vol-I',
    sorSourceUrl: 'https://tnpwdea.org/downloads.php?category_id=4',
    taxStatus: 'Exclusive of 18% GST',
    transportStatus: 'Transit mixer delivery within service zone',
    observedDate: '2026-10-22',
    lastVerifiedDate: '2026-10-22',
    verificationStatus: 'VERIFIED_RECENTLY'
  }
];

export class MaterialPriceIntelligence {
  /**
   * Determine freshness label according to observed date and source type
   */
  static getFreshnessBadge(observedDateStr, isOfficialSor = false, now = new Date()) {
    if (isOfficialSor) {
      return {
        code: 'OFFICIAL_SOR',
        label: 'Official SOR Reference',
        color: '#0d6efd',
        isStale: false
      };
    }

    if (!observedDateStr) {
      return {
        code: 'UNVERIFIED',
        label: 'Unverified / Missing',
        color: '#dc3545',
        isStale: true
      };
    }

    const obs = new Date(observedDateStr);
    const diffDays = Math.max(0, Math.floor((now.getTime() - obs.getTime()) / (1000 * 60 * 60 * 24)));

    if (diffDays <= 7) {
      return {
        code: 'VERIFIED_RECENTLY',
        label: `Verified Recently (${diffDays === 0 ? 'Today' : `${diffDays}d ago`})`,
        color: '#198754',
        isStale: false
      };
    } else if (diffDays <= 30) {
      return {
        code: 'OLDER_REFERENCE',
        label: `Older Reference (${diffDays}d ago)`,
        color: '#ffc107',
        isStale: false
      };
    } else {
      return {
        code: 'STALE',
        label: `Stale Rate (${diffDays}d ago)`,
        color: '#dc3545',
        isStale: true
      };
    }
  }

  /**
   * Get material rates customized for specific Tamil Nadu district
   */
  static getRatesForDistrict(districtName = 'Chennai') {
    const dName = TN_DISTRICTS.includes(districtName) ? districtName : 'Chennai';
    const index = DISTRICT_PRICE_INDEX[dName] || 1.0;

    return RAW_MATERIAL_BENCHMARKS.map(item => {
      const adjustedMarketPrice = SafeMath.round(item.marketPrice * index, 2);
      const freshness = this.getFreshnessBadge(item.observedDate, false);
      const sorFreshness = this.getFreshnessBadge(item.sorEffectiveDate, true);

      return {
        ...item,
        district: dName,
        districtFactor: index,
        marketPrice: adjustedMarketPrice,
        freshness,
        sorFreshness,
        formattedMarketPrice: SafeMath.formatINR(adjustedMarketPrice),
        formattedSorPrice: SafeMath.formatINR(item.officialSorPrice)
      };
    });
  }

  /**
   * Query single material item with provenance
   */
  static getMaterialById(materialId, districtName = 'Chennai') {
    const list = this.getRatesForDistrict(districtName);
    return list.find(m => m.id === materialId) || null;
  }
}
