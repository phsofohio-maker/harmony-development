/**
 * Sidebar.jsx - Collapsible Navigation Sidebar
 * Updated: Replaced emojis with Lucide React icons
 */

import { useAuth } from '../contexts/AuthContext';
import { NAV_ICONS, BRAND_ICONS, ICON_SIZES } from '../constants/icons';

const Sidebar = ({ currentPage, onNavigate, collapsed, onToggleCollapse }) => {
  const { user, userProfile, logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: NAV_ICONS.dashboard },
    { id: 'patients', label: 'Patients', icon: NAV_ICONS.patients },
    { id: 'certifications', label: 'Certifications', icon: NAV_ICONS.certifications },
    { id: 'huv', label: 'HUV Tracking', icon: NAV_ICONS.huv },
    { id: 'documents', label: 'Documents', icon: NAV_ICONS.documents },
    { id: 'notifications', label: 'Notifications', icon: NAV_ICONS.notifications },
    { id: 'settings', label: 'Settings', icon: NAV_ICONS.settings },
  ];

  const CollapseIcon = collapsed ? NAV_ICONS.expand : NAV_ICONS.collapse;
  const LogoutIcon = NAV_ICONS.logout;

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Header */}
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-icon">
            <BRAND_ICONS.heart size={24} className="heart-icon" />
            <BRAND_ICONS.activity size={16} className="pulse-icon" />
          </div>
          {!collapsed && <span className="logo-text">Harmony</span>}
        </div>
        <button className="collapse-btn" onClick={onToggleCollapse} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <CollapseIcon size={16} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.map(item => {
          const IconComponent = item.icon;
          return (
            <button
              key={item.id}
              className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
              title={collapsed ? item.label : ''}
            >
              <span className="nav-icon">
                <IconComponent size={ICON_SIZES.md} />
              </span>
              {!collapsed && <span className="nav-label">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">
            {(userProfile?.displayName || user?.email || 'U').charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="user-details">
              <span className="user-name">
                {userProfile?.displayName || user?.email?.split('@')[0]}
              </span>
              <span className="user-role">{userProfile?.role || 'Staff'}</span>
            </div>
          )}
        </div>
        <button 
          className="logout-btn" 
          onClick={logout}
          title={collapsed ? 'Sign Out' : ''}
        >
          <LogoutIcon size={collapsed ? 18 : 16} />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>

      <style>{`
        .sidebar {
          position: fixed;
          left: 0;
          top: 0;
          bottom: 0;
          width: var(--sidebar-width, 240px);
          background: linear-gradient(180deg, var(--sidebar-bg-start) 0%, var(--sidebar-bg-end) 100%);
          color: var(--sidebar-text);
          display: flex;
          flex-direction: column;
          transition: width 0.3s ease;
          z-index: 1000;
        }

        .sidebar.collapsed {
          width: var(--sidebar-width-collapsed, 64px);
        }

        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--spacing-md);
          border-bottom: 1px solid var(--sidebar-border);
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 0.625rem;
        }

        .logo-icon {
          position: relative;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .logo-icon .heart-icon {
          color: #f472b6;
          fill: #f472b6;
        }

        .logo-icon .pulse-icon {
          position: absolute;
          bottom: -2px;
          right: -4px;
          color: #34d399;
          background: var(--sidebar-bg-start);
          border-radius: 2px;
        }

        .logo-text {
          font-size: 1.25rem;
          font-weight: 600;
          letter-spacing: -0.025em;
        }

        .collapse-btn {
          background: var(--sidebar-hover);
          border: none;
          color: var(--sidebar-text);
          width: 28px;
          height: 28px;
          border-radius: var(--radius-md);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background var(--transition-fast);
        }

        .collapse-btn:hover {
          background: var(--sidebar-active);
        }

        .sidebar.collapsed .sidebar-header {
          flex-direction: column;
          gap: 0.75rem;
        }

        .sidebar.collapsed .collapse-btn {
          width: 100%;
        }

        .sidebar-nav {
          flex: 1;
          padding: var(--spacing-md) var(--spacing-sm);
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
          overflow-y: auto;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          border: none;
          background: transparent;
          color: var(--sidebar-text-muted);
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: all var(--transition-fast);
          width: 100%;
          text-align: left;
        }

        .nav-item:hover {
          background: var(--sidebar-hover);
          color: var(--sidebar-text);
        }

        .nav-item.active {
          background: var(--sidebar-active);
          color: var(--sidebar-text);
        }

        .nav-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          flex-shrink: 0;
        }

        .nav-label {
          font-size: 0.875rem;
          font-weight: 500;
          white-space: nowrap;
        }

        .sidebar.collapsed .nav-item {
          justify-content: center;
          padding: 0.75rem;
        }

        .sidebar-footer {
          padding: var(--spacing-md);
          border-top: 1px solid var(--sidebar-border);
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .user-avatar {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-full);
          background: var(--sidebar-active);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: var(--font-weight-semibold);
          font-size: var(--font-size-sm);
          flex-shrink: 0;
        }

        .user-details {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .user-name {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .user-role {
          font-size: var(--font-size-xs);
          color: var(--sidebar-text-muted);
        }

        .sidebar.collapsed .user-info {
          justify-content: center;
        }

        .logout-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.625rem;
          background: var(--sidebar-hover);
          border: none;
          color: var(--sidebar-text-muted);
          border-radius: var(--radius-lg);
          cursor: pointer;
          font-size: 0.8125rem;
          transition: all var(--transition-fast);
        }

        .logout-btn:hover {
          background: rgba(239, 68, 68, 0.2);
          color: #fca5a5;
        }

        .sidebar.collapsed .logout-btn {
          padding: 0.75rem;
        }

        @media (max-width: 768px) {
          .sidebar {
            transform: translateX(-100%);
          }
          .sidebar.mobile-open {
            transform: translateX(0);
          }
        }
      `}</style>
    </aside>
  );
};

export default Sidebar;