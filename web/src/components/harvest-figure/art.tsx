import * as React from "react";
import { Dots, FaceText, Line, Solid } from "./kit/draw";
import {
  BASE_ART,
  COIN_ART,
  CRATE_ART,
  DISPENSER_ART,
  DOCK_BELT_ART,
  FARM_BELT_ART,
  FEED_ART,
  ORCHARD_ART,
  PAY_ART,
  POOL_ART,
  PRESS_ART,
  REPAY_ART,
  SCALE_ART,
  SEAL_ART,
  STOP_ART,
  TILL_ART,
  VAULT_ART,
} from "./geometry";
import { HarvestLive } from "./live";

// Static parts, built on the server. Every element prop has a key on its root: on a large
// page React streams some props lazily and would otherwise warn about missing keys.

type Chute = { plate: Parameters<typeof Solid>[0]["paths"]; rails: Parameters<typeof Solid>[0]["paths"][] };
const chute = (c: Chute) => (
  <>
    <Solid paths={c.plate} tone="mid" crease="none" />
    {c.rails.map((paths, i) => (
      <Solid key={i} paths={paths} tone="mid" crease="none" />
    ))}
  </>
);

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
    <Solid paths={BASE_ART.label} tone="lo" crease="none" />
    <Line d={BASE_ART.labelLine} tone="faint" />
    <Line d={BASE_ART.labelRule} tone="lo" free />
    <Dots points={BASE_ART.labelScrews} size={0.45} tone="mid" />
  </g>
);

const ORCHARD = (
  <g key="orchard">
    <path className="iso-halo" d={ORCHARD_ART.halo} />
    <Solid paths={ORCHARD_ART.soil} tone="lo" crease="none" className="hf-soil" />
    <Line d={ORCHARD_ART.furrows} tone="lo" className="hf-furrow" />
    {ORCHARD_ART.boards.map((paths, i) => (
      <Solid key={i} paths={paths} tone="mid" crease="faint" className="hf-wood" />
    ))}
    <Dots points={ORCHARD_ART.stakes} size={0.5} tone="mid" />
    {ORCHARD_ART.seedlings.map((s, i) => (
      <g key={i}>
        <Solid paths={s.stem} tone="mid" crease="none" className="hf-stem-solid" />
        <Solid paths={s.leaves} tone="mid" crease="none" className="hf-leaf" />
      </g>
    ))}
    <Solid paths={ORCHARD_ART.trunkFlare} tone="mid" crease="faint" className="hf-bark" />
    <Solid paths={ORCHARD_ART.trunk} tone="mid" crease="none" className="hf-bark" />
    {ORCHARD_ART.fruit.map((f, i) => (
      <g key={i}>
        <Line d={f.stalk} tone="mid" className="hf-stalk" />
        <Solid paths={f.body} tone="mid" crease="none" className="hf-avocado" />
        <Solid paths={f.top} tone="mid" crease="none" className="hf-avocado hf-avocado-top" />
      </g>
    ))}
    {ORCHARD_ART.canopy.map((paths, i) => (
      <Solid key={i} paths={paths} tone="mid" crease="faint" className="hf-leaf" />
    ))}
  </g>
);

const PAY = (
  <g key="pay">
    <Solid paths={PAY_ART.legFoot} tone="lo" crease="faint" />
    <Solid paths={PAY_ART.leg} tone="mid" crease="faint" />
    {chute(PAY_ART)}
  </g>
);

const TILL = (
  <g key="till">
    <path className="iso-halo" d={TILL_ART.halo} />
    {TILL_ART.feet.map((paths, i) => (
      <Solid key={i} paths={paths} tone="lo" crease="none" />
    ))}
    <Solid paths={TILL_ART.body} tone="hi" crease="faint" inner={<Line d={TILL_ART.seam} tone="faint" />} />
    {TILL_ART.slots.map((paths, i) => (
      <Solid key={i} paths={paths} tone="mid" crease="none" />
    ))}
    <Line d={TILL_ART.slotMouths} tone="hi" />
    <Dots points={TILL_ART.screws} size={0.45} tone="mid" />
    <Solid paths={TILL_ART.badge} tone="mid" crease="none" className="hf-leaf" />
    <Solid paths={PAY_ART.bracket} tone="mid" crease="faint" />
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
    <Solid paths={POOL_ART.hopper} tone="mid" crease="faint" />
    <Line d={POOL_ART.hopperMouth} tone="hi" />
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
    <Solid paths={POOL_ART.pipeFlange} tone="mid" crease="faint" />
    <Solid paths={POOL_ART.pipeSpout} tone="mid" crease="faint" />
    <Solid paths={POOL_ART.pipe} tone="mid" crease="faint" />
    <Solid paths={POOL_ART.pipeLip} tone="mid" crease="faint" />
    <Solid paths={POOL_ART.valveStem} tone="mid" crease="none" />
    <Solid paths={POOL_ART.valveWheel} tone="mid" crease="faint" />
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
    <Solid paths={VAULT_ART.slot} tone="mid" crease="none" />
    <Line d={VAULT_ART.slotMouth} tone="hi" />
    <Line d={VAULT_ART.vents} tone="lo" />
    {VAULT_ART.spouts.map((paths, i) => (
      <Solid key={i} paths={paths} tone="mid" crease="faint" />
    ))}
    <Line d={VAULT_ART.spoutMouths} tone="hi" />
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
    {chute(FEED_ART)}
  </g>
);

const REPAY = <g key="repay">{chute(REPAY_ART)}</g>;

