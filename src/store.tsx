import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';

export type BookingStatus =
  | 'pending' | 'confirmed' | 'cleaner_assigned'
  | 'en_route' | 'in_progress' | 'completed'
  | 'cancelled' | 'rescheduled' | 'awaiting_quote';

export type UserRole = 'customer' | 'cleaner' | 'partner' | 'admin';
export type MembershipTier = 'bronze' | 'silver' | 'gold';

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  role: UserRole;
  phone: string;
  employeeId?: string | null;
  companyId?: string | null;
  companyCode?: string | null;
  assignedZoneId?: string | null;
  permissions?: string[];
  membershipTier: MembershipTier | null;
  membershipStatus: 'none' | 'active' | 'pending';
  partnerApplicationId: string | null;
  createdAt: string;
}

export interface TimelineEvent {
  id: string;
  event: string;
  note: string;
  timestamp: string;
  actor: string;
}

export interface Booking {
  id: string;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  service: string;
  status: BookingStatus;
  date: string;
  time: string;
  address: string;
  city: string;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  size: string;
  frequency: string;
  specialRequests: string;
  fragrance: string;
  allergies: string;
  accessInstructions: string;
  cleanerId: string | null;
  cleanerNotes: string;
  beforePhotos: string[];
  progressPhotos: string[];
  afterPhotos: string[];
  timeline: TimelineEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  link: string;
  createdAt: string;
}

export interface PartnerApplication {
  id: string;
  userId: string | null;
  companyName: string;
  industry: string;
  contactPerson: string;
  position: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  servicesRequired: string;
  estimatedVolume: string;
  proposal: string;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected';
  createdAt: string;
}

export interface PartnerProject {
  id: string;
  partnerId: string;
  name: string;
  address: string;
  size: string;
  units: string;
  turnoverDate: string;
  preferredDate: string;
  requirements: string;
  additionalInfo: string;
  status: 'lead_submitted' | 'received' | 'contacted' | 'quote' | 'approved' | 'scheduled' | 'cleaning' | 'completed';
  createdAt: string;
}

export interface TrainingProgram {
  id: string;
  name: string;
  description: string;
  requirements: string;
  duration: string;
  objectives: string[];
  schedule: string;
  slots: number;
  slotsAvailable: number;
  price: number | null;
}

