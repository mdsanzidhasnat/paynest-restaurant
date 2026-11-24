import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { EmptyState, ErrorState, LoadingState } from '../common/AsyncState';
import { MenuItemCard } from '../common/MenuItemCard';
import { PRODUCT_IMAGES } from '../../data/productImages';
import type { MenuCategory, MenuItem, PrepStation } from '../../types/domain';
import { formatMoney, parseMinorUnits } from '../../utils/money';

const IMAGE_OPTIONS = Array.from(
  new Set([
    ...Object.values(PRODUCT_IMAGES),
    '/images/dish_chickenroast.svg',
    '/images/dish_daal.svg',
    '/images/dish_fishcurry.svg',
    '/images/dish_friedrice.svg',
    '/images/dish_jalfrezi.svg',
    '/images/dish_kebab.svg',
    '/images/dish_lachaparatha.svg',
    '/images/dish_muttonbhuna.svg',
    '/images/dish_paratha.svg',
    '/images/dish_pulao.svg',
    '/images/dish_roll.svg',
    '/images/dish_roti.svg',
    '/images/dish_samosa.svg',
    '/images/dish_skewer.svg',
    '/images/drink_coffee.svg',
    '/images/drink_juice.svg',
    '/images/drink_lassi.svg',
    '/images/drink_soda.svg',
    '/images/dessert_chomchom.svg',
    '/images/dessert_jalebi.svg',
    '/images/dessert_jamun.svg',
    '/images/dessert_kheer.svg',
    '/images/dessert_mishtidoi.svg',
  ])
);

interface MenuViewProps {
  canManage: boolean;
  canToggleAvailability: boolean;
}

