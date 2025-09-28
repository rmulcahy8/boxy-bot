const chatBody = document.getElementById('chatBody');
const quickReplies = document.getElementById('quickReplies');
const textEntry = document.getElementById('textEntry');
const userInput = document.getElementById('userInput');
const inputLabel = document.getElementById('inputLabel');
const inputHint = document.getElementById('inputHint');

const conversation = {
  step: null,
  data: {},
};

let activeInputStep = null;
let typingQueue = Promise.resolve();

const TYPEWRITER_DELAY = 22;
const BLOCK_ELEMENTS = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'BR',
  'DIV',
  'DL',
  'FIELDSET',
  'FIGCAPTION',
  'FIGURE',
  'FOOTER',
  'FORM',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'HR',
  'LI',
  'MAIN',
  'NAV',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'TABLE',
  'UL',
]);

const locations = [
  'Chicago, IL distribution center',
  'Dallas, TX logistics hub',
  'Jersey City, NJ sorting facility',
  'Portland, OR depot',
  'Atlanta, GA air dock',
  'Los Angeles, CA gateway facility',
];

const statusPhrases = [
  'Package processed and in transit',
  'Parcel arrived at regional facility',
  'Shipment departed local hub',
  'Package scanned - out for next leg',
  'Parcel processed - awaiting departure',
];

const steps = {
  start: {
    onEnter() {
      botSay("Hello, I'm Boxy. How can I help with your package today?");
      setQuickReplies([
        { label: 'No tracking updates', next: 'askTrackingNumber' },
        { label: 'Package seems missing', next: 'askExpectedDate' },
        { label: 'Package arrived damaged', next: 'askDamageDescription' },
        { label: "Something else", next: 'offTopic' },
      ]);
    },
  },
  askTrackingNumber: {
    onEnter() {
      botSay(
        'I can check what we know so far. Please enter your tracking number.'
      );
      showTextInput({
        label: 'Tracking number',
        placeholder: '1Z999AA10123456784',
        hint: 'Use 8-22 letters or numbers.',
      });
    },
    onInput(value) {
      const normalized = value.replace(/\s+/g, '');
      if (!/^[A-Za-z0-9]{8,22}$/.test(normalized)) {
        botSay(
          "That number doesn't look right. Tracking numbers are 8-22 letters or digits."
        );
        inputHint.textContent = 'Example: 1Z999AA10123456784';
        return { stay: true };
      }
      inputHint.textContent = '';
      conversation.data.trackingNumber = normalized.toUpperCase();
      botSay(`Thanks! Got it: <strong>${conversation.data.trackingNumber}</strong>.`);
      return { next: 'askCarrier' };
    },
  },
  askCarrier: {
    onEnter() {
      botSay('Which carrier is moving this package?');
      setQuickReplies([
        { label: 'UPS', value: 'UPS' },
        { label: 'USPS', value: 'USPS' },
        { label: 'FedEx', value: 'FedEx' },
      ]);
    },
    onSelect(option) {
      const carrier = option.value;
      if (!['UPS', 'USPS', 'FedEx'].includes(carrier)) {
        botSay('Please choose UPS, USPS, or FedEx.');
        return { stay: true };
      }
      conversation.data.carrier = carrier;
      botSay(`Thanks! Let me check ${carrier} for you.`);
      return { next: 'showTrackingStatus' };
    },
  },
  showTrackingStatus: {
    onEnter() {
      const summary = buildTrackingSummary();
      botSay(
        [
          `<strong>Status:</strong> ${summary.status}`,
          `<small>Last scan: ${summary.lastScan}</small>`,
          `<small>ETA: ${summary.eta}</small>`,
        ]
      );
      setQuickReplies([
        { label: 'Set delivery alerts', next: 'alertsConfigured' },
        { label: 'Talk to an agent', next: 'agentTransfer' },
        { label: 'All set', next: 'closing' },
      ]);
    },
  },
  alertsConfigured: {
    onEnter() {
      botSay(
        'Alerts are on! You will get notifications for every scan and on delivery day.'
      );
      setQuickReplies([
        { label: 'Talk to an agent', next: 'agentTransfer' },
        { label: 'All set', next: 'closing' },
      ]);
    },
  },
  askExpectedDate: {
    onEnter() {
      botSay(
        'I can start an investigation. When was the package supposed to arrive? (YYYY-MM-DD)'
      );
      showTextInput({
        label: 'Expected delivery date',
        placeholder: '2024-03-22',
        hint: 'Use YYYY-MM-DD and choose a past date.',
      });
    },
    onInput(value) {
      const trimmed = value.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        botSay('Please use the YYYY-MM-DD format.');
        inputHint.textContent = 'Example: 2024-03-22';
        return { stay: true };
      }
      const entered = new Date(trimmed);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (Number.isNaN(entered.getTime())) {
        botSay('That date does not seem valid. Try again using YYYY-MM-DD.');
        return { stay: true };
      }
      if (entered > today) {
        botSay('The date cannot be in the future.');
        inputHint.textContent = 'Choose a date on or before today.';
        return { stay: true };
      }
      inputHint.textContent = '';
      conversation.data.expectedDate = trimmed;
      botSay(`Thanks, noted ${trimmed}. Starting an investigation ticket now.`);
      return { next: 'investigationOpened' };
    },
  },
  investigationOpened: {
    onEnter() {
      const ticket = generateTicket('INV');
      conversation.data.investigationId = ticket;
      botSay(
        `Ticket <strong>${ticket}</strong> is open. Our team will review scans and reach out within 24 hours.`
      );
      setQuickReplies([
        { label: 'Talk to an agent', next: 'agentTransfer' },
        { label: 'All set', next: 'closing' },
      ]);
    },
  },
  askDamageDescription: {
    onEnter() {
      botSay('I am so sorry to hear that. Can you describe the damage?');
      showTextInput({
        label: 'Damage description',
        placeholder: 'e.g. Box crushed and item dented',
        hint: 'A short description helps us document the claim.',
      });
    },
    onInput(value) {
      const description = value.trim();
      if (description.length < 10) {
        botSay('Could you share a few more details about the damage?');
        inputHint.textContent = 'Try adding at least 10 characters.';
        return { stay: true };
      }
      inputHint.textContent = '';
      conversation.data.damageDescription = description;
      botSay('Thanks. I will file a claim right away.');
      return { next: 'claimFiled' };
    },
  },
  claimFiled: {
    onEnter() {
      const ticket = generateTicket('CLM');
      conversation.data.claimId = ticket;
      botSay(
        `Claim <strong>${ticket}</strong> is submitted. Please hang onto the packaging until our partner reviews photos.`
      );
      setQuickReplies([
        { label: 'Care tips while you wait', next: 'damageTips' },
        { label: 'All set', next: 'closing' },
      ]);
    },
  },
  damageTips: {
    onEnter() {
      const tips = `
        <strong>While you wait:</strong>
        <ul>
          <li>Photograph the damage from multiple angles.</li>
          <li>Keep original packaging for the carrier inspection.</li>
          <li>Store items in a dry place to prevent further issues.</li>
        </ul>
      `;
      botSay(tips);
      setQuickReplies([{ label: 'All set', next: 'closing' }]);
    },
  },
  offTopic: {
    onEnter() {
      botSay(
        "I'm here for package problems. Would you like to keep troubleshooting or speak with an agent?"
      );
      setQuickReplies([
        { label: 'Keep troubleshooting', next: 'start' },
        { label: 'Talk to an agent', next: 'agentTransfer' },
      ]);
    },
  },
  agentTransfer: {
    onEnter() {
      botSay(
        'No worries—I am sending this conversation to a human teammate. Someone will join in under 2 minutes.'
      );
      setQuickReplies([{ label: 'Start over', next: 'start' }]);
    },
  },
  closing: {
    onEnter() {
      botSay('Glad I could help! If something else pops up, just start again.');
      setQuickReplies([{ label: 'Restart', next: 'start' }]);
    },
  },
};

