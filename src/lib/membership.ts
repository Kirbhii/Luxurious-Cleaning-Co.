import type { MembershipTier } from '../store';

/**
 * Single source of truth for membership benefits.
 * Every perk listed here is wired into the system:
 * - discountPercent  → auto-applied member rate on every booking (shown in
 *                      booking review, customer portal card, and admin list)
 * - priority         → member bookings jump the queue (admin list is sorted
 *                      urgent → high → normal; badges shown on both portals)
 * - urgent requests  → Gold-only "urgent" toggle in the booking flow
 * - gold-only services → locked service choices for non-Gold members
 * - support line     → shown in the customer portal membership tab
 * - credits          → redeemable via support/admin (complimentary clean / add-on)
 */

export const TIER_ORDER: MembershipTier[] = ['bronze', 'silver', 'gold'];

export const TIER_NAMES: Record<MembershipTier, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
};

export const TIER_DISCOUNT: Record<MembershipTier, number> = {
  bronze: 5,
  silver: 10,
  gold: 15,
};

export const TIER_SUPPORT: Record<MembershipTier, { label: string; contact: string }> = {
  bronze: { label: 'Member support line', contact: '0919 002 4136' },
  silver: { label: 'Priority support line', contact: '0919 002 4136' },
  gold: { label: 'Gold concierge + account manager', contact: '0919 002 4136' },
};

/** Redeemable benefit credits per tier (redeemed through support/admin). */
export const TIER_CREDITS: Record<MembershipTier, string[]> = {
  bronze: ['Free scent upgrade on every booking'],
  silver: ['One complimentary add-on every 6 months'],
  gold: ['Quarterly complimentary deep clean', 'One complimentary add-on every 6 months'],
};

export const TIER_PERKS: Record<MembershipTier, string[]> = {
  bronze: [
    '5% member pricing on all services',
    'Priority booking queue — ahead of non-members',
    'Member-only promo alerts',
    'Dedicated member support line',
    'Free scent upgrade on every booking',
  ],
  silver: [
    'All Bronze benefits',
    '10% member pricing + selected service discounts',
    'Higher booking priority',
    'One complimentary add-on every 6 months',
    'Early access to seasonal packages',
    'Priority support response',
  ],
  gold: [
    'All Silver benefits',
    '15% Gold member pricing',
    'Highest booking priority',
    'Urgent (same-day / next-day) cleaning requests',
    'Exclusive Gold-only services',
    'Quarterly complimentary deep clean',
    'Premium concierge support',
    'Dedicated account manager',
  ],
};

/** Services only Gold members can book. Everyone else sees them locked. */
export const GOLD_ONLY_SERVICES = ['Signature Deep Clean', 'Premium Concierge Cleaning'];

/** Mock monthly membership prices (PHP). */
export const TIER_PRICE: Record<MembershipTier, number> = {
  bronze: 499,
  silver: 999,
  gold: 1999,
};

export function formatPeso(amount: number): string {
  return `₱${amount.toLocaleString('en-PH')}`;
}

export interface ServiceInfo {
  name: string;
  description: string;
  /** Mock starting price (PHP). */
  price: number;
  /** Property type auto-selected when this service is picked (still editable). */
  propertyType: string;
  goldOnly?: boolean;
}

/** Booking service catalog — short descriptions, mock prices, auto property-type. */
export const SERVICE_CATALOG: ServiceInfo[] = [
  { name: 'Residential Cleaning', description: 'Routine whole-home upkeep — bedrooms, baths, kitchen, and living areas.', price: 1500, propertyType: 'House' },
  { name: 'Deep Cleaning', description: 'Intensive top-to-bottom detail — grout, appliances, baseboards, and more.', price: 2800, propertyType: 'House' },
  { name: 'Move-In / Move-Out Cleaning', description: 'Empty-unit reset for turnover — inside cabinets, appliances, and fixtures.', price: 3200, propertyType: 'Apartment' },
  { name: 'Post-Construction Cleaning', description: 'Dust, debris, and residue removal after renovation or build-out.', price: 4500, propertyType: 'Commercial' },
  { name: 'Commercial Cleaning', description: 'Scheduled upkeep for retail, showroom, and commercial premises.', price: 5000, propertyType: 'Commercial' },
  { name: 'Condo Cleaning', description: 'Condo-unit refresh tailored to tower living and compact layouts.', price: 1800, propertyType: 'Condo' },
  { name: 'Office Cleaning', description: 'Workplace cleaning — desks, meeting rooms, pantry, and restrooms.', price: 3500, propertyType: 'Office' },
  { name: 'Specialized Cleaning', description: 'Targeted jobs — upholstery, windows, or custom checklists.', price: 2500, propertyType: 'Other' },
  { name: 'Signature Deep Clean', description: 'Gold-exclusive premium detail with senior crew and scent finishing.', price: 4200, propertyType: 'House', goldOnly: true },
  { name: 'Premium Concierge Cleaning', description: 'Gold-exclusive white-glove service with priority scheduling.', price: 5500, propertyType: 'Condo', goldOnly: true },
];

export function serviceInfo(name: string): ServiceInfo | undefined {
  return SERVICE_CATALOG.find(s => s.name === name);
}

/** Member price for a service (mock): base minus tier discount, rounded. */
export function memberPrice(base: number, tier: MembershipTier | null | undefined): number {
  if (!tier) return base;
  return Math.round(base * (1 - TIER_DISCOUNT[tier] / 100));
}

export type BookingPriority = 'normal' | 'high' | 'urgent';

export const PRIORITY_LABELS: Record<BookingPriority, string> = {
  normal: 'Standard',
  high: 'Priority',
  urgent: 'Urgent',
};

export const PRIORITY_COLORS: Record<BookingPriority, string> = {
  normal: 'text-cream-300 bg-navy-700 border-gold-400/10',
  high: 'text-amber-400 bg-amber-400/10 border-amber-400/25',
  urgent: 'text-red-400 bg-red-400/10 border-red-400/30',
};

const PRIORITY_RANK: Record<BookingPriority, number> = { urgent: 0, high: 1, normal: 2 };

export function priorityRank(priority: BookingPriority | undefined): number {
  return PRIORITY_RANK[priority ?? 'normal'];
}

/** Default queue priority for a member tier (Gold can additionally flag urgent). */
export function priorityForTier(tier: MembershipTier | null | undefined, urgent: boolean): BookingPriority {
  if (urgent) return 'urgent';
  if (tier) return 'high';
  return 'normal';
}
