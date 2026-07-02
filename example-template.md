# Template: NBA player Over/Under rebounds

Use this example in the arb calculator to see how a real cross-book arb can look. Then replace the odds with live lines from DraftKings, FanDuel, and Polymarket when you hunt for actual bets.

---

## Market

**Example:** *Jalen Johnson — Rebounds O/U 8.5*

- **Outcome A** = Over 8.5 rebounds  
- **Outcome B** = Under 8.5 rebounds  

(You can rename to any player and line, e.g. "Domantas Sabonis O/U 11.5", "Evan Mobley O/U 9.5".)

---

## Example odds (creates a small arb)

| Book        | Over 8.5      | Under 8.5     |
|------------|---------------|---------------|
| DraftKings | +105 (2.05)   | -130 (1.769)  |
| FanDuel    | -115 (1.870)  | +100 (2.00)   |
| Polymarket | .48           | .52           |

**Best line:** Over at Polymarket (.48 → 2.083), Under at FanDuel (+100 → 2.00).  
**Combined implied:** 0.48 + 0.50 = 98% → **arb exists**, ~2% profit.

**For $100 total stake:**  
- Bet **Over 8.5** at **Polymarket**: ~$49 @ .48  
- Bet **Under 8.5** at **FanDuel**: ~$51 @ +100  
- Guaranteed payout ~$102; profit ~$2 (scales with stake).

---

## How to use this as a template

1. **Open the calculator** and click **Load example** to fill this scenario.
2. **Hit Calculate** to see the exact stake split and profit.
3. **When searching for real bets:**
   - Pick a player prop (e.g. Rebounds O/U 8.5) on all three sites.
   - Enter DraftKings and FanDuel in American or decimal; Polymarket in .xx price.
   - Calculate. If you get "Arb found", follow the suggested stakes; if "Not profitable", try another line or wait for lines to move.
4. **Execution:** Bet the **faster-moving book first** (often FanDuel), then the other side. Use round stakes (e.g. $50 / $50) if the exact split is awkward.

---

## Why this format works

- **Same market:** One player, one stat, one line (e.g. 8.5). Over vs Under = two outcomes, so the 3-book arb math applies.
- **Different formats:** DraftKings/FanDuel use American or decimal; Polymarket uses price .xx. The calculator converts everything to the same scale.
- **Realistic spread:** Books often disagree by a few cents on player props, especially after news or late line moves. Small edges (1–3%) are common; larger arbs are rarer and get closed quickly.

Use **Outcome A** = Over and **Outcome B** = Under (or the other way) consistently across all three books when you enter odds.