const POST = (
  <g key="post">
    <Solid paths={PRESS_ART.foot} tone="lo" crease="faint" />
    <Dots points={PRESS_ART.footScrews} size={0.45} tone="mid" />
    <Solid paths={PRESS_ART.post} tone="mid" crease="faint" />
    <Line d={PRESS_ART.postTicks} tone="lo" free="end" />
    <Solid paths={PRESS_ART.postCap} tone="mid" crease="faint" />
  </g>
);

const beltBack = (s: typeof FARM_BELT_ART, key: string) => (
  <g key={key}>
    {s.legs.map((paths, i) => (
      <Solid key={i} paths={paths} tone="lo" crease="faint" />
    ))}
    <Solid paths={s.back} tone="mid" crease="faint" />
    <Solid paths={s.belt} tone="lo" crease="none" className="hf-belt" />
    <Line d={s.ribs} tone="lo" className="hf-rib" />
  </g>
);

const beltFront = (s: typeof FARM_BELT_ART, key: string) => (
  <g key={key}>
    <Solid paths={s.front} tone="mid" crease="faint" />
    {s.rollers.map((d, i) => (
      <Line key={i} d={d} tone="lo" />
    ))}
    <Dots points={s.hubs} size={0.6} tone="mid" />
  </g>
);

const BELTS = (
  <g key="belts">
    {beltBack(FARM_BELT_ART, "farm")}
    {beltBack(DOCK_BELT_ART, "dock")}
    <path className="iso-halo" d={SCALE_ART.halo} />
    <Solid paths={SCALE_ART.base} tone="mid" crease="faint" inner={<Line d={SCALE_ART.baseSeam} tone="faint" />} />
    <Solid paths={SCALE_ART.pan} tone="hi" crease="faint" />
    <Line d={SCALE_ART.panGroove} tone="faint" />
    <Solid paths={STOP_ART.plate} tone="mid" crease="faint" />
    <Dots points={STOP_ART.screws} size={0.45} tone="mid" />
  </g>
);

const BELTS_FRONT = (
  <g key="belts-front">
    {beltFront(FARM_BELT_ART, "farm")}
    {beltFront(DOCK_BELT_ART, "dock")}
  </g>
);

const DIAL = (
  <g key="dial">
    <Solid paths={SCALE_ART.neck} tone="mid" crease="faint" />
    <Solid paths={SCALE_ART.box} tone="mid" crease="faint" />
    <Line d={SCALE_ART.face} tone="mid" />
    <Line d={SCALE_ART.faceInner} tone="lo" />
    <Line d={SCALE_ART.ticks} tone="mid" />
  </g>
);

const DIAL_HUB = <Dots key="dial-hub" points={[SCALE_ART.hub]} size={0.9} tone="hi" />;

const CRATE = (
  <g key="crate">
    <path className="iso-halo" d={CRATE_ART.halo} />
    <Solid paths={CRATE_ART.box} tone="mid" crease="faint" className="hf-wood" inner={<Line d={CRATE_ART.slats} tone="lo" />} />
    {CRATE_ART.posts.map((paths, i) => (
      <Solid key={i} paths={paths} tone="mid" crease="faint" className="hf-wood" />
    ))}
    <Line d={CRATE_ART.rim} tone="lo" />
    {CRATE_ART.fruit.map((a, i) => (
      <g key={i}>
        <Solid paths={a.body} tone="mid" crease="none" className="hf-avocado" />
        <Solid paths={a.top} tone="mid" crease="none" className="hf-avocado hf-avocado-top" />
      </g>
    ))}
    <g className="hf-stem">
      {CRATE_ART.fruit.map((a, i) => (
        <circle key={i} cx={a.stem[0]} cy={a.stem[1]} r={0.7} />
      ))}
    </g>
    <Solid paths={CRATE_ART.board} tone="hi" crease="faint" className="hf-wood" />
    <Dots points={CRATE_ART.boardScrews} size={0.45} tone="mid" />
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

const COIN = (
  <g key="coin" className="hf-coin">
    <Solid paths={COIN_ART.body} tone="hi" crease="faint" />
    <Line d={COIN_ART.ring} tone="mid" />
    <FaceText transform={COIN_ART.mark} size={5} tone="hi" anchor="middle">
      $
    </FaceText>
  </g>
);

const LABEL =
  "A farm sale drawn as a bench-top machine with two rows moving in opposite directions. At the back, money: the buyer's dispenser drops USDC coins into an escrow vault whose door counts the money locked; a financing pool tank sends an advance down a pipe into the farmer's till; once the delivery is approved the vault pays the pool back first through a chute into its hopper, then pays the farmer through a second chute. At the front, goods: a crate of avocados leaves the orchard on a conveyor, is weighed on an inspection scale whose dial needle swings, receives the validator's green seal from a press, and rides on to the buyer's end of the belt.";

export function HarvestArt() {
  return (
    <HarvestLive
      label={LABEL}
      base={BASE}
      orchard={ORCHARD}
      pay={PAY}
      till={TILL}
      pool={POOL}
      poolFront={POOL_FRONT}
      pipe={PIPE}
      dispenser={DISPENSER}
      vault={VAULT}
      feed={FEED}
      repay={REPAY}
      post={POST}
      belts={BELTS}
      crate={CRATE}
      seal={SEAL}
      stamp={STAMP}
      arm={ARM}
      beltsFront={BELTS_FRONT}
      dial={DIAL}
      dialHub={DIAL_HUB}
      coin={COIN}
    />
  );
}
