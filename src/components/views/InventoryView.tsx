import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, PackagePlus } from 'lucide-react';
import { api } from '../../api/client';
import { EmptyState, ErrorState, LoadingState } from '../common/AsyncState';
import { StatusBadge } from '../common/StatusBadge';
import type { Ingredient, MenuItem, RecipeLine, StockMovement } from '../../types/domain';

interface InventoryViewProps {
  canWrite: boolean;
  canEditRecipes: boolean;
}

export function InventoryView({ canWrite, canEditRecipes }: InventoryViewProps) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [stockAmount, setStockAmount] = useState('');
  const [stockNote, setStockNote] = useState('');
  const [recipeItemId, setRecipeItemId] = useState('');
  const [recipeLines, setRecipeLines] = useState<RecipeLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ingredientRows, movementRows] = await Promise.all([
        api.getIngredients(),
        api.getStockMovements(),
      ]);
      setIngredients(ingredientRows);
      setMovements(movementRows.slice(0, 10));
      setSelectedId((current) => current || ingredientRows[0]?.id || '');
      if (canEditRecipes) {
        const items = await api.getMenuItems();
        setMenuItems(items);
        setRecipeItemId((current) => current || items[0]?.id || '');
      }
    } catch {
      setError('Unable to load inventory.');
    } finally {
      setLoading(false);
    }
  }, [canEditRecipes]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!recipeItemId) {
      setRecipeLines([]);
      return;
    }
    let active = true;
    api
      .getRecipe(recipeItemId)
      .then((lines) => {
        if (active) setRecipeLines(lines);
      })
      .catch(() => {
        if (active) setRecipeLines([]);
      });
    return () => {
      active = false;
    };
  }, [recipeItemId]);

  const selected = ingredients.find((item) => item.id === selectedId) ?? null;

  async function restock() {
    if (!selected || !canWrite || busy) return;
    const quantity = Number(stockAmount);
    if (!Number.isFinite(quantity) || quantity === 0) {
      setError('Enter a non-zero quantity (use a negative number to use stock).');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.adjustStock(selected.id, quantity, stockNote.trim());
      setStockAmount('');
      setStockNote('');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to adjust stock.');
    } finally {
      setBusy(false);
    }
  }

  async function saveRecipe() {
    if (!recipeItemId || !canEditRecipes || busy) return;
    setBusy(true);
    setError('');
    try {
      await api.saveRecipe(
        recipeItemId,
        recipeLines.map((line) => ({ ingredientId: line.ingredientId, quantity: line.quantity }))
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save the recipe.');
    } finally {
      setBusy(false);
    }
  }

  function updateRecipeLine(ingredientId: string, quantity: number) {
    setRecipeLines((previous) =>
      previous.map((line) =>
        line.ingredientId === ingredientId ? { ...line, quantity } : line
      )
    );
  }

  function addRecipeLine() {
    const available = ingredients.find(
      (item) => !recipeLines.some((line) => line.ingredientId === item.id)
    );
    if (!available) return;
    setRecipeLines((previous) => [
      ...previous,
      {
        menuItemId: recipeItemId,
        ingredientId: available.id,
        ingredientName: available.name,
        unit: available.unit,
        quantity: 1,
        stock: available.stock,
        lowStockThreshold: available.lowStockThreshold,
      },
    ]);
  }

  if (loading) return <LoadingState label="Loading ingredients…" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[#111827]">Ingredient inventory</h1>
        <p className="mt-1 text-[13px] text-[#6B7280]">
          Track stock, restock ingredients and edit per-item recipes.
        </p>
      </div>

      {error && <ErrorState message={error} />}

      {ingredients.length === 0 ? (
        <EmptyState title="No ingredients yet" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="overflow-hidden rounded-[12px] border border-[#E6EAF0] bg-white">
            <div className="flex items-center justify-between border-b border-[#E6EAF0] px-5 py-3">
              <h2 className="text-[14px] font-semibold text-[#111827]">Ingredients</h2>
              <span className="text-[11px] text-[#9CA3AF]">{ingredients.length} items</span>
            </div>
            <ul className="divide-y divide-[#F1F4F8]">
              {ingredients.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors ${
                      selectedId === item.id ? 'bg-[#EEF2FF]' : 'hover:bg-[#F6F8FB]'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-[#111827]">
                        {item.name}
                      </span>
                      <span className="text-[11px] text-[#9CA3AF]">
                        {item.stock} {item.unit} · low at {item.lowStockThreshold}
                      </span>
                    </span>
                    {item.lowStock ? (
                      <StatusBadge status="low" />
                    ) : (
                      <span className="text-[12px] font-semibold tabular-nums text-[#047857]">OK</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <aside className="space-y-4">
            {selected && (
              <section className="rounded-[12px] border border-[#E6EAF0] bg-white p-4">
                <h2 className="text-[13px] font-semibold text-[#111827]">Restock {selected.name}</h2>
                <p className="mt-1 flex items-center gap-1.5 text-[12px] text-[#6B7280]">
                  {selected.lowStock && <AlertTriangle className="h-3.5 w-3.5 text-[#EF4444]" />}
                  {selected.stock} {selected.unit} in stock
                </p>
                {canWrite ? (
                  <>
                    <input
                      value={stockAmount}
                      onChange={(event) => setStockAmount(event.target.value)}
                      placeholder="Quantity to add (or negative to use)"
                      inputMode="decimal"
                      className="mt-3 h-10 w-full rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 text-[12px]"
                    />
                    <input
                      value={stockNote}
                      onChange={(event) => setStockNote(event.target.value)}
                      placeholder="Note (optional)"
                      className="mt-2 h-10 w-full rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 text-[12px]"
                    />
                    <button
                      type="button"
                      onClick={() => void restock()}
                      disabled={busy}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-[9px] bg-[#4F46E5] px-3 py-2.5 text-[13px] font-semibold text-white hover:bg-[#4338CA] disabled:opacity-60"
                    >
                      <PackagePlus className="h-4 w-4" /> Adjust stock
                    </button>
                  </>
                ) : (
                  <p className="mt-2 text-[12px] text-[#9CA3AF]">Restocking is not available to your role.</p>
                )}
              </section>
            )}

            <section className="rounded-[12px] border border-[#E6EAF0] bg-white p-4">
              <h2 className="text-[13px] font-semibold text-[#111827]">Recent movements</h2>
              {movements.length === 0 ? (
                <p className="mt-2 text-[12px] text-[#9CA3AF]">No stock movements yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-[#F1F4F8] text-[12px]">
                  {movements.map((movement) => (
                    <li key={movement.id} className="flex justify-between gap-2 py-2">
                      <span className="min-w-0 truncate text-[#4B5563]">
                        {movement.ingredientName}
                        <span className="block text-[10px] text-[#9CA3AF]">{movement.reason}</span>
                      </span>
                      <span className="tabular-nums font-semibold text-[#111827]">
                        {movement.quantity > 0 ? '+' : ''}
                        {movement.quantity}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      )}

      {canEditRecipes && (
        <section className="rounded-[12px] border border-[#E6EAF0] bg-white p-5">
          <h2 className="text-[14px] font-semibold text-[#111827]">Recipe editor</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <select
              value={recipeItemId}
              onChange={(event) => setRecipeItemId(event.target.value)}
              className="h-10 min-w-[240px] rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 text-[12px]"
            >
              <option value="">Select a menu item</option>
              {menuItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addRecipeLine}
              disabled={!recipeItemId || busy}
              className="rounded-[9px] border border-[#4F46E5] px-3 py-2 text-[12px] font-semibold text-[#4338CA] disabled:opacity-50"
            >
              Add ingredient
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {recipeLines.map((line) => (
              <div key={line.ingredientId} className="flex items-center gap-3 text-[12px]">
                <span className="w-48 truncate text-[#374151]">{line.ingredientName}</span>
                <input
                  value={line.quantity}
                  onChange={(event) => updateRecipeLine(line.ingredientId, Number(event.target.value))}
                  inputMode="decimal"
                  aria-label={`${line.ingredientName} quantity`}
                  className="h-9 w-24 rounded-[9px] border border-[#E6EAF0] px-2 text-[12px]"
                />
                <span className="text-[#9CA3AF]">{line.unit}</span>
                <button
                  type="button"
                  onClick={() =>
                    setRecipeLines((previous) =>
                      previous.filter((entry) => entry.ingredientId !== line.ingredientId)
                    )
                  }
                  className="ml-auto text-[#9CA3AF] hover:text-[#EF4444]"
                >
                  Remove
                </button>
              </div>
            ))}
            {recipeLines.length === 0 && (
              <p className="text-[12px] text-[#9CA3AF]">This item has no recipe lines.</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void saveRecipe()}
            disabled={!recipeItemId || busy}
            className="mt-4 rounded-[9px] bg-[#4F46E5] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#4338CA] disabled:opacity-60"
          >
            Save recipe
          </button>
        </section>
      )}
    </div>
  );
}
