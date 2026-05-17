/* ============================================================
 * MOCK · Venue directory
 * ------------------------------------------------------------
 * The rider PDF never contains venue addresses or local promoter
 * contacts — those come from the booking agent's deal memos and
 * the PM's advance work with the venue's house production team.
 *
 * In production this would be a reusable Venue DB (Master Tour
 * has 15k+ venue records globally; ours would grow as TMs use
 * the hub). For the prototype, we mock the venues referenced by
 * `day.venueId` in mockTour.ts so the printable day sheet can
 * show realistic local info.
 * ============================================================
 */

export interface MockVenue {
  name: string;
  address: string;
  city: string;
  country: string;
  phone?: string;
  capacity?: number;
  /** Local power voltage (mains) — relevant for backline. */
  voltage?: string;
  /** Local currency for settlement. */
  currency?: string;
  /** Local primary language. */
  language?: string;
  /** Promoter org (e.g. "OCESA"). */
  promoter?: string;
  promoterRep?: string;
  promoterPhone?: string;
  promoterEmail?: string;
  /** Venue's own production manager (the "house PM" the tour PM advances with). */
  housePM?: string;
  housePMPhone?: string;
  /** Stage door street/entrance — what the bus driver needs. */
  stageDoor?: string;
}

export const mockVenues: Record<string, MockVenue> = {
  v_auditorio_nacional: {
    name: 'Auditorio Nacional',
    address: 'Paseo de la Reforma 50, Polanco, Miguel Hidalgo',
    city: 'Ciudad de México',
    country: 'MX',
    phone: '+52 55 9138 1350',
    capacity: 9683,
    voltage: '127V / 60Hz',
    currency: 'MXN',
    language: 'Español',
    promoter: 'OCESA',
    promoterRep: 'María López',
    promoterPhone: '+52 55 5511 2233',
    promoterEmail: 'mlopez@ocesa.com.mx',
    housePM: 'Ricardo Núñez',
    housePMPhone: '+52 55 9138 1380',
    stageDoor: 'Calle Tennyson · service entrance B',
  },
  v_auditorio_banamex: {
    name: 'Arena Monterrey',
    address: 'Av. Francisco I. Madero 2500, Centro',
    city: 'Monterrey, NL',
    country: 'MX',
    phone: '+52 81 8369 1100',
    capacity: 17599,
    voltage: '127V / 60Hz',
    currency: 'MXN',
    language: 'Español',
    promoter: 'Ticketmaster Live MX',
    promoterRep: 'Carlos Romero',
    promoterPhone: '+52 81 8444 9090',
    housePM: 'Diego Tamez',
    housePMPhone: '+52 81 8369 1190',
    stageDoor: 'Loading dock — south side',
  },
  v_auditorio_telmex: {
    name: 'Auditorio Telmex',
    address: 'Av. Obrero Mundial 750, Atemajac',
    city: 'Guadalajara, JAL',
    country: 'MX',
    phone: '+52 33 3818 0660',
    capacity: 9942,
    voltage: '127V / 60Hz',
    currency: 'MXN',
    language: 'Español',
    promoter: 'OCESA',
    promoterRep: 'Patricia Vela',
    promoterPhone: '+52 33 1234 5678',
    housePM: 'Hugo Salazar',
    housePMPhone: '+52 33 3818 0690',
    stageDoor: 'Acceso producción — gate C',
  },
  v_greek: {
    name: 'Greek Theatre',
    address: '2700 N Vermont Ave',
    city: 'Los Angeles, CA',
    country: 'US',
    phone: '+1 323 665 5857',
    capacity: 5870,
    voltage: '120V / 60Hz',
    currency: 'USD',
    language: 'English',
    promoter: 'Nederlander Concerts',
    promoterRep: 'Sarah Chen',
    promoterPhone: '+1 323 555 0102',
    promoterEmail: 'schen@nederlander.com',
    housePM: 'Marcus O’Hara',
    housePMPhone: '+1 323 665 5860',
    stageDoor: 'Vermont Canyon Rd · production gate',
  },
  v_fox: {
    name: 'Fox Theater',
    address: '1807 Telegraph Ave',
    city: 'Oakland, CA',
    country: 'US',
    phone: '+1 510 302 2250',
    capacity: 2800,
    voltage: '120V / 60Hz',
    currency: 'USD',
    language: 'English',
    promoter: 'Another Planet Entertainment',
    promoterRep: 'Mike Vasquez',
    promoterPhone: '+1 415 555 0184',
    housePM: 'Jenna Park',
    housePMPhone: '+1 510 302 2255',
    stageDoor: '19th St entrance · loading dock',
  },
};

export function getMockVenue(venueId?: string): MockVenue | undefined {
  if (!venueId) return undefined;
  return mockVenues[venueId];
}
