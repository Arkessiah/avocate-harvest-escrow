import * as React from "react";
import { Dots, FaceText, Line, Solid } from "./kit/draw";
import { BASE_ART, CHUTE_ART, COIN_ART, CRATE_ART, DISPENSER_ART, FEED_ART, POOL_ART, PRESS_ART, SEAL_ART, VAULT_ART } from "./geometry";
import { HarvestLive } from "./live";

// Static parts, built on the server. Every element prop has a key on its root: on a large
// page React streams some props lazily and would otherwise warn about missing keys.

const BASE = (
  <g key="base">
    <path className="iso-halo" d={BASE_ART.halo} />
    {BASE_ART.feet.map((parts, i) => (
      <g key={i}>
        {parts.map((paths, k) => (
          <Solid key={k} paths={paths} tone={k ? "mid" : "lo"} crease="faint" />
        ))}
      </g>
    ))}
    <Solid paths={BASE_ART.slab} tone="mid" crease="faint" />
    <Line d={BASE_ART.groove} tone="lo" />
    <Line d={BASE_ART.screwRings} tone="lo" />
    <Dots points={BASE_ART.screws} size={0.55} tone="mid" />
    <Solid paths={BASE_ART.ruler} tone="lo" crease="none" />
    <Line d={BASE_ART.rulerMinor} tone="lo" />
    <Line d={BASE_ART.rulerMajor} tone="mid" />
    <Dots points={BASE_ART.rulerScrews} size={0.45} tone="mid" />
    <Solid paths={BASE_ART.label} tone="lo" crease="none" />
    <Line d={BASE_ART.labelLine} tone="faint" />
    <Line d={BASE_ART.labelRule} tone="lo" free />
    <Dots points={BASE_ART.labelScrews} size={0.45} tone="mid" />
  </g>
);

const POOL = (
  <g key="pool">
    <path className="iso-halo" d={POOL_ART.plinth.fill} />
    <Solid paths={POOL_ART.plinth} tone="lo" crease="faint" />
    <Dots points={POOL_ART.plinthBolts} size={0.5} tone="mid" />
    <Solid paths={POOL_ART.body} tone="mid" crease="none" inner={<Line d={POOL_ART.bands} tone="faint" />} />
    <Solid paths={POOL_ART.shoulder} tone="mid" crease="faint" />
    <Solid paths={POOL_ART.neck} tone="mid" crease="faint" />
    <Solid paths={POOL_ART.cap} tone="mid" crease="faint" />
    <Line d={POOL_ART.capKnurl} tone="faint" />
    <Solid paths={POOL_ART.glassCaps[0]!} tone="mid" crease="faint" />
    <Solid paths={POOL_ART.glass} tone="lo" crease="none" className="hf-glass" />
  </g>
);

const POOL_FRONT = (
  <g key="pool-front">
    <Solid paths={POOL_ART.glassCaps[1]!} tone="mid" crease="faint" />
    <Line d={POOL_ART.glassTicks} tone="mid" free="end" />
  </g>
);

const PIPE = (
  <g key="pipe">
    <Solid paths={POOL_ART.flange} tone="mid" crease="faint" />
    <Solid paths={POOL_ART.spout} tone="mid" crease="faint" />
    <Solid paths={POOL_ART.pipe} tone="mid" crease="faint" />
    <Solid paths={POOL_ART.pipeLip} tone="mid" crease="faint" />
    <Solid paths={POOL_ART.valveStem} tone="mid" crease="none" />
    <Solid paths={POOL_ART.valveWheel} tone="mid" crease="faint" />
  </g>
);

const POST = (
  <g key="post">
    <Solid paths={PRESS_ART.postFoot} tone="lo" crease="faint" />
    <Dots points={PRESS_ART.postFootScrews} size={0.45} tone="mid" />
    <Solid paths={PRESS_ART.post} tone="mid" crease="faint" />
    <Line d={PRESS_ART.postTicks} tone="lo" free="end" />
  </g>
);

const DISPENSER = (
  <g key="dispenser">
    <path className="iso-halo" d={DISPENSER_ART.foot.fill} />
    <Solid paths={DISPENSER_ART.foot} tone="lo" crease="faint" />
    <Line d={DISPENSER_ART.footRing} tone="faint" />
    <Dots points={DISPENSER_ART.footScrews} size={0.45} tone="mid" />
    <Solid paths={DISPENSER_ART.column} tone="mid" crease="faint" />
    <Solid paths={DISPENSER_ART.collar} tone="mid" crease="faint" />
    <Solid paths={DISPENSER_ART.tube} tone="mid" crease="none" inner={<Line d={DISPENSER_ART.bands} tone="faint" />} />
    <Line d={DISPENSER_ART.slit.frame} tone="lo" />
    <Line d={DISPENSER_ART.slit.coins} tone="mid" />
    <Solid paths={DISPENSER_ART.gate} tone="mid" crease="faint" inner={<Line d={DISPENSER_ART.gateLine} tone="faint" />} />
    <Solid paths={DISPENSER_ART.cap} tone="mid" crease="faint" />
    <Line d={DISPENSER_ART.capKnurl} tone="faint" />
    <Solid paths={DISPENSER_ART.knob} tone="mid" crease="faint" />
  </g>
);

