// ── PATTON INC — AI LAYER (Claude API) ──────────────────────────────
const AI = {
  getKey() {
    return localStorage.getItem('patton_claude_key') || '';
  },
  setKey(key) {
    localStorage.setItem('patton_claude_key', key);
  },
  hasKey() {
    return !!this.getKey();
  },

  async call(userPrompt, systemPrompt = '', maxTokens = 300) {
    const key = this.getKey();
    if (!key) throw new Error('No API key set — go to Profile → ⚙ Settings');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error ${response.status}`);
    }
    const data = await response.json();
    return data.content[0].text;
  },

  // ── CADDIE ADVICE ────────────────────────────────────────────────
  async getCaddieAdvice(holeIdx, holeDef, userHdcp, caddieMem, stats) {
    const mem = caddieMem[holeIdx] || [];
    let historyText = 'No previous data on this hole.';
    if (mem.length > 0) {
      const byClub = {};
      mem.forEach(m => {
        if (!byClub[m.club]) byClub[m.club] = { good: 0, okay: 0, disaster: 0 };
        byClub[m.club][m.result] = (byClub[m.club][m.result] || 0) + 1;
      });
      historyText = Object.entries(byClub).map(([club, d]) => {
        const total = (d.good || 0) + (d.okay || 0) + (d.disaster || 0);
        return `${club}: ${total} rounds — ${d.good || 0} good, ${d.okay || 0} okay, ${d.disaster || 0} disaster`;
      }).join('\n');
    }
    const statsLine = stats.fairways !== null
      ? `Recent stats: ${stats.fairways}% fairways, ${stats.gir}% GIR, ${stats.avgPutts} putts/round`
      : 'No round stats yet.';

    const prompt = `Golf caddie advice for hole ${holeIdx + 1}.

Hole: Par ${holeDef.p}, ${holeDef.y} yards, ${holeDef.d}
Player handicap: ${userHdcp}
${statsLine}

Club history on this hole:
${historyText}

Give a 2-sentence recommendation: which club to hit and one tactical tip. Be direct. No filler.`;

    return this.call(
      prompt,
      'You are a sharp, confident golf caddie. Keep advice to 2 sentences. Be specific to the data. Plain language.',
      200
    );
  },

  // ── POST-ROUND RECAP ─────────────────────────────────────────────
  async getPostRoundRecap(round, caddieMem, userHdcp) {
    if (!round?.summary) throw new Error('No round data');
    const s = round.summary;
    const holeDetails = (round.holes || []).map((h, i) =>
      h ? `Hole ${i + 1}: ${h.club || 'no club logged'} — ${h.result}` : `Hole ${i + 1}: skipped`
    ).join('\n');

    const prompt = `Post-round coaching recap for a ${userHdcp} handicap player.

Score: ${s.score} | Fairways: ${s.fairways}/${s.fwTotal} | GIR: ${s.gir}/${s.girTotal} | 3-putts: ${s.putts}
Course: ${round.course || 'unknown'}

Hole-by-hole:
${holeDetails}

Write exactly 3 lines:
1. What went well (specific to the data)
2. Biggest weakness to fix (most impactful, data-driven)
3. One drill or focus for the next round

No generic advice. Reference actual holes or clubs where possible.`;

    return this.call(
      prompt,
      'You are a golf coach. Be data-driven and specific. Exactly 3 short sentences.',
      250
    );
  },

  // ── CHALLENGE SUGGESTION ─────────────────────────────────────────
  async getChallengeSuggestion(stats, friends, existingChallenges) {
    const weakArea = stats.fairways !== null && stats.fairways < 50 ? `fairways (${stats.fairways}%)`
      : stats.gir !== null && stats.gir < 40 ? `greens in regulation (${stats.gir}%)`
      : stats.avgPutts !== null && stats.avgPutts > 1.8 ? `3-putts (avg ${stats.avgPutts}/round)`
      : 'overall handicap improvement';

    const prompt = `Design a golf improvement challenge.

Player's weakest area: ${weakArea}
Friends available: ${friends.map(f => f.name + ' (hdcp ' + f.hdcp + ')').join(', ')}
Active challenges: ${existingChallenges.length}

Respond in this exact format:
Title: [challenge name]
Metric: [what is measured]
Duration: [timeframe]
Stake: [fun consequence]
Why: [one sentence on why this targets the weakness]`;

    return this.call(
      prompt,
      'You are a competitive golf challenge designer. Be creative, specific, and motivating.',
      200
    );
  },

  // ── NETWORK MESSAGE DRAFT ────────────────────────────────────────
  async draftRoundRequest(player, userNote, lastPlayed, userName) {
    const prompt = `Draft a short round request message from ${userName || 'a golf contact'}.

Recipient: ${player.n}, ${player.r}
Their availability: ${player.av}
Last played together: ${lastPlayed || 'never'}
Note about them: ${userNote || 'none'}

Write 2 sentences max. Casual, personal, not generic. Reference their role or availability if natural.`;

    return this.call(
      prompt,
      'You are writing a casual golf message between business professionals. Keep it brief and genuine.',
      150
    );
  },

  // ── FEED WEEKLY SUMMARY ──────────────────────────────────────────
  async getWeeklySummary(stats, challenges, rounds) {
    const recentRounds = rounds.slice(-3);
    const prompt = `Write a 2-sentence weekly golf summary for this player.

Handicap: ${stats.hdcpTrend !== null ? (stats.hdcpTrend > 0 ? '+' : '') + stats.hdcpTrend + ' trend' : 'no trend data'}
Rounds this week: ${recentRounds.length}
Active challenges: ${challenges.length} (rank: #${challenges[0]?.rank || 'N/A'})
Fairways: ${stats.fairways !== null ? stats.fairways + '%' : 'no data'}

Be motivational but honest. Reference the actual numbers.`;

    return this.call(
      prompt,
      'You are a golf performance coach writing a weekly summary. 2 sentences max. Tone: competitive and direct.',
      150
    );
  }
};