function botSay(content) {
  const bubble = document.createElement('div');
  bubble.className = 'message bot typing';
  chatBody.appendChild(bubble);
  scrollToBottom();

  let html = Array.isArray(content) ? content.join('<br />') : content;
  if (typeof html === 'string') {
    html = html.trim();
  }

  typingQueue = typingQueue
    .then(() => typewriterInto(bubble, html))
    .then(() => {
      bubble.classList.remove('typing');
      scrollToBottom();
    });

  return bubble;
}

function userSay(text) {
  const bubble = document.createElement('div');
  bubble.className = 'message user';
  bubble.textContent = text;
  chatBody.appendChild(bubble);
  scrollToBottom();
}

function scrollToBottom() {
  chatBody.scrollTop = chatBody.scrollHeight;
}

function typewriterInto(container, html) {
  container.innerHTML = '';

  const template = document.createElement('template');
  template.innerHTML = html;
  const nodes = normalizeChildren(template.content.childNodes);

  return nodes.reduce(
    (promise, node) => promise.then(() => typeNode(node, container)),
    Promise.resolve()
  );
}

function normalizeChildren(nodeList) {
  return Array.from(nodeList).reduce((accumulator, node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text.trim() === '') {
        if (shouldKeepSpace(node)) {
          node.textContent = ' ';
          accumulator.push(node);
        }
        return accumulator;
      }
      node.textContent = collapseInternalWhitespace(text);
      accumulator.push(node);
      return accumulator;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      accumulator.push(node);
    }

    return accumulator;
  }, []);
}

function collapseInternalWhitespace(text) {
  return text.replace(/\s+/g, (match) => (match.includes('\n') ? ' ' : match));
}

