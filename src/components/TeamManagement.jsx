/**
 * TeamManagement.jsx - Team Members & Invitation Management
 * 
 * Features:
 * - View current team members
 * - Send new invitations
 * - Manage pending invitations (resend, cancel)
 */

import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  Users,
  UserPlus,
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Trash2,
  AlertCircle,
  Loader2,
  Shield,
  ShieldCheck,
  User
} from 'lucide-react';

const TeamManagement = () => {
  const { user, userProfile } = useAuth();
  const orgId = user?.customClaims?.orgId || 'org_parrish';
  const currentUserRole = user?.customClaims?.role || userProfile?.role;

  // State
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('staff');
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState(null);

  const canManageTeam = currentUserRole === 'owner' || currentUserRole === 'admin';

  // Load team members
  useEffect(() => {
    const membersQuery = query(
      collection(db, 'users'),
      where('organizationId', '==', orgId)
    );

    const unsubMembers = onSnapshot(membersQuery, (snapshot) => {
      const membersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMembers(membersList);
      setLoading(false);
    });

    return () => unsubMembers();
  }, [orgId]);

  // Load pending invites
  useEffect(() => {
    if (!canManageTeam) return;

    const invitesQuery = query(
      collection(db, 'organizations', orgId, 'pendingInvites'),
      where('status', 'in', ['pending', 'sent']),
      orderBy('invitedAt', 'desc')
    );

    const unsubInvites = onSnapshot(invitesQuery, (snapshot) => {
      const invitesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        invitedAt: doc.data().invitedAt?.toDate(),
        sentAt: doc.data().sentAt?.toDate(),
      }));
      setInvites(invitesList);
    });

    return () => unsubInvites();
  }, [orgId, canManageTeam]);

  // Send invitation
  const handleSendInvite = async () => {
    if (!newEmail.trim()) return;

    setSending(true);
    setMessage(null);

    try {
      const createInviteFn = httpsCallable(functions, 'createInvite');
      const result = await createInviteFn({ 
        email: newEmail.trim().toLowerCase(),
        role: newRole 
      });

      if (result.data.success) {
        setMessage({ type: 'success', text: `Invitation sent to ${newEmail}` });
        setNewEmail('');
      }
    } catch (error) {
      console.error('Error sending invite:', error);
      setMessage({ 
        type: 'error', 
        text: error.message || 'Failed to send invitation' 
      });
    } finally {
      setSending(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  // Resend invitation
  const handleResend = async (inviteId) => {
    setActionLoading(inviteId);
    setMessage(null);

    try {
      const resendFn = httpsCallable(functions, 'resendInvite');
      await resendFn({ inviteId });
      setMessage({ type: 'success', text: 'Invitation resent' });
    } catch (error) {
      console.error('Error resending invite:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to resend' });
    } finally {
      setActionLoading(null);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  // Cancel invitation
  const handleCancel = async (inviteId) => {
    if (!confirm('Cancel this invitation?')) return;

    setActionLoading(inviteId);
    setMessage(null);

    try {
      const cancelFn = httpsCallable(functions, 'cancelInvite');
      await cancelFn({ inviteId });
      setMessage({ type: 'success', text: 'Invitation cancelled' });
    } catch (error) {
      console.error('Error cancelling invite:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to cancel' });
    } finally {
      setActionLoading(null);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  // Role badge
  const RoleBadge = ({ role }) => {
    const config = {
      owner: { icon: ShieldCheck, label: 'Owner', className: 'role-owner' },
      admin: { icon: Shield, label: 'Admin', className: 'role-admin' },
      staff: { icon: User, label: 'Staff', className: 'role-staff' },
    };
    const { icon: Icon, label, className } = config[role] || config.staff;

    return (
      <span className={`role-badge ${className}`}>
        <Icon size={12} />
        {label}
      </span>
    );
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return '';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(date);
  };

  if (loading) {
    return (
      <div className="team-loading">
        <Loader2 className="spin" size={24} />
        <span>Loading team...</span>
      </div>
    );
  }

  return (
    <div className="team-management">
      {/* Message Banner */}
      {message && (
        <div className={`team-message ${message.type}`}>
          {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Current Members */}
      <section className="team-section">
        <div className="section-header">
          <Users size={20} />
          <div>
            <h3>Team Members</h3>
            <p>{members.length} member{members.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="members-list">
          {members.map(member => (
            <div key={member.id} className="member-row">
              <div className="member-avatar">
                {(member.displayName || member.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="member-info">
                <span className="member-name">
                  {member.displayName || member.email?.split('@')[0]}
                  {member.id === user?.uid && <span className="you-badge">You</span>}
                </span>
                <span className="member-email">{member.email}</span>
              </div>
              <RoleBadge role={member.role} />
            </div>
          ))}
        </div>
      </section>

      {/* Invite New Member */}
      {canManageTeam && (
        <section className="team-section">
          <div className="section-header">
            <UserPlus size={20} />
            <div>
              <h3>Invite Team Member</h3>
              <p>Send an invitation to join your organization</p>
            </div>
          </div>

          <div className="invite-form">
            <div className="invite-inputs">
              <div className="input-group email-input">
                <Mail size={16} className="input-icon" />
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  onKeyDown={(e) => e.key === 'Enter' && handleSendInvite()}
                />
              </div>
              <select 
                value={newRole} 
                onChange={(e) => setNewRole(e.target.value)}
                className="role-select"
              >
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
              <button 
                className="btn-primary"
                onClick={handleSendInvite}
                disabled={sending || !newEmail.trim()}
              >
                {sending ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <Mail size={16} />
                )}
                Send Invite
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Pending Invitations */}
      {canManageTeam && invites.length > 0 && (
        <section className="team-section">
          <div className="section-header">
            <Clock size={20} />
            <div>
              <h3>Pending Invitations</h3>
              <p>{invites.length} pending</p>
            </div>
          </div>

          <div className="invites-list">
            {invites.map(invite => (
              <div key={invite.id} className="invite-row">
                <div className="invite-info">
                  <span className="invite-email">{invite.email}</span>
                  <span className="invite-meta">
                    <RoleBadge role={invite.role} />
                    <span className="invite-date">
                      {invite.status === 'sent' ? 'Sent' : 'Pending'} {formatDate(invite.sentAt || invite.invitedAt)}
                    </span>
                  </span>
                </div>
                <div className="invite-actions">
                  <button
                    className="action-btn"
                    onClick={() => handleResend(invite.id)}
                    disabled={actionLoading === invite.id}
                    title="Resend invitation"
                  >
                    {actionLoading === invite.id ? (
                      <Loader2 size={14} className="spin" />
                    ) : (
                      <RefreshCw size={14} />
                    )}
                  </button>
                  <button
                    className="action-btn danger"
                    onClick={() => handleCancel(invite.id)}
                    disabled={actionLoading === invite.id}
                    title="Cancel invitation"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <style>{`
        .team-management {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .team-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          padding: 3rem;
          color: var(--color-gray-500);
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Message */
        .team-message {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          border-radius: var(--radius-lg);
          font-size: var(--font-size-sm);
        }

        .team-message.success {
          background: var(--color-success-light);
          color: var(--color-success-dark);
        }

        .team-message.error {
          background: var(--color-error-light);
          color: var(--color-error-dark);
        }

        /* Section */
        .team-section {
          background: white;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          padding: 1.5rem;
        }

        .section-header {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          margin-bottom: 1rem;
          color: var(--color-gray-700);
        }

        .section-header h3 {
          margin: 0;
          font-size: var(--font-size-base);
          font-weight: var(--font-weight-semibold);
          color: var(--color-gray-900);
        }

        .section-header p {
          margin: 0.125rem 0 0;
          font-size: var(--font-size-sm);
          color: var(--color-gray-500);
        }

        /* Members List */
        .members-list {
          display: flex;
          flex-direction: column;
        }

        .member-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 0;
          border-bottom: 1px solid var(--color-gray-100);
        }

        .member-row:last-child {
          border-bottom: none;
        }

        .member-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--color-primary-100);
          color: var(--color-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: var(--font-weight-semibold);
          font-size: var(--font-size-sm);
        }

        .member-info {
          flex: 1;
          min-width: 0;
        }

        .member-name {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          color: var(--color-gray-900);
        }

        .you-badge {
          font-size: var(--font-size-xs);
          padding: 0.125rem 0.375rem;
          background: var(--color-gray-100);
          color: var(--color-gray-600);
          border-radius: var(--radius-full);
          font-weight: var(--font-weight-normal);
        }

        .member-email {
          display: block;
          font-size: var(--font-size-xs);
          color: var(--color-gray-500);
        }

        /* Role Badge */
        .role-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.5rem;
          border-radius: var(--radius-full);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
        }

        .role-owner {
          background: #fef3c7;
          color: #92400e;
        }

        .role-admin {
          background: #dbeafe;
          color: #1e40af;
        }

        .role-staff {
          background: var(--color-gray-100);
          color: var(--color-gray-600);
        }

        /* Invite Form */
        .invite-form {
          margin-top: 0.5rem;
        }

        .invite-inputs {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .input-group {
          position: relative;
          flex: 1;
          min-width: 200px;
        }

        .input-icon {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-gray-400);
        }

        .input-group input {
          width: 100%;
          padding: 0.625rem 0.75rem 0.625rem 2.25rem;
          border: 1px solid var(--color-gray-300);
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
        }

        .input-group input:focus {
          outline: none;
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px var(--color-primary-100);
        }

        .role-select {
          padding: 0.625rem 0.75rem;
          border: 1px solid var(--color-gray-300);
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
          background: white;
        }

        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 1rem;
          background: var(--color-primary);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          cursor: pointer;
          white-space: nowrap;
        }

        .btn-primary:hover:not(:disabled) {
          background: var(--color-primary-hover);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Invites List */
        .invites-list {
          display: flex;
          flex-direction: column;
        }

        .invite-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.75rem 0;
          border-bottom: 1px solid var(--color-gray-100);
        }

        .invite-row:last-child {
          border-bottom: none;
        }

        .invite-info {
          flex: 1;
          min-width: 0;
        }

        .invite-email {
          display: block;
          font-size: var(--font-size-sm);
          color: var(--color-gray-900);
        }

        .invite-meta {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 0.25rem;
        }

        .invite-date {
          font-size: var(--font-size-xs);
          color: var(--color-gray-500);
        }

        .invite-actions {
          display: flex;
          gap: 0.375rem;
        }

        .action-btn {
          padding: 0.375rem;
          background: none;
          border: 1px solid var(--color-gray-200);
          border-radius: var(--radius-md);
          color: var(--color-gray-500);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .action-btn:hover:not(:disabled) {
          background: var(--color-gray-50);
          color: var(--color-gray-700);
          border-color: var(--color-gray-300);
        }

        .action-btn.danger:hover:not(:disabled) {
          background: var(--color-error-light);
          color: var(--color-error);
          border-color: var(--color-error);
        }

        .action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @media (max-width: 600px) {
          .invite-inputs {
            flex-direction: column;
          }

          .input-group {
            min-width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default TeamManagement;