import path from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();

const moneyScreens = [
  ['billing', 'src/components/views/BillingView.tsx'],
  ['invoice print', 'src/components/common/BillSummary.tsx'],
  ['reports', 'src/components/views/ReportsView.tsx'],
  ['dashboard', 'src/components/views/DashboardView.tsx'],
  ['waiter order', 'src/components/views/WaiterOrderView.tsx'],
  ['waiter order ticket', 'src/components/common/OrderTicket.tsx'],
  ['QR menu', 'src/components/customer/CustomerMenuPage.tsx'],
] as const;

describe('money formatting usage', () => {
  it.each(moneyScreens)('%s formats money through the shared helper', (_label, relativePath) => {
    const source = readFileSync(path.join(projectRoot, relativePath), 'utf8');
    expect(source, `${relativePath} must import formatMoney from utils/money`).toMatch(
      /import\s+\{[^}]*\bformatMoney\b[^}]*\}\s+from\s+['"][^'"]*utils\/money['"]/s
    );
    expect(source, `${relativePath} must call formatMoney`).toMatch(/\bformatMoney\s*\(/);
    expect(source, `${relativePath} must not format money inline`).not.toMatch(
      /(?:toLocaleString|Intl\.NumberFormat|\.toFixed\(\s*2\s*\)|\/\s*100)/s
    );
  });
});
