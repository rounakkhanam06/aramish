const resolveVariantPrice = (product, variant) =>
  (!variant.useDefaultPricing && variant.sellingPrice !== undefined) ? variant.sellingPrice : product.sellingPrice;

module.exports = { resolveVariantPrice };
