/**
 * TwitchFeatures — Polls Twitch GQL every 30s for active predictions, polls, and drops.
 * Displays them in a collapsible slide-in panel from the right side.
 * Read-only: no voting or participation.
 */

import { TWITCH_CLIENT_ID } from '../../background/twitch-api';

interface PredictionOutcome {
  id: string;
  title: string;
  color: string;
  totalPoints: number;
  totalUsers: number;
  percentage: number;
}

interface ActivePrediction {
  id: string;
  title: string;
  status: string;
  outcomes: PredictionOutcome[];
  createdAt: string;
  lockedAt: string | null;
}

interface PollChoice {
  id: string;
  title: string;
  totalVotes: number;
  percentage: number;
}

interface ActivePoll {
  id: string;
  title: string;
  status: string;
  choices: PollChoice[];
  totalVotes: number;
  startedAt: string;
  endedAt: string | null;
}

interface DropProgress {
  campaignName: string;
  currentMinutesWatched: number;
  requiredMinutesWatched: number;
  percentage: number;
  gameName: string;
}

export class TwitchFeatures {
  private channel: string;
  private container: HTMLElement;
  private panel: HTMLElement | null = null;
  private badgeBtn: HTMLElement | null = null;
  private pollInterval: number | null = null;
  private destroyed = false;

  private predictions: ActivePrediction[] = [];
  private polls: ActivePoll[] = [];
  private drops: DropProgress[] = [];
  private deviceId = '';

  constructor(channel: string, controlsBar: HTMLElement, videoContainer: HTMLElement) {
    this.channel = channel.toLowerCase();
    this.container = videoContainer;
    this.init(controlsBar);
  }

