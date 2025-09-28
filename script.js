// Cache the primary chat DOM nodes once so we avoid repeated lookups.
const chatBody = document.getElementById('chatBody');
const quickReplies = document.getElementById('quickReplies');
const textEntry = document.getElementById('textEntry');
const userInput = document.getElementById('userInput');
const inputLabel = document.getElementById('inputLabel');
const inputHint = document.getElementById('inputHint');

// Central store to remember the current step and any collected answers.
const conversation = {
  step: null,
  data: {},
};

// Track which step is currently collecting free-form input from the user.
let activeInputStep = null;
// Queue used by the typewriter effect so bot messages render sequentially.
let typingQueue = Promise.resolve();
// Snapshot of the quick reply options the UI is showing.
let currentQuickReplies = [];
// Flag indicating whether the text field should treat submissions as quick replies.
let quickReplyTypingEnabled = false;

// Pace the typewriter effect so the bot feels conversational.
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

// State machine that drives the chat flow. Each step defines how to behave
// when entered and how to handle the user's response.
const steps = {
  start: {
    onEnter() {
      botSay("Hi, I'm Boxy! Can I assist you with your lost package today?");
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
      // Strip whitespace because users sometimes paste formatted numbers.
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
      botSay(`Thanks! Got it: ${conversation.data.trackingNumber}.`);
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
          `Status: ${summary.status}`,
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
        'I can start an investigation. When was the package supposed to arrive? (MM/DD/YYYY)'
      );
      showTextInput({
        label: 'Expected delivery date',
        placeholder: '03/22/2024',
        hint: 'Use MM/DD/YYYY and choose a past date.',
      });
    },
    onInput(value) {
      // Remove stray whitespace so validation focuses on the essential text.
      const trimmed = value.trim();
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
        botSay('Please use the MM/DD/YYYY format.');
        inputHint.textContent = 'Example: 03/22/2024';
        return { stay: true };
      }
      const [monthStr, dayStr, yearStr] = trimmed.split('/');
      const month = Number.parseInt(monthStr, 10);
      const day = Number.parseInt(dayStr, 10);
      const year = Number.parseInt(yearStr, 10);
      if (
        Number.isNaN(day) ||
        Number.isNaN(month) ||
        Number.isNaN(year)
      ) {
        botSay('That date does not seem valid. Try again using MM/DD/YYYY.');
        inputHint.textContent = 'Example: 03/22/2024';
        return { stay: true };
      }
      const entered = new Date(year, month - 1, day);
      entered.setHours(0, 0, 0, 0);
      if (
        entered.getFullYear() !== year ||
        entered.getMonth() !== month - 1 ||
        entered.getDate() !== day
      ) {
        botSay('That date does not seem valid. Try again using MM/DD/YYYY.');
        inputHint.textContent = 'Example: 03/22/2024';
        return { stay: true };
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (Number.isNaN(entered.getTime())) {
        botSay('That date does not seem valid. Try again using MM/DD/YYYY.');
        inputHint.textContent = 'Example: 03/22/2024';
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
        `Ticket ${ticket} is open. Our team will review scans and reach out within 24 hours.`
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
        `Claim ${ticket} is submitted. Please hang onto the packaging until our partner reviews photos.`
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
        <p>While you wait:</p>
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

// Render a bot bubble with a typewriter animation for the provided content.
function botSay(content) {
  const bubble = document.createElement('div');
  bubble.className = 'message bot typing';

  const indicator = createTypingIndicator();
  bubble.appendChild(indicator);

  let html = Array.isArray(content) ? content.join('<br />') : content;
  if (typeof html === 'string') {
    html = html.trim();
  }

  typingQueue = typingQueue
    .then(() => {
      chatBody.appendChild(bubble);
      scrollToBottom();
      return wait(320);
    })
    .then(() => {
      return typewriterInto(bubble, html);
    })
    .then(() => {
      bubble.classList.remove('typing');
      scrollToBottom();
    });

  return bubble;
}

// Create a plain user bubble so their answer appears instantly in the chat log.
function userSay(text) {
  const bubble = document.createElement('div');
  bubble.className = 'message user';
  bubble.textContent = text;
  chatBody.appendChild(bubble);
  scrollToBottom();
}

// Ensure the chat window stays scrolled to the latest message.
function scrollToBottom() {
  chatBody.scrollTop = chatBody.scrollHeight;
}

// Apply the typewriter effect into a chat bubble by walking over nodes one at a time.
function typewriterInto(container, html) {
  removeTypingIndicator(container);
  container.innerHTML = '';

  const template = document.createElement('template');
  template.innerHTML = html;
  const nodes = normalizeChildren(template.content.childNodes);

  return nodes.reduce(
    (promise, node) => promise.then(() => typeNode(node, container)),
    Promise.resolve()
  );
}

// Clean up DOM nodes so the typewriter animation has predictable spacing.
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

// Collapse runs of whitespace but keep line breaks so formatted HTML still looks nice.
function collapseInternalWhitespace(text) {
  return text.replace(/\s+/g, (match) => (match.includes('\n') ? ' ' : match));
}

// Decide whether to keep whitespace that sits between inline elements.
function shouldKeepSpace(node) {
  const previous = findMeaningfulSibling(node, 'previousSibling');
  const next = findMeaningfulSibling(node, 'nextSibling');
  if (previous === null || next === null) {
    return false;
  }
  return isInlineNode(previous) && isInlineNode(next);
}

// Walk the DOM until we find the next sibling that contains visible content.
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

// Treat text nodes and inline HTML tags as inline; everything else is block-level.
function isInlineNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return true;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }
  return BLOCK_ELEMENTS.has(node.nodeName) === false;
}

// Type each node recursively so nested markup renders naturally.
function typeNode(node, parent) {
  if (node.nodeType === Node.TEXT_NODE) {
    return typeTextNode(node, parent);
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const clone = node.cloneNode(false);
    parent.appendChild(clone);
    scrollToBottom();
    const children = normalizeChildren(node.childNodes);
    const needsLayoutPause =
      BLOCK_ELEMENTS.has(node.nodeName) || node.nodeName === 'BR';
    const startTyping = () =>
      children
        .reduce(
          (promise, child) => promise.then(() => typeNode(child, clone)),
          Promise.resolve()
        )
        .then(() => undefined);

    if (needsLayoutPause) {
      return nextFrame().then(startTyping);
    }

    return startTyping();
  }

  return Promise.resolve();
}

// Reveal the characters for a text node one by one to achieve the typewriter effect.
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

// Add the animated dots displayed while the bot is "thinking".
function createTypingIndicator() {
  const indicator = document.createElement('div');
  indicator.className = 'typing-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  for (let index = 0; index < 3; index += 1) {
    indicator.appendChild(document.createElement('span'));
  }
  return indicator;
}

