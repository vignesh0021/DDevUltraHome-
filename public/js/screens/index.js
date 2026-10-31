/**
 * DDevUltraHome — Screens Registry & Router
 */

import { DashboardScreen } from './dashboardScreen.js';
import { ProjectsScreen } from './projectsScreen.js';
import { ClientsScreen } from './clientsScreen.js';
import { QuotationsScreen } from './quotationsScreen.js';
import { IncomeScreen } from './incomeScreen.js';
import { ExpensesScreen } from './expensesScreen.js';
import { LabourScreen } from './labourScreen.js';
import { SuppliersScreen } from './suppliersScreen.js';
import { ProgressScreen } from './progressScreen.js';
import { DocumentsScreen } from './documentsScreen.js';
import { ReportsScreen } from './reportsScreen.js';
import { BackupScreen } from './backupScreen.js';
import { SettingsScreen } from './settingsScreen.js';
import { FinanceHubScreen } from './financeHubScreen.js';
import { DocsHubScreen } from './docsHubScreen.js';

export const SCREENS = {
  dashboard: DashboardScreen,
  projects: ProjectsScreen,
  clients: ClientsScreen,
  quotations: QuotationsScreen,
  income: IncomeScreen,
  expenses: ExpensesScreen,
  labour: LabourScreen,
  suppliers: SuppliersScreen,
  progress: ProgressScreen,
  documents: DocumentsScreen,
  reports: ReportsScreen,
  backup: BackupScreen,
  settings: SettingsScreen,
  finance: FinanceHubScreen,
  docs: DocsHubScreen
};

export class ScreenRouter {
  constructor(mountElement) {
    this.mountElement = mountElement;
    this.currentScreen = 'dashboard';
  }

  async navigate(screenKey) {
    // If routing to a sub-tab of finance or docs, route to the unified hub with that tab active
    if (['income', 'receipts'].includes(screenKey)) {
      FinanceHubScreen.setTab('receipts');
      this.currentScreen = 'income';
      await FinanceHubScreen.render(this.mountElement);
      return;
    }
    if (screenKey === 'expenses') {
      FinanceHubScreen.setTab('expenses');
      this.currentScreen = 'expenses';
      await FinanceHubScreen.render(this.mountElement);
      return;
    }
    if (['labour', 'attendance', 'wages'].includes(screenKey)) {
      FinanceHubScreen.setTab('labour');
      this.currentScreen = 'labour';
      await FinanceHubScreen.render(this.mountElement);
      return;
    }
    if (screenKey === 'suppliers') {
      FinanceHubScreen.setTab('suppliers');
      this.currentScreen = 'suppliers';
      await FinanceHubScreen.render(this.mountElement);
      return;
    }
    if (screenKey === 'quotations') {
      DocsHubScreen.setTab('quotes');
      this.currentScreen = 'quotations';
      await DocsHubScreen.render(this.mountElement);
      return;
    }
    if (screenKey === 'documents' || screenKey === 'vault' || screenKey === 'docs') {
      if (screenKey === 'vault') DocsHubScreen.setTab('vault');
      this.currentScreen = 'documents';
      await DocsHubScreen.render(this.mountElement);
      return;
    }
    if (screenKey === 'finance') {
      this.currentScreen = 'finance';
      await FinanceHubScreen.render(this.mountElement);
      return;
    }

    if (!SCREENS[screenKey]) {
      console.warn(`Unknown screen: ${screenKey}`);
      return;
    }
    this.currentScreen = screenKey;
    await SCREENS[screenKey].render(this.mountElement);
  }
}