const VAULT = (
  <g key="vault">
    <path className="iso-halo" d={VAULT_ART.plinth.fill} />
    <Solid paths={VAULT_ART.plinth} tone="lo" crease="faint" inner={<Line d={VAULT_ART.plinthSeam} tone="faint" />} />
    <Solid paths={VAULT_ART.body} tone="hi" crease="faint" inner={<Line d={VAULT_ART.bodySeams} tone="faint" />} />
    <Line d={VAULT_ART.topPanel} tone="faint" />
    <Dots points={VAULT_ART.screws} size={0.6} tone="mid" />
    <Line d={VAULT_ART.seat} tone="lo" />
    <Solid paths={VAULT_ART.slot} tone="mid" crease="none" />
    <Line d={VAULT_ART.slotMouth} tone="hi" />
    <Line d={VAULT_ART.vents} tone="lo" />
    <Solid paths={VAULT_ART.spout} tone="mid" crease="faint" />
    <Line d={VAULT_ART.spoutMouth} tone="hi" />
    {VAULT_ART.hinges.map((paths, i) => (
      <Solid key={i} paths={paths} tone="mid" crease="faint" />
    ))}
    <Solid paths={VAULT_ART.door} tone="mid" crease="faint" />
    <Line d={VAULT_ART.doorInset} tone="faint" />
    <Line d={VAULT_ART.dialOuter} tone="mid" />
    <Line d={VAULT_ART.dialInner} tone="lo" />
    <Line d={VAULT_ART.dialTicks} tone="lo" />
    <Line d={VAULT_ART.dialHub} tone="mid" />
    {VAULT_ART.handleStandoffs.map((paths, i) => (
      <Solid key={i} paths={paths} tone="mid" crease="faint" />
    ))}
    <Solid paths={VAULT_ART.handle} tone="mid" crease="faint" />
    <Solid paths={VAULT_ART.window} tone="lo" crease="none" className="hf-window" />
    <Line d={VAULT_ART.windowGlass} tone="faint" />
  </g>
);

const FEED = (
  <g key="feed">
    <Solid paths={FEED_ART.bracket} tone="mid" crease="faint" />
    <Solid paths={FEED_ART.plate} tone="mid" crease="none" />
    {FEED_ART.rails.map((paths, i) => (
      <Solid key={i} paths={paths} tone="mid" crease="none" />
    ))}
  </g>
);

const SEAL = (
  <g key="seal">
    <Solid paths={SEAL_ART.disc} tone="hi" crease="none" className="hf-seal" />
    <path className="hf-seal-mark" d={SEAL_ART.mark} />
  </g>
);

const STAMP = (
  <g key="stamp">
    <Solid paths={PRESS_ART.rod} tone="mid" crease="none" />
    <Solid paths={PRESS_ART.pad} tone="mid" crease="none" />
    <Solid paths={PRESS_ART.head} tone="mid" crease="faint" />
    <Line d={PRESS_ART.headKnurl} tone="faint" />
  </g>
);

const ARM = (
  <g key="arm">
    <Solid paths={PRESS_ART.gland} tone="mid" crease="faint" />
    <Solid paths={PRESS_ART.housing} tone="mid" crease="faint" inner={<Line d={PRESS_ART.housingBand} tone="faint" />} />
    <Solid paths={PRESS_ART.arm} tone="mid" crease="faint" inner={<Line d={PRESS_ART.armLine} tone="faint" />} />
    <Dots points={PRESS_ART.armScrews} size={0.5} tone="mid" />
  </g>
);

const CRATE = (
  <g key="crate">
    <path className="iso-halo" d={CRATE_ART.halo} />
    <Solid paths={CRATE_ART.box} tone="mid" crease="faint" inner={<Line d={CRATE_ART.slats} tone="lo" />} />
    {CRATE_ART.posts.map((paths, i) => (
      <Solid key={i} paths={paths} tone="mid" crease="faint" />
    ))}
    <Line d={CRATE_ART.rim} tone="lo" />
    {CRATE_ART.avocados.map((a, i) => (
      <g key={i}>
        <Solid paths={a.body} tone="mid" crease="none" className="hf-avocado" />
        <Solid paths={a.shoulder} tone="mid" crease="none" className="hf-avocado hf-avocado-top" />
      </g>
    ))}
    <g className="hf-stem">
      {CRATE_ART.avocados.map((a, i) => (
        <circle key={i} cx={a.stem[0]} cy={a.stem[1]} r={0.8} />
      ))}
    </g>
  </g>
);

const CHUTE = (
  <g key="chute">
    <Solid paths={CHUTE_ART.legFoot} tone="lo" crease="faint" />
    <Solid paths={CHUTE_ART.leg} tone="mid" crease="faint" />
    <Solid paths={CHUTE_ART.plate} tone="mid" crease="none" />
    {CHUTE_ART.rails.map((paths, i) => (
      <Solid key={i} paths={paths} tone="mid" crease="none" />
    ))}
  </g>
);

const COIN = (
  <g key="coin" className="hf-coin">
    <Solid paths={COIN_ART.body} tone="hi" crease="faint" />
    <Line d={COIN_ART.ring} tone="mid" />
    <FaceText transform={COIN_ART.mark} size={5.4} tone="hi" anchor="middle">
      $
    </FaceText>
  </g>
);

const LABEL =
  "An escrow for a farm sale drawn as a bench-top machine. On the left the buyer's dispenser drops USDC coins down a chute into a vault, whose door window counts the money locked. Behind the farmer's crate of avocados on the right, a financing pool tank sends an advance down a pipe into the crate. A validator's press above the vault stamps a green seal when the delivery conforms, and the vault then releases the coins down a chute into the crate while the pool is repaid.";

export function HarvestArt() {
  return (
    <HarvestLive
      label={LABEL}
      base={BASE}
      pool={POOL}
      poolFront={POOL_FRONT}
      pipe={PIPE}
      post={POST}
      dispenser={DISPENSER}
      vault={VAULT}
      feed={FEED}
      seal={SEAL}
      stamp={STAMP}
      arm={ARM}
      crate={CRATE}
      chute={CHUTE}
      coin={COIN}
    />
  );
}
