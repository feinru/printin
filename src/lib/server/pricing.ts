// src/lib/server/pricing.ts — IDR pricing engine
import { getConfig } from './db';
import type { PrintOptions, PriceBreakdown } from '$lib/types';

export function calculatePrice(options: PrintOptions, page_count: number): PriceBreakdown {
  const config = getConfig();

  const bw_price = config.price_bw_per_page;
  const color_price = config.price_color_per_page;
  const duplex_discount_pct = config.duplex_discount_pct;

  // Clamp page range
  const from = Math.max(1, options.pageFrom);
  const to = Math.min(page_count, options.pageTo);
  const effective_pages = Math.max(1, to - from + 1);

  const base_per_page = options.color === 'color' ? color_price : bw_price;
  const color_surcharge = options.color === 'color' ? (color_price - bw_price) * effective_pages * options.copies : 0;

  // Duplex halves physical paper but we still charge per side — give a small discount
  const subtotal_before_discount = base_per_page * effective_pages * options.copies;
  const duplex_discount = options.duplex === 'duplex'
    ? Math.round(subtotal_before_discount * duplex_discount_pct / 100)
    : 0;

  const subtotal = subtotal_before_discount;
  const total = Math.max(0, subtotal - duplex_discount);

  return {
    base_per_page,
    page_count,
    effective_pages,
    copies: options.copies,
    color_surcharge,
    duplex_discount,
    subtotal,
    total
  };
}

/** Format IDR for display */
export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}