// Clean up the temporary typing indicator before inserting final content.
function removeTypingIndicator(container) {
  const indicator = container.querySelector('.typing-indicator');
  if (indicator) {
    indicator.remove();
  }
}

// Render quick reply buttons and optionally enable typed submissions for them.
function setQuickReplies(options) {
  currentQuickReplies = Array.isArray(options) ? options : [];
  quickReplies.innerHTML = '';
  if (currentQuickReplies.length === 0) {
    // Hide the tray entirely when no choices are available.
    quickReplies.style.display = 'none';
    quickReplyTypingEnabled = false;
    if (!activeInputStep) {
      // Reset the input only if nothing else is expecting text.
      textEntry.hidden = true;
      userInput.value = '';
      inputHint.textContent = '';
    }
    return;
  }
  quickReplies.style.display = 'flex';
  currentQuickReplies.forEach((option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = option.label;
    // Clicking should follow the same path as typing, so reuse the handler.
    button.addEventListener('click', () => handleQuickReply(option));
    quickReplies.appendChild(button);
  });
  if (!activeInputStep) {
    // When no text prompt is active, let the input box act as a quick reply catcher.
    quickReplyTypingEnabled = true;
    textEntry.hidden = false;
    inputLabel.textContent = 'Choose an option';
    userInput.placeholder = 'Type an option shown above';
    userInput.value = '';
    inputHint.textContent = 'Type the option text or tap a button.';
  }
}

// Display the text field with contextual hints for the current step.
function showTextInput({ label, placeholder, hint }) {
  activeInputStep = conversation.step;
  inputLabel.textContent = label || 'Your response';
  userInput.placeholder = placeholder || '';
  userInput.value = '';
  textEntry.hidden = false;
  userInput.focus();
  inputHint.textContent = hint || '';
  // Remove any quick replies so the input gets full attention.
  setQuickReplies([]);
}

// Hide the text input and clear helper text until another step needs it.
function hideTextInput() {
  activeInputStep = null;
  if (!quickReplyTypingEnabled) {
    // Only hide the field if nothing else needs it; quick replies may keep it visible.
    textEntry.hidden = true;
  }
  userInput.value = '';
  if (!quickReplyTypingEnabled) {
    // Preserve hints for quick replies so they still guide typed answers.
    inputHint.textContent = '';
  }
}

