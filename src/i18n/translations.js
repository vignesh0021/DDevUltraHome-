/**
 * DDevUltraHome Bilingual Localization Module
 * Full English & Tamil (தமிழ்) Support for Civil Engineering & Scrap Operations
 */

export const TRANSLATIONS = {
  en: {
    appTitle: 'DDevUltraHome',
    tagline: 'Tamil Nadu Civil Engineering, Material Intelligence & Scrap Management',
    regionNotice: 'Tamil Nadu Focus • Chennai & All 38 Districts • IS 456 & PWD Standards',
    nav: {
      calculations: 'Engineering Calculations',
      materialRates: 'Material Rates (PWD & Market)',
      scrapRates: 'Scrap Valuation',
      boq: 'BOQ & Estimates',
      aiAssistant: 'Civil AI & Knowledge',
      projects: 'Projects & Backup'
    },
    actions: {
      calculate: 'Calculate Quantities',
      reset: 'Reset Fields',
      exportPdf: 'Print / Save PDF Report',
      exportCsv: 'Export CSV',
      saveEstimate: 'Save Estimate',
      lockRevision: 'Lock Revision',
      askAssistant: 'Ask Civil Engine'
    },
    common: {
      district: 'Select Tamil Nadu District',
      unit: 'Unit',
      quantity: 'Quantity',
      rate: 'Rate (₹)',
      amount: 'Amount (₹)',
      disclaimer: 'Engineering Disclaimer',
      freshness: 'Price Provenance & Freshness',
      assumptions: 'Assumptions & Standards'
    },
    civil: {
      concreteMix: 'Concrete Volume & Mix',
      rccElements: 'RCC Slabs, Beams & Columns',
      masonry: 'Brick & AAC Masonry',
      finishing: 'Plastering, Painting & Tiles',
      earthwork: 'Excavation & Backfill',
      bbs: 'Bar Bending Schedule (BBS)',
      waterTank: 'Water Tank & Sump',
      shuttering: 'Formwork & Centering',
      labour: 'Labour Norms & Wages'
    },
    scrap: {
      title: 'Scrap Metal & Material Valuation',
      grossWeight: 'Gross Scale Weight',
      tareWeight: 'Tare (Vehicle/Bin)',
      netWeight: 'Net Scale Weight',
      moistureDeduction: 'Moisture / Water (%)',
      impurityDeduction: 'Dirt / Slag / Oil (%)',
      insulationDeduction: 'Wire Sheath / Insulation (%)',
      acceptedWeight: 'Net Accepted Weight',
      transportDeduction: 'Transport Expenses',
      labourDeduction: 'Cutting & Handling',
      netPayout: 'Net Settlement Payout'
    }
  },
  ta: {
    appTitle: 'டிடெவ் அல்ட்ரா ஹோம்',
    tagline: 'தமிழ்நாடு சிவில் இன்ஜினியரிங், கட்டுமான விலை மற்றும் ஸ்கிராப் மேலாண்மை',
    regionNotice: 'தமிழ்நாடு முன்னுரிமை • சென்னை மற்றும் 38 மாவட்டங்கள் • IS 456 & PWD தரம்',
    nav: {
      calculations: 'கட்டுமான கணக்கீடுகள்',
      materialRates: 'பொருட்கள் விலை (PWD & சந்தை)',
      scrapRates: 'ஸ்கிராப் மதிப்பீடு',
      boq: 'மதிப்பீடு & BOQ',
      aiAssistant: 'சிவில் AI & வழிகாட்டி',
      projects: 'திட்டங்கள் & காப்பு'
    },
    actions: {
      calculate: 'அளவுகளைக் கணக்கிடு',
      reset: 'மீட்டமை',
      exportPdf: 'PDF அச்சிடு / சேமி',
      exportCsv: 'CSV ஏற்றுமதி',
      saveEstimate: 'மதிப்பீட்டை சேமி',
      lockRevision: 'பதிப்பை பூட்டு',
      askAssistant: 'கேள்வி கேளுங்கள்'
    },
    common: {
      district: 'தமிழ்நாடு மாவட்டத்தைத் தேர்ந்தெடுக்கவும்',
      unit: 'அலகு',
      quantity: 'அளவு',
      rate: 'விலை (₹)',
      amount: 'மொத்த தொகை (₹)',
      disclaimer: 'பொறியியல் பொறுப்புத் துறப்பு',
      freshness: 'விலை ஆதாரம் மற்றும் நம்பகத்தன்மை',
      assumptions: 'அனுமானங்கள் மற்றும் தரநிலைகள்'
    },
    civil: {
      concreteMix: 'கான்கிரீட் கலவை & கணக்கீடு',
      rccElements: 'ஆர்சிசி தளம், பீம் மற்றும் தூண்',
      masonry: 'செங்கல் மற்றும் ஆக் பிளாக் சுவர்',
      finishing: 'பூச்சு வேலை, வண்ணம் & டைல்ஸ்',
      earthwork: 'அஸ்திவாரம் மண் தோண்டுதல்',
      bbs: 'கம்பி வளைப்பு அட்டவணை (BBS)',
      waterTank: 'தண்ணீர் தொட்டி & நிலத்தடி சம்ப்',
      shuttering: 'சென்டரிங் & பலகை வேலை',
      labour: 'கூலி மற்றும் ஆட்கள் தேவை'
    },
    scrap: {
      title: 'ஸ்கிராப் பழைய இரும்பு & உலோக மதிப்பீடு',
      grossWeight: 'மொத்த எடை (Gross)',
      tareWeight: 'வாகன எடை (Tare)',
      netWeight: 'நிகர எடை (Net Scale)',
      moistureDeduction: 'ஈரப்பதம் கழிவு (%)',
      impurityDeduction: 'தூசி, அழுக்கு கழிவு (%)',
      insulationDeduction: 'வயர் தோல் / பிளாஸ்டிக் கழிவு (%)',
      acceptedWeight: 'ஏற்கப்பட்ட நிகர எடை',
      transportDeduction: 'வண்டி வாடகை கழிவு',
      labourDeduction: 'ஏற்று கூலி / வெட்டு கூலி',
      netPayout: 'வழங்க வேண்டிய நிகர பட்டுவாடா'
    }
  }
};

export class I18n {
  static get(lang = 'en') {
    return TRANSLATIONS[lang] || TRANSLATIONS['en'];
  }
}
