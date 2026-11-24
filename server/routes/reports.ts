import { Router } from 'express';
import { getDb } from '../db.ts';
import { pagination } from '../http.ts';
import { requirePermission } from '../middleware.ts';

export const reportsRouter = Router();

type Row = Record<string, any>;

function dashboardData() {
  const db = getDb();
  const latest = db
    .prepare('SELECT sales_date, sales, orders, vat, service_charge FROM daily_sales ORDER BY sales_date DESC LIMIT 1')
    .get() as Row | undefined;
  const weekly = db
    .prepare('SELECT COALESCE(SUM(sales), 0) AS revenue FROM (SELECT sales FROM daily_sales ORDER BY sales_date DESC LIMIT 7)')
    .get() as { revenue: number };
  const openOrders = db
    .prepare("SELECT COUNT(*) AS count FROM orders WHERE payment_status = 'unpaid'")
    .get() as { count: number };
  const occupiedTables = db
    .prepare("SELECT COUNT(*) AS count FROM tables WHERE status IN ('occupied', 'bill_pending')")
    .get() as { count: number };
  const lowStock = db
    .prepare('SELECT COUNT(*) AS count FROM ingredients WHERE stock <= low_stock_threshold')
    .get() as { count: number };
  return {
    todaySales: latest?.sales ?? 0,
    todayOrders: latest?.orders ?? 0,
    weeklyRevenue: weekly.revenue,
    openOrders: openOrders.count,
    occupiedTables: occupiedTables.count,
    lowStockCount: lowStock.count,
  };
}

reportsRouter.get('/dashboard', requirePermission('reports:read'), (_req, res) => {
  res.json(dashboardData());
});

reportsRouter.get('/daily-sales', requirePermission('reports:read'), (req, res) => {
  const { limit, offset } = pagination(req);
  res.json(
    getDb()
      .prepare(`
        SELECT sales_date, day, date_label, sales, orders, vat, service_charge
        FROM daily_sales ORDER BY sales_date DESC LIMIT ? OFFSET ?
      `)
      .all(limit, offset)
  );
});

reportsRouter.get('/top-items', requirePermission('reports:read'), (req, res) => {
  const { limit, offset } = pagination(req);
  res.json(
    getDb()
      .prepare(`
        SELECT mi.id AS menu_item_id, mi.name, SUM(oi.quantity) AS quantity,
          SUM(oi.line_total) AS revenue, COUNT(DISTINCT oi.order_id) AS orders
        FROM order_items oi JOIN menu_items mi ON mi.id = oi.menu_item_id
        WHERE oi.status != 'cancelled'
        GROUP BY mi.id, mi.name
        ORDER BY quantity DESC, revenue DESC
        LIMIT ? OFFSET ?
      `)
      .all(limit, offset)
  );
});

reportsRouter.get('/table-turnover', requirePermission('reports:read'), (req, res) => {
  const { limit, offset } = pagination(req);
  res.json(
    getDb()
      .prepare(`
        SELECT t.id AS table_id, t.number AS table_number, f.name AS floor,
          COUNT(CASE WHEN o.status = 'closed' AND o.payment_status = 'paid' THEN 1 END) AS completed_orders,
          COALESCE(SUM(CASE WHEN o.status = 'closed' AND o.payment_status = 'paid' THEN o.total END), 0) AS revenue
        FROM tables t
        JOIN floors f ON f.id = t.floor_id
        LEFT JOIN orders o ON o.table_id = t.id
        GROUP BY t.id, t.number, f.name
        ORDER BY completed_orders DESC, revenue DESC
        LIMIT ? OFFSET ?
      `)
      .all(limit, offset)
  );
});

reportsRouter.get('/low-stock', requirePermission('reports:read'), (_req, res) => {
  const db = getDb();
  const count = db
    .prepare('SELECT COUNT(*) AS count FROM ingredients WHERE stock <= low_stock_threshold')
    .get() as { count: number };
  const items = db
    .prepare(`
      SELECT id, name, unit, stock, low_stock_threshold FROM ingredients
      WHERE stock <= low_stock_threshold ORDER BY name LIMIT 100
    `)
    .all();
  res.json({ count: count.count, items });
});

reportsRouter.get('/', requirePermission('reports:read'), (_req, res) => {
  const db = getDb();
  res.json({
    ...dashboardData(),
    topItems: db
      .prepare(`
        SELECT mi.name, SUM(oi.quantity) AS quantity, SUM(oi.line_total) AS revenue
        FROM order_items oi JOIN menu_items mi ON mi.id = oi.menu_item_id
        WHERE oi.status != 'cancelled'
        GROUP BY mi.id, mi.name ORDER BY quantity DESC LIMIT 10
      `)
      .all(),
  });
});
