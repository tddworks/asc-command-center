/**
 * Apple App Store territory directory.
 *
 * Maps Apple's 3-letter territory ids (ISO 3166-1 alpha-3, with a couple of
 * Apple-specific codes such as "XKS" for Kosovo) to a display name and
 * 2-letter code used to render a flag emoji. The backend returns only the
 * 3-letter id and the currency code on each price/availability row, so the
 * UI enriches them client-side with this directory.
 */

interface TerritoryInfo {
  /** Human-readable country/region name in en-US. */
  name: string;
  /** ISO 3166-1 alpha-2 code used to derive the flag emoji. */
  iso2: string;
}

const TERRITORIES: Record<string, TerritoryInfo> = {
  AFG: { name: 'Afghanistan', iso2: 'AF' },
  AGO: { name: 'Angola', iso2: 'AO' },
  AIA: { name: 'Anguilla', iso2: 'AI' },
  ALB: { name: 'Albania', iso2: 'AL' },
  AND: { name: 'Andorra', iso2: 'AD' },
  ARE: { name: 'United Arab Emirates', iso2: 'AE' },
  ARG: { name: 'Argentina', iso2: 'AR' },
  ARM: { name: 'Armenia', iso2: 'AM' },
  ATG: { name: 'Antigua & Barbuda', iso2: 'AG' },
  AUS: { name: 'Australia', iso2: 'AU' },
  AUT: { name: 'Austria', iso2: 'AT' },
  AZE: { name: 'Azerbaijan', iso2: 'AZ' },
  BDI: { name: 'Burundi', iso2: 'BI' },
  BEL: { name: 'Belgium', iso2: 'BE' },
  BEN: { name: 'Benin', iso2: 'BJ' },
  BFA: { name: 'Burkina Faso', iso2: 'BF' },
  BGD: { name: 'Bangladesh', iso2: 'BD' },
  BGR: { name: 'Bulgaria', iso2: 'BG' },
  BHR: { name: 'Bahrain', iso2: 'BH' },
  BHS: { name: 'Bahamas', iso2: 'BS' },
  BIH: { name: 'Bosnia & Herzegovina', iso2: 'BA' },
  BLR: { name: 'Belarus', iso2: 'BY' },
  BLZ: { name: 'Belize', iso2: 'BZ' },
  BMU: { name: 'Bermuda', iso2: 'BM' },
  BOL: { name: 'Bolivia', iso2: 'BO' },
  BRA: { name: 'Brazil', iso2: 'BR' },
  BRB: { name: 'Barbados', iso2: 'BB' },
  BRN: { name: 'Brunei', iso2: 'BN' },
  BTN: { name: 'Bhutan', iso2: 'BT' },
  BWA: { name: 'Botswana', iso2: 'BW' },
  CAF: { name: 'Central African Republic', iso2: 'CF' },
  CAN: { name: 'Canada', iso2: 'CA' },
  CHE: { name: 'Switzerland', iso2: 'CH' },
  CHL: { name: 'Chile', iso2: 'CL' },
  CHN: { name: 'China', iso2: 'CN' },
  CIV: { name: "Côte d'Ivoire", iso2: 'CI' },
  CMR: { name: 'Cameroon', iso2: 'CM' },
  COD: { name: 'Congo - Kinshasa', iso2: 'CD' },
  COG: { name: 'Congo - Brazzaville', iso2: 'CG' },
  COK: { name: 'Cook Islands', iso2: 'CK' },
  COL: { name: 'Colombia', iso2: 'CO' },
  COM: { name: 'Comoros', iso2: 'KM' },
  CPV: { name: 'Cape Verde', iso2: 'CV' },
  CRI: { name: 'Costa Rica', iso2: 'CR' },
  CUB: { name: 'Cuba', iso2: 'CU' },
  CYM: { name: 'Cayman Islands', iso2: 'KY' },
  CYP: { name: 'Cyprus', iso2: 'CY' },
  CZE: { name: 'Czechia', iso2: 'CZ' },
  DEU: { name: 'Germany', iso2: 'DE' },
  DJI: { name: 'Djibouti', iso2: 'DJ' },
  DMA: { name: 'Dominica', iso2: 'DM' },
  DNK: { name: 'Denmark', iso2: 'DK' },
  DOM: { name: 'Dominican Republic', iso2: 'DO' },
  DZA: { name: 'Algeria', iso2: 'DZ' },
  ECU: { name: 'Ecuador', iso2: 'EC' },
  EGY: { name: 'Egypt', iso2: 'EG' },
  ERI: { name: 'Eritrea', iso2: 'ER' },
  ESP: { name: 'Spain', iso2: 'ES' },
  EST: { name: 'Estonia', iso2: 'EE' },
  ETH: { name: 'Ethiopia', iso2: 'ET' },
  FIN: { name: 'Finland', iso2: 'FI' },
  FJI: { name: 'Fiji', iso2: 'FJ' },
  FRA: { name: 'France', iso2: 'FR' },
  FRO: { name: 'Faroe Islands', iso2: 'FO' },
  FSM: { name: 'Micronesia', iso2: 'FM' },
  GAB: { name: 'Gabon', iso2: 'GA' },
  GBR: { name: 'United Kingdom', iso2: 'GB' },
  GEO: { name: 'Georgia', iso2: 'GE' },
  GHA: { name: 'Ghana', iso2: 'GH' },
  GIN: { name: 'Guinea', iso2: 'GN' },
  GMB: { name: 'Gambia', iso2: 'GM' },
  GNB: { name: 'Guinea-Bissau', iso2: 'GW' },
  GNQ: { name: 'Equatorial Guinea', iso2: 'GQ' },
  GRC: { name: 'Greece', iso2: 'GR' },
  GRD: { name: 'Grenada', iso2: 'GD' },
  GTM: { name: 'Guatemala', iso2: 'GT' },
  GUY: { name: 'Guyana', iso2: 'GY' },
  HKG: { name: 'Hong Kong', iso2: 'HK' },
  HND: { name: 'Honduras', iso2: 'HN' },
  HRV: { name: 'Croatia', iso2: 'HR' },
  HTI: { name: 'Haiti', iso2: 'HT' },
  HUN: { name: 'Hungary', iso2: 'HU' },
  IDN: { name: 'Indonesia', iso2: 'ID' },
  IND: { name: 'India', iso2: 'IN' },
  IRL: { name: 'Ireland', iso2: 'IE' },
  IRN: { name: 'Iran', iso2: 'IR' },
  IRQ: { name: 'Iraq', iso2: 'IQ' },
  ISL: { name: 'Iceland', iso2: 'IS' },
  ISR: { name: 'Israel', iso2: 'IL' },
  ITA: { name: 'Italy', iso2: 'IT' },
  JAM: { name: 'Jamaica', iso2: 'JM' },
  JOR: { name: 'Jordan', iso2: 'JO' },
  JPN: { name: 'Japan', iso2: 'JP' },
  KAZ: { name: 'Kazakhstan', iso2: 'KZ' },
  KEN: { name: 'Kenya', iso2: 'KE' },
  KGZ: { name: 'Kyrgyzstan', iso2: 'KG' },
  KHM: { name: 'Cambodia', iso2: 'KH' },
  KIR: { name: 'Kiribati', iso2: 'KI' },
  KNA: { name: 'St. Kitts & Nevis', iso2: 'KN' },
  KOR: { name: 'South Korea', iso2: 'KR' },
  KWT: { name: 'Kuwait', iso2: 'KW' },
  LAO: { name: 'Laos', iso2: 'LA' },
  LBN: { name: 'Lebanon', iso2: 'LB' },
  LBR: { name: 'Liberia', iso2: 'LR' },
  LBY: { name: 'Libya', iso2: 'LY' },
  LCA: { name: 'St. Lucia', iso2: 'LC' },
  LIE: { name: 'Liechtenstein', iso2: 'LI' },
  LKA: { name: 'Sri Lanka', iso2: 'LK' },
  LSO: { name: 'Lesotho', iso2: 'LS' },
  LTU: { name: 'Lithuania', iso2: 'LT' },
  LUX: { name: 'Luxembourg', iso2: 'LU' },
  LVA: { name: 'Latvia', iso2: 'LV' },
  MAC: { name: 'Macao', iso2: 'MO' },
  MAR: { name: 'Morocco', iso2: 'MA' },
  MCO: { name: 'Monaco', iso2: 'MC' },
  MDA: { name: 'Moldova', iso2: 'MD' },
  MDG: { name: 'Madagascar', iso2: 'MG' },
  MDV: { name: 'Maldives', iso2: 'MV' },
  MEX: { name: 'Mexico', iso2: 'MX' },
  MHL: { name: 'Marshall Islands', iso2: 'MH' },
  MKD: { name: 'North Macedonia', iso2: 'MK' },
  MLI: { name: 'Mali', iso2: 'ML' },
  MLT: { name: 'Malta', iso2: 'MT' },
  MMR: { name: 'Myanmar (Burma)', iso2: 'MM' },
  MNE: { name: 'Montenegro', iso2: 'ME' },
  MNG: { name: 'Mongolia', iso2: 'MN' },
  MOZ: { name: 'Mozambique', iso2: 'MZ' },
  MRT: { name: 'Mauritania', iso2: 'MR' },
  MSR: { name: 'Montserrat', iso2: 'MS' },
  MUS: { name: 'Mauritius', iso2: 'MU' },
  MWI: { name: 'Malawi', iso2: 'MW' },
  MYS: { name: 'Malaysia', iso2: 'MY' },
  NAM: { name: 'Namibia', iso2: 'NA' },
  NER: { name: 'Niger', iso2: 'NE' },
  NGA: { name: 'Nigeria', iso2: 'NG' },
  NIC: { name: 'Nicaragua', iso2: 'NI' },
  NLD: { name: 'Netherlands', iso2: 'NL' },
  NOR: { name: 'Norway', iso2: 'NO' },
  NPL: { name: 'Nepal', iso2: 'NP' },
  NRU: { name: 'Nauru', iso2: 'NR' },
  NZL: { name: 'New Zealand', iso2: 'NZ' },
  OMN: { name: 'Oman', iso2: 'OM' },
  PAK: { name: 'Pakistan', iso2: 'PK' },
  PAN: { name: 'Panama', iso2: 'PA' },
  PER: { name: 'Peru', iso2: 'PE' },
  PHL: { name: 'Philippines', iso2: 'PH' },
  PLW: { name: 'Palau', iso2: 'PW' },
  PNG: { name: 'Papua New Guinea', iso2: 'PG' },
  POL: { name: 'Poland', iso2: 'PL' },
  PRT: { name: 'Portugal', iso2: 'PT' },
  PRY: { name: 'Paraguay', iso2: 'PY' },
  QAT: { name: 'Qatar', iso2: 'QA' },
  ROU: { name: 'Romania', iso2: 'RO' },
  RUS: { name: 'Russia', iso2: 'RU' },
  RWA: { name: 'Rwanda', iso2: 'RW' },
  SAU: { name: 'Saudi Arabia', iso2: 'SA' },
  SDN: { name: 'Sudan', iso2: 'SD' },
  SEN: { name: 'Senegal', iso2: 'SN' },
  SGP: { name: 'Singapore', iso2: 'SG' },
  SLB: { name: 'Solomon Islands', iso2: 'SB' },
  SLE: { name: 'Sierra Leone', iso2: 'SL' },
  SLV: { name: 'El Salvador', iso2: 'SV' },
  SMR: { name: 'San Marino', iso2: 'SM' },
  SOM: { name: 'Somalia', iso2: 'SO' },
  SRB: { name: 'Serbia', iso2: 'RS' },
  SSD: { name: 'South Sudan', iso2: 'SS' },
  STP: { name: 'São Tomé & Príncipe', iso2: 'ST' },
  SUR: { name: 'Suriname', iso2: 'SR' },
  SVK: { name: 'Slovakia', iso2: 'SK' },
  SVN: { name: 'Slovenia', iso2: 'SI' },
  SWE: { name: 'Sweden', iso2: 'SE' },
  SWZ: { name: 'Eswatini', iso2: 'SZ' },
  SYC: { name: 'Seychelles', iso2: 'SC' },
  SYR: { name: 'Syria', iso2: 'SY' },
  TCA: { name: 'Turks & Caicos Islands', iso2: 'TC' },
  TCD: { name: 'Chad', iso2: 'TD' },
  THA: { name: 'Thailand', iso2: 'TH' },
  TJK: { name: 'Tajikistan', iso2: 'TJ' },
  TKM: { name: 'Turkmenistan', iso2: 'TM' },
  TLS: { name: 'Timor-Leste', iso2: 'TL' },
  TON: { name: 'Tonga', iso2: 'TO' },
  TTO: { name: 'Trinidad & Tobago', iso2: 'TT' },
  TUN: { name: 'Tunisia', iso2: 'TN' },
  TUR: { name: 'Türkiye', iso2: 'TR' },
  TUV: { name: 'Tuvalu', iso2: 'TV' },
  TWN: { name: 'Taiwan', iso2: 'TW' },
  TZA: { name: 'Tanzania', iso2: 'TZ' },
  UGA: { name: 'Uganda', iso2: 'UG' },
  UKR: { name: 'Ukraine', iso2: 'UA' },
  URY: { name: 'Uruguay', iso2: 'UY' },
  USA: { name: 'United States', iso2: 'US' },
  UZB: { name: 'Uzbekistan', iso2: 'UZ' },
  VCT: { name: 'St. Vincent & the Grenadines', iso2: 'VC' },
  VEN: { name: 'Venezuela', iso2: 'VE' },
  VGB: { name: 'British Virgin Islands', iso2: 'VG' },
  VNM: { name: 'Vietnam', iso2: 'VN' },
  VUT: { name: 'Vanuatu', iso2: 'VU' },
  WSM: { name: 'Samoa', iso2: 'WS' },
  XKS: { name: 'Kosovo', iso2: 'XK' },
  YEM: { name: 'Yemen', iso2: 'YE' },
  ZAF: { name: 'South Africa', iso2: 'ZA' },
  ZMB: { name: 'Zambia', iso2: 'ZM' },
  ZWE: { name: 'Zimbabwe', iso2: 'ZW' },
};

