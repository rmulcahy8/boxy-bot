// Core DOM references used to render and manage the chat interface.
const chatBody = document.getElementById('chatBody');
const quickReplies = document.getElementById('quickReplies');
const textEntry = document.getElementById('textEntry');
const userInput = document.getElementById('userInput');
const inputLabel = document.getElementById('inputLabel');
const inputHint = document.getElementById('inputHint');

// Shared state for tracking where the user is in the flow and their answers.
const conversation = {
  step: null,
  data: {},
};

// Mutable flags for controlling input visibility and sequential typing.
let activeInputStep = null;
let typingQueue = Promise.resolve();
let currentQuickReplies = [];
let quickReplyTypingEnabled = false;

// Animation timing and DOM layout helpers.
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

// Random facilities used when generating fake tracking scans.
const locations = [
  'Chicago, IL distribution center',
  'Dallas, TX logistics hub',
  'Jersey City, NJ sorting facility',
  'Portland, OR depot',
  'Atlanta, GA air dock',
  'Los Angeles, CA gateway facility',
];

// Generic status messages to make the mock tracking feel authentic.
const statusPhrases = [
  'Package processed and in transit',
  'Parcel arrived at regional facility',
  'Shipment departed local hub',
  'Package scanned - out for next leg',
  'Parcel processed - awaiting departure',
];

