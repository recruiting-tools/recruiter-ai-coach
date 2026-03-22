const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', async () => {
  const res = await chrome.runtime.sendMessage({ type: 'get_status' }) || {};
  const active = res.captureState === 'capturing' || res.captureState === 'starting';
  if (active) setActive(true);
});

$('startBtn').addEventListener('click', async () => {
  const btn = $('startBtn');
  btn.disabled = true;
  btn.textContent = 'Подключаюсь...';

  const res = await chrome.runtime.sendMessage({ type: 'start_capture' });

  if (res?.error) {
    $('status').textContent = '❌ ' + res.error;
    btn.disabled = false;
    btn.textContent = '▶ Начать';
    return;
  }

  setActive(true);
  $('status').textContent = '✅ Слушаю оба голоса...';
});

$('stopBtn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'stop_capture' });
  setActive(false);
  $('status').textContent = 'Остановлено';
});

function setActive(active) {
  $('startBtn').style.display = active ? 'none' : 'block';
  $('stopBtn').style.display = active ? 'block' : 'none';
  $('startBtn').disabled = false;
  $('startBtn').textContent = '▶ Начать';
  $('dot').className = active ? 'dot on' : 'dot';
}

chrome.runtime.onMessage.addListener((msg) => {
  // New state machine events
  if (msg.type === 'capture_state') {
    if (msg.state === 'capturing') {
      setActive(true);
      $('status').textContent = '✅ Слушаю оба голоса...';
    } else if (msg.state === 'idle') {
      setActive(false);
      $('status').textContent = 'Остановлено';
    } else if (msg.state === 'error') {
      setActive(false);
      $('status').textContent = '❌ ' + (msg.error || 'Ошибка захвата');
    } else if (msg.state === 'starting') {
      $('status').textContent = '⏳ Подключаюсь...';
    }
    return;
  }
  // Legacy status events from content.js broadcast
  if (msg.type === 'status') {
    if (msg.status === 'listening') {
      setActive(true);
      $('status').textContent = '✅ Слушаю оба голоса...';
    } else if (msg.status === 'stopped' || msg.status === 'error') {
      setActive(false);
      $('status').textContent = msg.error || 'Остановлено';
    }
  }
});
