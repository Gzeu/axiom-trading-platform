export interface DepthLevel {
  readonly price: number;
  readonly quantity: number;
  readonly cumulative: number;
}

export interface OrderBookSnapshot {
  readonly midPrice: number;
  readonly spread: number;
  readonly bids: readonly DepthLevel[];
  readonly asks: readonly DepthLevel[];
  readonly bidTotalVolume: number;
  readonly askTotalVolume: number;
}

export function buildOrderBook(midPrice: number, decimals: number): OrderBookSnapshot {
  const spread = Number((midPrice * 0.0003).toFixed(decimals));
  const bidLevels: DepthLevel[] = [];
  const askLevels: DepthLevel[] = [];
  let cumulativeBid = 0;
  let cumulativeAsk = 0;

  for (let levelIndex = 0; levelIndex < 20; levelIndex += 1) {
    const bidPrice = Number((midPrice - spread * (levelIndex + 1)).toFixed(decimals));
    const askPrice = Number((midPrice + spread * (levelIndex + 1)).toFixed(decimals));
    const bidQuantity = Number((500 + Math.random() * 2000).toFixed(2));
    const askQuantity = Number((500 + Math.random() * 2000).toFixed(2));

    cumulativeBid += bidQuantity;
    cumulativeAsk += askQuantity;

    bidLevels.push({
      price: bidPrice,
      quantity: bidQuantity,
      cumulative: Number(cumulativeBid.toFixed(2)),
    });
    askLevels.push({
      price: askPrice,
      quantity: askQuantity,
      cumulative: Number(cumulativeAsk.toFixed(2)),
    });
  }

  return {
    midPrice: Number(midPrice.toFixed(decimals)),
    spread,
    bids: bidLevels,
    asks: askLevels,
    bidTotalVolume: Number(cumulativeBid.toFixed(2)),
    askTotalVolume: Number(cumulativeAsk.toFixed(2)),
  };
}
