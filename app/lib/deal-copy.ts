export const DEAL_SIDE_COPY = {
  BUY: {
    headline: "Maker is buying tokens",
    tone: "Counterparty wires fiat after escrow."
  },
  SELL: {
    headline: "Maker is selling tokens",
    tone: "Taker wires fiat after seeing escrowed funds."
  }
} as const;

export type DealSideVariant = keyof typeof DEAL_SIDE_COPY;

export const getDealSideCopy = (side: DealSideVariant) => DEAL_SIDE_COPY[side];