// Unified entry point for quick replies regardless of typing or clicking.
function handleQuickReply(option) {
  // Mirror the user's selection in the transcript before processing.
  userSay(option.label);
  userInput.value = '';
  processQuickReply(option);
}

// Advance the state machine based on the selected quick reply option.
function processQuickReply(option) {
  // Peek at the current step so we can call its onSelect hook if it exists.
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
    // Prevent typed submissions from triggering while the next step loads.
    quickReplyTypingEnabled = false;
    advanceTo(next);
  }
}

textEntry.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = userInput.value.trim();
  if (!value) {
    return;
  }
  // When the user types during a quick-reply prompt, try to match their text.
  const quickReplyOption =
    !activeInputStep && quickReplyTypingEnabled
      ? findMatchingQuickReply(value)
      : null;
  userSay(value);
  userInput.value = '';
  if (quickReplyOption) {
    processQuickReply(quickReplyOption);
    return;
  }
  // Route text answers to whichever step is currently waiting for input.
  const step = steps[activeInputStep];
  if (!step || typeof step.onInput !== 'function') {
    offTopicFallback();
    return;
  }
  // Let the step validate the answer and tell us what to do next.
  const result = step.onInput(value) || {};
  if (result.stay) {
    // Keep the cursor ready so the user can correct their answer.
    userInput.focus();
    return;
  }
  hideTextInput();
  // Prefer the step's explicit next target, then fall back to its default.
  const nextStep = result.next || step.defaultNext;
  if (nextStep) {
    advanceTo(nextStep);
  }
});

// Gentle reminder when the bot cannot understand typed input outside a prompt.
function offTopicFallback() {
  botSay(
    "Let's keep things package related. Would you like to resume troubleshooting or talk with an agent?"
  );
  setQuickReplies([
    { label: 'Resume troubleshooting', next: 'start' },
    { label: 'Talk to an agent', next: 'agentTransfer' },
  ]);
}

// Move the conversation to another step and invoke its onEnter hook.
function advanceTo(stepName) {
  hideTextInput();
  conversation.step = stepName;
  const step = steps[stepName];
  if (!step) {
    console.warn('Missing step', stepName);
    return;
  }
  if (typeof step.onEnter === 'function') {
    // Delay slightly so the previous message can finish animating.
    setTimeout(() => step.onEnter(), 260);
  }
}

// Match typed text to a quick reply option ignoring case and extra spaces.
function findMatchingQuickReply(text) {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  // Compare the normalized text against both labels and explicit values.
  return currentQuickReplies.find((option) => {
    const labels = [option.label, option.value].filter(
      (item) => typeof item === 'string'
    );
    return labels.some(
      (label) => label.trim().toLowerCase() === normalized
    );
  });
}

// Generate pseudo-random tracking updates so every user sees different details.
function buildTrackingSummary() {
  const lastScanLocation = pickRandom(locations);
  const status = pickRandom(statusPhrases);
  const now = new Date();
  // Randomize how long ago the last scan happened so transcripts feel unique.
  const hoursAgo = Math.floor(Math.random() * 32) + 2; // 2-33 hours ago
  const lastScanDate = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
  // Pick an estimated delivery date a few days out.
  const etaDays = Math.floor(Math.random() * 4) + 1; // 1-4 days from now
  const etaDate = new Date(now.getTime() + etaDays * 24 * 60 * 60 * 1000);
  return {
    status,
    lastScan: `${formatDate(lastScanDate)} · ${lastScanLocation}`,
    eta: formatDate(etaDate),
  };
}

// Format dates into a friendly string with month, day, and time.
function formatDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).format(date);
}

// Build a fake ticket identifier with the provided prefix.
function generateTicket(prefix) {
  const id = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${id}`;
}

// Grab a random element from a list.
function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Promise-based timeout helper used for pacing animations.
function wait(duration) {
  return new Promise((resolve) => {
    // setTimeout provides the asynchronous pause for the typewriter pacing.
    setTimeout(resolve, duration);
  });
}

// Wait for the next animation frame before continuing, allowing layout to settle.
function nextFrame() {
  return new Promise((resolve) => {
    // requestAnimationFrame syncs updates with the browser paint cycle.
    requestAnimationFrame(() => resolve());
  });
}

// Kick off the conversation the moment the script loads.
advanceTo('start');
