# ML Models — AXIOM Trading Platform

## Signal Engine Architecture

### Model Stack

```
Raw OHLCV → Feature Extraction → Regime Classifier → Signal Generator → XAI Explainer
```

### Features Extracted

| Feature | Window | Description |
|---|---|---|
| RSI | 14 | Relative Strength Index |
| ATR | 14 | Average True Range (volatility proxy) |
| VWAP deviation | 20 | Price vs. volume-weighted average |
| Volume z-score | 20 | Anomalous volume detection |
| Momentum | 10 | Rate of price change |
| BB width | 20 | Bollinger Band width (squeeze detector) |

### Regime Classifier (Simulated HMM)

State transitions are governed by a stochastic matrix that updates based on recent price behavior:

```
              BULL   BEAR   RANGING   HIGH_VOL
BULL          0.85   0.05   0.07      0.03
BEAR          0.04   0.83   0.08      0.05
RANGING       0.10   0.10   0.75      0.05
HIGH_VOL      0.15   0.20   0.30      0.35
```

### Signal Types

- `LONG_ENTRY` — regime: BULL + RSI < 60 + momentum positive
- `SHORT_ENTRY` — regime: BEAR + RSI > 40 + momentum negative
- `CLOSE_LONG` — RSI > 75 OR ATR spike > 2σ
- `CLOSE_SHORT` — RSI < 25 OR ATR spike > 2σ
- `HOLD` — regime: RANGING, no edge detected

### XAI Explanation Schema

Every signal includes a structured explanation:

```json
{
  "signal_id": "SIG-0042",
  "type": "LONG_ENTRY",
  "confidence": 0.87,
  "regime": "TRENDING_BULL",
  "primary_driver": "RSI oversold + VWAP reversion",
  "contributing_factors": [
    { "feature": "RSI", "value": 31.2, "weight": 0.38, "direction": "bullish" },
    { "feature": "VWAP_dev", "value": -0.012, "weight": 0.29, "direction": "bullish" },
    { "feature": "Volume_zscore", "value": 1.8, "weight": 0.21, "direction": "bullish" },
    { "feature": "Momentum", "value": 0.003, "weight": 0.12, "direction": "neutral" }
  ],
  "risk_note": "ATR elevated — reduce position size by 20%",
  "model_version": "v2.4.1"
}
```

### Self-Improvement Loop (Simulated)

Every 50 signals, the engine evaluates its last 50 predictions:
- Win rate < 48% → reduce confidence threshold by 5%
- Win rate > 62% → increase position size multiplier by 0.1
- Regime mismatch rate > 20% → trigger regime recalibration
