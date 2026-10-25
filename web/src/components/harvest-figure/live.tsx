"use client";

import * as React from "react";
import { IsoFigure } from "./kit/draw";
import { asksForStillness, useReadout } from "./kit/live";
import { COINS, LOOP, STILL_TIME, counterText, poseAt, type Pose } from "./model";
import { COUNTER_MATRIX } from "./counter";
import { HEIGHT, WIDTH } from "./view";

const MOST_DT = 1 / 30;
const REST = poseAt(STILL_TIME);

interface Props {
  label: string;
  base: React.ReactNode;
  pool: React.ReactNode;
  poolFront: React.ReactNode;
  pipe: React.ReactNode;
  post: React.ReactNode;
  dispenser: React.ReactNode;
  vault: React.ReactNode;
  feed: React.ReactNode;
  seal: React.ReactNode;
  stamp: React.ReactNode;
  arm: React.ReactNode;
  crate: React.ReactNode;
  chute: React.ReactNode;
  coin: React.ReactNode;
}

const translate = ([x, y]: [number, number]) => `translate(${Math.round(x * 100) / 100} ${Math.round(y * 100) / 100})`;

// Buy coins and pay coins are drawn in different slots of the painter's order: the first
// fall onto the vault, the others slide off it towards the crate.
const BUY = [0, 1, 2, 3];
const LEND = [4, 5];
const PAY = [6, 7, 8, 9];

export function HarvestLive(props: Props) {
  const { anchor, say } = useReadout<HTMLDivElement>();
  const coins = React.useRef<(SVGGElement | null)[]>(Array.from({ length: COINS }, () => null));
  const stamp = React.useRef<SVGGElement | null>(null);
  const seal = React.useRef<SVGGElement | null>(null);
  const level = React.useRef<SVGPathElement | null>(null);
  const surface = React.useRef<SVGPathElement | null>(null);
  const counter = React.useRef<SVGTextElement | null>(null);
  const root = React.useRef<HTMLDivElement | null>(null);
  const clock = React.useRef(STILL_TIME);
  const lastStep = React.useRef("");
  const [visible, setVisible] = React.useState(false);
  const [paused, setPaused] = React.useState(false);

  const draw = React.useCallback(
    (pose: Pose) => {
      pose.coins.forEach((coin, i) => {
        const node = coins.current[i];
        if (!node) return;
        node.setAttribute("transform", translate(coin.shift));
        node.style.opacity = `${Math.round(coin.opacity * 100) / 100}`;
      });
      stamp.current?.setAttribute("transform", translate(pose.stamp));
      if (seal.current) seal.current.style.opacity = `${pose.seal}`;
      level.current?.setAttribute("d", pose.level);
      surface.current?.setAttribute("d", pose.surface);
      const text = counterText(pose.locked);
      if (counter.current && counter.current.textContent !== text) counter.current.textContent = text;
      if (pose.step !== lastStep.current) {
        lastStep.current = pose.step;
        say(pose.step);
      }
    },
    [say],
  );

  React.useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => setVisible(Boolean(entries.at(-1)?.isIntersecting)), { rootMargin: "80px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (!visible || paused || asksForStillness()) {
      draw(poseAt(asksForStillness() ? STILL_TIME : clock.current));
      return;
    }
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, MOST_DT) : 1 / 60;
      last = now;
      clock.current = (clock.current + dt) % LOOP;
      draw(poseAt(clock.current));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [visible, paused, draw]);

  const coinSlot = (indices: number[]) =>
    indices.map((i) => (
      <g
        key={`coin-${i}`}
        ref={(node) => {
          coins.current[i] = node;
        }}
        transform={translate(REST.coins[i]!.shift)}
        style={{ opacity: REST.coins[i]!.opacity }}
      >
        {props.coin}
      </g>
    ));

  return (
    <div
      ref={(node) => {
        root.current = node;
        (anchor as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      className="hf-stage"
      role="button"
      tabIndex={0}
      aria-pressed={paused}
      aria-label={paused ? "Animation paused. Press to play the trade again." : "Animation playing. Press to pause it."}
      onClick={() => setPaused((p) => !p)}
      onKeyDown={(event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          setPaused((p) => !p);
        }
      }}
    >
      <IsoFigure width={WIDTH} height={HEIGHT} label={props.label}>
        {props.base}
        {props.pool}
        <path ref={level} className="hf-level" d={REST.level} />
        <path ref={surface} className="iso-line" data-tone="lit" d={REST.surface} />
        {props.poolFront}
        {props.post}
        {props.dispenser}
        {props.vault}
        <text ref={counter} className="hf-counter" transform={COUNTER_MATRIX} fontSize={6.2}>
          {counterText(REST.locked)}
        </text>
        {props.feed}
        {coinSlot(BUY)}
        <g ref={seal} style={{ opacity: REST.seal }}>
          {props.seal}
        </g>
        <g ref={stamp} transform={translate(REST.stamp)}>
          {props.stamp}
        </g>
        {props.arm}
        {props.crate}
        {props.chute}
        {coinSlot(PAY)}
        {props.pipe}
        {coinSlot(LEND)}
      </IsoFigure>
    </div>
  );
}
