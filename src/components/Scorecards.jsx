/**
 * Scorecards.jsx - Dashboard Statistics Cards
 * Updated: Replaced emojis with Lucide React icons
 * 
 * PROPS:
 * - stats: Dashboard statistics object from getDashboardStats()
 * - onCardClick: Function to change the view filter
 * - activeView: Currently active filter (for highlighting)
 */

import { SCORECARD_ICONS, ICON_SIZES } from '../constants/icons';

const Scorecards = ({ stats, onCardClick, activeView }) => {
  // Handle missing stats gracefully
  if (!stats) {
    return (
      <div className="scorecards-grid">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="scorecard loading">
            <div className="scorecard-skeleton value" />
            <div className="scorecard-skeleton label" />
          </div>
        ))}
        <style>{scorecardsStyles}</style>
      </div>
    );
  }

  // Define scorecard configurations
  const cards = [
    {
      id: 'all',
      value: stats.totalActive || 0,
      label: 'Active Patients',
      trend: stats.byUrgency?.critical > 0 
        ? `${stats.byUrgency.critical} critical` 
        : 'All monitored',
      color: 'blue',
      icon: SCORECARD_ICONS.activePatients,
    },
    {
      id: 'upcoming',
      value: stats.upcomingRecerts || 0,
      label: 'Certs Due (14 days)',
      trend: stats.overdueRecerts > 0 
        ? `${stats.overdueRecerts} overdue!` 
        : 'On track',
      color: stats.overdueRecerts > 0 ? 'red' : 'amber',
      icon: SCORECARD_ICONS.certsDue,
    },
    {
      id: 'f2f',
      value: stats.f2fRequired || 0,
      label: 'F2F Required',
      trend: stats.f2fOverdue > 0 
        ? `${stats.f2fOverdue} overdue` 
        : stats.f2fRequired > 0 
          ? 'Encounters needed' 
          : 'All complete',
      color: stats.f2fOverdue > 0 ? 'red' : stats.f2fRequired > 0 ? 'amber' : 'green',
      icon: SCORECARD_ICONS.f2fRequired,
    },
    {
      id: '60day',
      value: stats.in60DayPeriods || 0,
      label: '60-Day Periods',
      trend: 'Requires F2F each period',
      color: 'purple',
      icon: SCORECARD_ICONS.sixtyDayPeriods,
    },
  ];

  return (
    <div className="scorecards-grid">
      {cards.map(card => {
        const IconComponent = card.icon;
        return (
          <button
            key={card.id}
            className={`scorecard ${card.color} ${activeView === card.id ? 'active' : ''}`}
            onClick={() => onCardClick?.(card.id)}
          >
            <div className="scorecard-content">
              <div className={`scorecard-icon ${card.color}`}>
                <IconComponent size={ICON_SIZES.lg} strokeWidth={1.5} />
              </div>
              <div className="scorecard-data">
                <div className="scorecard-value">{card.value}</div>
                <div className="scorecard-label">{card.label}</div>
                <div className="scorecard-trend">{card.trend}</div>
              </div>
            </div>
            {activeView === card.id && <div className="active-indicator" />}
          </button>
        );
      })}
      <style>{scorecardsStyles}</style>
    </div>
  );
};

// Styles extracted for readability
const scorecardsStyles = `
  .scorecards-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
  }

  @media (max-width: 1024px) {
    .scorecards-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 640px) {
    .scorecards-grid {
      grid-template-columns: 1fr;
    }
  }

  /* Base Scorecard */
  .scorecard {
    background: white;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-xl);
    padding: 1.25rem;
    cursor: pointer;
    transition: all var(--transition-normal);
    text-align: left;
    position: relative;
    overflow: hidden;
  }

  .scorecard:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-card-hover);
  }

  .scorecard.active {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-100);
  }

  /* Active Indicator */
  .active-indicator {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: var(--color-primary);
    border-radius: 4px 0 0 4px;
  }

  /* Content Layout */
  .scorecard-content {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  /* Icon Container */
  .scorecard-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    flex-shrink: 0;
  }

  .scorecard-icon.blue {
    background: var(--scorecard-blue-bg);
    color: var(--scorecard-blue-text);
  }

  .scorecard-icon.green {
    background: var(--scorecard-green-bg);
    color: var(--scorecard-green-text);
  }

  .scorecard-icon.amber {
    background: var(--scorecard-amber-bg);
    color: var(--scorecard-amber-text);
  }

  .scorecard-icon.red {
    background: var(--scorecard-red-bg);
    color: var(--scorecard-red-text);
  }

  .scorecard-icon.purple {
    background: var(--scorecard-purple-bg);
    color: var(--scorecard-purple-text);
  }

  .scorecard-data {
    flex: 1;
    min-width: 0;
  }

  /* Value Styles by Color */
  .scorecard-value {
    font-size: 1.875rem;
    font-weight: var(--font-weight-bold, 700);
    line-height: var(--line-height-tight, 1.1);
    letter-spacing: -0.025em;
  }

  .scorecard.blue .scorecard-value { color: var(--scorecard-blue-text); }
  .scorecard.green .scorecard-value { color: var(--scorecard-green-text); }
  .scorecard.amber .scorecard-value { color: var(--scorecard-amber-text); }
  .scorecard.red .scorecard-value { color: var(--scorecard-red-text); }
  .scorecard.purple .scorecard-value { color: var(--scorecard-purple-text); }

  /* Label & Trend */
  .scorecard-label {
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-gray-700, #374151);
    margin-top: 0.375rem;
  }

  .scorecard-trend {
    font-size: var(--font-size-xs, 0.75rem);
    color: var(--color-gray-500, #6b7280);
    margin-top: 0.25rem;
  }

  /* Loading State */
  .scorecard.loading {
    cursor: default;
    padding: 1.25rem;
  }

  .scorecard.loading:hover {
    transform: none;
    box-shadow: none;
  }

  .scorecard-skeleton {
    background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 6px;
  }

  .scorecard-skeleton.value {
    width: 72px;
    height: 36px;
    margin-bottom: 0.625rem;
  }

  .scorecard-skeleton.label {
    width: 100px;
    height: 18px;
  }

  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
`;

export default Scorecards;