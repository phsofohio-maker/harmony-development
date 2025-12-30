/**
 * Sidebar.jsx - Collapsible Navigation Sidebar
 * Phase 3: All pages active including Notifications
 */

import { useAuth } from '../contexts/AuthContext';

const Sidebar = ({ currentPage, onNavigate, collapsed, onToggleCollapse }) => {
  const { user, userProfile, logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'patients', label: 'Patients', icon: '👥' },
    { id: 'certifications', label: 'Certifications', icon: '📋' },
    { id: 'huv', label: 'HUV Tracking', icon: '📅' },
    { id: 'documents', label: 'Documents', icon: '📄' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Header */}
      <div className="sidebar-header">
        <div className="logo">
          <span className="logo-icon">💙</span>
          {!collapsed && <span className="logo-text">Harmony</span>}
        </div>
        <button className="collapse-btn" onClick={onToggleCollapse}>
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
            title={collapsed ? item.label : ''}
          >
            <span className="nav-icon">{item.icon}</span>
            {!collapsed && <span className="nav-label">{item.label}</span>}
          </button>
        ))}
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
          {collapsed ? '🚪' : 'Sign Out'}
        </button>
      </div>

      <style>{`
        .sidebar {
          position: fixed;
          left: 0;
          top: 0;
          bottom: 0;
          width: 240px;
          background: linear-gradient(180deg, #1e3a5f 0%, #2c5282 100%);
          color: white;
          display: flex;
          flex-direction: column;
          transition: width 0.3s ease;
          z-index: 1000;
        }

        .sidebar.collapsed {
          width: 64px;
        }

        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .logo-icon {
          font-size: 1.5rem;
        }

        .logo-text {
          font-size: 1.25rem;
          font-weight: 600;
        }

        .collapse-btn {
          background: rgba(255,255,255,0.1);
          border: none;
          color: white;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.875rem;
        }

        .collapse-btn:hover {
          background: rgba(255,255,255,0.2);
        }

        .sidebar.collapsed .collapse-btn {
          width: 100%;
          margin-top: 0.5rem;
        }

        .sidebar-nav {
          flex: 1;
          padding: 1rem 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          overflow-y: auto;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.7);
          font-size: 0.875rem;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s;
          text-align: left;
          width: 100%;
        }

        .nav-item:hover {
          background: rgba(255,255,255,0.1);
          color: white;
        }

        .nav-item.active {
          background: rgba(255,255,255,0.2);
          color: white;
        }

        .nav-icon {
          font-size: 1.125rem;
          min-width: 24px;
          text-align: center;
        }

        .sidebar.collapsed .nav-item {
          justify-content: center;
          padding: 0.75rem;
        }

        .sidebar.collapsed .nav-label {
          display: none;
        }

        .sidebar-footer {
          padding: 1rem;
          border-top: 1px solid rgba(255,255,255,0.1);
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
        }

        .user-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255,255,255,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 0.875rem;
        }

        .user-details {
          flex: 1;
          overflow: hidden;
        }

        .user-name {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .user-role {
          display: block;
          font-size: 0.7rem;
          color: rgba(255,255,255,0.6);
          text-transform: capitalize;
        }

        .sidebar.collapsed .user-details {
          display: none;
        }

        .sidebar.collapsed .user-info {
          justify-content: center;
        }

        .logout-btn {
          width: 100%;
          padding: 0.5rem;
          background: rgba(255,255,255,0.1);
          border: none;
          color: rgba(255,255,255,0.8);
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.8rem;
        }

        .logout-btn:hover {
          background: rgba(255,255,255,0.2);
        }

        @media (max-width: 768px) {
          .sidebar {
            width: 64px;
          }
          .logo-text,
          .nav-label,
          .user-details {
            display: none;
          }
          .nav-item {
            justify-content: center;
            padding: 0.75rem;
          }
          .user-info {
            justify-content: center;
          }
        }
      `}</style>
    </aside>
  );
};

export default Sidebar;