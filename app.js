// YT Text Checker — Main Application Logic

(function () {
  const LIMITS = {
    script: { max: 50000, label: 'Script' },
    title: { max: 100, label: 'Title Limit' },
    description: { max: 5000, label: 'Description Limit' },
    tags: { max: 500, label: 'Tags Limit' },
  };

  const SAMPLE_TEXTS = {
    script:
      'হ্যালো বন্ধুরা, আজকের ভিডিওতে আমরা শিখবো কীভাবে সফটওয়্যার ক্র্যাক করতে হয় এবং পাসওয়ার্ড হ্যাক করা যায়। অনেকেই আমাকে গালি দেয় বা হারামি বলে, কিন্তু আমি আজকে আপনাদের miracle cure এবং 100% guarantee ট্রিকস দেখাবো। ভিডিও শেষে সবাই sub4sub করবেন।',
    title: 'How to Hack Wifi & Crack Paid Software 100% Guarantee! Sub4Sub (ফ্রি টাকা ইনকাম)',
    description:
      'এই ভিডিওতে দেখাবো কীভাবে পাসওয়ার্ড হ্যাক ও Mod APK ফ্রি ডাউনলোড করবেন। এছাড়াও কীভাবে জুয়া ও betting খেলে earn $1000 daily সম্ভব! গ্যারান্টি দিচ্ছি 100% working! কোনো সমস্যা হলে kill the process এবং sub4sub করুন।',
    tags: 'free hack, mod apk, crack software, sub4sub, get rich quick, ফ্রি টাকা, হ্যাকিং',
  };

  const SEVERITY_WEIGHT = { high: 22, medium: 12, low: 6 };
  const SEVERITY_LABEL = {
    high: 'High Risk',
    medium: 'Yellow $ Risk',
    low: 'Clickbait / Low',
  };
  const RING_CIRCUMFERENCE = 232.48; // 2 * PI * 37

  // State — Video Script is first & default
  let currentType = 'script';
  let activeFilter = 'all';
  let historyStack = [];
  let currentMatches = [];
  let lastAiRewrite = '';

  // DOM Elements
  const inputText = document.getElementById('inputText');
  const charCounter = document.getElementById('charCounter');
  const wordCounter = document.getElementById('wordCounter');
  const metricWords = document.getElementById('metricWords');
  const metricReadTime = document.getElementById('metricReadTime');
  const metricIssues = document.getElementById('metricIssues');
  const highlightedPreview = document.getElementById('highlightedPreview');
  const issuesList = document.getElementById('issuesList');
  const issueCount = document.getElementById('issueCount');
  const scoreRing = document.getElementById('scoreRing');
  const scoreCircle = document.getElementById('scoreCircle');
  const scoreValue = document.getElementById('scoreValue');
  const statusBadge = document.getElementById('statusBadge');
  const statusHeadline = document.getElementById('statusHeadline');
  const statusSummary = document.getElementById('statusSummary');
  const btnCheck = document.getElementById('btnCheck');
  const btnAiCheck = document.getElementById('btnAiCheck');
  const btnFixAll = document.getElementById('btnFixAll');
  const btnCopy = document.getElementById('btnCopy');
  const btnUndo = document.getElementById('btnUndo');
  const btnClear = document.getElementById('btnClear');
  const btnSample = document.getElementById('btnSample');
  const btnThemeToggle = document.getElementById('btnThemeToggle');
  const btnAiSettings = document.getElementById('btnAiSettings');
  const aiBadge = document.getElementById('aiBadge');
  const aiModal = document.getElementById('aiModal');
  const aiModalBackdrop = document.getElementById('aiModalBackdrop');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const geminiKeyInput = document.getElementById('geminiKeyInput');
  const btnSaveKey = document.getElementById('btnSaveKey');
  const btnRemoveKey = document.getElementById('btnRemoveKey');
  const aiResultCard = document.getElementById('aiResultCard');
  const aiResultBody = document.getElementById('aiResultBody');
  const btnApplyAiRewrite = document.getElementById('btnApplyAiRewrite');
  const toastEl = document.getElementById('toast');

  // === Helpers ===
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function buildTermRegex(term) {
    const escaped = escapeRegex(term);
    return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'giu');
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toastEl.classList.add('hidden');
    }, 2600);
  }

  function pushHistory(text) {
    if (historyStack[historyStack.length - 1] !== text) {
      historyStack.push(text);
      if (historyStack.length > 30) historyStack.shift();
    }
    btnUndo.disabled = historyStack.length === 0;
  }

  function formatSpeechTime(words) {
    if (words === 0) return '0 সে.';
    // Average YouTube speaking pace ~130 words/min
    const totalSec = Math.max(1, Math.round((words / 130) * 60));
    if (totalSec < 60) return `${totalSec} সে.`;
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return secs > 0 ? `${mins} মি. ${secs} সে.` : `${mins} মিনিট`;
  }

  function updateCounters() {
    const text = inputText.value;
    const limit = LIMITS[currentType];
    const len = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const speechTime = formatSpeechTime(words);

    charCounter.textContent = `${len} / ${limit.max} অক্ষর (${limit.label})`;
    charCounter.classList.toggle('over-limit', len > limit.max);
    wordCounter.textContent = `${words} শব্দ • ~${speechTime} স্পিচ`;

    metricWords.textContent = words;
    metricReadTime.textContent = speechTime;
  }

  // === Core Analysis ===
  function analyzeText(text) {
    if (!text.trim()) return [];

    const rules = window.YT_POLICY_RULES || [];
    const found = [];

    for (const rule of rules) {
      const regex = buildTermRegex(rule.term);
      let match;
      while ((match = regex.exec(text)) !== null) {
        found.push({
          id: `${match.index}-${match[0].length}-${rule.term}`,
          start: match.index,
          end: match.index + match[0].length,
          matchedText: match[0],
          rule,
        });
      }
    }

    found.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    const nonOverlapping = [];
    let lastEnd = -1;
    for (const item of found) {
      if (item.start >= lastEnd) {
        nonOverlapping.push(item);
        lastEnd = item.end;
      }
    }

    return nonOverlapping;
  }

  function computeScore(matches, text) {
    if (!text.trim()) return 100;

    let penalty = 0;
    for (const m of matches) {
      penalty += SEVERITY_WEIGHT[m.rule.severity] || 8;
    }

    const limit = LIMITS[currentType].max;
    if (text.length > limit) penalty += 5;

    const capsWords = text.match(/\b[A-Z]{4,}\b/g) || [];
    if (capsWords.length >= 3) penalty += 8;

    return Math.max(0, Math.min(100, 100 - penalty));
  }

  function renderPreview(text, matches) {
    if (!text.trim()) {
      highlightedPreview.classList.add('empty-state');
      highlightedPreview.innerHTML =
        'টেক্সট লিখলে বা পেস্ট করলে ঝুঁকিপূর্ণ শব্দগুলো এখানে তাৎক্ষণিকভাবে রঙ দিয়ে চিহ্নিত হবে।';
      return;
    }

    highlightedPreview.classList.remove('empty-state');
    if (matches.length === 0) {
      highlightedPreview.innerHTML = escapeHtml(text);
      return;
    }

    let html = '';
    let cursor = 0;
    for (const m of matches) {
      if (m.start > cursor) {
        html += escapeHtml(text.slice(cursor, m.start));
      }
      html += `<span class="hl-mark hl-${m.rule.severity}" data-match-id="${escapeHtml(m.id)}" title="${escapeHtml(m.rule.category)}">${escapeHtml(m.matchedText)}</span>`;
      cursor = m.end;
    }
    if (cursor < text.length) {
      html += escapeHtml(text.slice(cursor));
    }
    highlightedPreview.innerHTML = html;
  }

  function renderScore(score, matches, text) {
    scoreValue.textContent = score;
    metricIssues.textContent = matches.length;

    const offset = RING_CIRCUMFERENCE - (score / 100) * RING_CIRCUMFERENCE;
    scoreRing.style.strokeDashoffset = offset;

    scoreRing.classList.remove('safe', 'medium', 'high');
    scoreCircle.classList.remove('safe', 'medium', 'high');
    statusBadge.classList.remove('safe', 'medium', 'high');

    if (!text.trim()) {
      scoreRing.classList.add('safe');
      scoreCircle.classList.add('safe');
      statusBadge.classList.add('safe');
      statusBadge.textContent = 'Ready to Check';
      statusHeadline.textContent = 'টেক্সট যাচাই করতে প্রস্তুত';
      statusSummary.textContent =
        'আপনার ভিডিও স্ক্রিপ্ট বা টাইটেল দিন এবং ঝুঁকিপূর্ণ শব্দগুলো এক ক্লিকে নিরাপদ শব্দে ঠিক করুন।';
      return;
    }

    const highCount = matches.filter((m) => m.rule.severity === 'high').length;
    const medCount = matches.filter((m) => m.rule.severity === 'medium').length;

    if (highCount > 0 || score < 60) {
      scoreRing.classList.add('high');
      scoreCircle.classList.add('high');
      statusBadge.classList.add('high');
      statusBadge.textContent = 'High Policy Risk';
      statusHeadline.textContent = 'উচ্চ ঝুঁকিপূর্ণ শব্দ পাওয়া গেছে!';
      statusSummary.textContent = `${matches.length}টি সমস্যা পাওয়া গেছে। আপলোডের আগে লাল চিহ্নিত শব্দগুলো কারেকশন করুন।`;
    } else if (medCount > 0 || matches.length > 0 || score < 90) {
      scoreRing.classList.add('medium');
      scoreCircle.classList.add('medium');
      statusBadge.classList.add('medium');
      statusBadge.textContent = 'Monetization / Warning';
      statusHeadline.textContent = 'সতর্কতা: Yellow Dollar বা স্প্যাম ঝুঁকি';
      statusSummary.textContent = `${matches.length}টি ঝুঁকিপূর্ণ শব্দ আছে। নিচের সাজেশন থেকে ১ ক্লিকে সেগুলো নিরাপদ শব্দে বদলে নিন।`;
    } else {
      scoreRing.classList.add('safe');
      scoreCircle.classList.add('safe');
      statusBadge.classList.add('safe');
      statusBadge.textContent = 'Looks Clean & Safe';
      statusHeadline.textContent = 'দারুণ! কোনো ঝুঁকিপূর্ণ শব্দ মেলেনি';
      statusSummary.textContent =
        'লোকাল পলিসি রুল অনুযায়ী টেক্সটটি নিরাপদ মনে হচ্ছে। চাইলে AI Deep Check দিয়েও যাচাই করতে পারেন।';
    }
  }

  function renderIssues(matches) {
    const filtered =
      activeFilter === 'all'
        ? matches
        : matches.filter((m) => m.rule.severity === activeFilter);

    issueCount.textContent = matches.length;
    btnFixAll.disabled = matches.length === 0;

    if (matches.length === 0) {
      issuesList.innerHTML = `
        <div class="empty-issues">
          <div class="empty-icon">🛡️</div>
          <p>কোনো পলিসি-ঝুঁকিপূর্ণ শব্দ পাওয়া যায়নি</p>
          <small>টিপস: দ্রুত পরীক্ষা করতে বামপাশে <strong>"✨ ডেমো টেক্সট"</strong> বাটনে ক্লিক করুন।</small>
        </div>`;
      return;
    }

    if (filtered.length === 0) {
      issuesList.innerHTML = `
        <div class="empty-issues">
          <p>এই ক্যাটাগরিতে কোনো শব্দ পাওয়া যায়নি।</p>
        </div>`;
      return;
    }

    issuesList.innerHTML = '';
    for (const item of filtered) {
      const card = document.createElement('div');
      card.className = `issue-card severity-${item.rule.severity}`;
      card.dataset.matchId = item.id;

      const suggestionsHtml = item.rule.suggestions
        .map(
          (sug) =>
            `<button class="suggestion-chip" type="button" data-replace="${escapeHtml(sug)}">✓ ${escapeHtml(sug)}</button>`
        )
        .join('');

      card.innerHTML = `
        <div class="issue-top">
          <span class="issue-word">"${escapeHtml(item.matchedText)}"</span>
          <span class="issue-cat ${item.rule.severity}">${SEVERITY_LABEL[item.rule.severity]} • ${escapeHtml(item.rule.category)}</span>
        </div>
        <p class="issue-reason">${escapeHtml(item.rule.reason)}</p>
        <div class="suggestions-label">নিরাপদ বিকল্প শব্দ (ক্লিক করলেই বদলে যাবে):</div>
        <div class="suggestions-row">${suggestionsHtml}</div>
        <div class="custom-fix-row">
          <input class="custom-fix-input" type="text" placeholder="নিজের মতো শব্দ লিখুন..." />
          <button class="btn btn-sm btn-outline custom-fix-btn" type="button">Apply</button>
        </div>
      `;

      card.querySelectorAll('.suggestion-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          replaceMatch(item, chip.dataset.replace);
        });
      });

      const customInput = card.querySelector('.custom-fix-input');
      const customBtn = card.querySelector('.custom-fix-btn');
      customBtn.addEventListener('click', () => {
        const val = customInput.value.trim();
        if (!val) {
          showToast('অনুগ্রহ করে একটি বিকল্প শব্দ লিখুন');
          return;
        }
        replaceMatch(item, val);
      });

      issuesList.appendChild(card);
    }
  }

  function runCheck() {
    const text = inputText.value;
    updateCounters();
    currentMatches = analyzeText(text);
    const score = computeScore(currentMatches, text);
    renderPreview(text, currentMatches);
    renderScore(score, currentMatches, text);
    renderIssues(currentMatches);
  }

  // === Word Replacement ===
  function matchCase(original, replacement) {
    if (original === original.toUpperCase() && /[A-Z]/.test(original)) {
      return replacement.toUpperCase();
    }
    if (/^[A-Z]/.test(original) && /^[a-z]/.test(replacement)) {
      return replacement.charAt(0).toUpperCase() + replacement.slice(1);
    }
    return replacement;
  }

  function replaceMatch(matchItem, replacement) {
    const text = inputText.value;
    pushHistory(text);
    const adjusted = matchCase(matchItem.matchedText, replacement);
    inputText.value =
      text.slice(0, matchItem.start) + adjusted + text.slice(matchItem.end);
    runCheck();
    showToast(`"${matchItem.matchedText}" → "${adjusted}" পরিবর্তন হয়েছে`);
  }

  function fixAllMatches() {
    if (currentMatches.length === 0) return;
    const text = inputText.value;
    pushHistory(text);

    let updated = text;
    const sortedDesc = [...currentMatches].sort((a, b) => b.start - a.start);
    for (const m of sortedDesc) {
      const topSuggestion = m.rule.suggestions[0];
      if (!topSuggestion) continue;
      const adjusted = matchCase(m.matchedText, topSuggestion);
      updated = updated.slice(0, m.start) + adjusted + updated.slice(m.end);
    }

    inputText.value = updated;
    runCheck();
    showToast(`${currentMatches.length}টি ঝুঁকিপূর্ণ শব্দ নিরাপদ শব্দে কারেকশন হয়েছে!`);
  }

  // === Optional Free Gemini AI Integration ===
  function getGeminiKey() {
    return localStorage.getItem('yt_checker_gemini_key') || '';
  }

  function updateAiBadge() {
    const hasKey = Boolean(getGeminiKey());
    aiBadge.textContent = hasKey ? 'Ready' : 'Off';
    aiBadge.className = hasKey ? 'badge badge-on' : 'badge badge-muted';
  }

  async function runAiDeepCheck() {
    const text = inputText.value.trim();
    if (!text) {
      showToast('প্রথমে কিছু টেক্সট লিখুন');
      return;
    }

    const apiKey = getGeminiKey();
    if (!apiKey) {
      openModal();
      showToast('AI Deep Check-এর জন্য ফ্রি Gemini API Key দিন');
      return;
    }

    btnAiCheck.disabled = true;
    btnAiCheck.textContent = '⏳ AI যাচাই করছে...';
    aiResultCard.classList.remove('hidden');
    aiResultBody.textContent = 'Gemini AI আপনার টেক্সটের কনটেক্সট বিশ্লেষণ করছে...';
    btnApplyAiRewrite.classList.add('hidden');

    const prompt = `You are a YouTube Policy & Monetization Expert. Analyze the following YouTube ${currentType} text for YouTube Community Guidelines, Advertiser-Friendly Guidelines (Yellow Dollar risks), and Spam/Metadata policies.

Respond in clean Bengali (with English policy terms where helpful) in this exact structure:
1. ঝুঁকির মাত্রা: (Safe / Medium / High)
2. সমস্যা ও কারণ: (bullet points of any risky words, phrases, or context issues; if none, say it looks safe)
3. নিরাপদ ও উন্নত সংস্করণ (Safe Rewrite):
Provide a clean, policy-safe rewritten version inside <<<REWRITE>>> and <<<END_REWRITE>>> tags so the user can apply it with one click.

Text to analyze:
"""
${text}
"""`;

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3 },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message || 'API Request Failed');
      }

      const rawText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        'AI থেকে কোনো উত্তর পাওয়া যায়নি।';

      const rewriteMatch = rawText.match(/<<<REWRITE>>>([\s\S]*?)<<<END_REWRITE>>>/);
      if (rewriteMatch && rewriteMatch[1].trim()) {
        lastAiRewrite = rewriteMatch[1].trim();
        btnApplyAiRewrite.classList.remove('hidden');
      } else {
        lastAiRewrite = '';
      }

      const cleanedDisplay = rawText
        .replace(/<<<REWRITE>>>/g, '')
        .replace(/<<<END_REWRITE>>>/g, '')
        .trim();

      aiResultBody.textContent = cleanedDisplay;
    } catch (err) {
      aiResultBody.textContent = `ত্রুটি হয়েছে: ${err.message}\n\nআপনার Gemini API Key সঠিক আছে কিনা যাচাই করুন।`;
    } finally {
      btnAiCheck.disabled = false;
      btnAiCheck.textContent = '✨ AI Deep Check (Free)';
    }
  }

  // === Modal & Theme ===
  function openModal() {
    geminiKeyInput.value = getGeminiKey();
    aiModal.classList.remove('hidden');
  }

  function closeModal() {
    aiModal.classList.add('hidden');
  }

  function initTheme() {
    const saved = localStorage.getItem('yt_checker_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    btnThemeToggle.textContent = saved === 'dark' ? '☀️' : '🌙';
  }

  // === Event Listeners ===
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentType = btn.dataset.type;
      runCheck();
    });
  });

  document.querySelectorAll('.filter-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      activeFilter = pill.dataset.filter;
      renderIssues(currentMatches);
    });
  });

  inputText.addEventListener('input', () => {
    runCheck();
  });

  btnCheck.addEventListener('click', () => {
    runCheck();
    showToast('পলিসি চেক সম্পন্ন হয়েছে');
  });

  btnFixAll.addEventListener('click', fixAllMatches);

  btnUndo.addEventListener('click', () => {
    if (historyStack.length === 0) return;
    inputText.value = historyStack.pop();
    btnUndo.disabled = historyStack.length === 0;
    runCheck();
    showToast('আগের অবস্থায় ফেরত নেওয়া হয়েছে');
  });

  btnClear.addEventListener('click', () => {
    if (!inputText.value) return;
    pushHistory(inputText.value);
    inputText.value = '';
    aiResultCard.classList.add('hidden');
    runCheck();
  });

  btnSample.addEventListener('click', () => {
    if (inputText.value) pushHistory(inputText.value);
    inputText.value = SAMPLE_TEXTS[currentType] || SAMPLE_TEXTS.script;
    runCheck();
    showToast('ডেমো ঝুঁকিপূর্ণ টেক্সট লোড হয়েছে');
  });

  btnCopy.addEventListener('click', async () => {
    const text = inputText.value;
    if (!text.trim()) {
      showToast('কপি করার জন্য কোনো টেক্সট নেই');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast('সংশোধিত টেক্সট ক্লিপবোর্ডে কপি হয়েছে!');
    } catch {
      inputText.select();
      document.execCommand('copy');
      showToast('টেক্সট কপি হয়েছে!');
    }
  });

  highlightedPreview.addEventListener('click', (e) => {
    const mark = e.target.closest('.hl-mark');
    if (!mark) return;
    const matchId = mark.dataset.matchId;

    if (activeFilter !== 'all') {
      activeFilter = 'all';
      document.querySelectorAll('.filter-pill').forEach((p) => {
        p.classList.toggle('active', p.dataset.filter === 'all');
      });
      renderIssues(currentMatches);
    }

    const card = issuesList.querySelector(`[data-match-id="${CSS.escape(matchId)}"]`);
    if (card) {
      issuesList.querySelectorAll('.issue-card').forEach((c) => c.classList.remove('focused'));
      card.classList.add('focused');
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });

  btnThemeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const next = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('yt_checker_theme', next);
    btnThemeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
  });

  btnAiSettings.addEventListener('click', openModal);
  btnCloseModal.addEventListener('click', closeModal);
  aiModalBackdrop.addEventListener('click', closeModal);

  btnSaveKey.addEventListener('click', () => {
    const key = geminiKeyInput.value.trim();
    if (!key) {
      showToast('অনুগ্রহ করে একটি বৈধ API Key দিন');
      return;
    }
    localStorage.setItem('yt_checker_gemini_key', key);
    updateAiBadge();
    closeModal();
    showToast('Gemini API Key সেভ হয়েছে!');
  });

  btnRemoveKey.addEventListener('click', () => {
    localStorage.removeItem('yt_checker_gemini_key');
    geminiKeyInput.value = '';
    updateAiBadge();
    closeModal();
    showToast('API Key মুছে ফেলা হয়েছে');
  });

  btnAiCheck.addEventListener('click', runAiDeepCheck);

  btnApplyAiRewrite.addEventListener('click', () => {
    if (!lastAiRewrite) return;
    pushHistory(inputText.value);
    inputText.value = lastAiRewrite;
    runCheck();
    showToast('AI-এর নিরাপদ টেক্সট প্রয়োগ করা হয়েছে!');
  });

  // Init
  initTheme();
  updateAiBadge();
  runCheck();
})();