function shouldKeepSpace(node) {
  const previous = findMeaningfulSibling(node, 'previousSibling');
  const next = findMeaningfulSibling(node, 'nextSibling');
  if (previous === null || next === null) {
    return false;
  }
  return isInlineNode(previous) && isInlineNode(next);
}

function findMeaningfulSibling(node, direction) {
  let sibling = node[direction];
  while (sibling) {
    if (sibling.nodeType === Node.TEXT_NODE) {
      if (sibling.textContent && sibling.textContent.trim()) {
        return sibling;
      }
    } else if (sibling.nodeType === Node.ELEMENT_NODE) {
      return sibling;
    }
    sibling = sibling[direction];
  }
  return null;
}

function isInlineNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return true;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }
  return BLOCK_ELEMENTS.has(node.nodeName) === false;
}

function typeNode(node, parent) {
  if (node.nodeType === Node.TEXT_NODE) {
    return typeTextNode(node, parent);
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const clone = node.cloneNode(false);
    parent.appendChild(clone);
    const children = normalizeChildren(node.childNodes);
    return children
      .reduce(
        (promise, child) => promise.then(() => typeNode(child, clone)),
        Promise.resolve()
      )
      .then(() => undefined);
  }

  return Promise.resolve();
}

function typeTextNode(node, parent) {
  const text = node.textContent || '';

  if (text.trim() === '') {
    parent.appendChild(document.createTextNode(text));
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const textNode = document.createTextNode('');
    parent.appendChild(textNode);
    let index = 0;

    const step = () => {
      textNode.textContent += text[index];
      index += 1;
      scrollToBottom();

      if (index < text.length) {
        const char = text[index - 1];
        const isPauseChar = /[.!?,]/.test(char);
        const delay = isPauseChar ? TYPEWRITER_DELAY * 6 : TYPEWRITER_DELAY;
        setTimeout(step, delay);
      } else {
        resolve();
      }
    };

    step();
  });
}

function setQuickReplies(options) {
  quickReplies.innerHTML = '';
  if (!options || options.length === 0) {
    quickReplies.style.display = 'none';
    return;
  }
  quickReplies.style.display = 'flex';
  options.forEach((option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = option.label;
    button.addEventListener('click', () => handleQuickReply(option));
    quickReplies.appendChild(button);
  });
}

function showTextInput({ label, placeholder, hint }) {
  activeInputStep = conversation.step;
  inputLabel.textContent = label || 'Your response';
  userInput.placeholder = placeholder || '';
  userInput.value = '';
  textEntry.hidden = false;
  userInput.focus();
  inputHint.textContent = hint || '';
  setQuickReplies([]);
}

function hideTextInput() {
  activeInputStep = null;
  textEntry.hidden = true;
  userInput.value = '';
  inputHint.textContent = '';
}

function handleQuickReply(option) {
  userSay(option.label);
  const step = steps[conversation.step];
  let next = option.next || null;
  if (step && typeof step.onSelect === 'function') {
    const result = step.onSelect(option) || {};
    if (result.error) {
      botSay(result.error);
      return;
    }
    if (result.stay) {
      next = null;
    }
    if (result.next) {
      next = result.next;
    }
  }
  if (next) {
    advanceTo(next);
  }
}

textEntry.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = userInput.value.trim();
  if (!value) {
    return;
  }
  userSay(value);
  const step = steps[activeInputStep];
  if (!step || typeof step.onInput !== 'function') {
    offTopicFallback();
    return;
  }
  const result = step.onInput(value) || {};
  if (result.stay) {
    userInput.focus();
    return;
  }
  hideTextInput();
  const nextStep = result.next || step.defaultNext;
  if (nextStep) {
    advanceTo(nextStep);
  }
});

function offTopicFallback() {
  botSay(
    "Let's keep things package related. Would you like to resume troubleshooting or talk with an agent?"
  );
  setQuickReplies([
    { label: 'Resume troubleshooting', next: 'start' },
    { label: 'Talk to an agent', next: 'agentTransfer' },
  ]);
}

function advanceTo(stepName) {
  hideTextInput();
  conversation.step = stepName;
  const step = steps[stepName];
  if (!step) {
    console.warn('Missing step', stepName);
    return;
  }
  if (typeof step.onEnter === 'function') {
    setTimeout(() => step.onEnter(), 260);
  }
}

function buildTrackingSummary() {
  const lastScanLocation = pickRandom(locations);
  const status = pickRandom(statusPhrases);
  const now = new Date();
  const hoursAgo = Math.floor(Math.random() * 32) + 2; // 2-33 hours ago
  const lastScanDate = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
  const etaDays = Math.floor(Math.random() * 4) + 1; // 1-4 days from now
  const etaDate = new Date(now.getTime() + etaDays * 24 * 60 * 60 * 1000);
  return {
    status,
    lastScan: `${formatDate(lastScanDate)} · ${lastScanLocation}`,
    eta: formatDate(etaDate),
  };
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).format(date);
}

function generateTicket(prefix) {
  const id = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${id}`;
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

advanceTo('start');