export interface TrainingApplication {
  id: string;
  programId: string;
  userId: string | null;
  name: string;
  email: string;
  phone: string;
  experience: string;
  status: 'submitted' | 'under_review' | 'accepted' | 'scheduled' | 'completed' | 'rejected';
  createdAt: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface AppState {
  currentUser: User | null;
  users: User[];
  bookings: Booking[];
  notifications: Notification[];
  partnerApplications: PartnerApplication[];
  partnerProjects: PartnerProject[];
  trainingPrograms: TrainingProgram[];
  trainingApplications: TrainingApplication[];
  contactMessages: ContactMessage[];
}

// Sample data
const SAMPLE_USERS: User[] = [
  {
    id: 'u1', email: 'admin@luxclean.com', password: 'admin123',
    name: 'Alexandra Morgan', role: 'admin', phone: '+1 416-555-0100',
    membershipTier: null, membershipStatus: 'none', partnerApplicationId: null,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'u2', email: 'customer@demo.com', password: 'demo123',
    name: 'Sophie Harrington', role: 'customer', phone: '+1 416-555-0201',
    membershipTier: 'gold', membershipStatus: 'active', partnerApplicationId: null,
    createdAt: '2024-03-15T10:00:00Z',
  },
  {
    id: 'u3', email: 'cleaner@demo.com', password: 'demo123',
    name: 'Marcus Chen', role: 'cleaner', phone: '+1 416-555-0302',
    employeeId: 'CLN-001', assignedZoneId: 'TOR-CENTRAL', permissions: [],
    membershipTier: null, membershipStatus: 'none', partnerApplicationId: null,
    createdAt: '2024-02-10T09:00:00Z',
  },
  {
    id: 'u4', email: 'partner@demo.com', password: 'demo123',
    name: 'James Whitfield', role: 'partner', phone: '+1 416-555-0403',
    companyId: 'company-apex', companyCode: 'APEX-001', permissions: [],
    membershipTier: null, membershipStatus: 'none', partnerApplicationId: 'pa1',
    createdAt: '2024-04-01T08:00:00Z',
  },
];

const SAMPLE_BOOKINGS: Booking[] = [
  {
    id: 'LC-10293',
    customerId: 'u2',
    service: 'Deep Cleaning',
    status: 'in_progress',
    date: '2025-09-12',
    time: '09:00',
    address: '142 Rosedale Heights Dr',
    city: 'Toronto, ON',
    propertyType: 'Condo',
    bedrooms: 2,
    bathrooms: 2,
    size: '1,200 sq ft',
    frequency: 'One-time',
    specialRequests: 'Please focus on kitchen appliances and bathroom grout',
    fragrance: 'Lavender',
    allergies: 'None',
    accessInstructions: 'Concierge will provide key. Unit 1204.',
    cleanerId: 'u3',
    cleanerNotes: 'Kitchen completed. Moving to bathrooms.',
    beforePhotos: [
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=400&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1556909212-d5b604d0c90d?w=600&h=400&fit=crop&auto=format',
    ],
    progressPhotos: [
      'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=600&h=400&fit=crop&auto=format',
    ],
    afterPhotos: [],
    timeline: [
      { id: 't1', event: 'Booking Confirmed', note: 'Your deep cleaning has been confirmed.', timestamp: '2025-09-10T14:32:00Z', actor: 'System' },
      { id: 't2', event: 'Cleaner Assigned', note: 'Marcus Chen has been assigned to your booking.', timestamp: '2025-09-11T09:15:00Z', actor: 'Admin' },
      { id: 't3', event: 'Cleaner En Route', note: 'Your cleaner is on the way.', timestamp: '2025-09-12T08:45:00Z', actor: 'Marcus Chen' },
      { id: 't4', event: 'Arrived On-Site', note: 'Marcus has arrived and will begin shortly.', timestamp: '2025-09-12T09:03:00Z', actor: 'Marcus Chen' },
      { id: 't5', event: 'Before Photos Uploaded', note: '2 before photos have been uploaded.', timestamp: '2025-09-12T09:10:00Z', actor: 'Marcus Chen' },
      { id: 't6', event: 'Cleaning In Progress', note: 'Kitchen completed, moving to bathrooms.', timestamp: '2025-09-12T10:30:00Z', actor: 'Marcus Chen' },
    ],
    createdAt: '2025-09-10T12:00:00Z',
    updatedAt: '2025-09-12T10:30:00Z',
  },
  {
    id: 'LC-10281',
    customerId: 'u2',
    service: 'Residential Cleaning',
    status: 'completed',
    date: '2025-08-28',
    time: '10:00',
    address: '142 Rosedale Heights Dr',
    city: 'Toronto, ON',
    propertyType: 'Condo',
    bedrooms: 2,
    bathrooms: 2,
    size: '1,200 sq ft',
    frequency: 'Bi-weekly',
    specialRequests: 'Standard clean',
    fragrance: 'Citrus',
    allergies: 'None',
    accessInstructions: 'Unit 1204',
    cleanerId: 'u3',
    cleanerNotes: 'All areas thoroughly cleaned. Left fresh scent sachets.',
    beforePhotos: ['https://images.unsplash.com/photo-1556909212-d5b604d0c90d?w=600&h=400&fit=crop&auto=format'],
    progressPhotos: [],
    afterPhotos: [
      'https://images.unsplash.com/photo-1556020685-ae41abfc9365?w=600&h=400&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=600&h=400&fit=crop&auto=format',
    ],
    timeline: [
      { id: 't1', event: 'Booking Confirmed', note: 'Booking confirmed.', timestamp: '2025-08-26T10:00:00Z', actor: 'System' },
      { id: 't2', event: 'Cleaner Assigned', note: 'Marcus Chen assigned.', timestamp: '2025-08-27T09:00:00Z', actor: 'Admin' },
      { id: 't3', event: 'Cleaning Completed', note: 'All done! After photos uploaded.', timestamp: '2025-08-28T12:45:00Z', actor: 'Marcus Chen' },
    ],
    createdAt: '2025-08-26T09:00:00Z',
    updatedAt: '2025-08-28T12:45:00Z',
  },
  {
    id: 'LC-10305',
    customerId: 'u2',
    service: 'Move-In / Move-Out Cleaning',
    status: 'pending',
    date: '2025-09-20',
    time: '08:00',
    address: '88 Bloor St W, Suite 901',
    city: 'Toronto, ON',
    propertyType: 'Condo',
    bedrooms: 3,
    bathrooms: 2,
    size: '1,800 sq ft',
    frequency: 'One-time',
    specialRequests: 'Full move-out deep clean including inside of all appliances',
    fragrance: 'Unscented',
    allergies: 'Nut-based products',
    accessInstructions: 'Realtor will be present to provide access',
    cleanerId: null,
    cleanerNotes: '',
    beforePhotos: [],
    progressPhotos: [],
    afterPhotos: [],
    timeline: [
      { id: 't1', event: 'Booking Submitted', note: 'Your booking is under review.', timestamp: '2025-09-10T18:00:00Z', actor: 'System' },
    ],
    createdAt: '2025-09-10T18:00:00Z',
    updatedAt: '2025-09-10T18:00:00Z',
  },
];

const SAMPLE_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1', userId: 'u2',
    title: 'Progress Update — LC-10293',
    message: 'Your cleaning team has uploaded a new progress update for Booking #LC-10293.',
    read: false, link: '/portal/customer',
    createdAt: '2025-09-12T10:30:00Z',
  },
  {
    id: 'n2', userId: 'u2',
    title: 'Cleaner Assigned — LC-10293',
    message: 'Marcus Chen has been assigned to your upcoming deep cleaning on Sep 12.',
    read: true, link: '/portal/customer',
    createdAt: '2025-09-11T09:15:00Z',
  },
  {
    id: 'n3', userId: 'u2',
    title: 'Booking Confirmed — LC-10305',
    message: 'Your Move-In/Move-Out cleaning for Sep 20 has been received and is pending review.',
    read: false, link: '/portal/customer',
    createdAt: '2025-09-10T18:01:00Z',
  },
  {
    id: 'n4', userId: 'u3',
    title: 'New Job Assignment',
    message: 'You have been assigned to Booking #LC-10293 on September 12 at 09:00.',
    read: false, link: '/portal/cleaner',
    createdAt: '2025-09-11T09:15:00Z',
  },
  {
    id: 'n5', userId: 'u4',
    title: 'Partnership Application Approved',
    message: 'Congratulations! Apex Construction has been approved as a Luxurious Cleaning Co. partner.',
    read: true, link: '/portal/partner',
    createdAt: '2025-09-05T11:00:00Z',
  },
];