// Conversation state machine describing the bot's behavior for each step.
const steps = {
  start: {
    onEnter() {
      // Greet the user and set the initial quick reply choices.
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
      // Switch the UI into text entry mode for the tracking number.
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
      // Remove whitespace and validate the tracking number format.
      const normalized = value.replace(/\s+/g, '');
      if (!/^[A-Za-z0-9]{8,22}$/.test(normalized)) {
        // Provide a hint and keep the user on this step until valid.
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
      // Present carrier options as quick replies for speedy selection.
      botSay('Which carrier is moving this package?');
      setQuickReplies([
        { label: 'UPS', value: 'UPS' },
        { label: 'USPS', value: 'USPS' },
        { label: 'FedEx', value: 'FedEx' },
      ]);
    },
    onSelect(option) {
      // Validate the carrier choice before moving forward.
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
      // Generate a mock tracking summary so the user receives immediate info.
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
      // Confirm the alert setup and offer follow-up actions.
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
      // Collect the promised delivery date to start the investigation flow.
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
      // Remember the expected date so it can be referenced in later steps.
      conversation.data.expectedDate = trimmed;
      botSay(`Thanks, noted ${trimmed}. Starting an investigation ticket now.`);
      return { next: 'investigationOpened' };
    },
  },
  investigationOpened: {
    onEnter() {
      // Create an investigation ticket ID and reassure the user of next steps.
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
      // Switch back to text input to capture a short damage summary.
      botSay('I am so sorry to hear that. Can you describe the damage?');
      showTextInput({
        label: 'Damage description',
        placeholder: 'e.g. Box crushed and item dented',
        hint: 'A short description helps us document the claim.',
      });
    },
    onInput(value) {
      // Encourage the user to provide at least a sentence of detail.
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
      // Provide a claim reference number to the user for follow-up.
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
      // Share practical advice while the claim is reviewed by partners.
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
      // Direct the user back toward supported help paths.
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
      // Let the user know a human teammate will join shortly.
      botSay(
        'No worries—I am sending this conversation to a human teammate. Someone will join in under 2 minutes.'
      );
      setQuickReplies([{ label: 'Start over', next: 'start' }]);
    },
  },
  closing: {
    onEnter() {
      // Offer a friendly goodbye while leaving the door open to restart.
      botSay('Glad I could help! If something else pops up, just start again.');
      setQuickReplies([{ label: 'Restart', next: 'start' }]);
    },
  },
};

function botSay(content) {
  // Render a bot bubble that types out content using the queue animation.
  const bubble = document.createElement('div');
  bubble.className = 'message bot typing';

  // Display animated dots while the message is being prepared.
  const indicator = createTypingIndicator();
  bubble.appendChild(indicator);

  let html = Array.isArray(content) ? content.join('<br />') : content;
  if (typeof html === 'string') {
    html = html.trim();
  }

  // Queue the message so the bot types sequentially even if many responses fire.
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

function userSay(text) {
  // Immediately append a bubble showing the user's submitted text.
  const bubble = document.createElement('div');
  bubble.className = 'message user';
  bubble.textContent = text;
  chatBody.appendChild(bubble);
  scrollToBottom();
}

function scrollToBottom() {
  // Keep the newest message in view.
  chatBody.scrollTop = chatBody.scrollHeight;
}

function typewriterInto(container, html) {
  // Animate the bot's response by typing each node sequentially.
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

function normalizeChildren(nodeList) {
  // Clean up whitespace-only nodes and flatten the node list for typing.
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
  // Replace runs of whitespace with a single space unless it spans a newline.
  return text.replace(/\s+/g, (match) => (match.includes('\n') ? ' ' : match));
}

function shouldKeepSpace(node) {
  // Decide when a blank text node should be preserved as a visible space.
  const previous = findMeaningfulSibling(node, 'previousSibling');
  const next = findMeaningfulSibling(node, 'nextSibling');
  if (previous === null || next === null) {
    return false;
  }
  return isInlineNode(previous) && isInlineNode(next);
}

function findMeaningfulSibling(node, direction) {
  // Traverse siblings to find the next node with visible content.
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
  // Treat text nodes and non-block elements as inline for spacing logic.
  if (node.nodeType === Node.TEXT_NODE) {
    return true;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }
  return BLOCK_ELEMENTS.has(node.nodeName) === false;
}

function typeNode(node, parent) {
  // Recursively animate each node from the template into the chat bubble.
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
    // Block-level elements get a brief pause so the layout can adjust.
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

function typeTextNode(node, parent) {
  // Animate plain text content character by character.
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

function createTypingIndicator() {
  // Build the animated dot indicator shown while the bot is "typing".
  const indicator = document.createElement('div');
  indicator.className = 'typing-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  for (let index = 0; index < 3; index += 1) {
    indicator.appendChild(document.createElement('span'));
  }
  return indicator;
}

function removeTypingIndicator(container) {
  // Remove the placeholder dots once the real message is ready.
  const indicator = container.querySelector('.typing-indicator');
  if (indicator) {
    indicator.remove();
  }
}

function setQuickReplies(options) {
  // Render quick reply buttons and configure the typing fallback behavior.
  currentQuickReplies = Array.isArray(options) ? options : [];
  quickReplies.innerHTML = '';
  if (currentQuickReplies.length === 0) {
    quickReplies.style.display = 'none';
    quickReplyTypingEnabled = false;
    if (!activeInputStep) {
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
    // Clicking a button should behave the same as typing the option.
    button.addEventListener('click', () => handleQuickReply(option));
    quickReplies.appendChild(button);
  });
  if (!activeInputStep) {
    // Show helpful hints so users know they can also type the option text.
    quickReplyTypingEnabled = true;
    textEntry.hidden = false;
    inputLabel.textContent = 'Choose an option';
    userInput.placeholder = 'Type an option shown above';
    userInput.value = '';
    inputHint.textContent = 'Type the option text or tap a button.';
  }
}

function showTextInput({ label, placeholder, hint }) {
  // Display the free-form text input for the current conversation step.
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
  // Reset and optionally hide the text input region.
  activeInputStep = null;
  if (!quickReplyTypingEnabled) {
    textEntry.hidden = true;
  }
  userInput.value = '';
  if (!quickReplyTypingEnabled) {
    inputHint.textContent = '';
  }
}

function handleQuickReply(option) {
  // Treat button taps as if the user typed the label manually.
  userSay(option.label);
  userInput.value = '';
  processQuickReply(option);
}

function processQuickReply(option) {
  // Allow the current step to react to the selection before advancing.
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
    quickReplyTypingEnabled = false;
    advanceTo(next);
  }
}

// Capture form submissions from both quick reply typing and free-form answers.
textEntry.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = userInput.value.trim();
  if (!value) {
    return;
  }
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
  // Provide a neutral prompt when the bot cannot process free-form input.
  botSay(
    "Let's keep things package related. Would you like to resume troubleshooting or talk with an agent?"
  );
  setQuickReplies([
    { label: 'Resume troubleshooting', next: 'start' },
    { label: 'Talk to an agent', next: 'agentTransfer' },
  ]);
}

function advanceTo(stepName) {
  // Move the state machine forward and run the next step's entry hook.
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

function findMatchingQuickReply(text) {
  // Allow keyboard users to trigger quick replies by typing the label text.
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return currentQuickReplies.find((option) => {
    const labels = [option.label, option.value].filter(
      (item) => typeof item === 'string'
    );
    return labels.some(
      (label) => label.trim().toLowerCase() === normalized
    );
  });
}

function buildTrackingSummary() {
  // Craft a realistic-looking tracking update using random data.
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
  // Use Intl.DateTimeFormat for locale-aware timestamps.
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).format(date);
}

function generateTicket(prefix) {
  // Produce a pseudo-random ticket number with a known prefix.
  const id = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${id}`;
}

function pickRandom(list) {
  // Select a random element from an array helper.
  return list[Math.floor(Math.random() * list.length)];
}

function wait(duration) {
  // Simple wrapper around setTimeout that returns a promise.
  return new Promise((resolve) => {
    setTimeout(resolve, duration);
  });
}

function nextFrame() {
  // Resolve on the next animation frame for smoother layout updates.
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

// Start the scripted flow immediately when the page loads.
advanceTo('start');
