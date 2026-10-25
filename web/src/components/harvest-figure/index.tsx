import { Plate } from "./kit/draw";
import { HarvestArt } from "./art";
import { ADVANCE, PRICE, REPAID } from "./model";
import "./kit/iso.css";
import "./harvest.css";

// The landing page's figure: one farm sale on Avocate, drawn as a machine on a bench.
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
        caption={`Money moves along the back, goods along the front. The buyer locks ${PRICE.toLocaleString("en")} USDC in the vault and the pool advances ${ADVANCE.toLocaleString("en")} USDC to the farmer while the crate leaves the orchard. The crate is weighed and sealed by the validator, then the vault repays the pool ${REPAID.toLocaleString("en")} USDC (the advance plus 2%) and pays the farmer the rest.`}
      >
        <HarvestArt />
      </Plate>
    </div>
  );
}
