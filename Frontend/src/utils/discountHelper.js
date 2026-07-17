/**
 * Formats a discount label to be consistent across the application.
 * @param {string|number} discountLabel - The discount label from the database.
 * @param {number} mrp - The maximum retail price.
 * @param {number} sellingPrice - The selling price.
 * @param {'off'|'minus'} style - The style of the output: 'off' (e.g. "38%") or 'minus' (e.g. "-38%").
 * @returns {string} The formatted discount string.
 */
export const formatDiscount = (discountLabel, mrp, sellingPrice, style = 'off') => {
  let raw = '';
  
  if (discountLabel) {
    const parsed = parseFloat(discountLabel);
    if (!isNaN(parsed) && parsed > 0 && parsed < 1) {
      raw = `${Math.round(parsed * 100)}%`;
    } else {
      // Clean up string: remove minus, % and OFF
      const cleanStr = String(discountLabel).replace('-', '').replace('%', '').replace(/off/gi, '').trim();
      const parsedClean = parseFloat(cleanStr);
      if (!isNaN(parsedClean)) {
        raw = `${Math.round(parsedClean)}%`;
      } else {
        raw = String(discountLabel);
      }
    }
  } else if (mrp && mrp > sellingPrice) {
    raw = `${Math.round((1 - sellingPrice / mrp) * 100)}%`;
  }

  if (!raw) return style === 'minus' ? '-0%' : '0%';

  // Extract numeric and trailing percent characters, removing extra text
  const value = raw.replace('-', '').replace(/off/gi, '').trim();
  
  if (style === 'minus') {
    return value.startsWith('-') ? value : `-${value}`;
  }
  return value;
};