const SAMPLE_PARTNER_APPLICATIONS: PartnerApplication[] = [
  {
    id: 'pa1', userId: 'u4',
    companyName: 'Apex Construction Group',
    industry: 'Construction',
    contactPerson: 'James Whitfield',
    position: 'Operations Director',
    email: 'partner@demo.com',
    phone: '+1 416-555-0403',
    website: 'https://apexconstruction.ca',
    address: '500 King St W, Toronto, ON',
    servicesRequired: 'Post-Construction Cleaning, Commercial Cleaning',
    estimatedVolume: '8–12 projects per year',
    proposal: 'We complete 10+ high-rise residential and commercial projects annually and require reliable post-construction cleaning after each handover.',
    status: 'approved',
    createdAt: '2025-08-20T10:00:00Z',
  },
  {
    id: 'pa2', userId: null,
    companyName: 'Meridian Real Estate',
    industry: 'Real Estate',
    contactPerson: 'Patricia Wells',
    position: 'Property Manager',
    email: 'pwells@meridianrealty.ca',
    phone: '+1 416-555-0512',
    website: 'https://meridianrealty.ca',
    address: '220 Bay St, Toronto, ON',
    servicesRequired: 'Move-In/Move-Out, Residential Cleaning',
    estimatedVolume: '20–30 units per month',
    proposal: 'We manage 400+ residential units and need a premium cleaning partner for tenant turnovers.',
    status: 'under_review',
    createdAt: '2025-09-08T14:00:00Z',
  },
];

const SAMPLE_PARTNER_PROJECTS: PartnerProject[] = [
  {
    id: 'pp1', partnerId: 'pa1',
    name: 'Harbour Point Residences — Tower A',
    address: '1 Harbour Square, Toronto, ON',
    size: '45,000 sq ft',
    units: '120 units, 32 floors',
    turnoverDate: '2025-10-01',
    preferredDate: '2025-10-03',
    requirements: 'Full post-construction clean including windows, debris removal, all surfaces. Appliances included.',
    additionalInfo: 'Union job site. All cleaners must sign NDA. Building manager contact: Bill Tran.',
    status: 'approved',
    createdAt: '2025-09-01T09:00:00Z',
  },
  {
    id: 'pp2', partnerId: 'pa1',
    name: 'Midtown Lofts Phase 2',
    address: '840 St Clair Ave W, Toronto, ON',
    size: '18,000 sq ft',
    units: '48 loft units',
    turnoverDate: '2025-11-15',
    preferredDate: '2025-11-17',
    requirements: 'Post-construction clean. Focus on concrete dust removal and polished concrete floors.',
    additionalInfo: 'Polished concrete — no abrasive cleaners.',
    status: 'quote',
    createdAt: '2025-09-09T11:00:00Z',
  },
];

