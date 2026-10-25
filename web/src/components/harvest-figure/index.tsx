import { Plate } from "./kit/draw";
import { HarvestArt } from "./art";
import { ADVANCE, PRICE, REPAID } from "./model";
import "./kit/iso.css";
import "./harvest.css";
import { LANDING, type LandingCopy } from "@/lib/landing-copy";

// The landing page's figure: one farm sale on Avocate, drawn as a machine on a bench.
export function HarvestFigure({
  copy = LANDING.en.figure,
  locale = "en",
}: {
  copy?: LandingCopy["figure"];
  locale?: string;
}) {
  const n = (v: number) => v.toLocaleString(locale);
  return (
    <div className="iso hf" data-theme="light">
      <Plate
        fig="Fig 1"
        title={copy.title}
        hint={copy.hint}
        readout={copy.readout}
        keys={[
          { mark: "raised", label: copy.coins },
          { mark: "lit", label: copy.seal },
        ]}
        caption={copy.caption(n(PRICE), n(ADVANCE), n(REPAID))}
      >
        <HarvestArt
          steps={copy.steps(n(PRICE), n(ADVANCE), n(REPAID))}
          paused={copy.paused}
          playing={copy.playing}
        />
      </Plate>
    </div>
  );
}