  private async init(controlsBar: HTMLElement) {
    // Get device ID for GQL requests
    try {
      const data = await new Promise<Record<string, any>>((resolve) => {
        chrome.storage.local.get(['twitch_device_id'], (d) => resolve(d));
      });
      this.deviceId = data.twitch_device_id || '';
    } catch {
      // Continue without device ID
    }

    // Create badge button in controls
    this.badgeBtn = document.createElement('button');
    this.badgeBtn.className = 'ctrl-btn features-btn';
    this.badgeBtn.title = 'Predictions/Polls/Drops';
    this.badgeBtn.tabIndex = 0;
    this.badgeBtn.setAttribute('aria-label', 'Show predictions, polls, and drops');
    this.badgeBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
      <span class="features-badge" style="display:none">0</span>
    `;

    // Insert before the settings button
    const settingsBtn = controlsBar.querySelector('.settings-btn');
    const rightSection = controlsBar.querySelector('.controls-section:last-child');
    if (rightSection && settingsBtn) {
      rightSection.insertBefore(this.badgeBtn, settingsBtn);
    } else if (rightSection) {
      rightSection.appendChild(this.badgeBtn);
    }

    // Create slide-in panel
    this.panel = document.createElement('div');
    this.panel.className = 'features-panel';
    this.panel.innerHTML = `
      <div class="features-panel-header">
        <span class="features-panel-title">Channel Events</span>
        <button class="features-panel-close" tabindex="0" aria-label="Close events panel">&times;</button>
      </div>
      <div class="features-panel-content"></div>
    `;
    this.container.appendChild(this.panel);

    // Event listeners
    this.badgeBtn.addEventListener('click', () => {
      this.panel?.classList.toggle('active');
    });

    this.panel.querySelector('.features-panel-close')?.addEventListener('click', () => {
      this.panel?.classList.remove('active');
    });

    // Start polling
    this.fetchAll();
    this.pollInterval = window.setInterval(() => {
      if (!this.destroyed) this.fetchAll();
    }, 30000);
  }

  private async fetchAll(): Promise<void> {
    if (this.destroyed) return;

    await Promise.allSettled([
      this.fetchPredictions(),
      this.fetchPolls(),
      this.fetchDrops(),
    ]);

    this.updateBadge();
    this.renderPanel();
  }

  private async gqlQuery(query: string, variables: Record<string, any> = {}): Promise<any> {
    try {
      const headers: Record<string, string> = {
        'Client-ID': TWITCH_CLIENT_ID,
        'Content-Type': 'application/json',
      };
      if (this.deviceId) {
        headers['X-Device-Id'] = this.deviceId;
      }

      const res = await fetch('https://gql.twitch.tv/gql', {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
      });

      if (!res.ok) return null;
      const data = await res.json();
      if (data.errors) return null;
      return data.data;
    } catch {
      return null;
    }
  }

  private async fetchPredictions(): Promise<void> {
    const query = `
      query ChannelPointsPredictions($channelLogin: String!) {
        channel(name: $channelLogin) {
          id
          channelPointsPrediction {
            id
            title
            status
            createdAt
            lockedAt
            outcomes {
              id
              title
              color
              totalPoints
              totalUsers
            }
          }
        }
      }
    `;

    const data = await this.gqlQuery(query, { channelLogin: this.channel });
    if (!data?.channel?.channelPointsPrediction) {
      this.predictions = [];
      return;
    }

    const pred = data.channel.channelPointsPrediction;
    if (pred.status !== 'ACTIVE' && pred.status !== 'LOCKED') {
      this.predictions = [];
      return;
    }

    const totalPoints = pred.outcomes.reduce((s: number, o: any) => s + (o.totalPoints || 0), 0);
    this.predictions = [{
      id: pred.id,
      title: pred.title,
      status: pred.status,
      createdAt: pred.createdAt,
      lockedAt: pred.lockedAt,
      outcomes: pred.outcomes.map((o: any) => ({
        id: o.id,
        title: o.title,
        color: o.color === 'BLUE' ? '#388ed6' : '#f5009b',
        totalPoints: o.totalPoints || 0,
        totalUsers: o.totalUsers || 0,
        percentage: totalPoints > 0 ? Math.round((o.totalPoints / totalPoints) * 100) : 0,
      })),
    }];
  }

  private async fetchPolls(): Promise<void> {
    const query = `
      query ChannelPolls($channelLogin: String!) {
        channel(name: $channelLogin) {
          id
          polls {
            edges {
              node {
                id
                title
                status
                startedAt
                endedAt
                choices {
                  id
                  title
                  totalVotes
                }
              }
            }
          }
        }
      }
    `;

    const data = await this.gqlQuery(query, { channelLogin: this.channel });
    if (!data?.channel?.polls?.edges) {
      this.polls = [];
      return;
    }

    this.polls = data.channel.polls.edges
      .map((e: any) => e.node)
      .filter((p: any) => p.status === 'ACTIVE')
      .map((p: any) => {
        const totalVotes = p.choices.reduce((s: number, c: any) => s + (c.totalVotes || 0), 0);
        return {
          id: p.id,
          title: p.title,
          status: p.status,
          startedAt: p.startedAt,
          endedAt: p.endedAt,
          totalVotes,
          choices: p.choices.map((c: any) => ({
            id: c.id,
            title: c.title,
            totalVotes: c.totalVotes || 0,
            percentage: totalVotes > 0 ? Math.round((c.totalVotes / totalVotes) * 100) : 0,
          })),
        };
      });
  }

  private async fetchDrops(): Promise<void> {
    const query = `
      query DropCurrentSessionContext {
        currentUser {
          dropCurrentSession {
            currentMinutesWatched
            requiredMinutesWatched
            campaign {
              name
              game {
                displayName
              }
            }
          }
        }
      }
    `;

    const data = await this.gqlQuery(query);
    if (!data?.currentUser?.dropCurrentSession) {
      this.drops = [];
      return;
    }

    const session = data.currentUser.dropCurrentSession;
    const current = session.currentMinutesWatched || 0;
    const required = session.requiredMinutesWatched || 1;
    this.drops = [{
      campaignName: session.campaign?.name || 'Unknown Drop',
      currentMinutesWatched: current,
      requiredMinutesWatched: required,
      percentage: Math.min(100, Math.round((current / required) * 100)),
      gameName: session.campaign?.game?.displayName || '',
    }];
  }

  private updateBadge(): void {
    if (!this.badgeBtn) return;
    const badge = this.badgeBtn.querySelector('.features-badge') as HTMLElement;
    if (!badge) return;

    const count = this.predictions.length + this.polls.length + this.drops.length;
    if (count > 0) {
      badge.textContent = String(count);
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }

  private renderPanel(): void {
    if (!this.panel) return;
    const content = this.panel.querySelector('.features-panel-content');
    if (!content) return;

    let html = '';

    // Predictions
    for (const pred of this.predictions) {
      html += `<div class="features-section">
        <div class="features-section-title">Prediction ${pred.status === 'LOCKED' ? '(Locked)' : ''}</div>
        <div class="features-section-subtitle">${this.escapeHtml(pred.title)}</div>`;
      for (const outcome of pred.outcomes) {
        html += `
          <div class="features-outcome">
            <div class="features-outcome-header">
              <span class="features-outcome-title">${this.escapeHtml(outcome.title)}</span>
              <span class="features-outcome-pct">${outcome.percentage}%</span>
            </div>
            <div class="features-progress-bar">
              <div class="features-progress-fill" style="width:${outcome.percentage}%;background:${outcome.color}"></div>
            </div>
            <div class="features-outcome-stats">${this.formatPoints(outcome.totalPoints)} pts &middot; ${outcome.totalUsers} users</div>
          </div>`;
      }
      html += `</div>`;
    }

    // Polls
    for (const poll of this.polls) {
      html += `<div class="features-section">
        <div class="features-section-title">Poll</div>
        <div class="features-section-subtitle">${this.escapeHtml(poll.title)}</div>`;
      for (const choice of poll.choices) {
        html += `
          <div class="features-outcome">
            <div class="features-outcome-header">
              <span class="features-outcome-title">${this.escapeHtml(choice.title)}</span>
              <span class="features-outcome-pct">${choice.percentage}%</span>
            </div>
            <div class="features-progress-bar">
              <div class="features-progress-fill" style="width:${choice.percentage}%;background:var(--accent-color)"></div>
            </div>
            <div class="features-outcome-stats">${choice.totalVotes} votes</div>
          </div>`;
      }
      html += `<div class="features-total">Total: ${poll.totalVotes} votes</div></div>`;
    }

    // Drops
    for (const drop of this.drops) {
      html += `<div class="features-section">
        <div class="features-section-title">Drop Progress</div>
        <div class="features-section-subtitle">${this.escapeHtml(drop.campaignName)}</div>
        ${drop.gameName ? `<div class="features-outcome-stats">${this.escapeHtml(drop.gameName)}</div>` : ''}
        <div class="features-progress-bar" style="margin-top:6px">
          <div class="features-progress-fill" style="width:${drop.percentage}%;background:#10b981"></div>
        </div>
        <div class="features-outcome-stats">${drop.currentMinutesWatched}/${drop.requiredMinutesWatched} min (${drop.percentage}%)</div>
      </div>`;
    }

    if (!html) {
      html = '<div class="features-empty">No active predictions, polls, or drops</div>';
    }

    content.innerHTML = html;
  }

  private formatPoints(pts: number): string {
    if (pts >= 1000000) return `${(pts / 1000000).toFixed(1)}M`;
    if (pts >= 1000) return `${(pts / 1000).toFixed(1)}K`;
    return String(pts);
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  destroy(): void {
    this.destroyed = true;
    if (this.pollInterval) {
      window.clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.panel?.remove();
    this.badgeBtn?.remove();
  }
}