const TRAINING_PROGRAMS: TrainingProgram[] = [
  {
    id: 'tp1',
    name: 'Professional Cleaning Fundamentals',
    description: 'The essential foundation for all cleaning professionals. Covers techniques, products, and professional standards expected by Luxurious Cleaning Co.',
    requirements: 'No prior experience required. Must be 18+ and able to lift 25 lbs.',
    duration: '2 days (16 hours)',
    objectives: ['Master residential cleaning techniques', 'Understand product safety and usage', 'Build professional client interaction skills', 'Learn quality inspection standards'],
    schedule: 'Monthly — first Monday & Tuesday',
    slots: 12,
    slotsAvailable: 4,
    price: null,
  },
  {
    id: 'tp2',
    name: 'Deep Cleaning Techniques',
    description: 'Advanced deep-cleaning methods for tackling the most demanding residential and commercial environments.',
    requirements: 'Completion of Fundamentals or 6 months cleaning experience.',
    duration: '1 day (8 hours)',
    objectives: ['Advanced degreasing and disinfection', 'Appliance and oven deep cleaning', 'Grout and tile restoration', 'Odour elimination methods'],
    schedule: 'Bi-monthly — third Saturday',
    slots: 10,
    slotsAvailable: 7,
    price: 95,
  },
  {
    id: 'tp3',
    name: 'Post-Construction Cleaning',
    description: 'Specialized training for post-construction environments including debris handling, surface care, and site safety.',
    requirements: 'Deep Cleaning Techniques certification required.',
    duration: '3 days (24 hours)',
    objectives: ['Construction debris and hazardous material awareness', 'Protecting high-end surfaces and finishes', 'Window and glass cleaning techniques', 'Final inspection protocols for developers'],
    schedule: 'Quarterly',
    slots: 8,
    slotsAvailable: 3,
    price: 195,
  },
  {
    id: 'tp4',
    name: 'Commercial & Office Cleaning',
    description: 'Professional training for commercial environments, with a focus on minimal disruption and security protocols.',
    requirements: 'Fundamentals certification.',
    duration: '1 day (8 hours)',
    objectives: ['After-hours cleaning protocols', 'Office equipment safety', 'High-traffic area maintenance', 'Client confidentiality and access controls'],
    schedule: 'Monthly — second Wednesday',
    slots: 15,
    slotsAvailable: 9,
    price: 75,
  },
];

const INITIAL_STATE: AppState = {
  currentUser: null,
  users: SAMPLE_USERS,
  bookings: SAMPLE_BOOKINGS,
  notifications: SAMPLE_NOTIFICATIONS,
  partnerApplications: SAMPLE_PARTNER_APPLICATIONS,
  partnerProjects: SAMPLE_PARTNER_PROJECTS,
  trainingPrograms: TRAINING_PROGRAMS,
  trainingApplications: [],
  contactMessages: [],
};

