/** Normalize item fields from Firestore (itemName/name, category/cat, unit default كرتونة). */
export const getItemName = (i) => (i?.itemName ?? i?.name ?? '').toString();
export const getCompany = (i) => i?.company || 'بدون شركة';
export const getCategory = (i) => i?.category ?? i?.cat ?? 'أخرى';
export const getUnit = (i) => i?.unit || 'كرتونة';
