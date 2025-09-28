# Boxy Bot

Boxy Bot is a small, front-end only demo that showcases a scripted package-support assistant. The project was built for interview walkthroughs where a realistic conversation flow is more helpful than production-ready integrations.

## What the demo does

- **Guided conversation:** The widget starts by asking what went wrong with a shipment and branches into three focused flows: tracking updates, missing packages, and damaged deliveries.
- **Quick reply buttons:** Most steps use buttons so the user can stay inside the intended decision tree. When text is required (such as tracking numbers, delivery dates, or damage details) the widget temporarily swaps to a text field with inline guidance.
- **Mock logistics data:** Tracking summaries, investigation ticket IDs, and claim IDs are generated on the fly so the flow feels live without any network calls.
- **Off-topic guardrail:** If the conversation wanders away from package support, the bot nudges the user back to the main troubleshooting options or offers a handoff to a human.

All of this logic lives in [`script.js`](./script.js) as a lightweight state machine—each step defines how the bot greets the user, what input it expects, and which step should run next.

## Running the demo

1. Clone or download this repository.
2. Open [`index.html`](./index.html) in any modern browser.
   - You can also serve the folder with any static file server and navigate to the hosted `index.html`.

There is no build process or external dependency; the experience is pure HTML, CSS, and vanilla JavaScript.

## Using the widget

1. Click the quick replies to move through the scripted paths.
2. Provide input when the text field appears:
   - Tracking numbers must be 8–22 alphanumeric characters.
   - Expected delivery dates are entered as `YYYY-MM-DD` and must be in the past.
   - Damage descriptions should include at least ten characters.
3. Choose “Talk to an agent” at any time to trigger the mock handoff response, or “Restart” to begin again from the top.

## Project structure

```
index.html   # Page shell and chat widget markup
style.css    # Layout, typography, and widget styling
script.js    # Conversation state machine and helper utilities
assets/      # Mascot SVGs and other visual assets used by the page
```

## Ideas for further exploration

- Swap the random data helpers for real carrier APIs and event history.
- Expand the decision tree with multi-package handling and richer self-service flows.
- Persist conversations to local storage so the chat history survives a refresh.
- Layer in natural-language intent detection before routing back into the scripted flows.

---

This repository contains a single-page prototype—perfect for showing how a guided support assistant could behave without standing up any backend services.
