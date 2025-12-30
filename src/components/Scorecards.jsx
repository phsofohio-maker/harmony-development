/**
 * Scorecards.jsx - Dashboard Statistics Cards
 * 
 * PURPOSE:
 * Display key metrics at a glance with visual indicators
 * and click-through navigation to filtered views.
 * 
 * PROPS:
 * - stats: Dashboard statistics object from getDashboardStats()
 * - onCardClick: Function to change the view filter
 * - activeView: Currently active filter (for highlighting)
 */

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
      icon: '👥',
    },
    {
      id: 'upcoming',
      value: stats.upcomingRecerts || 0,
      label: 'Certs Due (14 days)',
      trend: stats.overdueRecerts > 0 
        ? `${stats.overdueRecerts} overdue!` 
        : 'On track',
      color: stats.overdueRecerts > 0 ? 'red' : 'amber',
      icon: '📋',
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
      icon: '👨‍⚕️',
    },
    {
      id: '60day',
      value: stats.in60DayPeriods || 0,
      label: '60-Day Periods',
      trend: 'Requires F2F each period',
      color: 'purple',
      icon: '🔄',
    },
  ];

  return (
    <div className="scorecards-grid">
      {cards.map(card => (
        <button
          key={card.id}
          className={`scorecard ${card.color} ${activeView === card.id ? 'active' : ''}`}
          onClick={() => onCardClick?.(card.id)}
        >
          <div className="scorecard-content">
            <div className="scorecard-icon">{card.icon}</div>
            <div className="scorecard-data">
              <div className="scorecard-value">{card.value}</div>
              <div className="scorecard-label">{card.label}</div>
              <div className="scorecard-trend">{card.trend}</div>
            </div>
          </div>
          {activeView === card.id && <div className="active-indicator" />}
        </button>
      ))}
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
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 1rem;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    position: relative;
    overflow: hidden;
  }

  .scorecard:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }

  .scorecard.active {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
  }

  /* Active Indicator */
  .active-indicator {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: #2563eb;
    border-radius: 4px 0 0 4px;
  }

  /* Content Layout */
  .scorecard-content {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .scorecard-icon {
    font-size: 1.5rem;
    line-height: 1;
    margin-top: 0.125rem;
  }

  .scorecard-data {
    flex: 1;
    min-width: 0;
  }

  /* Value Styles by Color */
  .scorecard-value {
    font-size: 1.75rem;
    font-weight: 700;
    line-height: 1.1;
  }

  .scorecard.blue .scorecard-value { color: #2563eb; }
  .scorecard.green .scorecard-value { color: #10b981; }
  .scorecard.amber .scorecard-value { color: #f59e0b; }
  .scorecard.red .scorecard-value { color: #ef4444; }
  .scorecard.purple .scorecard-value { color: #7c3aed; }

  /* Label & Trend */
  .scorecard-label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: #374151;
    margin-top: 0.25rem;
  }

  .scorecard-trend {
    font-size: 0.6875rem;
    color: #6b7280;
    margin-top: 0.25rem;
  }

  /* Loading State */
  .scorecard.loading {
    cursor: default;
  }

  .scorecard.loading:hover {
    transform: none;
    box-shadow: none;
  }

  .scorecard-skeleton {
    background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
  }

  .scorecard-skeleton.value {
    width: 60px;
    height: 32px;
    margin-bottom: 0.5rem;
  }

  .scorecard-skeleton.label {
    width: 100px;
    height: 16px;
  }

  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
`;

export default Scorecards;