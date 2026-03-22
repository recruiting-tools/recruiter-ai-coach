/**
 * Service Worker — Audio Capture Orchestrator (Track 1)
 *
 * Responsibilities:
 *   - Manage offscreen document lifecycle (create / destroy)
 *   - Obtain streamId via chrome.tabCapture.getMediaStreamId
 *   - Monitor offscreen health via periodic ping
 *   - Detect tab close / navigation → auto-stop capture
 *   - Route events: offscreen → content.js / popup
 *
 * Does NOT do: audio processing, transcription, hints. Those are Tracks 2 & 3.
 */

const BACKEND_URL = 'http://localhost:3000';

// ── Capture state ─────────────────────────────────────────────────────────────
let captureState = 'idle';   // mirrors offscreen STATE machine
let currentTabId = null;
let sessionId    = null;

// ── Health check ──────────────────────────────────────────────────────────────
const HEALTH_PING_INTERVAL = 10_000; // ms
let healthPingTimer = null;

// ─────────────────────────────────────────────────────────────────────────────
// Message handler
// ─────────────────────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // Commands from popup
  if (msg.type === 'start_capture') {
    startCapture().then(sendResponse);
    return true; // async
  }

  if (msg.type === 'stop_capture') {
    stopCapture('user_request').then(sendResponse);
    return true;
  }

  if (msg.type === 'get_status') {
    sendResponse({ captureState, tabId: currentTabId, sessionId });
    return;
  }

  // ── Events from offscreen → forward to content.js / popup ──

  // State changes
  if (msg.type === 'capture_state') {
    captureState = msg.state;
    if (msg.state === 'capturing') {
      broadcastToMeetTab({ type: 'status', status: 'listening' });
      broadcastToPopup(msg);
    } else if (msg.state === 'idle') {
      if (healthPingTimer) { clearInterval(healthPingTimer); healthPingTimer = null; }
      broadcastToMeetTab({ type: 'status', status: 'stopped' });
      broadcastToPopup(msg);
    } else if (msg.state === 'error') {
      if (healthPingTimer) { clearInterval(healthPingTimer); healthPingTimer = null; }
      broadcastToMeetTab({ type: 'status', status: 'error', error: msg.error });
      broadcastToPopup(msg);
      console.error('[Background] Capture error:', msg.error);
    }
    return;
  }

  // Track ended unexpectedly
  if (msg.type === 'track_ended') {
    console.warn('[Background] Track ended — cleaning up');
    currentTabId = null;
    stopCapture('track_ended');
    return;
  }

  // WS transport status — forward to popup for diagnostics
  if (msg.type === 'ws_status') {
    broadcastToPopup(msg);
    return;
  }

  // Audio level + stats → forward to popup / content
  if (msg.type === 'audio_level') {
    broadcastToMeetTab(msg);
    broadcastToPopup(msg);
    return;
  }

  if (msg.type === 'audio_stats') {
    broadcastToPopup(msg);
    return;
  }

  if (msg.type === 'audio_silent') {
    broadcastToMeetTab(msg);
    broadcastToPopup(msg);
    return;
  }

  // Transcript + hints (from Track 2 via offscreen)
  if (msg.type === 'transcript_interim') {
    broadcastToMeetTab({ type: 'transcript_interim', text: msg.text });
    return;
  }

  if (msg.type === 'transcript_final') {
    broadcastToMeetTab({ type: 'transcript_final', text: msg.text, speaker: msg.speaker, speechFinal: msg.speechFinal });
    return;
  }

  if (msg.type === 'hint') {
    broadcastToMeetTab({ type: 'hint', hint: msg.hint });
    return;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Tab event listeners — auto-stop when Meet tab closes or navigates away
// ─────────────────────────────────────────────────────────────────────────────
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === currentTabId) {
    console.log('[Background] Meet tab closed — stopping capture');
    stopCapture('tab_closed');
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId !== currentTabId) return;
  // If URL changed away from Meet/Zoom
  if (changeInfo.url && !isMeetUrl(changeInfo.url)) {
    console.log('[Background] Meet tab navigated away — stopping capture');
    stopCapture('tab_navigated');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Start capture
// ─────────────────────────────────────────────────────────────────────────────
async function startCapture() {
  try {
    await ensureOffscreenStopped();

    // Find a Meet/Zoom tab
    const tabs = await chrome.tabs.query({
      url: ['https://meet.google.com/*', 'https://zoom.us/*'],
    });

    if (!tabs.length) {
      return { error: 'Открой Google Meet или Zoom в браузере' };
    }

    const targetTab = tabs.find((t) => t.active) || tabs[0];
    currentTabId   = targetTab.id;
    sessionId      = 'tab_' + currentTabId + '_' + Date.now();

    // Get streamId (must happen in service worker, not offscreen)
    const streamId = await new Promise((resolve, reject) => {
      chrome.tabCapture.getMediaStreamId(
        { targetTabId: currentTabId },
        (id) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve(id);
        },
      );
    });

    // Create fresh offscreen document
    await recreateOffscreen();

    // Hand off to offscreen
    await chrome.runtime.sendMessage({
      target:    'offscreen',
      type:      'start_capture',
      streamId,
      sessionId,
    });

    // Start health ping
    startHealthPing();

    return { ok: true, tabId: currentTabId, sessionId };

  } catch (err) {
    console.error('[Background] startCapture error:', err);
    return { error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stop capture
// ─────────────────────────────────────────────────────────────────────────────
async function stopCapture(reason = 'user_request') {
  if (healthPingTimer) { clearInterval(healthPingTimer); healthPingTimer = null; }

  await chrome.runtime.sendMessage({
    target: 'offscreen',
    type:   'stop_capture',
  }).catch(() => {});

  currentTabId = null;
  sessionId    = null;

  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Health ping — detect if offscreen died silently
// ─────────────────────────────────────────────────────────────────────────────
function startHealthPing() {
  if (healthPingTimer) clearInterval(healthPingTimer);

  healthPingTimer = setInterval(async () => {
    if (captureState !== 'capturing' && captureState !== 'starting') {
      clearInterval(healthPingTimer);
      healthPingTimer = null;
      return;
    }

    try {
      const resp = await chrome.runtime.sendMessage({
        target: 'offscreen',
        type:   'health_ping',
      });

      if (!resp?.ok) {
        console.warn('[Background] Health ping failed — offscreen may be dead');
        await handleOffscreenDead();
      }
    } catch {
      // offscreen not responding
      console.warn('[Background] Offscreen not responding to health ping');
      await handleOffscreenDead();
    }
  }, HEALTH_PING_INTERVAL);
}

async function handleOffscreenDead() {
  clearInterval(healthPingTimer);
  healthPingTimer = null;
  captureState = 'error';
  broadcastToMeetTab({ type: 'status', status: 'error', error: 'Offscreen document died' });
  broadcastToPopup({ type: 'capture_state', state: 'error', error: 'Offscreen document died' });
  currentTabId = null;
  sessionId    = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Offscreen document management
// ─────────────────────────────────────────────────────────────────────────────
async function ensureOffscreenStopped() {
  await chrome.runtime.sendMessage({
    target: 'offscreen',
    type:   'stop_capture',
  }).catch(() => {});

  try {
    if (await chrome.offscreen.hasDocument?.()) {
      await chrome.offscreen.closeDocument();
    }
  } catch {}
}

async function recreateOffscreen() {
  try {
    if (await chrome.offscreen.hasDocument?.()) {
      await chrome.offscreen.closeDocument();
    }
  } catch {}

  await chrome.offscreen.createDocument({
    url:           'offscreen.html',
    reasons:       ['USER_MEDIA'],
    justification: 'Capture tab audio for real-time AI coaching during interviews',
  });

  console.log('[Background] Offscreen document created');
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function isMeetUrl(url) {
  return url.startsWith('https://meet.google.com/') || url.startsWith('https://zoom.us/');
}

function broadcastToMeetTab(message) {
  chrome.tabs.query(
    { url: ['https://meet.google.com/*', 'https://zoom.us/*'] },
    (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {});
      });
    },
  );
}

function broadcastToPopup(message) {
  chrome.runtime.sendMessage(message).catch(() => {});
}