// Actions
type Action =
  | { type: 'LOGIN'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'REGISTER'; payload: User }
  | { type: 'ADD_BOOKING'; payload: Booking }
  | { type: 'UPDATE_BOOKING'; payload: Booking }
  | { type: 'DELETE_BOOKING'; payload: string }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'MARK_NOTIFICATION_READ'; payload: string }
  | { type: 'MARK_ALL_READ'; payload: string }
  | { type: 'SUBMIT_PARTNER_APP'; payload: PartnerApplication }
  | { type: 'UPDATE_PARTNER_APP'; payload: PartnerApplication }
  | { type: 'ADD_PARTNER_PROJECT'; payload: PartnerProject }
  | { type: 'UPDATE_PARTNER_PROJECT'; payload: PartnerProject }
  | { type: 'APPLY_TRAINING'; payload: TrainingApplication }
  | { type: 'UPDATE_TRAINING_APP'; payload: TrainingApplication }
  | { type: 'SUBMIT_CONTACT'; payload: ContactMessage }
  | { type: 'UPDATE_USER_PROFILE'; payload: { userId: string; name: string; email: string; phone: string } }
  | { type: 'UPDATE_USER_MEMBERSHIP'; payload: { userId: string; tier: MembershipTier; status: 'active' | 'pending' } }
  | { type: 'LOAD'; payload: AppState };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOAD':
      return action.payload;
    case 'LOGIN':
      return { ...state, currentUser: action.payload };
    case 'LOGOUT':
      return { ...state, currentUser: null };
    case 'REGISTER': {
      const newState = { ...state, users: [...state.users, action.payload], currentUser: action.payload };
      return newState;
    }
    case 'ADD_BOOKING':
      return { ...state, bookings: [...state.bookings, action.payload] };
    case 'UPDATE_BOOKING':
      return { ...state, bookings: state.bookings.map(b => b.id === action.payload.id ? action.payload : b) };
    case 'DELETE_BOOKING':
      return { ...state, bookings: state.bookings.filter(b => b.id !== action.payload) };
    case 'ADD_NOTIFICATION':
      return { ...state, notifications: [action.payload, ...state.notifications] };
    case 'MARK_NOTIFICATION_READ':
      return { ...state, notifications: state.notifications.map(n => n.id === action.payload ? { ...n, read: true } : n) };
    case 'MARK_ALL_READ':
      return { ...state, notifications: state.notifications.map(n => n.userId === action.payload ? { ...n, read: true } : n) };
    case 'SUBMIT_PARTNER_APP':
      return { ...state, partnerApplications: [...state.partnerApplications, action.payload] };
    case 'UPDATE_PARTNER_APP':
      return { ...state, partnerApplications: state.partnerApplications.map(p => p.id === action.payload.id ? action.payload : p) };
    case 'ADD_PARTNER_PROJECT':
      return { ...state, partnerProjects: [...state.partnerProjects, action.payload] };
    case 'UPDATE_PARTNER_PROJECT':
      return { ...state, partnerProjects: state.partnerProjects.map(p => p.id === action.payload.id ? action.payload : p) };
    case 'APPLY_TRAINING':
      return { ...state, trainingApplications: [...state.trainingApplications, action.payload] };
    case 'UPDATE_TRAINING_APP':
      return { ...state, trainingApplications: state.trainingApplications.map(t => t.id === action.payload.id ? action.payload : t) };
    case 'SUBMIT_CONTACT':
      return { ...state, contactMessages: [...state.contactMessages, action.payload] };
    case 'UPDATE_USER_PROFILE':
      return {
        ...state,
        users: state.users.map(u => u.id === action.payload.userId
          ? { ...u, name: action.payload.name, email: action.payload.email, phone: action.payload.phone }
          : u),
        currentUser: state.currentUser?.id === action.payload.userId
          ? { ...state.currentUser, name: action.payload.name, email: action.payload.email, phone: action.payload.phone }
          : state.currentUser,
      };
    case 'UPDATE_USER_MEMBERSHIP':
      return {
        ...state,
        users: state.users.map(u => u.id === action.payload.userId
          ? { ...u, membershipTier: action.payload.tier, membershipStatus: action.payload.status }
          : u),
        currentUser: state.currentUser?.id === action.payload.userId
          ? { ...state.currentUser, membershipTier: action.payload.tier, membershipStatus: action.payload.status }
          : state.currentUser,
      };
    default:
      return state;
  }
}

export const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE, (init) => {
    try {
      const saved = localStorage.getItem('lc_state');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return init;
  });

  useEffect(() => {
    localStorage.setItem('lc_state', JSON.stringify(state));
  }, [state]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useStore must be used within AppProvider');
  return ctx;
}

export function useCurrentUser() {
  return useStore().state.currentUser;
}

export function useNotifications(userId: string | undefined) {
  const { state } = useStore();
  return state.notifications.filter(n => n.userId === userId);
}

export function genId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function genBookingId() {
  return `LC-${10306 + Math.floor(Math.random() * 900)}`;
}

export const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  cleaner_assigned: 'Cleaner Assigned',
  en_route: 'En Route',
  in_progress: 'Cleaning In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rescheduled: 'Rescheduled',
  awaiting_quote: 'Awaiting Quote',
};

export const STATUS_COLORS: Record<BookingStatus, string> = {
  pending: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  confirmed: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  cleaner_assigned: 'text-violet-400 bg-violet-400/10 border-violet-400/20',
  en_route: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
  in_progress: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  completed: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  cancelled: 'text-red-400 bg-red-400/10 border-red-400/20',
  rescheduled: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  awaiting_quote: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
};
