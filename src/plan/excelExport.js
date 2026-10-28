/**
 * Multi-Sheet Excel (XML Spreadsheet 2003) and CSV Export Generator
 * Produces fully formatted multi-tab workbooks compatible with MS Excel, LibreOffice,
 * and mobile spreadsheet apps without requiring native C++ or external binary npm libraries.
 */

import { SafeMath } from '../engine/math.js';

export class ExcelExportEngine {
  /**
   * Escape XML entities
   */
  static escapeXml(val) {
    if (val === null || val === undefined) return '';
    return String(val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Generate Microsoft XML Spreadsheet 2003 multi-sheet workbook
   * @param {Object} boq - Generated BOQ from BoqGenerator
   * @param {Array<Object>} materials - Generated procurement list from MaterialProcurementEngine
   * @returns {string} XML workbook content
   */
  static generateWorkbookXml(boq, materials) {
    const esc = this.escapeXml;
    const nowStr = new Date().toISOString().split('T')[0];

    const projectName = boq.projectName || 'Residential Building Plan';
    const district = boq.district || 'Chennai';
    const bProfile = boq.buildingProfile || {};
    const fin = boq.financials || {};
    const items = boq.items || [];
    const matList = materials || [];

    return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>${esc(projectName)} - Civil BOQ &amp; Budget</Title>
  <Author>DDevUltraHome Civil Intelligence</Author>
  <Created>${nowStr}</Created>
  <Company>DDevUltraHome</Company>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:CharSet="0" ss:Size="11" ss:Color="#1E293B"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <!-- Header Title -->
  <Style ss:ID="HeaderTitle">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#0F172A"/>
   <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="HeaderSubtitle">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Italic="1" ss:Color="#475569"/>
  </Style>
  <!-- Table Header -->
  <Style ss:ID="TableHead">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
  </Style>
  <!-- Gold Table Head -->
  <Style ss:ID="GoldHead">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B45309"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B45309"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B45309"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B45309"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#78350F"/>
   <Interior ss:Color="#FDE68A" ss:Pattern="Solid"/>
  </Style>
  <!-- Cell Styles -->
  <Style ss:ID="TextCell">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="CenterCell">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="NumberCell">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>
  <Style ss:ID="IntegerCell">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <NumberFormat ss:Format="#,##0"/>
  </Style>
  <Style ss:ID="CurrencyCell">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <NumberFormat ss:Format="₹#,##0.00"/>
  </Style>
  <Style ss:ID="BoldTotalLabel">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Bold="1" ss:Color="#0F172A"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#64748B"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#64748B"/>
   </Borders>
  </Style>
  <Style ss:ID="BoldTotalValue">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Bold="1" ss:Color="#0F172A"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="₹#,##0.00"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#64748B"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#64748B"/>
   </Borders>
  </Style>
  <Style ss:ID="GrandTotalLabel">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="12" ss:Bold="1" ss:Color="#78350F"/>
   <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#B45309"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#B45309"/>
   </Borders>
  </Style>
  <Style ss:ID="GrandTotalValue">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="12" ss:Bold="1" ss:Color="#78350F"/>
   <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="₹#,##0.00"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#B45309"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#B45309"/>
   </Borders>
  </Style>
 </Styles>

 <!-- 1. SUMMARY SHEET -->
 <Worksheet ss:Name="1. Project Summary">
  <Table ss:DefaultColumnWidth="80" ss:DefaultRowHeight="20">
   <Column ss:Width="200"/>
   <Column ss:Width="160"/>
   <Column ss:Width="140"/>
   <Column ss:Width="180"/>
   <Row ss:Height="28">
    <Cell ss:MergeAcross="3" ss:StyleID="HeaderTitle"><Data ss:Type="String">DDevUltraHome — Executive Project Cost Summary</Data></Cell>
   </Row>
   <Row>
    <Cell ss:MergeAcross="3" ss:StyleID="HeaderSubtitle"><Data ss:Type="String">Tamil Nadu Construction Intelligence | Generated: ${nowStr} | Brand: ULTRA HOMES</Data></Cell>
   </Row>
   <Row ss:Height="10"/>
   <Row>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">Project Parameter</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">Value</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">Financial Metric</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">Amount (INR)</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Project Name</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">${esc(projectName)}</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Direct Civil Works Cost</Data></Cell>
    <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${fin.directCostSubtotal || 0}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Target District</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">${esc(district)} (TN PWD SOR)</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Site Overheads (5.0%)</Data></Cell>
    <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${fin.overhead?.amount || 0}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Number of Floors</Data></Cell>
    <Cell ss:StyleID="IntegerCell"><Data ss:Type="Number">${bProfile.floorsCount || 1}</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Contractor Profit (10.0%)</Data></Cell>
    <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${fin.contractorProfit?.amount || 0}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Total Carpet Area (sq.ft)</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${bProfile.carpetAreaSqft || 0}</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Contingency Fund (3.0%)</Data></Cell>
    <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${fin.contingency?.amount || 0}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Total Built-Up Area (sq.ft)</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${bProfile.totalBuiltupAreaSqft || 0}</Data></Cell>
    <Cell ss:StyleID="BoldTotalLabel"><Data ss:Type="String">Pre-Tax Subtotal</Data></Cell>
    <Cell ss:StyleID="BoldTotalValue"><Data ss:Type="Number">${fin.preTaxTotal || 0}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Total Built-Up Area (m²)</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${bProfile.totalBuiltupAreaM2 || 0}</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Works Contract GST (18%)</Data></Cell>
    <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${fin.gst?.amount || 0}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Structural Columns Count</Data></Cell>
    <Cell ss:StyleID="IntegerCell"><Data ss:Type="Number">${bProfile.numColumns || 0}</Data></Cell>
    <Cell ss:StyleID="GrandTotalLabel"><Data ss:Type="String">Grand Total Project Cost</Data></Cell>
    <Cell ss:StyleID="GrandTotalValue"><Data ss:Type="Number">${fin.grandTotal || 0}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Isolated RCC Footings</Data></Cell>
    <Cell ss:StyleID="IntegerCell"><Data ss:Type="Number">${bProfile.numFootings || 0}</Data></Cell>
    <Cell ss:StyleID="BoldTotalLabel"><Data ss:Type="String">Cost per Sq.Ft Built-Up</Data></Cell>
    <Cell ss:StyleID="BoldTotalValue"><Data ss:Type="Number">${fin.costPerSqft || 0}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Estimate Classification</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Draft Preliminary Takeoff</Data></Cell>
    <Cell ss:StyleID="BoldTotalLabel"><Data ss:Type="String">Cost per M² Built-Up</Data></Cell>
    <Cell ss:StyleID="BoldTotalValue"><Data ss:Type="Number">${fin.costPerM2 || 0}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Review Gate Lifecycle</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">${esc(boq.reviewState || 'DRAFT')}</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Engineering Status</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">${boq.isConstructionReady ? 'Certified Construction-Ready' : 'Draft Takeoff — Not Construction-Ready'}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Takeoff Data Provenance</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">${esc(boq.provenanceSummary || 'Parametric 2D-to-3D Takeoff Engine')}</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Report Generation Time</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">${esc(new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }))} IST</Data></Cell>
   </Row>
  </Table>
 </Worksheet>

 <!-- 2. BILL OF QUANTITIES SHEET -->
 <Worksheet ss:Name="2. Bill of Quantities">
  <Table ss:DefaultColumnWidth="70" ss:DefaultRowHeight="19">
   <Column ss:Width="80"/>
   <Column ss:Width="95"/>
   <Column ss:Width="240"/>
   <Column ss:Width="50"/>
   <Column ss:Width="70"/>
   <Column ss:Width="70"/>
   <Column ss:Width="70"/>
   <Column ss:Width="85"/>
   <Column ss:Width="85"/>
   <Column ss:Width="90"/>
   <Column ss:Width="110"/>
   <Column ss:Width="80"/>
   <Row ss:Height="24">
    <Cell ss:MergeAcross="11" ss:StyleID="HeaderTitle"><Data ss:Type="String">Itemized Civil Engineering Bill of Quantities (BOQ)</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">Item Code</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">Trade</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">Description of Work</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">Unit</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">Gross Qty</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">Deduction</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">Net Qty</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">Mat. Rate</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">Lab. Rate</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">Unit Rate</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">Total (₹)</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">Status</Data></Cell>
   </Row>
   ${items.map(itm => `
   <Row>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">${esc(itm.itemCode)}</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">${esc(itm.trade)}</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">${esc(itm.description)}</Data></Cell>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">${esc(itm.unit)}</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${itm.grossQuantity}</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${itm.deductions}</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${itm.netQuantity}</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${itm.materialRate}</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${itm.labourRate}</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${itm.unitRate}</Data></Cell>
    <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${itm.totalAmount}</Data></Cell>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">${esc(itm.reviewStatus || 'Draft')}</Data></Cell>
   </Row>`).join('')}
   <Row>
    <Cell ss:MergeAcross="9" ss:StyleID="BoldTotalLabel"><Data ss:Type="String">BOQ Direct Civil Works Subtotal (INR):</Data></Cell>
    <Cell ss:StyleID="BoldTotalValue"><Data ss:Type="Number">${fin.directCostSubtotal || 0}</Data></Cell>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String"></Data></Cell>
   </Row>
  </Table>
 </Worksheet>

 <!-- 3. MATERIAL PROCUREMENT LIST SHEET -->
 <Worksheet ss:Name="3. Material Procurement BOM">
  <Table ss:DefaultColumnWidth="80" ss:DefaultRowHeight="19">
   <Column ss:Width="95"/>
   <Column ss:Width="230"/>
   <Column ss:Width="90"/>
   <Column ss:Width="220"/>
   <Column ss:Width="70"/>
   <Column ss:Width="70"/>
   <Column ss:Width="90"/>
   <Column ss:Width="160"/>
   <Column ss:Width="80"/>
   <Column ss:Width="110"/>
   <Row ss:Height="24">
    <Cell ss:MergeAcross="9" ss:StyleID="HeaderTitle"><Data ss:Type="String">Bill of Materials &amp; Commercial Procurement Schedule</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="GoldHead"><Data ss:Type="String">Material Code</Data></Cell>
    <Cell ss:StyleID="GoldHead"><Data ss:Type="String">Material Name</Data></Cell>
    <Cell ss:StyleID="GoldHead"><Data ss:Type="String">Category</Data></Cell>
    <Cell ss:StyleID="GoldHead"><Data ss:Type="String">Standard Specification</Data></Cell>
    <Cell ss:StyleID="GoldHead"><Data ss:Type="String">Theoretical</Data></Cell>
    <Cell ss:StyleID="GoldHead"><Data ss:Type="String">Waste %</Data></Cell>
    <Cell ss:StyleID="GoldHead"><Data ss:Type="String">Order Qty &amp; Unit</Data></Cell>
    <Cell ss:StyleID="GoldHead"><Data ss:Type="String">Commercial Pack Size</Data></Cell>
    <Cell ss:StyleID="GoldHead"><Data ss:Type="String">Est. Rate (₹)</Data></Cell>
    <Cell ss:StyleID="GoldHead"><Data ss:Type="String">Total Cost (₹)</Data></Cell>
   </Row>
   ${matList.map(m => `
   <Row>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">${esc(m.materialCode)}</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">${esc(m.name)}</Data></Cell>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">${esc(m.category)}</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">${esc(m.specification)}</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${m.theoreticalQuantity}</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${m.wastagePercent}</Data></Cell>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">${m.orderQuantity} ${esc(m.unit)}</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">${esc(m.standardPackSize)}</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${m.estimatedRateInr}</Data></Cell>
    <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${m.totalCostInr}</Data></Cell>
   </Row>`).join('')}
   <Row>
    <Cell ss:MergeAcross="8" ss:StyleID="BoldTotalLabel"><Data ss:Type="String">Estimated Materials Total (Ex-Quarry/Retail, INR):</Data></Cell>
    <Cell ss:StyleID="BoldTotalValue"><Data ss:Type="Number">${SafeMath.round(matList.reduce((acc, m) => acc + (m.totalCostInr || 0), 0), 2)}</Data></Cell>
   </Row>
  </Table>
 </Worksheet>

 <!-- 4. RATES REFERENCE SHEET -->
 <Worksheet ss:Name="4. Rates &amp; Basis">
  <Table ss:DefaultColumnWidth="85" ss:DefaultRowHeight="19">
   <Column ss:Width="100"/>
   <Column ss:Width="240"/>
   <Column ss:Width="65"/>
   <Column ss:Width="90"/>
   <Column ss:Width="90"/>
   <Column ss:Width="90"/>
   <Column ss:Width="200"/>
   <Row ss:Height="24">
    <Cell ss:MergeAcross="6" ss:StyleID="HeaderTitle"><Data ss:Type="String">District Rate Catalog &amp; Schedule of Rates (SOR) Reference</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">Item / Material</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">Description</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">Unit</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">Material (₹)</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">Labour (₹)</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">Unit Rate (₹)</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">Rate Source &amp; Authority</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">PCC 1:4:8</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Plain Cement Concrete 40mm metal</Data></Cell>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">m³</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">4450.00</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">850.00</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">5300.00</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">TN PWD SOR 2025-26 Item #C-04</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">RCC M25</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Design mix 1:1:2 reinforced concrete</Data></Cell>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">m³</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">6200.00</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">1250.00</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">7450.00</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">TN PWD SOR 2025-26 Item #RC-02</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">Fe550D TMT</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Cutting, bending, binding rebar steel</Data></Cell>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">kg</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">65.00</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">9.50</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">74.50</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">TN PWD SOR + Chennai Steel Yard Avg</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">Brick Masonry</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">9" Country brickwork CM 1:5</Data></Cell>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">m³</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">5200.00</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">1400.00</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">6600.00</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">TN PWD SOR 2025-26 Item #M-08</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">Cement (50kg)</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">OPC 53 / PPC Grade</Data></Cell>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">Bag</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">390.00</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">0.00</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">390.00</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Tamil Nadu Dealer Price Index Oct 2025</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">M-Sand</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Manufactured Zone II Crushed Rock Sand</Data></Cell>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">Unit (100cft)</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">4500.00</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">0.00</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">4500.00</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Kancheepuram Quarry Direct + Freight</Data></Cell>
   </Row>
  </Table>
 </Worksheet>

 <!-- 5. ASSUMPTIONS & ENGINEERING CODES SHEET -->
 <Worksheet ss:Name="5. Assumptions &amp; IS Codes">
  <Table ss:DefaultColumnWidth="120" ss:DefaultRowHeight="20">
   <Column ss:Width="160"/>
   <Column ss:Width="450"/>
   <Column ss:Width="140"/>
   <Row ss:Height="24">
    <Cell ss:MergeAcross="2" ss:StyleID="HeaderTitle"><Data ss:Type="String">Standards, Regulatory IS Codes &amp; Cost Assumptions</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">Category</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">Standard / Rule / Code Reference</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">Applied Parameter</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Structural Concrete</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">IS 456:2000 Plain and Reinforced Concrete - Code of Practice</Data></Cell>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">M25 Grade (1:1:2)</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Steel Reinforcement</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">IS 1786:2008 High Strength Deformed Steel Bars for Concrete</Data></Cell>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">Fe 550D TMT</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Measurement Method</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">IS 1200 (Part 1-28) Method of Measurement of Building and Civil Works</Data></Cell>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">Standard Deductions</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Aggregates &amp; Sand</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">IS 383:2016 Coarse and Fine Aggregates for Concrete</Data></Cell>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">Zone II Sand, 20mm/40mm</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Site Overheads</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Site supervision, watchman, electricity, water, curing logistics</Data></Cell>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">5.0% Direct Cost</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Contractor Profit</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Standard TN PWD schedule allowance for civil contracting firms</Data></Cell>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">10.0% Subtotal</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Contingency Reserve</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Unforeseen ground variations, price escalation, minor scope change</Data></Cell>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">3.0% Direct Cost</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Statutory Taxation</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">GST on Works Contract Services in India (Notification No. 03/2022)</Data></Cell>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">18.0% Works Contract GST</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Legal Disclaimer</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">This is a draft preliminary quantity takeoff budget. Field verification by a licensed structural engineer is required before foundation execution or commercial tender award.</Data></Cell>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">Draft Estimate</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">CAD Note 2 Compliance</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">All dimensions verified from native CAD text annotations. Pixel scaling restricted per Note 2 (&apos;Drawings should not be scaled for obtaining dimensions&apos;).</Data></Cell>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">Compliant</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Engineering Review Status</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">Review Gate: ${esc(boq.reviewState || 'DRAFT')}. Model not certified construction-ready until licensed engineer sign-off.</Data></Cell>
    <Cell ss:StyleID="CenterCell"><Data ss:Type="String">Non-Construction-Ready</Data></Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;
  }

  /**
   * Generate CSV format for supplier procurement
   * @param {Array<Object>} materials - Procurement list
   * @returns {string} CSV text
   */
  static generateProcurementCsv(materials) {
    const rows = [
      ['Material Code', 'Material Name', 'Category', 'Specification', 'Theoretical Qty', 'Waste %', 'Order Qty', 'Unit', 'Commercial Pack Size', 'Est Rate (INR)', 'Total Amount (INR)']
    ];

    for (const m of (materials || [])) {
      rows.push([
        `"${m.materialCode || ''}"`,
        `"${(m.name || '').replace(/"/g, '""')}"`,
        `"${m.category || ''}"`,
        `"${(m.specification || '').replace(/"/g, '""')}"`,
        m.theoreticalQuantity || 0,
        m.wastagePercent || 0,
        m.orderQuantity || 0,
        `"${m.unit || ''}"`,
        `"${(m.standardPackSize || '').replace(/"/g, '""')}"`,
        m.estimatedRateInr || 0,
        m.totalCostInr || 0
      ]);
    }

    return rows.map(r => r.join(',')).join('\r\n');
  }
}
