/**
 * DDevUltraHome — Screens Registry & Router
 */

import { DashboardScreen } from './dashboardScreen.js';
import { ProjectsScreen } from './projectsScreen.js';
import { ClientsScreen } from './clientsScreen.js';
import { QuotationsScreen } from './quotationsScreen.js';
import { IncomeScreen } from './incomeScreen.js';
import { ExpensesScreen } from './expensesScreen.js';
import { SuppliersScreen } from './suppliersScreen.js';
import { ProgressScreen } from './progressScreen.js';
import { DocumentsScreen } from './documentsScreen.js';
import { ReportsScreen } from './reportsScreen.js';
import { BackupScreen } from './backupScreen.js';
import { SettingsScreen } from './settingsScreen.js';

export const SCREENS = {
  dashboard: DashboardScreen,
  projects: ProjectsScreen,
  clients: ClientsScreen,
  quotations: QuotationsScreen,
  income: IncomeScreen,
  expenses: ExpensesScreen,
  suppliers: SuppliersScreen,
  progress: ProgressScreen,
  documents: DocumentsScreen,
  reports: ReportsScreen,
  backup: BackupScreen,
  settings: SettingsScreen
};

export class ScreenRouter {
  constructor(mountElement) {
    this.mountElement = mountElement;
    this.currentScreen = 'dashboard';
  }

  async navigate(screenKey) {
    if (!SCREENS[screenKey]) {
      console.warn(`Unknown screen: ${screenKey}`);
      return;
    }
    this.currentScreen = screenKey;
    await SCREENS[screenKey].render(this.mountElement);
  }
}