export function MenuView({ canManage, canToggleAvailability }: MenuViewProps) {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [image, setImage] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [prepStation, setPrepStation] = useState<PrepStation>('kitchen');
  const [variantName, setVariantName] = useState('');
  const [variantPrice, setVariantPrice] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [categoryRows, itemRows] = await Promise.all([api.getCategories(), api.getMenuItems()]);
      setCategories(categoryRows);
      setItems(itemRows);
      setActiveCategory((current) => current || categoryRows[0]?.id || '');
      setCategoryId((current) => current || categoryRows[0]?.id || '');
    } catch {
      setError('Unable to load the menu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const editingItem = useMemo(() => items.find((item) => item.id === editingId) ?? null, [items, editingId]);
  const visibleItems = items.filter((item) => !activeCategory || item.categoryId === activeCategory);

  function startCreate() {
    setCreating(true);
    setEditingId(null);
    setName('');
    setDescription('');
    setCategoryId(activeCategory || categories[0]?.id || '');
    setImage('');
    setPriceInput('');
    setPrepStation('kitchen');
  }

  function startEdit(item: MenuItem) {
    setCreating(true);
    setEditingId(item.id);
    setName(item.name);
    setDescription(item.description);
    setCategoryId(item.categoryId);
    setImage(item.image ?? '');
    setPriceInput((item.price / 100).toFixed(2));
    setPrepStation(item.prepStation);
    setVariantName('');
    setVariantPrice('');
  }

  function closeForm() {
    setCreating(false);
    setEditingId(null);
  }

  async function saveItem() {
    const price = parseMinorUnits(priceInput);
    if (!name.trim() || !categoryId || price === null) {
      setError('Enter a name, category and valid price in taka.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = {
        name: name.trim(),
        categoryId,
        description: description.trim(),
        image: image || null,
        price,
        prepStation,
      };
      if (editingId) await api.updateMenuItem(editingId, payload);
      else await api.createMenuItem(payload);
      closeForm();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save the menu item.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleAvailability(item: MenuItem) {
    setBusy(true);
    try {
      await api.toggleMenuItemAvailability(item.id, !item.available);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to change availability.');
    } finally {
      setBusy(false);
    }
  }

  async function addVariant() {
    if (!editingItem) return;
    const price = parseMinorUnits(variantPrice);
    if (!variantName.trim() || price === null) {
      setError('Enter a variant name and valid price in taka.');
      return;
    }
    setBusy(true);
    try {
      await api.createVariant({ menuItemId: editingItem.id, name: variantName.trim(), price });
      setVariantName('');
      setVariantPrice('');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to add the variant.');
    } finally {
      setBusy(false);
    }
  }

  async function removeVariant(variantId: string) {
    setBusy(true);
    try {
      await api.deleteVariant(variantId);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to remove the variant.');
    } finally {
      setBusy(false);
    }
  }

  async function addCategory() {
    if (!newCategoryName.trim()) return;
    setBusy(true);
    try {
      const created = await api.createCategory({ name: newCategoryName.trim() });
      setNewCategoryName('');
      await load();
      setActiveCategory(created.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to add the category.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState label="Loading menu…" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[#111827]">Menu management</h1>
          <p className="mt-1 text-[13px] text-[#6B7280]">
            Categories, items, variants and availability.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-2 rounded-[9px] bg-[#4F46E5] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#4338CA]"
          >
            <Plus className="h-4 w-4" /> New item
          </button>
        )}
      </div>

      {error && <ErrorState message={error} />}

      <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-[#E6EAF0] bg-white p-4">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setActiveCategory(category.id)}
            className={`rounded-[9px] px-3 py-1.5 text-[12px] font-semibold ${
              activeCategory === category.id
                ? 'bg-[#4F46E5] text-white'
                : 'bg-[#F6F8FB] text-[#4B5563] hover:bg-[#EEF2FF]'
            }`}
          >
            {category.name}
          </button>
        ))}
        {canManage && (
          <div className="ml-auto flex gap-2">
            <input
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              placeholder="New category"
              className="h-9 w-40 rounded-[9px] border border-[#E6EAF0] px-3 text-[12px]"
            />
            <button
              type="button"
              onClick={() => void addCategory()}
              disabled={busy || !newCategoryName.trim()}
              className="rounded-[9px] border border-[#4F46E5] px-3 text-[12px] font-semibold text-[#4338CA] disabled:opacity-50"
            >
              Add
            </button>
          </div>
        )}
      </div>

      {creating && (
        <section className="rounded-[12px] border border-[#C7D2FE] bg-white p-5">
          <h2 className="text-[14px] font-semibold text-[#111827]">
            {editingId ? `Edit ${editingItem?.name ?? 'item'}` : 'New menu item'}
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-[12px] font-medium text-[#4B5563]">
              Name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 h-10 w-full rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 text-[13px]"
              />
            </label>
            <label className="text-[12px] font-medium text-[#4B5563]">
              Category
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className="mt-1 h-10 w-full rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 text-[13px]"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[12px] font-medium text-[#4B5563]">
              Price (taka)
              <input
                value={priceInput}
                onChange={(event) => setPriceInput(event.target.value)}
                inputMode="decimal"
                placeholder="250.00"
                className="mt-1 h-10 w-full rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 text-[13px]"
              />
            </label>
            <label className="text-[12px] font-medium text-[#4B5563]">
              Prep station
              <select
                value={prepStation}
                onChange={(event) => setPrepStation(event.target.value as PrepStation)}
                className="mt-1 h-10 w-full rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 text-[13px]"
              >
                <option value="kitchen">Kitchen</option>
                <option value="grill">Grill</option>
                <option value="beverage">Beverage</option>
                <option value="dessert">Dessert</option>
              </select>
            </label>
            <label className="text-[12px] font-medium text-[#4B5563] md:col-span-2">
              Image (bundled with the app)
              <select
                value={image}
                onChange={(event) => setImage(event.target.value)}
                className="mt-1 h-10 w-full rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 text-[13px]"
              >
                <option value="">No image</option>
                {IMAGE_OPTIONS.map((path) => (
                  <option key={path} value={path}>
                    {path.split('/').pop()}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[12px] font-medium text-[#4B5563] md:col-span-2">
              Description
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={2}
                className="mt-1 w-full rounded-[9px] border border-[#E6EAF0] bg-[#F6F8FB] px-3 py-2 text-[13px]"
              />
            </label>
          </div>

          {editingItem && (
            <div className="mt-5 border-t border-[#F1F4F8] pt-4">
              <h3 className="text-[13px] font-semibold text-[#374151]">Variants</h3>
              <div className="mt-2 space-y-2">
                {editingItem.variants.map((variant) => (
                  <div key={variant.id} className="flex items-center justify-between text-[12px]">
                    <span className="text-[#374151]">
                      {variant.name} — {formatMoney(variant.price)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${variant.name}`}
                      onClick={() => void removeVariant(variant.id)}
                      className="text-[#9CA3AF] hover:text-[#EF4444]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {editingItem.variants.length === 0 && (
                  <p className="text-[12px] text-[#9CA3AF]">No variants yet.</p>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  value={variantName}
                  onChange={(event) => setVariantName(event.target.value)}
                  placeholder="Variant name"
                  className="h-9 w-40 rounded-[9px] border border-[#E6EAF0] px-3 text-[12px]"
                />
                <input
                  value={variantPrice}
                  onChange={(event) => setVariantPrice(event.target.value)}
                  placeholder="Price (taka)"
                  inputMode="decimal"
                  className="h-9 w-32 rounded-[9px] border border-[#E6EAF0] px-3 text-[12px]"
                />
                <button
                  type="button"
                  onClick={() => void addVariant()}
                  disabled={busy}
                  className="rounded-[9px] border border-[#4F46E5] px-3 text-[12px] font-semibold text-[#4338CA]"
                >
                  Add variant
                </button>
              </div>
            </div>
          )}

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => void saveItem()}
              disabled={busy}
              className="rounded-[9px] bg-[#4F46E5] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#4338CA] disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Save item'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-[9px] border border-[#E6EAF0] px-4 py-2 text-[13px] font-medium text-[#4B5563]"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {visibleItems.length === 0 ? (
        <EmptyState title="No items in this category" description="Add a menu item to get started." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {visibleItems.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              onSelect={(target) => {
                if (canManage) startEdit(target);
              }}
              onToggleAvailability={(target) => void toggleAvailability(target)}
              canToggle={canManage || canToggleAvailability}
            />
          ))}
        </div>
      )}
    </div>
  );
}