/** Display name for an Apple territory id, falling back to the raw code. */
export function territoryName(iso3: string): string {
  return TERRITORIES[iso3]?.name ?? iso3;
}

export interface TerritoryEntry {
  id: string;
  name: string;
  flag: string;
}

/** All known Apple territories sorted by display name — used by the
 *  pricing picker's territory-selection step. */
export function listTerritories(): TerritoryEntry[] {
  return Object.entries(TERRITORIES)
    .map(([id]) => ({ id, name: territoryName(id), flag: territoryFlag(id) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Flag emoji for an Apple territory id, derived from the ISO-2 code. */
export function territoryFlag(iso3: string): string {
  const iso2 = TERRITORIES[iso3]?.iso2;
  if (!iso2 || iso2.length !== 2) return '';
  const A = 0x1f1e6;
  const code1 = iso2.charCodeAt(0) - 65;
  const code2 = iso2.charCodeAt(1) - 65;
  if (code1 < 0 || code1 > 25 || code2 < 0 || code2 > 25) return '';
  return String.fromCodePoint(A + code1, A + code2);
}

/** Format a raw price string (as returned by the backend) using the
 *  territory's currency. Falls back to "<code> <amount>" for non-ISO
 *  currencies, and returns the input verbatim when it isn't numeric so
 *  pre-formatted strings ("$9.99") pass through untouched. */
export function formatTerritoryPrice(rawPrice: string, currency: string): string {
  const trimmed = rawPrice.trim();
  if (trimmed === '') return rawPrice;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount)) return rawPrice;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    }).format(amount);
  } catch {
    return `${currency} ${trimmed}`;
  }
}
