import { Plate } from "./kit/draw";
import { HarvestArt } from "./art";
import { PRICE, ADVANCE } from "./model";
import "./kit/iso.css";
import "./harvest.css";

// The landing page's figure: one trade on Avocate, drawn as a machine on a bench.
export function HarvestFigure() {
  return (
    <div className="iso hf" data-theme="light">
      <Plate
        fig="Fig 1"
        title="One harvest, one escrow"
        hint="Click to pause"
        readout="Validator: delivery conforms"
        keys={[
          { mark: "raised", label: "USDC coins" },
          { mark: "lit", label: "The validator's seal" },
        ]}
        caption={`The buyer locks ${PRICE.toLocaleString("en")} USDC in the vault, the pool advances ${ADVANCE} USDC to the farmer, the validator's seal lets the vault pay out, and the pool is repaid from the price.`}
      >
        <HarvestArt />
      </Plate>
    </div>
  );
}
