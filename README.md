# Boxy — Lost Package Assistant

A simple chatbot prototype for the **eGain SWE Take‑Home Assignment** designed to help users recover lost packages.

---

## Setup / Installation

### For technical users

```bash
# clone the repo
git clone https://github.com/rmulcahy8/boxy-bot.git
cd boxy-bot

# run by opening index.html in a browser
# or serve locally:
python3 -m http.server 5500
```

Open `http://localhost:5500` in your browser.

### For non-technical users

1. Click the green **Code** button at the top of this repository.
2. Select **Download ZIP**.
3. Extract the ZIP file to a folder on your computer.
4. Open the extracted folder.
5. Double-click `index.html` to open it in your browser.

---

## Approach

* Scenario: **Helping a customer track a lost package**
* Conversation starts with four quick replies:

  * No tracking updates
  * Package seems missing
  * Package arrived damaged
  * Something else
* Each branch validates input, gives clear next steps, and routes to closure or agent handoff.
* Error handling included (tracking number, date, description length).
* Brief instructions are always displayed at the bottom of the chatbot window, guiding the user on what to do next.
* Users can either click one of the suggested quick reply buttons or type their answer directly.

---

## Conversation Flow

Conversation flowchart

```mermaid
flowchart TD
  %% === Start ===
  S([Start: Bot greeting + quick replies])
  S -->|No tracking updates| N1[Collect tracking number]
  S -->|Package missing| M1[Collect expected delivery date]
  S -->|Damaged package| D1[Describe damage]
  S -->|Something else| O1[Reminder: package issues only]

  %% === No tracking updates branch ===
  N1 --> N1V{Valid tracking number?}
  N1V -- No --> N1E[Show guidance + re-prompt]
  N1E --> N1
  N1V -- Yes --> N2[Ask carrier: UPS/USPS/FedEx]
  N2 --> N2V{Valid carrier?}
  N2V -- No --> N2E[Re-prompt carriers]
  N2E --> N2
  N2V -- Yes --> N3[Show status + ETA]
  N3 --> N3A{Enable alerts?}
  N3A -- Yes --> N4[Confirm alerts activated]
  N3A -- No --> H1
  N4 --> H1

  %% === Missing package branch ===
  M1 --> M1V{Valid past date?}
  M1V -- No --> M1E[Re-prompt date format]
  M1E --> M1
  M1V -- Yes --> M2[Investigation opened: INV-XXXXXX]
  M2 --> H1

  %% === Damaged package branch ===
  D1 --> D1V{Description >=10 chars?}
  D1V -- No --> D1E[Re-prompt for detail]
  D1E --> D1
  D1V -- Yes --> D2[Claim filed: CLM-XXXXXX]
  D2 --> D2A{Show care tips?}
  D2A -- Yes --> D3[Care tips given]
  D3 --> C1
  D2A -- No --> C1

  %% === Something else branch ===
  O1 --> O1A{Restart or agent?}
  O1A -- Restart --> S
  O1A -- Agent --> A1

  %% === Shared resolution ===
  H1{Agent transfer or close?}
  H1 -- Agent --> A1[Agent transfer <2 min]
  H1 -- Close --> C1[Closing confirmed]
  A1 --> R1[Restart option]
  R1 --> S
  C1 --> S

```

---

## Example


![Gif didn't load properly.](./boxy.gif)


---

## Error Handling Examples

* **Tracking number too short/invalid:**

  * User: `123`
  * Bot: "Tracking numbers must be 8–22 characters. Please try again."

* **Future delivery date entered:**

  * User: `12/31/2099`
  * Bot: "That date is in the future. Please enter the actual expected delivery date."

---
