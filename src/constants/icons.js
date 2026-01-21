/**
 * icons.js - Centralized Icon Configuration
 * 
 * Using Lucide React for consistent, professional healthcare iconography.
 * Import icons from this file to ensure consistency across the app.
 * 
 * Usage:
 *   import { NAV_ICONS, SCORECARD_ICONS } from '../constants/icons';
 *   <NAV_ICONS.dashboard className="icon" />
 */

import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  CalendarClock,
  FileText,
  Bell,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Search,
  Plus,
  X,
  Edit,
  Trash2,
  Download,
  Upload,
  Mail,
  Phone,
  MapPin,
  Calendar,
  User,
  Building2,
  Heart,
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Filter,
  SortAsc,
  SortDesc,
  Eye,
  EyeOff,
  Save,
  Loader2,
} from 'lucide-react';

// Navigation icons - used in Sidebar
export const NAV_ICONS = {
  dashboard: LayoutDashboard,
  patients: Users,
  certifications: ClipboardCheck,
  huv: CalendarClock,
  documents: FileText,
  notifications: Bell,
  settings: Settings,
  logout: LogOut,
  collapse: ChevronLeft,
  expand: ChevronRight,
};

// Scorecard icons - used in Dashboard metrics
export const SCORECARD_ICONS = {
  activePatients: Users,
  certsDue: ClipboardCheck,
  f2fRequired: Stethoscope,
  sixtyDayPeriods: RefreshCw,
};

// Status icons - used for alerts and indicators
export const STATUS_ICONS = {
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
  info: Info,
  pending: Clock,
};

// Action icons - used in buttons and interactive elements
export const ACTION_ICONS = {
  add: Plus,
  edit: Edit,
  delete: Trash2,
  close: X,
  search: Search,
  filter: Filter,
  download: Download,
  upload: Upload,
  save: Save,
  view: Eye,
  hide: EyeOff,
  more: MoreVertical,
  sortAsc: SortAsc,
  sortDesc: SortDesc,
  loading: Loader2,
};

// Entity icons - used for data types
export const ENTITY_ICONS = {
  patient: User,
  organization: Building2,
  calendar: Calendar,
  email: Mail,
  phone: Phone,
  location: MapPin,
  document: FileText,
};

// Trend icons - used for metrics
export const TREND_ICONS = {
  up: TrendingUp,
  down: TrendingDown,
  chevronUp: ChevronUp,
  chevronDown: ChevronDown,
};

// App branding
export const BRAND_ICONS = {
  heart: Heart,
  activity: Activity,
};

// Default icon size classes (for Tailwind or custom CSS)
export const ICON_SIZES = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

// Helper component for consistent icon rendering
export const Icon = ({ 
  icon: IconComponent, 
  size = 'md', 
  className = '',
  ...props 
}) => {
  const sizeValue = typeof size === 'number' ? size : ICON_SIZES[size] || ICON_SIZES.md;
  
  return (
    <IconComponent 
      size={sizeValue} 
      className={className}
      {...props} 
    />
  );
};

export default {
  NAV_ICONS,
  SCORECARD_ICONS,
  STATUS_ICONS,
  ACTION_ICONS,
  ENTITY_ICONS,
  TREND_ICONS,
  BRAND_ICONS,
  ICON_SIZES,
  Icon,
};
